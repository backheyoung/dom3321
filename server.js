// server.js - YouTube Live Chat → WebSocket → Game Bridge
// 사용법: node server.js [유튜브 라이브 URL 또는 Video ID]
// 예시:   node server.js https://www.youtube.com/watch?v=dQw4w9WgXcQ
//         node server.js dQw4w9WgXcQ

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 1. Express 서버 (게임 파일 서빙) ───
const app = express();
app.use(express.static(__dirname)); // 현재 폴더의 모든 파일 서빙
app.use(express.json());

const server = http.createServer(app);

// ─── 2. WebSocket 서버 (게임에 채팅 전달용) ───
const wss = new WebSocketServer({ server });
const gameClients = new Set();

wss.on('connection', (ws) => {
    gameClients.add(ws);
    console.log(`[WS] 게임 클라이언트 연결됨 (총 ${gameClients.size}개)`);
    ws.on('close', () => {
        gameClients.delete(ws);
        console.log(`[WS] 게임 클라이언트 연결 해제 (총 ${gameClients.size}개)`);
    });
});

function broadcastToGame(data) {
    const msg = JSON.stringify(data);
    gameClients.forEach(ws => {
        if (ws.readyState === 1) ws.send(msg);
    });
}

// ─── 3. YouTube Live Chat 스크래핑 (API 키 불필요!) ───
let pollingActive = false;
let currentVideoId = null;

function extractVideoId(input) {
    if (!input) return null;
    // 이미 Video ID인 경우 (11자)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    // URL에서 추출
    const match = input.match(/(?:v=|live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

async function getInitialChatData(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[YT] 페이지 가져오는 중: ${url}`);
    
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    const html = await res.text();
    
    // innertubeApiKey 추출
    const apiKeyMatch = html.match(/"innertubeApiKey":"([^"]+)"/);
    // continuation token 추출
    const contMatch = html.match(/"continuation":"([^"]+)"/);
    
    if (!apiKeyMatch || !contMatch) {
        // 라이브 채팅이 없는 경우
        console.log('[YT] 라이브 채팅을 찾을 수 없습니다. 현재 라이브 방송 중인 영상인지 확인하세요.');
        return null;
    }
    
    return {
        apiKey: apiKeyMatch[1],
        continuation: contMatch[1]
    };
}

async function pollChat(apiKey, continuation) {
    const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${apiKey}`;
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240101.00.00'
                    }
                },
                continuation: continuation
            })
        });
        
        const data = await res.json();
        
        // 다음 continuation token
        const continuations = data?.continuationContents?.liveChatContinuation?.continuations;
        let nextContinuation = null;
        let pollInterval = 5000; // 기본 5초
        
        if (continuations) {
            for (const c of continuations) {
                if (c.invalidationContinuationData) {
                    nextContinuation = c.invalidationContinuationData.continuation;
                    pollInterval = c.invalidationContinuationData.timeoutMs || 5000;
                } else if (c.timedContinuationData) {
                    nextContinuation = c.timedContinuationData.continuation;
                    pollInterval = c.timedContinuationData.timeoutMs || 5000;
                } else if (c.liveChatReplayContinuationData) {
                    nextContinuation = c.liveChatReplayContinuationData.continuation;
                }
            }
        }
        
        // 채팅 메시지 파싱
        const actions = data?.continuationContents?.liveChatContinuation?.actions || [];
        for (const action of actions) {
            const item = action?.addChatItemAction?.item;
            if (!item) continue;
            
            // 일반 텍스트 메시지
            const textMsg = item.liveChatTextMessageRenderer;
            if (textMsg) {
                const username = textMsg.authorName?.simpleText || 'Unknown';
                const messageRuns = textMsg.message?.runs || [];
                const text = messageRuns.map(r => r.text || r.emoji?.emojiId || '').join('').trim().toLowerCase();
                
                if (text) {
                    processCommand(username, text);
                }
            }
            
            // 멤버십(구독) 메시지
            const memberMsg = item.liveChatMembershipItemRenderer;
            if (memberMsg) {
                const username = memberMsg.authorName?.simpleText || 'Subscriber';
                console.log(`[YT] 구독 감지: ${username}`);
                broadcastToGame({ type: 'command', command: 'subscribe_event', username: username });
            }
            
            // 슈퍼챗 메시지
            const superChat = item.liveChatPaidMessageRenderer;
            if (superChat) {
                const username = superChat.authorName?.simpleText || 'SuperChat';
                console.log(`[YT] 슈퍼챗 감지: ${username}`);
                broadcastToGame({ type: 'command', command: 'subscribe_event', username: username });
            }
        }
        
        return { nextContinuation, pollInterval };
    } catch (e) {
        console.error('[YT] 폴링 오류:', e.message);
        return { nextContinuation: continuation, pollInterval: 10000 };
    }
}

function processCommand(username, text) {
    let command = null;
    
    if (text.includes('warrior') || text.includes('전사')) {
        command = 'warrior';
    } else if (text.includes('archer') || text.includes('궁수')) {
        command = 'archer';
    } else if (text.includes('heal') || text.includes('힐')) {
        command = 'heal';
    } else if (text.includes('!like') || text.includes('!좋아요')) {
        command = 'like_event';
    } else if (text.includes('!sub') || text.includes('!구독')) {
        command = 'subscribe_event';
    }
    
    if (command) {
        console.log(`[YT] 명령어 감지: ${username} → ${command}`);
        broadcastToGame({ type: 'command', command, username });
    }
}

async function startPolling(videoId) {
    console.log(`[YT] Video ID: ${videoId} 채팅 폴링 시작...`);
    pollingActive = true;
    currentVideoId = videoId;
    
    const initial = await getInitialChatData(videoId);
    if (!initial) {
        pollingActive = false;
        return false;
    }
    
    console.log(`[YT] API Key 확보! 채팅 감시 활성화.`);
    
    let continuation = initial.continuation;
    
    while (pollingActive) {
        const result = await pollChat(initial.apiKey, continuation);
        if (result.nextContinuation) {
            continuation = result.nextContinuation;
        }
        // YouTube가 권장하는 간격만큼 대기
        await new Promise(r => setTimeout(r, Math.max(result.pollInterval, 2000)));
    }
    
    return true;
}

// ─── 4. REST API (게임 UI에서 영상 ID 설정용) ───
app.post('/api/connect', async (req, res) => {
    const { videoUrl } = req.body;
    const videoId = extractVideoId(videoUrl);
    
    if (!videoId) {
        return res.json({ success: false, error: 'Invalid YouTube URL or Video ID' });
    }
    
    // 기존 폴링 중지
    pollingActive = false;
    await new Promise(r => setTimeout(r, 1000));
    
    // 새 폴링 시작
    startPolling(videoId);
    res.json({ success: true, videoId });
});

app.get('/api/status', (req, res) => {
    res.json({ polling: pollingActive, videoId: currentVideoId });
});

// ─── 5. 서버 시작 ───
const PORT = 8080;
server.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  ⚔️  STICKMAN LIVE DEFENSE SERVER');
    console.log('═══════════════════════════════════════════════');
    console.log(`  🎮 게임 열기: http://localhost:${PORT}`);
    console.log('  📺 게임 화면에서 유튜브 URL을 입력하세요!');
    console.log('═══════════════════════════════════════════════');
    console.log('');
});

// 커맨드라인에서 바로 Video ID를 넘긴 경우
const videoArg = process.argv[2];
if (videoArg) {
    const vid = extractVideoId(videoArg);
    if (vid) {
        setTimeout(() => startPolling(vid), 1000);
    }
}

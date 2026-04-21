export class ChatService {
    constructor(onCommand) {
        this.onCommand = onCommand;
        this.ws = null;
        this.setupSimulatedChat();
        this.setupWebSocket();
        this.setupYouTubeConnectUI();
    }

    // WebSocket으로 서버에서 유튜브 채팅 수신
    setupWebSocket() {
        const connect = () => {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${location.host}`;
            
            try {
                this.ws = new WebSocket(wsUrl);
            } catch (e) {
                console.log('[ChatService] WebSocket 연결 실패 (서버 없이 실행 중)');
                return;
            }
            
            this.ws.onopen = () => {
                console.log('[ChatService] WebSocket 연결됨!');
                this.addMessage('System', '서버 연결 완료! 유튜브 URL을 연결하세요.', true);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'command') {
                        this.addMessage(data.username, data.command);
                        this.onCommand(data.command, data.username);
                    }
                } catch (e) {
                    console.error('[ChatService] 메시지 파싱 오류:', e);
                }
            };
            
            this.ws.onclose = () => {
                console.log('[ChatService] WebSocket 연결 끊김. 3초 후 재시도...');
                setTimeout(connect, 3000);
            };
            
            this.ws.onerror = () => {
                // 서버 없이 로컬에서 열었을 때 — 무시
            };
        };
        
        connect();
    }

    // 유튜브 URL 연결 UI
    setupYouTubeConnectUI() {
        const connectBtn = document.getElementById('yt-connect-btn');
        const urlInput = document.getElementById('yt-url-input');
        const statusDot = document.getElementById('yt-status-dot');
        const statusText = document.getElementById('yt-status-text');
        
        if (!connectBtn) return; // UI가 없으면 스킵

        connectBtn.addEventListener('click', async () => {
            const videoUrl = urlInput.value.trim();
            if (!videoUrl) return;

            statusDot.style.background = '#ffaa00';
            statusText.textContent = '연결 중...';

            try {
                const res = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl })
                });
                const result = await res.json();
                
                if (result.success) {
                    statusDot.style.background = '#00ff88';
                    statusText.textContent = `연결됨: ${result.videoId}`;
                    this.addMessage('System', `유튜브 라이브 채팅 연결 완료! (${result.videoId})`, true);
                } else {
                    statusDot.style.background = '#ff4444';
                    statusText.textContent = `오류: ${result.error}`;
                }
            } catch (e) {
                statusDot.style.background = '#ff4444';
                statusText.textContent = '서버 연결 실패';
                this.addMessage('System', '서버가 실행 중이 아닙니다. 터미널에서 node server.js 를 실행하세요.', true);
            }
        });

        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') connectBtn.click();
        });
    }

    setupSimulatedChat() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-chat');

        const sendMessage = () => {
            const text = input.value.trim();
            if (!text) return;

            const username = 'You';
            this.addMessage(username, text);
            this.processCommand(text, username);
            input.value = '';
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    addMessage(user, text, isSystem = false) {
        const container = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = isSystem ? 'message system' : 'message';
        
        const userSpan = document.createElement('span');
        userSpan.className = 'user';
        userSpan.textContent = user + ': ';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        textSpan.textContent = text;

        msgDiv.appendChild(userSpan);
        msgDiv.appendChild(textSpan);
        container.appendChild(msgDiv);
        
        // Auto scroll
        container.scrollTop = container.scrollHeight;
        
        // 메시지 100개 넘으면 오래된 것 제거
        while (container.children.length > 100) {
            container.removeChild(container.firstChild);
        }
    }

    processCommand(text, username) {
        const command = text.toLowerCase().trim();
        
        if (command === 'warrior' || command === '전사') {
            this.onCommand('warrior', username);
        } else if (command === 'archer' || command === '궁수') {
             this.onCommand('archer', username);
        } else if (command === 'heal' || command === '힐') {
             this.onCommand('heal', username);
        } else if (command === '!like' || command === '!좋아요') {
             this.onCommand('like_event', username);
        } else if (command === '!sub' || command === '!구독') {
             this.onCommand('subscribe_event', username);
        }
    }
}

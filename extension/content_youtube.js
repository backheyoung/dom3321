// content_youtube.js - 유튜브 페이지에 주입되는 스크립트
// 유튜브 라이브 채팅 DOM을 감시하고 새 메시지를 Background로 전달합니다.

console.log('[Stickman Bridge] 유튜브 채팅 감시 시작...');

const processedIds = new Set(); // 이미 처리된 메시지 ID 중복 방지

function extractAndSendMessage(element) {
    try {
        // 메시지 ID (중복 방지용)
        const msgId = element.getAttribute('id') || element.getAttribute('data-item-id');
        if (msgId && processedIds.has(msgId)) return;
        if (msgId) processedIds.add(msgId);

        // 닉네임 추출 (여러 선택자 시도)
        const authorEl =
            element.querySelector('#author-name') ||
            element.querySelector('.yt-live-chat-author-chip') ||
            element.querySelector('[class*="author"]');
        
        // 메시지 내용 추출
        const messageEl =
            element.querySelector('#message') ||
            element.querySelector('[class*="message"]');

        if (!authorEl || !messageEl) return;

        const username = authorEl.textContent.trim();
        const text = messageEl.textContent.trim().toLowerCase();

        if (!username || !text) return;

        // Custom Chat Commands (Forgiving match)
        if (text.includes('warrior')) {
            console.log(`[Stickman Bridge] 명령어 감지: ${username} → warrior`);
            chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'warrior' });
        } else if (text.includes('archer')) {
            console.log(`[Stickman Bridge] 명령어 감지: ${username} → archer`);
            chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'archer' });
        } else if (text.includes('heal')) {
            console.log(`[Stickman Bridge] 명령어 감지: ${username} → heal`);
            chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'heal' });
        } else if (text.includes('!like') || text.includes('!좋아요')) {
            console.log(`[Stickman Bridge] 좋아요 명령어 감지: ${username}`);
            chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'like_event' });
        } else if (text.includes('!sub') || text.includes('!구독')) {
            console.log(`[Stickman Bridge] 구독 명령어 감지: ${username}`);
            chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'subscribe_event' });
        }
        
        // System Message Parsing (for Subscriptions)
        if (element.tagName && element.tagName.toLowerCase().includes('membership-item')) {
             console.log(`[Stickman Bridge] 멤버십/구독 감지: ${username}`);
             chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'subscribe_event' });
        }
        if (text.includes('구독') || text.includes('subscribed') || text.includes('member')) {
            // Check if it's a system message
            if (element.id === 'purchase-amount' || element.classList.contains('yt-live-chat-membership-item-renderer')) {
                 console.log(`[Stickman Bridge] 시스템 구독 감지: ${username}`);
                 chrome.runtime.sendMessage({ type: 'YOUTUBE_CHAT', username: username, text: 'subscribe_event' });
            }
        }
    } catch (e) {
        // 파싱 실패는 무시
    }
}

function startObserving() {
    // 유튜브 라이브 채팅 컨테이너 (여러 버전 대응)
    const chatContainer =
        document.querySelector('#chat-messages') ||           // embed chat
        document.querySelector('yt-live-chat-item-list-renderer #items') ||
        document.querySelector('#items.yt-live-chat-item-list-renderer');

    if (!chatContainer) {
        // 아직 채팅이 로드되지 않음 — 재시도
        console.log('[Stickman Bridge] 채팅창 로딩 대기 중...');
        setTimeout(startObserving, 2000);
        return;
    }

    console.log('[Stickman Bridge] 채팅창 발견! 감시 시작.');

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                // 새로 추가된 메시지 요소 처리
                if (node.tagName && node.tagName.toLowerCase().includes('text-message')) {
                    extractAndSendMessage(node);
                }
                // 자식 중에 메시지가 있는 경우
                node.querySelectorAll('yt-live-chat-text-message-renderer').forEach(el => {
                    extractAndSendMessage(el);
                });
            });
        });
    });

    observer.observe(chatContainer, { childList: true, subtree: true });
}

// DOM이 준비되면 시작
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
} else {
    startObserving();
}

// background.js - 메시지 중계 역할
// YouTube 탭 콘텐츠 스크립트로부터 채팅 메시지를 받아서
// 게임이 열린 localhost 탭으로 전달합니다.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'YOUTUBE_CHAT') {
        // 게임 탭을 찾아서 메시지 전달 (localhost, 127.0.0.1, 또는 file://)
        chrome.tabs.query({}, (tabs) => {
            const gameTabs = tabs.filter(t => t.url && (t.url.includes('localhost') || t.url.includes('127.0.0.1') || t.url.includes('file://')));
            if (gameTabs.length === 0) {
                console.log('[Bridge] 게임 탭을 찾을 수 없습니다. 게임을 실행하세요.');
                return;
            }
            gameTabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'CHAT_COMMAND',
                    username: message.username,
                    text: message.text
                });
            });
        });
    }
});

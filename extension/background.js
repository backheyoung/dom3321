// background.js - 메시지 중계 역할
// YouTube 탭 콘텐츠 스크립트로부터 채팅 메시지를 받아서
// 게임이 열린 localhost 탭으로 전달합니다.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'YOUTUBE_CHAT') {
        // 모든 탭에 브로드캐스트 (content_game.js가 주입된 탭만 응답함)
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'CHAT_COMMAND',
                    username: message.username,
                    text: message.text
                }).catch(() => {}); // content script가 없는 탭의 에러는 무시
            });
        });
    }
});

// content_game.js - localhost 게임 페이지에 주입되는 스크립트
// Background로부터 채팅 명령어를 받아서 게임에 CustomEvent로 전달합니다.

console.log('[Stickman Bridge] 게임 채팅 브릿지 활성화!');

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'CHAT_COMMAND') {
        console.log(`[Stickman Bridge] 게임에 전달: ${message.username} → ${message.text}`);

        // 게임의 chatService.js가 감지할 수 있는 CustomEvent 발행
        window.dispatchEvent(new CustomEvent('youtube_chat_command', {
            detail: {
                username: message.username,
                text: message.text
            }
        }));
    }
});

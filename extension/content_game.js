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
        
        // 화면에 임시 토스트 알림 띄우기 (디버깅 용도)
        let toast = document.createElement('div');
        toast.textContent = `[Bridge] ${message.username}: ${message.text}`;
        toast.style.cssText = "position:fixed; top:10px; right:10px; background:rgba(0,255,0,0.8); color:black; padding:5px 10px; border-radius:5px; z-index:9999; font-size:12px; pointer-events:none; transition: opacity 0.5s;";
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
    }
});

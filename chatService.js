export class ChatService {
    constructor(onCommand) {
        this.onCommand = onCommand;
        this.setupSimulatedChat();
        this.setupYouTubeBridge();
    }

    // 크롬 확장에서 오는 유튜브 채팅 이벤트 수신
    setupYouTubeBridge() {
        window.addEventListener('youtube_chat_command', (e) => {
            const { username, text } = e.detail;
            this.addMessage(username, text);
            this.processCommand(text, username);
        });
        console.log('[ChatService] 유튜브 채팅 브릿지 대기 중...');
    }

    setupSimulatedChat() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-chat');
        const messagesContainer = document.getElementById('chat-messages');

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

    addMessage(user, text) {
        const container = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        
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
    }

    processCommand(text, username) {
        const command = text.toLowerCase().trim();
        
        if (command === 'warrior') {
            this.onCommand('warrior', username);
        } else if (command === 'archer') {
             this.onCommand('archer', username);
        } else if (command === 'heal') {
             this.onCommand('heal', username);
        }
    }

    // Future method for real YouTube API integration
    connectToYouTube(videoId) {
        console.log(`Connecting to YouTube Live Chat for video: ${videoId}`);
        // Implementation for YouTube Data API v3 would go here
    }
}

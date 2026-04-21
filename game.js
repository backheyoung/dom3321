// ChatService - 유튜브 채팅 연동
class ChatService {
    constructor(onCommand) {
        this.onCommand = onCommand;
        this.ws = null;
        this.setupSimulatedChat();
        this.setupWebSocket();
        this.setupYouTubeConnectUI();
    }

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
                } catch (e) { console.error('[ChatService] 메시지 파싱 오류:', e); }
            };
            this.ws.onclose = () => { setTimeout(connect, 3000); };
            this.ws.onerror = () => {};
        };
        connect();
    }

    setupYouTubeConnectUI() {
        const connectBtn = document.getElementById('yt-connect-btn');
        const urlInput = document.getElementById('yt-url-input');
        const statusDot = document.getElementById('yt-status-dot');
        const statusText = document.getElementById('yt-status-text');
        if (!connectBtn) return;
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
                statusText.textContent = '서버 없이 실행 중 (채팅창 직접 입력)';
            }
        });
        urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') connectBtn.click(); });
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
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
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
        container.scrollTop = container.scrollHeight;
        while (container.children.length > 100) container.removeChild(container.firstChild);
    }

    processCommand(text, username) {
        const command = text.toLowerCase().trim();
        if (command === 'warrior') {
            this.onCommand('warrior', username);
        } else if (command === 'archer') {
            this.onCommand('archer', username);
        } else if (command === 'defender') {
            this.onCommand('defender', username);
        } else if (command === 'mage') {
            this.onCommand('mage', username);
        } else if (command === 'heal') {
            this.onCommand('heal', username);
        } else if (command === '!like' || command === '!좋아요') {
            this.onCommand('like_event', username);
        } else if (command === '!sub' || command === '!구독') {
            this.onCommand('subscribe_event', username);
        }
    }
}


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Initial Canvas Size Setup
canvas.width = 800;
canvas.height = 600;

document.addEventListener('DOMContentLoaded', () => {
    const applyBtn = document.getElementById('apply-map-size');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const w = parseInt(document.getElementById('map-width-input').value);
            const h = parseInt(document.getElementById('map-height-input').value);
            if (w >= 400 && h >= 400) {
                canvas.width = w;
                canvas.height = h;
            }
        });
    }
});

// Game Constants
const COLORS = {
    cyan: '#0055ff', 
    red: '#ff2222',
    white: '#ffffff',
    bg: '#f5f5f5',
    yellow: '#ffa500',
    green: '#00cc44',
    line: '#333333',
    grid: '#e0e0e0',
    stone: '#aaaaaa'
};

// State
let warriors = [];
let enemies = [];
let particles = [];
let projectiles = [];
let floatingTexts = [];
let coreHealth = 100;
let coreMaxHealth = 1000;
let castleRegenPerSec = 0;  // HP regen per second
let score = 0;
let isGameOver = false;
let frameCount = 0;
let restartInterval = null;
let castleAttackCooldown = 0;
let currentDay = 1;
let dayTimer = 60 * 60; // 60 seconds at 60 FPS
let spawnBaseInterval = 120; // Base enemy spawn interval (frames) at Day 1
let spawnMinClamp = 30;      // Minimum spawn interval regardless of day
let persistentMaxHpBonus = 0;
let userKills = {};

// Global Game Settings
const GAME_SETTINGS = {
    ally: { heroChance: 0.10, legendaryChance: 0.05, mythChance: 0.01 }, 
    heroMultipliers: { hp: 3.0, dmg: 2.0, speed: 1.2, atkSpeed: 0.7 }, 
    legendaryMultipliers: { hp: 10.0, dmg: 5.0, speed: 1.5, atkSpeed: 0.5 },
    mythMultipliers: { hp: 30.0, dmg: 15.0, speed: 2.0, atkSpeed: 0.3 },
    units: {
        warrior:  { hp: 100, speed: 1.5, dmg: 25, atkCooldown: 30 },
        archer:   { hp: 80,  speed: 1.2, dmg: 15, atkCooldown: 40 },
        defender: { hp: 300, speed: 0.9, dmg: 8,  atkCooldown: 60 },
        mage:     { hp: 60,  speed: 1.0, dmg: 50, atkCooldown: 90 },
        enemy:   { hp: 60,  speed: 0.8, dmg: 15, atkCooldown: 60, spawnWeight: 70 },
        brute:   { hp: 250, speed: 0.6, dmg: 40, atkCooldown: 80, spawnWeight: 30 },
        enemyArcher: { hp: 45, speed: 0.9, dmg: 12, atkCooldown: 50, spawnWeight: 20 },
        assassin: { hp: 120, speed: 1.8, dmg: 35, atkCooldown: 40, spawnWeight: 10 },
        giant: { hp: 1000, speed: 0.4, dmg: 80, atkCooldown: 120, spawnWeight: 0 },
        necromancer: { hp: 150, speed: 0.7, dmg: 30, atkCooldown: 70, spawnWeight: 0 },
        ninja: { hp: 100, speed: 2.2, dmg: 45, atkCooldown: 30, spawnWeight: 0 },
        armoredBrute: { hp: 800, speed: 0.5, dmg: 50, atkCooldown: 90, spawnWeight: 0 },
        berserker: { hp: 300, speed: 1.4, dmg: 60, atkCooldown: 40, spawnWeight: 0 },
        golem: { hp: 1500, speed: 0.3, dmg: 100, atkCooldown: 150, spawnWeight: 0 },
        warlock: { hp: 250, speed: 0.8, dmg: 70, atkCooldown: 60, spawnWeight: 0 },
        shadow: { hp: 400, speed: 2.5, dmg: 80, atkCooldown: 25, spawnWeight: 0 },
        titan: { hp: 3000, speed: 0.4, dmg: 150, atkCooldown: 100, spawnWeight: 0 },
        eliteKnight: { hp: 1200, speed: 1.0, dmg: 100, atkCooldown: 50, spawnWeight: 0 },
        bossDemon: { hp: 5000, speed: 0.8, dmg: 200, atkCooldown: 60, spawnWeight: 0 }
    },
    spawnTimer: { minFrames: 30, maxFrames: 120 }
};

// Expose to window so UI can edit it
window.GAME_SETTINGS = GAME_SETTINGS;

// Settings UI Binding
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
});
document.getElementById('close-settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
});

// Tab Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class from all
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
        
        // Add active to clicked
        e.target.classList.add('active');
        const tabId = e.target.getAttribute('data-tab');
        document.getElementById(tabId).classList.remove('hidden');
    });
});

function bindSetting(inputId, obj, key, isFloat = false, multiplier = 1) {
    const input = document.getElementById(inputId);
    input.value = obj[key] * multiplier;
    input.addEventListener('change', (e) => {
        let val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
        obj[key] = val / multiplier;
    });
}

// Global & Hero & Legendary
bindSetting('set-hero-chance', GAME_SETTINGS.ally, 'heroChance', true, 100);
bindSetting('set-hero-hp-mult', GAME_SETTINGS.heroMultipliers, 'hp', true);
bindSetting('set-hero-dmg-mult', GAME_SETTINGS.heroMultipliers, 'dmg', true);
bindSetting('set-hero-speed-mult', GAME_SETTINGS.heroMultipliers, 'speed', true);
bindSetting('set-hero-atk-mult', GAME_SETTINGS.heroMultipliers, 'atkSpeed', true);
bindSetting('set-leg-hp-mult', GAME_SETTINGS.legendaryMultipliers, 'hp', true);
bindSetting('set-leg-dmg-mult', GAME_SETTINGS.legendaryMultipliers, 'dmg', true);
bindSetting('set-leg-speed-mult', GAME_SETTINGS.legendaryMultipliers, 'speed', true);
bindSetting('set-leg-atk-mult', GAME_SETTINGS.legendaryMultipliers, 'atkSpeed', true);

// Spawn interval settings
const spawnIntervalInput = document.getElementById('set-spawn-interval');
spawnIntervalInput.value = spawnBaseInterval;
spawnIntervalInput.addEventListener('change', e => { spawnBaseInterval = Math.max(5, parseInt(e.target.value)); });

const spawnMinClampInput = document.getElementById('set-spawn-min-clamp');
spawnMinClampInput.value = spawnMinClamp;
spawnMinClampInput.addEventListener('change', e => { spawnMinClamp = Math.max(1, parseInt(e.target.value)); });

// Castle settings
const castleMaxHpInput = document.getElementById('set-castle-maxhp');
castleMaxHpInput.value = coreMaxHealth;
castleMaxHpInput.addEventListener('change', e => {
    const newMax = Math.max(1, parseInt(e.target.value));
    coreMaxHealth = newMax;
    coreHealth = Math.min(coreHealth, coreMaxHealth);
    updateUI();
});

const castleRegenInput = document.getElementById('set-castle-regen');
castleRegenInput.value = castleRegenPerSec;
castleRegenInput.addEventListener('change', e => { castleRegenPerSec = Math.max(0, parseFloat(e.target.value)); });

// Warrior
bindSetting('set-warrior-hp', GAME_SETTINGS.units.warrior, 'hp');
bindSetting('set-warrior-dmg', GAME_SETTINGS.units.warrior, 'dmg');
bindSetting('set-warrior-speed', GAME_SETTINGS.units.warrior, 'speed', true);
bindSetting('set-warrior-atk', GAME_SETTINGS.units.warrior, 'atkCooldown');

// Archer
bindSetting('set-archer-hp', GAME_SETTINGS.units.archer, 'hp');
bindSetting('set-archer-dmg', GAME_SETTINGS.units.archer, 'dmg');
bindSetting('set-archer-speed', GAME_SETTINGS.units.archer, 'speed', true);
bindSetting('set-archer-atk', GAME_SETTINGS.units.archer, 'atkCooldown');

// Enemy
bindSetting('set-enemy-hp', GAME_SETTINGS.units.enemy, 'hp');
bindSetting('set-enemy-dmg', GAME_SETTINGS.units.enemy, 'dmg');
bindSetting('set-enemy-speed', GAME_SETTINGS.units.enemy, 'speed', true);
bindSetting('set-enemy-atk', GAME_SETTINGS.units.enemy, 'atkCooldown');
bindSetting('set-enemy-weight', GAME_SETTINGS.units.enemy, 'spawnWeight');

// Brute
bindSetting('set-brute-hp', GAME_SETTINGS.units.brute, 'hp');
bindSetting('set-brute-dmg', GAME_SETTINGS.units.brute, 'dmg');
bindSetting('set-brute-speed', GAME_SETTINGS.units.brute, 'speed', true);
bindSetting('set-brute-atk', GAME_SETTINGS.units.brute, 'atkCooldown');
bindSetting('set-brute-weight', GAME_SETTINGS.units.brute, 'spawnWeight');

// Enemy Archer
bindSetting('set-earc-hp', GAME_SETTINGS.units.enemyArcher, 'hp');
bindSetting('set-earc-dmg', GAME_SETTINGS.units.enemyArcher, 'dmg');
bindSetting('set-earc-speed', GAME_SETTINGS.units.enemyArcher, 'speed', true);
bindSetting('set-earc-atk', GAME_SETTINGS.units.enemyArcher, 'atkCooldown');
bindSetting('set-earc-weight', GAME_SETTINGS.units.enemyArcher, 'spawnWeight');

// Map Sizing & Zoom
function setMapSize(w, h) {
    canvas.width = w;
    canvas.height = h;
}

// Initial size
setMapSize(800, 600);

document.getElementById('apply-map-size').addEventListener('click', () => {
    const newW = parseInt(document.getElementById('map-width-input').value);
    const newH = parseInt(document.getElementById('map-height-input').value);
    if (newW >= 400 && newH >= 400 && newW <= 3000 && newH <= 3000) {
        setMapSize(newW, newH);
    }
});

let zoomLevel = 1.0;
const canvasWrapper = document.getElementById('canvas-wrapper');
canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomLevel += e.deltaY < 0 ? 0.1 : -0.1;
    zoomLevel = Math.max(0.3, Math.min(zoomLevel, 3.0));
    canvasWrapper.style.transform = `translate(-50%, -50%) scale(${zoomLevel})`;
}, { passive: false });

// --- Sound System ---
class SoundSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        document.addEventListener('click', () => {
            if (this.ctx.state === 'suspended') this.ctx.resume();
        }, { once: true });
    }
    
    playTone(freq, type, duration, vol) {
        if (!this.enabled || this.ctx.state !== 'running') return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playHit() { this.playTone(150, 'square', 0.1, 0.1); }
    playShoot() { this.playTone(600, 'sine', 0.1, 0.05); }
    playExplosion() { this.playTone(100, 'sawtooth', 0.3, 0.1); }
    playHeal() { this.playTone(800, 'sine', 0.4, 0.1); this.playTone(1200, 'sine', 0.4, 0.1); }
    playCastleHit() { this.playTone(80, 'sawtooth', 0.5, 0.2); }
}

const sounds = new SoundSystem();

// --- Utility Classes ---

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -1;
    }
    update(dt = 1) {
        this.y += this.vy * dt;
        this.life -= 0.02 * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, target, color, ownerUsername = null) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.color = color;
        this.ownerUsername = ownerUsername;
        this.speed = 5;
        this.dead = false;
    }
    update(dt = 1) {
        if (!this.target || this.target.dead) {
            this.dead = true;
            return;
        }
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 15) {
            const dmg = this.damage || 15;
            if (this.isEnemyProjectile && this.target.isCastle) {
                coreHealth -= dmg;
                sounds.playCastleHit();
                spawnExplosion(this.target.x, this.target.y, this.color);
                floatingTexts.push(new FloatingText(this.target.x, this.target.y - 20, `-${dmg} Castle`, this.color));
                updateUI();
                if (coreHealth <= 0) gameOver();
            } else {
                this.target.health -= dmg;
                this.target.lastHitter = this.ownerUsername; // Track who shot this
                sounds.playHit();
                spawnExplosion(this.target.x, this.target.y, this.color);
                floatingTexts.push(new FloatingText(this.target.x, this.target.y - 20, `-${dmg}`, this.color));
            }
            this.dead = true;
        } else {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }
    draw(ctx) {
        // Draw an arrow pointing towards target
        let dx = 1, dy = 0;
        if (this.target && !this.target.dead) {
            dx = this.target.x - this.x;
            dy = this.target.y - this.y;
        }
        const angle = Math.atan2(dy, dx);
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        
        // Arrow shaft
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        
        // Arrow head
        ctx.fillStyle = '#aaaaaa';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(2, -3);
        ctx.lineTo(2, 3);
        ctx.fill();
        
        // Arrow fletching (feathers)
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-9, -3);
        ctx.moveTo(-6, 0);
        ctx.lineTo(-9, 3);
        ctx.stroke();
        
        ctx.restore();
    }
}


class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
    }

    update(dt = 1) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Stickman {
    constructor(x, y, color, type = 'warrior', tier = 'normal', username = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.tier = tier; // 'normal', 'hero', 'legendary', 'myth'
        this.username = username;
        
        const stats = GAME_SETTINGS.units[type];
        let baseSize = 20;
        if (['brute', 'armoredBrute', 'berserker', 'eliteKnight', 'defender'].includes(type)) baseSize = 26;
        if (['giant', 'golem', 'titan', 'bossDemon'].includes(type)) baseSize = 35;
        this.size = baseSize;
        this.speed = stats.speed;
        this.health = stats.hp;
        
        if (this.tier === 'hero') {
            this.size *= 1.3;
            this.speed *= GAME_SETTINGS.heroMultipliers.speed;
            this.health *= GAME_SETTINGS.heroMultipliers.hp;
        } else if (this.tier === 'legendary') {
            this.size *= 1.8;
            this.speed *= GAME_SETTINGS.legendaryMultipliers.speed;
            this.health *= GAME_SETTINGS.legendaryMultipliers.hp;
        } else if (this.tier === 'myth') {
            this.size *= 2.2;
            this.speed *= GAME_SETTINGS.mythMultipliers.speed;
            this.health *= GAME_SETTINGS.mythMultipliers.hp;
        }
        
        this.maxHealth = this.health;
        
        this.target = null;
        this.patrolTarget = null;
        this.patrolWait = 0;
        this.walkCycle = 0;
        this.attackCooldown = 0;
        this.dead = false;
    }

    draw(ctx) {
        const { x, y, size, color, walkCycle, type } = this;
        
        // Determine facing direction
        let targetX = canvas.width / 2;
        if (this.target && !this.target.dead) {
            targetX = this.target.x;
        } else if (this.patrolTarget) {
            targetX = this.patrolTarget.x;
        } else {
            targetX = x + (x - canvas.width / 2); // face outwards
        }
        const dir = (targetX > x) ? 1 : -1;

        ctx.save();
        if (this.tier === 'myth') {
            ctx.strokeStyle = '#00ffff'; // Cyan
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 18;
        } else if (this.tier === 'legendary') {
            ctx.strokeStyle = '#a200ff'; // Purple
            ctx.shadowColor = '#ff00ff'; // Magenta glow
            ctx.shadowBlur = 10;
        } else if (this.tier === 'hero') {
            ctx.strokeStyle = '#ffd700'; // Gold
            ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = this.color;
            ctx.shadowBlur = 0;
        }
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Legs
        const legWave = Math.sin(walkCycle) * 15;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.lineTo(x - size * 0.4 * dir, y + size + legWave);
        ctx.moveTo(x, y + size * 0.3);
        ctx.lineTo(x + size * 0.4 * dir, y + size - legWave);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.7);
        ctx.lineTo(x, y + size * 0.3);
        ctx.stroke();

        // Back Arm (Left if facing right, Right if facing left)
        const armWave = Math.sin(walkCycle) * 10;
        const backHandX = x - size * 0.5 * dir;
        const backHandY = y - size * 0.2 + armWave;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.5);
        ctx.lineTo(backHandX, backHandY);
        ctx.stroke();

        // Head
        ctx.beginPath();
        ctx.fillStyle = COLORS.bg;
        ctx.arc(x, y - size, size / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        if (type === 'warrior') {
            // Knight Visor
            ctx.strokeStyle = '#555555';
            ctx.beginPath();
            ctx.moveTo(x, y - size - 2);
            ctx.lineTo(x + (size/3) * dir, y - size - 2);
            ctx.stroke();
        } else if (type === 'defender') {
            // Defender Helmet (full face)
            ctx.strokeStyle = '#888888';
            ctx.fillStyle = '#aaaaaa';
            ctx.beginPath();
            ctx.arc(x, y - size, size / 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (type === 'mage') {
            // Wizard Hat
            ctx.fillStyle = '#220044';
            ctx.strokeStyle = '#6600cc';
            ctx.beginPath();
            ctx.moveTo(x - size * 0.4, y - size * 1.05);
            ctx.lineTo(x, y - size * 1.8);
            ctx.lineTo(x + size * 0.4, y - size * 1.05);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // Front Arm
        const frontHandX = x + size * 0.6 * dir;
        let frontHandY = y - size * 0.2 - armWave;
        
        // If attacking, override front arm
        if (this.attackCooldown > (type === 'archer' ? 30 : 20)) {
             frontHandY = y - size * 0.5; // Raised arm
        }
        
        if (this.tier === 'myth') {
            ctx.strokeStyle = '#00ffff';
        } else if (this.tier === 'legendary') {
            ctx.strokeStyle = '#a200ff';
        } else if (this.tier === 'hero') {
            ctx.strokeStyle = '#ffd700';
        } else {
            ctx.strokeStyle = color;
        }
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.5);
        ctx.lineTo(frontHandX, frontHandY);
        ctx.stroke();

        // Weapons
        if (type === 'warrior') {
            // Sword in front hand (no shield)
            ctx.strokeStyle = COLORS.stone;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(frontHandX, frontHandY);
            ctx.lineTo(frontHandX + 15 * dir, frontHandY - 15);
            ctx.stroke();
        } else if (type === 'defender') {
            // Only big rectangular shield (no sword)
            ctx.fillStyle = '#8b4513';
            ctx.strokeStyle = '#555555';
            ctx.lineWidth = 2;
            ctx.save();
            ctx.translate(backHandX, backHandY);
            ctx.fillRect(-5, -14, 12, 22);
            ctx.strokeRect(-5, -14, 12, 22);
            // Shield emblem
            ctx.strokeStyle = '#ffdd44';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(1, -10); ctx.lineTo(1, 5);
            ctx.moveTo(-3, -3); ctx.lineTo(5, -3);
            ctx.stroke();
            ctx.restore();
        } else if (type === 'mage') {
            // Staff in front hand
            ctx.strokeStyle = '#6600cc';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(frontHandX, frontHandY);
            ctx.lineTo(frontHandX + 5 * dir, frontHandY - 22);
            ctx.stroke();
            // Orb at top of staff
            ctx.fillStyle = '#aa00ff';
            ctx.shadowColor = '#aa00ff';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(frontHandX + 5 * dir, frontHandY - 22, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (type === 'archer' || type === 'enemyArcher') {
            // Bow in front hand
            const tipX = frontHandX - 4 * dir;
            const topY = frontHandY - 14;
            const bottomY = frontHandY + 14;

            // Bow Wood (curves forward)
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(tipX, topY);
            ctx.quadraticCurveTo(frontHandX + 8 * dir, frontHandY, tipX, bottomY);
            ctx.stroke();

            // Bow string (pulled back)
            ctx.strokeStyle = '#aaaaaa';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tipX, topY);
            ctx.lineTo(frontHandX - 8 * dir, frontHandY);
            ctx.lineTo(tipX, bottomY);
            ctx.stroke();

            // Quiver on back
            ctx.fillStyle = '#654321';
            ctx.fillRect(x - 6 * dir, y - size*0.6, 6, 14);
        } else if (['enemy', 'brute', 'giant', 'assassin', 'necromancer', 'ninja', 'armoredBrute', 'berserker', 'golem', 'warlock', 'shadow', 'titan', 'eliteKnight', 'bossDemon'].includes(type)) {
            // Weapon handle
            ctx.strokeStyle = (['assassin', 'ninja', 'shadow'].includes(type)) ? '#111' : '#4a2f1d';
            ctx.lineWidth = (['giant', 'golem', 'titan', 'bossDemon'].includes(type)) ? 8 : (['brute', 'armoredBrute', 'berserker', 'eliteKnight'].includes(type) ? 6 : (['assassin', 'ninja', 'shadow'].includes(type) ? 2 : 4));
            ctx.beginPath();
            ctx.moveTo(frontHandX, frontHandY);
            
            const weaponLen = (['giant', 'golem', 'titan', 'bossDemon'].includes(type)) ? 25 : (['brute', 'armoredBrute', 'berserker', 'eliteKnight'].includes(type) ? 15 : (['assassin', 'ninja', 'shadow'].includes(type) ? 12 : 10));
            const weaponDrop = (['giant', 'golem', 'titan', 'bossDemon'].includes(type)) ? 35 : (['brute', 'armoredBrute', 'berserker', 'eliteKnight'].includes(type) ? 20 : (['assassin', 'ninja', 'shadow'].includes(type) ? 5 : 15));
            ctx.lineTo(frontHandX + weaponLen * dir, frontHandY - weaponDrop);
            ctx.stroke();
            
            if (['giant', 'golem', 'titan', 'bossDemon', 'brute', 'armoredBrute', 'berserker', 'eliteKnight'].includes(type)) {
                ctx.fillStyle = (['giant', 'golem', 'titan', 'bossDemon'].includes(type)) ? '#555555' : '#aaaaaa';
                ctx.beginPath();
                ctx.moveTo(frontHandX + weaponLen * dir, frontHandY - weaponDrop);
                ctx.lineTo(frontHandX + (weaponLen + 15) * dir, frontHandY - weaponDrop - 10);
                ctx.lineTo(frontHandX + (weaponLen + 15) * dir, frontHandY + 10);
                ctx.fill();
            } else if (['assassin', 'ninja', 'shadow'].includes(type)) {
                ctx.strokeStyle = '#aaaaaa'; // Dagger blade
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(frontHandX + weaponLen * dir, frontHandY - weaponDrop);
                ctx.lineTo(frontHandX + (weaponLen + 8) * dir, frontHandY - weaponDrop - 8);
                ctx.stroke();
            } else if (['necromancer', 'warlock'].includes(type)) {
                ctx.fillStyle = (type === 'necromancer') ? '#800080' : '#00ff00';
                ctx.beginPath();
                ctx.arc(frontHandX + weaponLen * dir, frontHandY - weaponDrop, 6, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#222222';
                ctx.beginPath();
                ctx.arc(frontHandX + 10 * dir, frontHandY - 15, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Health Bar
        if (this.health < this.maxHealth) {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(x - 10, y - size - 10, 20, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(x - 10, y - size - 10, 20 * (this.health / this.maxHealth), 3);
        }
        
        // Draw tier indicator
        if (this.tier === 'myth') {
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 13px Outfit';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 8;
            ctx.fillText('✦ MYTH ✦', x, y - size - 38);
            ctx.shadowBlur = 0;
        } else if (this.tier === 'legendary') {
            ctx.fillStyle = '#ff00ff';
            ctx.font = 'bold 13px Outfit';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 5;
            ctx.fillText('LEGENDARY', x, y - size - 26);
            ctx.shadowBlur = 0;
        } else if (this.tier === 'hero') {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 12px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('HERO', x, y - size - 15);
        }
        
        // Draw Username
        if (this.username) {
            ctx.fillStyle = '#000000';
            ctx.font = '11px Outfit';
            ctx.textAlign = 'center';
            let offset = 14;
            if (this.tier === 'hero') offset = 30;
            if (this.tier === 'legendary') offset = 42;
            if (this.tier === 'myth') offset = 55;
            ctx.fillText(this.username, x, y - size - offset);
        }
        
        ctx.restore();
    }

    update(dt = 1) {
        if (this.dead) return;
        this.walkCycle += 0.2 * dt;
        
        if (['warrior', 'archer', 'defender', 'mage'].includes(this.type)) {
            this.updateWarrior(dt);
        } else {
            this.updateEnemy(dt);
        }
    }

    updateWarrior(dt = 1) {
        // Find nearest enemy within range
        let minDist = Infinity;
        let nearestEnemy = null;
        enemies.forEach(e => {
            const dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < minDist) {
                minDist = dist;
                nearestEnemy = e;
            }
        });

        const aggroRange = 400; // Increased range
        if (nearestEnemy && minDist < aggroRange && !nearestEnemy.dead) {
            this.target = nearestEnemy;
        } else {
            this.target = null;
        }

        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.hypot(dx, dy);
            const attackRange = this.type === 'archer' ? 250 : (this.type === 'mage' ? 375 : 40);

            if (dist > attackRange) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            } else {
                // Attack
                if (this.attackCooldown <= 0) {
                    const stats = GAME_SETTINGS.units[this.type];
                    let dmg = stats.dmg;
                    let cooldown = stats.atkCooldown;
                    
                    if (this.tier === 'myth') {
                        dmg *= GAME_SETTINGS.mythMultipliers.dmg;
                        cooldown *= GAME_SETTINGS.mythMultipliers.atkSpeed;
                    } else if (this.tier === 'hero') {
                        dmg *= GAME_SETTINGS.heroMultipliers.dmg;
                        cooldown *= GAME_SETTINGS.heroMultipliers.atkSpeed;
                    } else if (this.tier === 'legendary') {
                        dmg *= GAME_SETTINGS.legendaryMultipliers.dmg;
                        cooldown *= GAME_SETTINGS.legendaryMultipliers.atkSpeed;
                    }
                    
                    if (this.type === 'archer' || this.type === 'mage') {
                        let pColor = this.type === 'mage' ? '#aa00ff' : COLORS.yellow;
                        if (this.tier === 'hero') pColor = this.type === 'mage' ? '#dd44ff' : '#ffd700';
                        if (this.tier === 'legendary') pColor = '#ff00ff';
                        if (this.tier === 'myth') pColor = '#00ffff';
                        
                        const proj = new Projectile(this.x, this.y, this.target, pColor, this.username);
                        proj.damage = dmg;
                        proj.speed = this.type === 'mage' ? 4 : 5;
                        projectiles.push(proj);
                        sounds.playShoot();
                        this.attackCooldown = cooldown;
                    } else {
                        this.target.health -= dmg;
                        this.target.lastHitter = this.username;
                        this.attackCooldown = cooldown;
                        if (this.tier === 'myth') dmg *= GAME_SETTINGS.mythMultipliers.dmg / GAME_SETTINGS.mythMultipliers.dmg; // already applied above
                        sounds.playHit();
                        
                        let fxColor = COLORS.cyan;
                        if (this.tier === 'hero') fxColor = '#ffd700';
                        if (this.tier === 'legendary') fxColor = '#ff00ff';
                        
                        spawnExplosion(this.target.x, this.target.y, fxColor);
                        floatingTexts.push(new FloatingText(this.target.x, this.target.y - 20, `-${dmg}`, fxColor));
                    }
                }
            }
        } else {
            // Independent Wander AI
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            if (this.patrolWait > 0) {
                this.patrolWait -= dt;
            } else {
                if (!this.patrolTarget) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = (this.type === 'archer' ? 70 : 120) + Math.random() * 50;
                    this.patrolTarget = {
                        x: centerX + Math.cos(angle) * radius,
                        y: centerY + Math.sin(angle) * radius
                    };
                }

                const dx = this.patrolTarget.x - this.x;
                const dy = this.patrolTarget.y - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 5) {
                    this.x += (dx / dist) * this.speed * 0.6 * dt; // Stroll speed
                    this.y += (dy / dist) * this.speed * 0.6 * dt;
                } else {
                    this.patrolTarget = null;
                    this.patrolWait = 60 + Math.random() * 120; // Wait 1~3 seconds
                }
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        if (this.health <= 0) {
            this.dead = true;
            sounds.playExplosion();
            spawnExplosion(this.x, this.y, this.color);
            updateUI();
        }
    }

    updateEnemy(dt = 1) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Find nearest warrior
        let nearestWarrior = null;
        let minWarriorDist = Infinity;
        warriors.forEach(w => {
            const d = Math.hypot(w.x - this.x, w.y - this.y);
            if (d < minWarriorDist) {
                minWarriorDist = d;
                nearestWarrior = w;
            }
        });

        // Determine target
        let targetX, targetY;
        let targetIsUnit = false;

        if (nearestWarrior && minWarriorDist < 120) { // Aggro range
            targetX = nearestWarrior.x;
            targetY = nearestWarrior.y;
            targetIsUnit = true;
            this.target = nearestWarrior;
        } else {
            targetX = centerX;
            targetY = centerY;
            this.target = null;
        }

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);
        const attackRange = (this.type === 'enemyArcher' || this.type === 'necromancer' || this.type === 'warlock') ? 150 : (targetIsUnit ? 35 : 70);

        if (dist > attackRange) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else {
            // Attack
            if (this.attackCooldown <= 0) {
                const stats = GAME_SETTINGS.units[this.type];
                if (this.type === 'enemyArcher' || this.type === 'necromancer' || this.type === 'warlock') {
                    // Create dummy target object for castle if targeting core
                    const targetObj = targetIsUnit ? nearestWarrior : { x: centerX, y: centerY, health: coreHealth, isCastle: true };
                    const pColor = (this.type === 'necromancer') ? '#800080' : ((this.type === 'warlock') ? '#00ff00' : COLORS.red);
                    const proj = new Projectile(this.x, this.y, targetObj, pColor);
                    proj.damage = stats.dmg;
                    proj.isEnemyProjectile = true; // Need to track this to damage castle properly
                    projectiles.push(proj);
                    sounds.playShoot();
                } else {
                    if (targetIsUnit) {
                        nearestWarrior.health -= stats.dmg;
                        sounds.playHit();
                        spawnExplosion(nearestWarrior.x, nearestWarrior.y, COLORS.red);
                        floatingTexts.push(new FloatingText(nearestWarrior.x, nearestWarrior.y - 20, `-${stats.dmg}`, COLORS.red));
                    } else {
                        coreHealth -= stats.dmg;
                        sounds.playCastleHit();
                        spawnExplosion(centerX, centerY, COLORS.red);
                        floatingTexts.push(new FloatingText(centerX, centerY - 20, `-${stats.dmg} Castle`, COLORS.red));
                        updateUI();
                        if (coreHealth <= 0) gameOver();
                    }
                }
                this.attackCooldown = stats.atkCooldown;
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        if (this.health <= 0) {
            this.dead = true;
            score++;
            if (this.lastHitter) {
                userKills[this.lastHitter] = (userKills[this.lastHitter] || 0) + 1;
            }
            sounds.playExplosion();
            spawnExplosion(this.x, this.y, COLORS.red);
            updateUI();
        }
    }
}

// --- Game Logic ---

function separate(unit, group) {
    group.forEach(other => {
        if (unit === other) return;
        const dx = unit.x - other.x;
        const dy = unit.y - other.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 25;
        if (dist > 0 && dist < minDist) {
            const push = (minDist - dist) / minDist * 0.5;
            unit.x += (dx / dist) * push;
            unit.y += (dy / dist) * push;
        }
    });
}

function avoidCastle(unit) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = unit.x - cx;
    const dy = unit.y - cy;
    const dist = Math.hypot(dx, dy);
    const minCastleDist = 65; // Keep slightly outside the castle walls
    if (dist > 0 && dist < minCastleDist) {
        unit.x = cx + (dx / dist) * minCastleDist;
        unit.y = cy + (dy / dist) * minCastleDist;
    }
}

function spawnExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const padding = 50;

    if (side === 0) { // Top
        x = Math.random() * canvas.width;
        y = -padding;
    } else if (side === 1) { // Right
        x = canvas.width + padding;
        y = Math.random() * canvas.height;
    } else if (side === 2) { // Bottom
        x = Math.random() * canvas.width;
        y = canvas.height + padding;
    } else { // Left
        x = -padding;
        y = Math.random() * canvas.height;
    }

    let type = 'enemy';
    let color = COLORS.red;
    
    // Dynamic weights based on day
    let enemyW = GAME_SETTINGS.units.enemy.spawnWeight;
    let archerW = GAME_SETTINGS.units.enemyArcher.spawnWeight;
    let bruteW = currentDay >= 2 ? GAME_SETTINGS.units.brute.spawnWeight + (currentDay * 2) : 0;
    let assassinW = currentDay >= 3 ? GAME_SETTINGS.units.assassin.spawnWeight + (currentDay * 2) : 0;
    let giantW = currentDay >= 5 ? (currentDay - 4) * 2 : 0;
    let necromancerW = currentDay >= 7 ? (currentDay - 6) * 3 : 0;
    let ninjaW = currentDay >= 9 ? (currentDay - 8) * 3 : 0;
    let armoredBruteW = currentDay >= 11 ? (currentDay - 10) * 3 : 0;
    let berserkerW = currentDay >= 13 ? (currentDay - 12) * 3 : 0;
    let golemW = currentDay >= 15 ? (currentDay - 14) * 3 : 0;
    let warlockW = currentDay >= 18 ? (currentDay - 17) * 3 : 0;
    let shadowW = currentDay >= 21 ? (currentDay - 20) * 3 : 0;
    let titanW = currentDay >= 24 ? (currentDay - 23) * 3 : 0;
    let eliteKnightW = currentDay >= 27 ? (currentDay - 26) * 3 : 0;
    let bossDemonW = currentDay >= 30 ? (currentDay - 29) * 4 : 0;
    
    const totalW = enemyW + archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW + warlockW + shadowW + titanW + eliteKnightW + bossDemonW;
    let roll = Math.random() * totalW;
    
    if (roll < archerW) {
        type = 'enemyArcher';
    } else if (roll < archerW + bruteW) {
        type = 'brute';
        color = '#800080';
    } else if (roll < archerW + bruteW + assassinW) {
        type = 'assassin';
        color = '#000000';
    } else if (roll < archerW + bruteW + assassinW + giantW) {
        type = 'giant';
        color = '#8B0000';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW) {
        type = 'necromancer';
        color = '#4B0082';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW) {
        type = 'ninja';
        color = '#00CED1';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW) {
        type = 'armoredBrute';
        color = '#708090';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW) {
        type = 'berserker';
        color = '#FF4500';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW) {
        type = 'golem';
        color = '#696969';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW + warlockW) {
        type = 'warlock';
        color = '#006400';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW + warlockW + shadowW) {
        type = 'shadow';
        color = '#2F4F4F';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW + warlockW + shadowW + titanW) {
        type = 'titan';
        color = '#800000';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW + warlockW + shadowW + titanW + eliteKnightW) {
        type = 'eliteKnight';
        color = '#FFD700';
    } else if (roll < archerW + bruteW + assassinW + giantW + necromancerW + ninjaW + armoredBruteW + berserkerW + golemW + warlockW + shadowW + titanW + eliteKnightW + bossDemonW) {
        type = 'bossDemon';
        color = '#000000';
    }

    enemies.push(new Stickman(x, y, color, type));
}

function spawnWarrior(type = 'warrior', username = null, forceTier = null) {
    const x = canvas.width / 2 + (Math.random() - 0.5) * 100;
    const y = canvas.height / 2 + (Math.random() - 0.5) * 100;
    
    let tier = 'normal';
    
    if (forceTier) {
        tier = forceTier;
    } else {
        // Tier roll: myth 1%, legendary 5%, hero 10%
        const roll = Math.random();
        if (roll < GAME_SETTINGS.ally.mythChance) {
            tier = 'myth';
        } else if (roll < GAME_SETTINGS.ally.mythChance + GAME_SETTINGS.ally.legendaryChance) {
            tier = 'legendary';
        } else if (roll < GAME_SETTINGS.ally.mythChance + GAME_SETTINGS.ally.legendaryChance + GAME_SETTINGS.ally.heroChance) {
            tier = 'hero';
        }
    }
    
    let color = COLORS.cyan;
    if (type === 'archer') color = COLORS.yellow;
    if (type === 'defender') color = '#4488ff';
    if (type === 'mage') color = '#aa00ff';
    
    warriors.push(new Stickman(x, y, color, type, tier, username));
    updateUI();
}

function updateUI() {
    document.getElementById('core-health-bar').style.width = `${Math.max(0, (coreHealth / coreMaxHealth) * 100)}%`;
    const hpLabel = document.getElementById('castle-hp-label');
    if (hpLabel) {
        hpLabel.textContent = `CASTLE HEALTH (${Math.floor(Math.max(0, coreHealth))} / ${coreMaxHealth})`;
    }
    
    document.getElementById('warrior-count').textContent = warriors.length;
    document.getElementById('score').textContent = score;
    const dayEl = document.getElementById('day-display');
    if (dayEl) dayEl.textContent = `DAY ${currentDay}`;

    // Render Leaderboard
    const lbList = document.getElementById('leaderboard-list');
    if (lbList) {
        const sortedUsers = Object.entries(userKills)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        if (sortedUsers.length === 0) {
            lbList.innerHTML = '<div style="color: #666; font-size: 12px; text-align: center; margin-top: 10px;">No kills yet...</div>';
        } else {
            lbList.innerHTML = sortedUsers.map(([name, kills], i) => `
                <div class="leaderboard-item">
                    <div class="leaderboard-name">${i + 1}. ${name}</div>
                    <div class="leaderboard-count">${kills} Kills</div>
                </div>
            `).join('');
        }
    }
}

function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    
    let countdown = 5;
    const titleEl = document.getElementById('overlay-title');
    titleEl.innerHTML = `GAME OVER<br><span style="font-size: 1.5rem; color: #333;">Restarting in ${countdown}s...</span>`;
    document.getElementById('overlay').classList.remove('hidden');
    
    restartInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            titleEl.innerHTML = `GAME OVER<br><span style="font-size: 1.5rem; color: #333;">Restarting in ${countdown}s...</span>`;
        } else {
            clearInterval(restartInterval);
            restartInterval = null;
            titleEl.innerHTML = `GAME OVER`;
            restartGame();
        }
    }, 1000);
}

function restartGame() {
    if (restartInterval) {
        clearInterval(restartInterval);
        restartInterval = null;
    }
    document.getElementById('overlay-title').innerHTML = `GAME OVER`;
    warriors = [];
    enemies = [];
    particles = [];
    projectiles = [];
    floatingTexts = [];
    
    // PERSISTENCE: Maintain bonus from previous games
    coreMaxHealth = 1000 + persistentMaxHpBonus;
    coreHealth = coreMaxHealth;
    
    score = 0;
    isGameOver = false;
    castleAttackCooldown = 0;
    frameCount = 0;
    currentDay = 1;
    dayTimer = 60 * 60;
    document.getElementById('overlay').classList.add('hidden');
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    warriors.push(new Stickman(cx, cy, COLORS.cyan, 'warrior', 'normal'));
    updateUI();
}

document.getElementById('restart-btn').addEventListener('click', restartGame);

// --- Main Loop ---

let lastTime = performance.now();

function gameLoop() {
    const now = performance.now();
    const dt = Math.min(2.0, (now - lastTime) / (1000 / 60)); // Delta time (1.0 = 60fps)
    lastTime = now;

    if (!isGameOver) {
        frameCount++;
        
        // Day Timer Logic (60 seconds per day)
        dayTimer -= dt;
        if (dayTimer <= 0) {
            dayTimer = 60 * 60; // Reset to 60s
            currentDay++;
            floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height / 2 - 100, `DAY ${currentDay} STARTED!`, '#ffaa00'));
        }
        
        updateUI();

        // Clear Background
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Graph Paper Grid
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        const gridSize = 40;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();

        // Draw Medieval Castle
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.strokeStyle = COLORS.line;
        ctx.fillStyle = COLORS.stone;
        ctx.lineWidth = 3;

        const cw = 80; // Castle width
        const ch = 60; // Castle height
        const tw = 30; // Tower width
        const th = 90; // Tower height

        // Draw Towers
        ctx.beginPath();
        ctx.rect(centerX - cw/2 - tw + 5, centerY - th/2, tw, th); // Left Tower
        ctx.rect(centerX + cw/2 - 5, centerY - th/2, tw, th); // Right Tower
        ctx.fill();
        ctx.stroke();

        // Tower Crenellations (Battlements)
        ctx.fillStyle = COLORS.stone;
        ctx.beginPath();
        for(let i=0; i<3; i++) {
            let lx = centerX - cw/2 - tw + 5 + i * 10;
            ctx.rect(lx, centerY - th/2 - 10, 10, 10);
            let rx = centerX + cw/2 - 5 + i * 10;
            ctx.rect(rx, centerY - th/2 - 10, 10, 10);
        }
        ctx.fill();
        ctx.stroke();

        // Main Body
        ctx.beginPath();
        ctx.rect(centerX - cw/2, centerY - ch/2 + 20, cw, ch - 20);
        ctx.fill();
        ctx.stroke();

        // Body Crenellations
        ctx.beginPath();
        for(let i=0; i<4; i++) {
            let bx = centerX - cw/2 + 5 + i * 20;
            ctx.rect(bx, centerY - ch/2 + 10, 10, 10);
        }
        ctx.fill();
        ctx.stroke();

        // Castle Door
        ctx.fillStyle = '#654321'; // Brown wood
        ctx.beginPath();
        ctx.arc(centerX, centerY + 20, 15, Math.PI, Math.PI * 2);
        ctx.lineTo(centerX + 15, centerY + ch/2 + 20);
        ctx.lineTo(centerX - 15, centerY + ch/2 + 20);
        ctx.fill();
        ctx.stroke();

        // Castle HP Bar
        const barY = centerY - th/2 - 25;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(centerX - 40, barY, 80, 8);
        ctx.fillStyle = '#00cc44';
        ctx.fillRect(centerX - 40, barY, 80 * Math.max(0, coreHealth / coreMaxHealth), 8);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - 40, barY, 80, 8);

        // Castle HUD
        const secondsLeft = Math.ceil(dayTimer / 60);
        ctx.fillStyle = COLORS.line;
        ctx.font = 'bold 16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`${secondsLeft}s | DAY ${currentDay}`, centerX, barY - 25);

        ctx.font = 'bold 12px Outfit';
        ctx.fillText(`HP: ${Math.floor(Math.max(0, coreHealth))} / ${Math.floor(coreMaxHealth)}`, centerX, barY - 8);

        // Castle HP Regen
        if (castleRegenPerSec > 0 && coreHealth < coreMaxHealth && !isGameOver) {
            coreHealth = Math.min(coreMaxHealth, coreHealth + castleRegenPerSec / 60 * dt);
            updateUI();
        }

        // Spawn Enemies
        const spawnInterval = Math.max(spawnMinClamp, spawnBaseInterval - (currentDay * 8));
        if (frameCount % Math.max(1, Math.round(spawnInterval)) === 0) {
            spawnEnemy();
        }

        // Castle Auto-Attack
        if (castleAttackCooldown > 0) {
            castleAttackCooldown -= dt;
        } else if (enemies.length > 0) {
            let nearestEnemy = null;
            let minDist = Infinity;
            enemies.forEach(e => {
                const dist = Math.hypot(e.x - centerX, e.y - centerY);
                if (dist < minDist) {
                    minDist = dist;
                    nearestEnemy = e;
                }
            });

            if (nearestEnemy && minDist < 350) { // Castle attack range
                projectiles.push(new Projectile(centerX, centerY - 40, nearestEnemy, '#ffffff'));
                castleAttackCooldown = 60; // Attack speed
            }
        }

        // Update & Draw Entities
        projectiles = projectiles.filter(p => !p.dead);
        projectiles.forEach(p => { p.update(dt); p.draw(ctx); });

        // Resolve Collisions
        warriors.forEach(w => {
            if (frameCount % 2 === 0) separate(w, warriors, dt);
            avoidCastle(w, dt);
        });
        enemies.forEach(e => {
            if (frameCount % 2 === 0) separate(e, enemies, dt);
            if (frameCount % 2 === 0) separate(e, warriors, dt); 
            avoidCastle(e, dt);
        });

        warriors = warriors.filter(w => !w.dead);
        warriors.forEach(w => {
            w.update(dt);
            w.draw(ctx);
        });

        enemies = enemies.filter(e => !e.dead);
        enemies.forEach(e => {
            e.update(dt);
            e.draw(ctx);
        });

        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => { p.update(dt); p.draw(ctx); });

        floatingTexts = floatingTexts.filter(ft => ft.life > 0);
        floatingTexts.forEach(ft => { ft.update(dt); ft.draw(ctx); });
    }

    requestAnimationFrame(gameLoop);
}

// Initialize Chat Service
const chat = new ChatService((cmd, username) => {
    if (cmd === 'warrior') {
        spawnWarrior('warrior', username);
    } else if (cmd === 'archer') {
        spawnWarrior('archer', username);
    } else if (cmd === 'defender') {
        spawnWarrior('defender', username);
    } else if (cmd === 'mage') {
        spawnWarrior('mage', username);
    } else if (cmd === 'heal') {
        coreHealth = Math.min(coreMaxHealth, coreHealth + 20);
        updateUI();
        sounds.playHeal();
        spawnExplosion(canvas.width / 2, canvas.height / 2, COLORS.green);
        floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height / 2 - 40, '+20 HEAL', COLORS.green));
    } else if (cmd === 'like_event') {
        // PERMANENT CASTLE MAX HP +50
        persistentMaxHpBonus += 50;
        coreMaxHealth += 50;
        coreHealth += 50; 
        updateUI();
        sounds.playHeal();
        spawnExplosion(canvas.width / 2, canvas.height / 2, '#ff69b4');
        floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height / 2 - 80, '+50 PERMANENT MAX HP! (LIKE)', '#ff69b4'));
    } else if (cmd === 'subscribe_event') {
        const classType = Math.random() < 0.5 ? 'warrior' : 'archer';
        spawnWarrior(classType, username, 'legendary');
    }
});

// Start with one knight
spawnWarrior('warrior');

gameLoop();

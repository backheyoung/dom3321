import { ChatService } from './chatService.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const COLORS = {
    cyan: '#0055ff', // Now blue
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
let score = 0;
let isGameOver = false;
let frameCount = 0;
let restartInterval = null;
let castleAttackCooldown = 0;
let currentDay = 1;

// Global Game Settings
const GAME_SETTINGS = {
    ally: { heroChance: 0.1 }, // 10% chance
    heroMultipliers: { hp: 3.0, dmg: 2.0, speed: 1.2, atkSpeed: 0.7 }, // Cooldown is multiplied by atkSpeed
    units: {
        warrior: { hp: 100, speed: 1.0, dmg: 25, atkCooldown: 30 },
        archer:  { hp: 80,  speed: 0.8, dmg: 15, atkCooldown: 40 },
        enemy:   { hp: 60,  speed: 0.5, dmg: 15, atkCooldown: 60, spawnWeight: 70 },
        brute:   { hp: 180, speed: 0.35, dmg: 30, atkCooldown: 60, spawnWeight: 30 },
        enemyArcher: { hp: 40, speed: 0.6, dmg: 10, atkCooldown: 50, spawnWeight: 20 }
    },
    spawnTimer: { minFrames: 60, maxFrames: 180 }
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

// Global & Hero
bindSetting('set-hero-chance', GAME_SETTINGS.ally, 'heroChance', true, 100);
bindSetting('set-hero-hp-mult', GAME_SETTINGS.heroMultipliers, 'hp', true);
bindSetting('set-hero-dmg-mult', GAME_SETTINGS.heroMultipliers, 'dmg', true);
bindSetting('set-hero-speed-mult', GAME_SETTINGS.heroMultipliers, 'speed', true);
bindSetting('set-hero-atk-mult', GAME_SETTINGS.heroMultipliers, 'atkSpeed', true);
bindSetting('set-spawn-min', GAME_SETTINGS.spawnTimer, 'minFrames');
bindSetting('set-spawn-max', GAME_SETTINGS.spawnTimer, 'maxFrames');

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
    update() {
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, target, color) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.color = color;
        this.speed = 5;
        this.dead = false;
    }
    update() {
        if (!this.target || this.target.dead) {
            this.dead = true;
            return;
        }
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 10) {
            const dmg = this.damage || 15;
            if (this.isEnemyProjectile && this.target.isCastle) {
                coreHealth -= dmg;
                spawnExplosion(this.target.x, this.target.y, this.color);
                floatingTexts.push(new FloatingText(this.target.x, this.target.y - 20, `-${dmg} Castle`, this.color));
                updateUI();
                if (coreHealth <= 0) gameOver();
            } else {
                this.target.health -= dmg;
                spawnExplosion(this.target.x, this.target.y, this.color);
                floatingTexts.push(new FloatingText(this.target.x, this.target.y - 20, `-${dmg}`, this.color));
            }
            this.dead = true;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
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

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
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
    constructor(x, y, color, type = 'warrior', isHero = false, username = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.isHero = isHero;
        this.username = username;
        
        const stats = GAME_SETTINGS.units[type];
        this.size = type === 'brute' ? 26 : 20;
        this.speed = stats.speed;
        this.health = stats.hp;
        
        if (this.isHero) {
            this.size *= 1.3;
            this.speed *= GAME_SETTINGS.heroMultipliers.speed;
            this.health *= GAME_SETTINGS.heroMultipliers.hp;
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
        ctx.strokeStyle = this.isHero ? '#ffd700' : this.color; // Unified Gold if Hero
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
        }

        // Front Arm
        const frontHandX = x + size * 0.6 * dir;
        let frontHandY = y - size * 0.2 - armWave;
        
        // If attacking, override front arm
        if (this.attackCooldown > (type === 'archer' ? 30 : 20)) {
             frontHandY = y - size * 0.5; // Raised arm
        }
        
        ctx.strokeStyle = this.isHero ? '#ffd700' : color;
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.5);
        ctx.lineTo(frontHandX, frontHandY);
        ctx.stroke();

        // Weapons
        if (type === 'warrior') {
            // Sword in front hand
            ctx.strokeStyle = COLORS.stone;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(frontHandX, frontHandY);
            ctx.lineTo(frontHandX + 15 * dir, frontHandY - 15);
            ctx.stroke();
            // Shield on back hand
            ctx.fillStyle = '#8b4513';
            ctx.strokeStyle = '#555555';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(backHandX, backHandY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
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
        } else if (type === 'enemy' || type === 'brute') {
            // Enemy Club / Brute Axe
            ctx.strokeStyle = '#4a2f1d';
            ctx.lineWidth = type === 'brute' ? 6 : 4;
            ctx.beginPath();
            ctx.moveTo(frontHandX, frontHandY);
            ctx.lineTo(frontHandX + (type === 'brute' ? 15 : 10) * dir, frontHandY - (type === 'brute' ? 20 : 15));
            ctx.stroke();
            
            if (type === 'brute') {
                ctx.fillStyle = '#aaaaaa';
                ctx.beginPath();
                ctx.moveTo(frontHandX + 15 * dir, frontHandY - 20);
                ctx.lineTo(frontHandX + 25 * dir, frontHandY - 25);
                ctx.lineTo(frontHandX + 25 * dir, frontHandY - 5);
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
        
        // Draw Username
        if (this.username) {
            ctx.fillStyle = '#000000';
            ctx.font = '11px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(this.username, x, y - size - 14);
        }
        
        ctx.restore();
    }

    update() {
        if (this.dead) return;
        this.walkCycle += 0.2;
        
        if (this.type === 'warrior' || this.type === 'archer') {
            this.updateWarrior();
        } else {
            this.updateEnemy();
        }
    }

    updateWarrior() {
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
            const attackRange = this.type === 'archer' ? 150 : 30;

            if (dist > attackRange) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            } else {
                // Attack
                if (this.attackCooldown <= 0) {
                    const stats = GAME_SETTINGS.units[this.type];
                    let dmg = stats.dmg;
                    let cooldown = stats.atkCooldown;
                    
                    if (this.isHero) {
                        dmg *= GAME_SETTINGS.heroMultipliers.dmg;
                        cooldown *= GAME_SETTINGS.heroMultipliers.atkSpeed;
                    }
                    
                    if (this.type === 'archer') {
                        const proj = new Projectile(this.x, this.y, this.target, this.isHero ? '#ffd700' : COLORS.yellow);
                        proj.damage = dmg;
                        projectiles.push(proj);
                        this.attackCooldown = cooldown;
                    } else {
                        this.target.health -= dmg;
                        this.attackCooldown = cooldown;
                        const fxColor = this.isHero ? '#ffd700' : COLORS.cyan;
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
                this.patrolWait--;
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
                    this.x += (dx / dist) * this.speed * 0.6; // Stroll speed
                    this.y += (dy / dist) * this.speed * 0.6;
                } else {
                    this.patrolTarget = null;
                    this.patrolWait = 60 + Math.random() * 120; // Wait 1~3 seconds
                }
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown--;

        if (this.health <= 0) {
            this.dead = true;
            spawnExplosion(this.x, this.y, this.color);
            updateUI();
        }
    }

    updateEnemy() {
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
        const attackRange = (this.type === 'enemyArcher') ? 150 : (targetIsUnit ? 35 : 70);

        if (dist > attackRange) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            // Attack
            if (this.attackCooldown <= 0) {
                const stats = GAME_SETTINGS.units[this.type];
                if (this.type === 'enemyArcher') {
                    // Create dummy target object for castle if targeting core
                    const targetObj = targetIsUnit ? nearestWarrior : { x: centerX, y: centerY, health: coreHealth, isCastle: true };
                    const proj = new Projectile(this.x, this.y, targetObj, COLORS.red);
                    proj.damage = stats.dmg;
                    proj.isEnemyProjectile = true; // Need to track this to damage castle properly
                    projectiles.push(proj);
                } else {
                    if (targetIsUnit) {
                        nearestWarrior.health -= stats.dmg;
                        spawnExplosion(nearestWarrior.x, nearestWarrior.y, COLORS.red);
                        floatingTexts.push(new FloatingText(nearestWarrior.x, nearestWarrior.y - 20, `-${stats.dmg}`, COLORS.red));
                    } else {
                        coreHealth -= stats.dmg;
                        spawnExplosion(centerX, centerY, COLORS.red);
                        floatingTexts.push(new FloatingText(centerX, centerY - 20, `-${stats.dmg} Castle`, COLORS.red));
                        updateUI();
                        if (coreHealth <= 0) gameOver();
                    }
                }
                this.attackCooldown = stats.atkCooldown;
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown--;

        if (this.health <= 0) {
            this.dead = true;
            score++;
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
    
    const enemyWeight = GAME_SETTINGS.units.enemy.spawnWeight;
    const bruteWeight = GAME_SETTINGS.units.brute.spawnWeight;
    const archerWeight = GAME_SETTINGS.units.enemyArcher.spawnWeight;
    const totalWeight = enemyWeight + bruteWeight + archerWeight;
    
    let roll = Math.random() * totalWeight;
    
    if (roll < archerWeight) {
        type = 'enemyArcher';
    } else if (currentDay >= 2 && roll < archerWeight + bruteWeight) {
        type = 'brute';
        color = '#800080';
    }

    enemies.push(new Stickman(x, y, color, type));
}

function spawnWarrior(type = 'warrior', username = null) {
    const x = canvas.width / 2 + (Math.random() - 0.5) * 100;
    const y = canvas.height / 2 + (Math.random() - 0.5) * 100;
    
    let isHero = false;
    // Check for Hero spawn
    if (Math.random() < GAME_SETTINGS.ally.heroChance) {
        isHero = true;
    }
    
    let color = COLORS.cyan;
    if (type === 'archer') color = COLORS.yellow;
    
    warriors.push(new Stickman(x, y, color, type, isHero, username));
    updateUI();
}

function updateUI() {
    document.getElementById('core-health-bar').style.width = `${Math.max(0, coreHealth)}%`;
    document.getElementById('warrior-count').textContent = warriors.length;
    document.getElementById('score').textContent = score;
    const dayEl = document.getElementById('day-display');
    if (dayEl) dayEl.textContent = `DAY ${currentDay}`;
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
    coreHealth = 100;
    score = 0;
    isGameOver = false;
    castleAttackCooldown = 0;
    frameCount = 0;
    currentDay = 1;
    document.getElementById('overlay').classList.add('hidden');
    
    // Start with one knight (never a hero)
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    warriors.push(new Stickman(cx, cy, COLORS.cyan, 'warrior', false));
    updateUI();
}

document.getElementById('restart-btn').addEventListener('click', restartGame);

// --- Main Loop ---

function gameLoop() {
    if (!isGameOver) {
        frameCount++;
        currentDay = Math.floor(frameCount / 3600) + 1; // 60 FPS = 3600 frames per day
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
        ctx.fillRect(centerX - 40, barY, 80 * Math.max(0, coreHealth / 100), 8);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - 40, barY, 80, 8);

        // Castle HP Text
        ctx.fillStyle = COLORS.line;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.floor(Math.max(0, coreHealth))} / 100`, centerX, barY - 8);

        // Spawn Enemies
        const maxF = GAME_SETTINGS.spawnTimer.maxFrames;
        const minF = GAME_SETTINGS.spawnTimer.minFrames;
        const currentInterval = Math.max(minF, maxF - Math.floor(score / 2));
        if (frameCount % currentInterval === 0) {
            spawnEnemy();
        }

        // Castle Auto-Attack
        if (castleAttackCooldown > 0) {
            castleAttackCooldown--;
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
        projectiles.forEach(p => {
            p.update();
            p.draw(ctx);
        });

        // Resolve Collisions
        warriors.forEach(w => {
            separate(w, warriors);
            avoidCastle(w);
        });
        enemies.forEach(e => {
            separate(e, enemies);
            separate(e, warriors); // Enemies shouldn't overlap warriors completely
            avoidCastle(e);
        });

        warriors = warriors.filter(w => !w.dead);
        warriors.forEach(w => {
            w.update();
            w.draw(ctx);
        });

        enemies = enemies.filter(e => !e.dead);
        enemies.forEach(e => {
            e.update();
            e.draw(ctx);
        });

        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.update();
            p.draw(ctx);
        });

        floatingTexts = floatingTexts.filter(ft => ft.life > 0);
        floatingTexts.forEach(ft => {
            ft.update();
            ft.draw(ctx);
        });
    }

    requestAnimationFrame(gameLoop);
}

// Initialize Chat Service
const chat = new ChatService((cmd, username) => {
    if (cmd === 'warrior') {
        spawnWarrior('warrior', username);
    } else if (cmd === 'archer') {
        spawnWarrior('archer', username);
    } else if (cmd === 'heal') {
        coreHealth = Math.min(100, coreHealth + 20);
        updateUI();
        spawnExplosion(canvas.width / 2, canvas.height / 2, COLORS.green);
        floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height / 2 - 40, '+20 HEAL', COLORS.green));
    }
});

// Start with one knight
spawnWarrior('warrior');

gameLoop();

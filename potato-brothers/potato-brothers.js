// 土豆兄弟 Potato Brothers - 幸存者like游戏

// 游戏常量
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const PLAYER_SIZE = 20;
const ENEMY_SIZE = 16;
const BULLET_SIZE = 6;
const EXP_SIZE = 8;

// 颜色
const COLORS = {
    background: '#000000',
    player: '#ffcc00',
    enemy: '#ff3333',
    enemyFast: '#ff66ff',
    enemyBig: '#6666ff',
    bullet: '#ffff00',
    exp: '#00ff00',
    healthBarBg: '#333',
    healthBarFill: '#00ff00'
};

// 升级选项
const UPGRADES = [
    { name: '增加最大生命', description: '+20 最大生命', effect: (game) => { game.player.maxHealth += 20; game.player.health += 20; }},
    { name: '增加伤害', description: '+5 子弹伤害', effect: (game) => { game.player.damage += 5; }},
    { name: '增加射速', description: '-15% 射击间隔', effect: (game) => { game.player.fireCooldown *= 0.85; }},
    { name: '增加移速', description: '+0.5 移动速度', effect: (game) => { game.player.speed += 0.5; }},
    { name: '更大体型', description: '+50% 体型 + 10 最大生命', effect: (game) => { game.player.size *= 1.5; game.player.maxHealth += 10; game.player.health += 10; }},
    { name: '吸血', description: '每次击杀恢复 2 生命', effect: (game) => { game.player.lifesteal += 2; }},
    { name: '多发射弹', description: '+1 子弹数量', effect: (game) => { game.player.bulletCount += 1; }},
    { name: '散弹扩散', description: '增加子弹扩散角度', effect: (game) => { game.player.spread += 0.1; }},
    { name: '更快吸取', description: '+50% 经验吸取范围', effect: (game) => { game.player.pickupRange *= 1.5; }},
];

// 游戏状态
let canvas, ctx;
let gameRunning = false;
let gamePaused = false;
let animationId = null;
let lastTime = 0;

// 玩家
let player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    size: PLAYER_SIZE,
    speed: 3,
    health: 100,
    maxHealth: 100,
    damage: 10,
    damageMultiplier: 1,
    fireCooldown: 300,
    lastFire: 0,
    bulletCount: 1,
    spread: 0.2,
    xp: 0,
    xpToNext: 10,
    level: 1,
    kills: 0,
    lifesteal: 0,
    pickupRange: 50
};

// 敌人、子弹、经验宝石
let enemies = [];
let bullets = [];
let expGems = [];
let particles = [];

// 摇杆
let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickDir = { x: 0, y: 0 };

// DOM元素
const levelEl = document.getElementById('level');
const healthEl = document.getElementById('health');
const damageEl = document.getElementById('damage');
const xpFillEl = document.getElementById('xp-fill');
const xpTextEl = document.getElementById('xpText');
const killsEl = document.getElementById('kills');
const upgradeModal = document.getElementById('upgradeModal');
const upgradeOptionsEl = document.getElementById('upgradeOptions');
const gameOverModal = document.getElementById('gameOverModal');
const survivalTimeEl = document.getElementById('survivalTime');
const finalKillsEl = document.getElementById('finalKills');
const maxLevelEl = document.getElementById('maxLevel');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const joystickArea = document.getElementById('joystickArea');
const joystick = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystickKnob');

// 粒子效果
class Particle {
    constructor(x, y, color, velocity, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = velocity.x;
        this.vy = velocity.y;
        this.life = life;
        this.maxLife = life;
        this.size = 3 + Math.random() * 3;
    }
    
    update(dt) {
        this.x += this.vx * dt / 16;
        this.y += this.vy * dt / 16;
        this.life -= dt / 1000;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }
    
    draw(ctx) {
        const alpha = Math.floor((this.life / this.maxLife) * 255).toString(16).padStart(2, '0');
        ctx.fillStyle = this.color + alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (this.life / this.maxLife), 0, Math.PI * 2);
        ctx.fill();
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// 敌人
class Enemy {
    constructor(x, y, type = 0) {
        this.x = x;
        this.y = y;
        this.type = type; // 0=普通 1=快 2=大
        this.setByType();
        this.health = this.maxHealth;
    }
    
    setByType() {
        switch(this.type) {
            case 1: // 快
                this.size = ENEMY_SIZE * 0.8;
                this.speed = 2.5;
                this.maxHealth = 3;
                this.exp = 2;
                break;
            case 2: // 大
                this.size = ENEMY_SIZE * 1.5;
                this.speed = 1.2;
                this.maxHealth = 15;
                this.exp = 8;
                break;
            default: // 普通
                this.size = ENEMY_SIZE;
                this.speed = 1.5;
                this.maxHealth = 5;
                this.exp = 3;
                break;
        }
        this.health = this.maxHealth;
    }
    
    getColor() {
        switch(this.type) {
            case 1: return COLORS.enemyFast;
            case 2: return COLORS.enemyBig;
            default: return COLORS.enemy;
        }
    }
    
    update(dt, playerX, playerY) {
        // 追玩家
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt / 16;
            this.y += (dy / dist) * this.speed * dt / 16;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = this.getColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 血条
        if (this.health < this.maxHealth) {
            const barWidth = this.size;
            const barHeight = 4;
            ctx.fillStyle = COLORS.healthBarBg;
            ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 8, barWidth, barHeight);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 8, barWidth * (this.health / this.maxHealth), barHeight);
        }
    }
    
    hit(damage) {
        this.health -= damage;
        return this.health <= 0;
    }
}

// 子弹
class Bullet {
    constructor(x, y, angle, damage) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 6;
        this.damage = damage;
        this.size = BULLET_SIZE;
        this.life = 600; // 生命周期
        this.active = true;
    }
    
    update(dt) {
        if (!this.active) return;
        
        this.x += Math.cos(this.angle) * this.speed * dt / 16;
        this.y += Math.sin(this.angle) * this.speed * dt / 16;
        this.life -= dt;
    }
    
    draw(ctx) {
        ctx.fillStyle = COLORS.bullet;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    isDead() {
        // 出界死亡
        if (this.x < 0 || this.x > CANVAS_WIDTH || this.y < 0 || this.y > CANVAS_HEIGHT) {
            return true;
        }
        return this.life <= 0;
    }
}

// 经验宝石
class ExpGem {
    constructor(x, y, amount) {
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.size = EXP_SIZE * Math.sqrt(amount);
    }
    
    update(dt, player) {
        // 被吸引到玩家
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < player.pickupRange) {
            // 被拾取
            if (dist < player.size / 2 + this.size / 2) {
                player.xp += this.amount;
                addParticles(this.x, this.y, COLORS.exp, 8);
                checkLevelUp();
                return false; // 删除
            }
            // 吸引
            const speed = 2 + (player.pickupRange - dist) / 20;
            this.x += (dx / dist) * speed * dt / 16;
            this.y += (dy / dist) * speed * dt / 16;
        }
        return true;
    }
    
    draw(ctx) {
        ctx.fillStyle = COLORS.exp;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// 添加粒子
function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particles.push(new Particle(x, y, color, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        }, 1000 + Math.random() * 500));
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // 绑定事件
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    playAgainBtn.addEventListener('click', () => {
        gameOverModal.classList.add('hidden');
        startGame();
    });
    
    // 键盘鼠标
    document.addEventListener('keydown', handleKeyDown);
    
    // 摇杆绑定
    bindJoystick();
    
    draw();
    updateUI();
});

// 绑定摇杆
function bindJoystick() {
    joystickArea.addEventListener('touchstart', (e) => {
        const rect = joystick.getBoundingClientRect();
        joystickStart.x = rect.left + rect.width / 2;
        joystickStart.y = rect.top + rect.height / 2;
        joystickActive = true;
        e.preventDefault();
    }, {passive: false});
    
    document.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;
        const touch = e.touches[0];
        const dx = touch.clientX - joystickStart.x;
        const dy = touch.clientY - joystickStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 30;
        const clampedDist = Math.min(dist, maxDist);
        if (dist > 0) {
            joystickDir.x = (dx / dist) * (clampedDist / maxDist);
            joystickDir.y = (dy / dist) * (clampedDist / maxDist);
        } else {
            joystickDir.x = 0;
            joystickDir.y = 0;
        }
        // 更新旋钮位置
        const knobX = 50 + joystickDir.x * 30;
        const knobY = 50 + joystickDir.y * 30;
        joystickKnob.style.left = knobX + 'px';
        joystickKnob.style.top = knobY + 'px';
        e.preventDefault();
    }, {passive: false});
    
    document.addEventListener('touchend', (e) => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickDir.x = 0;
        joystickDir.y = 0;
        joystickKnob.style.left = '50%';
        joystickKnob.style.top = '50%';
        e.preventDefault();
    }, {passive: false});
    
    // PC鼠标模拟摇杆
    joystickArea.addEventListener('mousedown', (e) => {
        const rect = joystick.getBoundingClientRect();
        joystickStart.x = rect.left + rect.width / 2;
        joystickStart.y = rect.top + rect.height / 2;
        joystickActive = true;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!joystickActive) return;
        const dx = e.clientX - joystickStart.x;
        const dy = e.clientY - joystickStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 30;
        const clampedDist = Math.min(dist, maxDist);
        if (dist > 0) {
            joystickDir.x = (dx / dist) * (clampedDist / maxDist);
            joystickDir.y = (dy / dist) * (clampedDist / maxDist);
        } else {
            joystickDir.x = 0;
            joystickDir.y = 0;
        }
        const knobX = 50 + joystickDir.x * 30;
        const knobY = 50 + joystickDir.y * 30;
        joystickKnob.style.left = knobX + 'px';
        joystickKnob.style.top = knobY + 'px';
    });
    
    document.addEventListener('mouseup', (e) => {
        if (!joystickActive) return;
        joystickActive = false;
        joystickDir.x = 0;
        joystickDir.y = 0;
        joystickKnob.style.left = '50%';
        joystickKnob.style.top = '50%';
    });
}

// 按键状态
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

function handleKeyDown(e) {
    if (e.code === 'Space') {
        togglePause();
        e.preventDefault();
    }
}

// 开始游戏
function startGame() {
    // 重置所有
    player = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        size: PLAYER_SIZE,
        speed: 3,
        health: 100,
        maxHealth: 100,
        damage: 10,
        damageMultiplier: 1,
        fireCooldown: 300,
        lastFire: 0,
        bulletCount: 1,
        spread: 0.2,
        xp: 0,
        xpToNext: 10,
        level: 1,
        kills: 0,
        lifesteal: 0,
        pickupRange: 50
    };
    enemies = [];
    bullets = [];
    expGems = [];
    particles = [];
    
    startTime = Date.now();
    enemySpawnTimer = 0;
    enemySpawnInterval = 1000; // 初始1秒一个
    
    gameRunning = true;
    gamePaused = false;
    lastTime = Date.now();
    gameLoop();
    updateUI();
}

let startTime = 0;
let enemySpawnTimer = 0;
let enemySpawnInterval = 1000;

// 玩家移动
function movePlayer(dt) {
    let dx = 0, dy = 0;
    
    // 键盘
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx -= -1;
    
    // 摇杆
    if (joystickActive) {
        dx += joystickDir.x;
        dy += joystickDir.y;
    }
    
    // 归一化
    if (dx !== 0 || dy !== 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / dist) * player.speed * dt / 16;
        dy = (dy / dist) * player.speed * dt / 16;
        
        // 边界碰撞
        const halfSize = player.size / 2;
        player.x = Math.max(halfSize, Math.min(CANVAS_WIDTH - halfSize, player.x + dx));
        player.y = Math.max(halfSize, Math.min(CANVAS_HEIGHT - halfSize, player.y + dy));
    }
}

// 玩家射击
function playerFire() {
    const now = Date.now();
    if (now - player.lastFire < player.fireCooldown) {
        return;
    }
    player.lastFire = now;
    
    // 向每个敌人方向射击，如果没敌人就向各个方向
    if (enemies.length > 0) {
        // 找最近敌人
        let closest = null;
        let minDist = 10000;
        for (let enemy of enemies) {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                closest = enemy;
            }
        }
        
        if (closest) {
            const dx = closest.x - player.x;
            const dy = closest.y - player.y;
            const baseAngle = Math.atan2(dy, dx);
            
            // 发射多个子弹
            for (let i = 0; i < player.bulletCount; i++) {
                let angle = baseAngle + (Math.random() - 0.5) * 2 * player.spread;
                bullets.push(new Bullet(player.x, player.y, angle, player.damage));
            }
        }
    } else {
        // 没敌人就向上
        for (let i = 0; i < player.bulletCount; i++) {
            let angle = -Math.PI/2 + (Math.random() - 0.5) * 2 * player.spread;
            bullets.push(new Bullet(player.x, player.y, angle, player.damage));
        }
    }
}

// 生成敌人
function spawnEnemy() {
    // 在边界出生
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -20 : CANVAS_WIDTH + 20;
        y = Math.random() * CANVAS_HEIGHT;
    } else {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() < 0.5 ? -20 : CANVAS_HEIGHT + 20;
    }
    
    // 敌人类型
    let type = 0;
    const r = Math.random();
    if (r < 0.2) type = 1;
    else if (r < 0.35) type = 2;
    
    enemies.push(new Enemy(x, y, type));
}

// 检查升级
function checkLevelUp() {
    if (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = Math.floor(player.xpToNext * 1.5);
        showUpgradeMenu();
    }
}

// 显示升级菜单
function showUpgradeMenu() {
    gamePaused = true;
    upgradeModal.classList.remove('hidden');
    
    // 随机选3个选项
    upgradeOptionsEl.innerHTML = '';
    const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
    
    for (let option of shuffled) {
        const div = document.createElement('div');
        div.className = 'upgrade-option';
        div.innerHTML = `<h4>${option.name}</h4><p>${option.description}</p>`;
        div.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            option.effect(player);
            upgradeModal.classList.add('hidden');
            gamePaused = false;
            lastTime = Date.now();
            updateUI();
            if (gameRunning) {
                gameLoop();
            }
        });
        upgradeOptionsEl.appendChild(div);
    }
}

// 检测子弹碰撞敌人
function checkCollisions() {
    for (let bullet of bullets) {
        if (bullet.active) {
            for (let enemy of enemies) {
                if (enemy.health <= 0) continue;
                
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < enemy.size / 2) {
                    if (enemy.hit(bullet.damage)) {
                        // 敌人死亡
                        addParticles(enemy.x, enemy.y, enemy.getColor(), 12);
                        expGems.push(new ExpGem(enemy.x, enemy.y, enemy.exp));
                        player.kills++;
                        // 吸血
                        if (player.lifesteal > 0) {
                            player.health = Math.min(player.maxHealth, player.health + player.lifesteal);
                        }
                        enemies = enemies.filter(e => e !== enemy);
                    }
                    bullet.active = false;
                    break;
                }
            }
        }
    }
    
    // 检测敌人碰撞玩家
    for (let enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (enemy.size + player.size) / 2) {
            // 碰撞伤害，每秒10伤害
            player.health -= 10 * (1 / 60);
            if (player.health <= 0) {
                gameOver();
                break;
            }
        }
    }
}

// 检查游戏结束
function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    
    const survivalSeconds = Math.floor((Date.now() - startTime) / 1000);
    survivalTimeEl.textContent = formatTime(survivalSeconds);
    finalKillsEl.textContent = player.kills;
    maxLevelEl.textContent = player.level;
    gameOverModal.classList.remove('hidden');
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 更新UI
function updateUI() {
    levelEl.textContent = player.level;
    healthEl.textContent = `${Math.floor(player.health)}/${player.maxHealth}`;
    damageEl.textContent = player.damage;
    killsEl.textContent = player.kills;
    const xpPercent = (player.xp / player.xpToNext) * 100;
    xpFillEl.style.width = xpPercent + '%';
    xpTextEl.textContent = `${player.xp}/${player.xpToNext}`;
}

// 暂停切换
function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    if (!gamePaused) {
        lastTime = Date.now();
        gameLoop();
    }
}

// 绘制
function draw() {
    // 清空
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制经验宝石
    for (let gem of expGems) {
        gem.draw(ctx);
    }
    
    // 绘制子弹
    for (let bullet of bullets) {
        if (!bullet.isDead()) {
            bullet.draw(ctx);
        }
    }
    
    // 绘制敌人
    for (let enemy of enemies) {
        enemy.draw(ctx);
    }
    
    // 绘制粒子
    for (let particle of particles) {
        particle.draw(ctx);
    }
    
    // 绘制玩家
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 玩家血条
    if (player.health < player.maxHealth) {
        const barWidth = player.size + 10;
        const barHeight = 6;
        const barX = player.x - barWidth / 2;
        const barY = player.y - player.size / 2 - 15;
        ctx.fillStyle = COLORS.healthBarBg;
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = COLORS.healthBarFill;
        ctx.fillRect(barX, barY, barWidth * (player.health / player.maxHealth), barHeight);
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    const now = Date.now();
    const dt = now - lastTime;
    lastTime = now;
    
    // 玩家移动
    movePlayer(dt);
    
    // 玩家射击
    playerFire();
    
    // 更新敌人
    enemySpawnTimer += dt;
    if (enemySpawnTimer >= enemySpawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
        // 随着时间加快生成
        enemySpawnInterval = Math.max(300, enemySpawnInterval * 0.99);
    }
    
    for (let enemy of enemies) {
        enemy.update(dt, player.x, player.y);
    }
    
    // 更新子弹
    for (let bullet of bullets) {
        bullet.update(dt);
    }
    bullets = bullets.filter(b => !b.isDead());
    
    // 更新经验宝石
    expGems = expGems.filter(gem => gem.update(dt, player));
    
    // 更新粒子
    for (let particle of particles) {
        particle.update(dt);
    }
    particles = particles.filter(p => !p.isDead());
    
    // 碰撞检测
    checkCollisions();
    
    // 绘制
    draw();
    
    // 更新UI
    updateUI();
    
    animationId = requestAnimationFrame(gameLoop);
}

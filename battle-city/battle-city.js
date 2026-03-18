// 坦克大战 Battle City - 核心逻辑

// 游戏常量
const TILE_SIZE = 24;
const MAP_WIDTH = 13;
const MAP_HEIGHT = 13;
const CANVAS_WIDTH = MAP_WIDTH * TILE_SIZE;
const CANVAS_HEIGHT = MAP_HEIGHT * TILE_SIZE;

// 瓷砖类型
const TILE = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    WATER: 3,
    FOREST: 4,
    ICE: 5,
    BASE: 6
};

// 坦克方向
const DIRECTION = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

// 坦克类型
const TANK_TYPE = {
    PLAYER: 0,
    ENEMY_BASIC: 1,
    ENEMY_FAST: 2,
    ENEMY_ARMOR: 3
};

// 颜色定义
const COLORS = {
    BACKGROUND: '#000000',
    EMPTY: '#000000',
    BRICK: '#ad8850',
    STEEL: '#666666',
    WATER: '#0044ff',
    FOREST: '#008800',
    ICE: '#88ffff',
    BASE: '#ffcc00',
    PLAYER: '#00ff00',
    ENEMY: '#ff4444',
    BULLET: '#ffff00'
};

// 游戏状态
let canvas, ctx;
let map = [];
let player = null;
let enemies = [];
let bullets = [];
let explosions = [];
let score = 0;
let stage = 1;
let lives = 3;
let totalEnemies = 20;
let enemiesDestroyed = 0;
let gameRunning = false;
let gamePaused = false;
let lastTime = 0;
let animationId = null;

// DOM元素
const stageEl = document.getElementById('stage');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const enemyIconsEl = document.getElementById('enemyIcons');
const finalScoreEl = document.getElementById('finalScore');
const gameOverTitleEl = document.getElementById('gameOverTitle');
const gameOverModal = document.getElementById('gameOverModal');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');

// 坦克对象
class Tank {
    constructor(x, y, direction, type, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.type = type;
        this.isPlayer = isPlayer;
        this.width = 2;
        this.height = 2;
        this.speed = isPlayer ? 2 : this.getSpeed();
        this.armor = this.getArmor();
        this.lastFire = 0;
        this.fireCooldown = isPlayer ? 300 : 800 + Math.random() * 500;
        this.moveTimer = 0;
        this.changeDirectionChance = 0.02;
        this.active = true;
    }
    
    getSpeed() {
        switch(this.type) {
            case TANK_TYPE.ENEMY_FAST: return 3;
            case TANK_TYPE.ENEMY_ARMOR: return 1.5;
            default: return 2;
        }
    }
    
    getArmor() {
        switch(this.type) {
            case TANK_TYPE.ENEMY_ARMOR: return 2;
            default: return 1;
        }
    }
    
    move(dx, dy) {
        // 检查碰撞
        const newX = this.x + dx / TILE_SIZE;
        const newY = this.y + dy / TILE_SIZE;
        
        if (!this.checkCollision(newX, newY)) {
            this.x = newX;
            this.y = newY;
            return true;
        }
        return false;
    }
    
    checkCollision(newX, newY) {
        // 检查四个角 (坦克占2x2格)
        const points = [
            [newX, newY],
            [newX + this.width - 0.1, newY],
            [newX, newY + this.height - 0.1],
            [newX + this.width - 0.1, newY + this.height - 0.1]
        ];
        
        for (let [px, py] of points) {
            // 检查边界
            if (px < 0 || px + this.width > MAP_WIDTH || py < 0 || py + this.height > MAP_HEIGHT) {
                return true; // 撞墙
            }
            
            const tileX = Math.floor(px);
            const tileY = Math.floor(py);
            if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
                return true;
            }
            
            const tile = map[tileY][tileX];
            
            if (tile === TILE.BRICK || tile === TILE.STEEL || tile === TILE.BASE) {
                return true;
            }
        }
        
        // 检查和其他坦克碰撞
        const allTanks = [player, ...enemies].filter(t => t !== this && t.active);
        for (let tank of allTanks) {
            if (this.overlaps(newX, newY, tank)) {
                return true;
            }
        }
        
        return false;
    }
    
    overlaps(x, y, other) {
        return !(x + this.width <= other.x || 
                 x >= other.x + other.width || 
                 y + this.height <= other.y || 
                 y >= other.y + other.height);
    }
    
    fire() {
        const now = Date.now();
        if (now - this.lastFire < this.fireCooldown) {
            return;
        }
        this.lastFire = now;
        
        let dx = 0, dy = 0;
        switch(this.direction) {
            case DIRECTION.UP: dy = -1; break;
            case DIRECTION.DOWN: dy = 1; break;
            case DIRECTION.LEFT: dx = -1; break;
            case DIRECTION.RIGHT: dx = 1; break;
        }
        
        let bulletX = this.x + this.width / 2;
        let bulletY = this.y + this.height / 2;
        
        bullets.push(new Bullet(bulletX, bulletY, dx * 4, dy * 4, this.isPlayer));
    }
    
    hit() {
        this.armor--;
        return this.armor <= 0;
    }
}

// 子弹对象
class Bullet {
    constructor(x, y, dx, dy, isPlayerBullet) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.isPlayerBullet = isPlayerBullet;
        this.speed = 5;
        this.active = true;
    }
    
    update() {
        if (!this.active) return;
        
        this.x += this.dx * this.speed / TILE_SIZE;
        this.y += this.dy * this.speed / TILE_SIZE;
        
        // 检查边界
        if (this.x < 0 || this.x > MAP_WIDTH || this.y < 0 || this.y > MAP_HEIGHT) {
            this.active = false;
            return;
        }
        
        // 检查地图碰撞
        const tileX = Math.floor(this.x);
        const tileY = Math.floor(this.y);
        const tile = map[tileY][tileX];
        
        if (tile === TILE.BRICK) {
            map[tileY][tileX] = TILE.EMPTY;
            this.active = false;
            if (this.isPlayerBullet) score += 10;
            return;
        }
        
        if (tile === TILE.STEEL || (tile === TILE.BASE && !this.isPlayerBullet)) {
            this.active = false;
            return;
        }
        
        if (tile === TILE.BASE && this.isPlayerBullet) {
            // 玩家打中基地，游戏结束
            this.active = false;
            gameOver(false);
            return;
        }
        
        // 检查坦克碰撞
        if (this.isPlayerBullet) {
            for (let enemy of enemies) {
                if (enemy.active && this.intersects(enemy)) {
                    if (enemy.hit(damage)) {
                        explosions.push(new Explosion(enemy.x * TILE_SIZE + TILE_SIZE, enemy.y * TILE_SIZE + TILE_SIZE));
                        enemiesDestroyed++;
                        score += enemy.type === TANK_TYPE.ENEMY_ARMOR ? 400 : 
                                  enemy.type === TANK_TYPE.ENEMY_FAST ? 200 : 100;
                        enemy.active = false;
                        updateEnemyIcons();
                    }
                    this.active = false;
                    break;
                }
            }
        } else {
            // 敌人子弹打中玩家
            if (player && player.active && this.intersects(player)) {
                this.active = false;
                playerDies();
                return;
            }
        }
    }
    
    intersects(tank) {
        if (!tank.active) return false;
        const bx = this.x;
        const by = this.y;
        return !(bx + 0.5 <= tank.x || 
                 bx - 0.5 >= tank.x + tank.width || 
                 by + 0.5 <= tank.y || 
                 by - 0.5 >= tank.y + tank.height);
    }
}

// 爆炸效果
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = TILE_SIZE * 1.5;
        this.active = true;
    }
    
    update() {
        this.radius += 2;
        if (this.radius >= this.maxRadius) {
            this.active = false;
        }
    }
    
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 165, 0, ${1 - this.radius / this.maxRadius})`;
        ctx.fill();
    }
}

// 第一关地图 - 正确的13x13
function createStage1() {
    // 初始化空地图 0~12
    map = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(TILE.EMPTY));
    
    // 边界钢铁墙 整个外围
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
                map[y][x] = TILE.STEEL;
            }
        }
    }
    
    // 随机砖块
    for (let i = 0; i < 30; i++) {
        let x = 1 + Math.floor(Math.random() * (MAP_WIDTH - 3));
        let y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 3));
        if (map[y][x] === TILE.EMPTY) {
            map[y][x] = Math.random() > 0.3 ? TILE.BRICK : TILE.STEEL;
        }
    }
    
    // 中心竖墙
    for (let y = 3; y <= 9; y++) {
        map[y][6] = y % 2 === 0 ? TILE.STEEL : TILE.BRICK;
    }
    
    // 基地在底部中心 (基地占 2x2)
    // y = 11, 从 x=6 开始
    map[11][6] = TILE.BASE;
    map[11][7] = TILE.BASE;
    map[12][6] = TILE.BASE;
    map[12][7] = TILE.BASE;
    
    // 保护基地的砖块
    map[10][5] = TILE.BRICK;
    map[10][6] = TILE.BRICK;
    map[10][7] = TILE.BRICK;
    map[10][8] = TILE.BRICK;
}

// 更新敌人数图标
function updateEnemyIcons() {
    enemyIconsEl.innerHTML = '';
    for (let i = 0; i < totalEnemies; i++) {
        const div = document.createElement('div');
        div.className = 'enemy-icon' + (i < enemiesDestroyed ? ' destroyed' : '');
        enemyIconsEl.appendChild(div);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // 绑定按钮事件
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    restartBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', () => {
        gameOverModal.classList.add('hidden');
        startGame();
    });
    
    // 绑定触屏控制
    bindTouchControls();
    
    // 键盘控制
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    createStage1();
    draw();
    updateEnemyIcons();
});

// 按键状态
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

function handleKeyDown(e) {
    switch(e.keyCode) {
        case 38: keys.up = true; player && (player.direction = DIRECTION.UP); e.preventDefault(); break;
        case 40: keys.down = true; player && (player.direction = DIRECTION.DOWN); e.preventDefault(); break;
        case 37: keys.left = true; player && (player.direction = DIRECTION.LEFT); e.preventDefault(); break;
        case 39: keys.right = true; player && (player.direction = DIRECTION.RIGHT); e.preventDefault(); break;
        case 32: if (gameRunning && !gamePaused && player && player.active) player.fire(); e.preventDefault(); break;
        case 80: togglePause(); e.preventDefault(); break;
    }
}

function handleKeyUp(e) {
    switch(e.keyCode) {
        case 38: keys.up = false; break;
        case 40: keys.down = false; break;
        case 37: keys.left = false; break;
        case 39: keys.right = false; break;
    }
}

// 触屏控制绑定
function bindTouchControls() {
    const btnMap = {
        btnUp: () => { if (player && player.active) player.direction = DIRECTION.UP; movePlayer(); },
        btnDown: () => { if (player && player.active) player.direction = DIRECTION.DOWN; movePlayer(); },
        btnLeft: () => { if (player && player.active) player.direction = DIRECTION.LEFT; movePlayer(); },
        btnRight: () => { if (player && player.active) player.direction = DIRECTION.RIGHT; movePlayer(); },
        btnFire: () => { if (gameRunning && !gamePaused && player && player.active) player.fire(); }
    };
    
    for (let [id, action] of Object.entries(btnMap)) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                action();
            }, {passive: false});
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                action();
            });
        }
    }
}

// 开始游戏
function startGame() {
    score = 0;
    stage = 1;
    lives = 3;
    enemiesDestroyed = 0;
    gameRunning = true;
    gamePaused = false;
    bullets = [];
    explosions = [];
    enemies = [];
    
    createStage1();
    spawnPlayer();
    spawnEnemies();
    updateStats();
    updateEnemyIcons();
    lastTime = Date.now();
    gameLoop();
}

// 生成玩家
function spawnPlayer() {
    player = new Tank(1, MAP_HEIGHT - 3, DIRECTION.UP, TANK_TYPE.PLAYER, true);
}

// 生成敌人
function spawnEnemies() {
    // 敌人从上方三个位置出来
    const spawnPoints = [
        [1, 1],
        [Math.floor(MAP_WIDTH / 2) - 1, 1],
        [MAP_WIDTH - 3, 1]
    ];
    
    let remaining = totalEnemies - enemies.filter(e => e.active).length;
    let toSpawn = Math.min(2, remaining);
    
    for (let i = 0; i < toSpawn; i++) {
        const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const type = Math.random() < 0.6 ? TANK_TYPE.ENEMY_BASIC :
                     Math.random() < 0.5 ? TANK_TYPE.ENEMY_FAST : TANK_TYPE.ENEMY_ARMOR;
        enemies.push(new Tank(sp[0], sp[1], DIRECTION.DOWN, type, false));
    }
}

function movePlayer() {
    if (!gameRunning || gamePaused || !player.active) return;
    
    let dx = 0, dy = 0;
    switch(player.direction) {
        case DIRECTION.UP: dy = -player.speed; break;
        case DIRECTION.DOWN: dy = player.speed; break;
        case DIRECTION.LEFT: dx = -player.speed; break;
        case DIRECTION.RIGHT: dx = player.speed; break;
    }
    player.move(dx, dy);
}

// 玩家死亡
function playerDies() {
    lives--;
    updateStats();
    explosions.push(new Explosion(player.x * TILE_SIZE + TILE_SIZE, player.y * TILE_SIZE + TILE_SIZE));
    player.active = false;
    
    if (lives <= 0) {
        gameOver(false);
    } else {
        setTimeout(() => {
            spawnPlayer();
        }, 1000);
    }
}

// AI 敌人移动
function updateEnemies(dt) {
    for (let enemy of enemies) {
        if (!enemy.active) continue;
        
        // 随机改变方向
        if (Math.random() < enemy.changeDirectionChance * (dt / 16)) {
            enemy.direction = Math.floor(Math.random() * 4);
        }
        
        let dx = 0, dy = 0;
        switch(enemy.direction) {
            case DIRECTION.UP: dy = -enemy.speed; break;
            case DIRECTION.DOWN: dy = enemy.speed; break;
            case DIRECTION.LEFT: dx = -enemy.speed; break;
            case DIRECTION.RIGHT: dx = enemy.speed; break;
        }
        
        if (!enemy.move(dx, dy)) {
            // 如果撞了，换方向
            enemy.direction = Math.floor(Math.random() * 4);
        }
        
        // AI 开火
        enemy.moveTimer += dt;
        if (enemy.moveTimer > 1000) {
            enemy.fire();
            enemy.moveTimer = 0;
        }
    }
    
    // 生成新敌人
    const activeEnemies = enemies.filter(e => e.active).length;
    if (activeEnemies < 2 && enemiesDestroyed + activeEnemies < totalEnemies) {
        spawnEnemies();
    }
}

// 检查关卡完成
function checkStageClear() {
    return enemiesDestroyed >= totalEnemies && enemies.filter(e => e.active).length === 0;
}

// 游戏结束
function gameOver(victory) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    gameOverTitleEl.textContent = victory ? '恭喜通关！' : '游戏结束';
    finalScoreEl.textContent = score;
    gameOverModal.classList.remove('hidden');
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

// 更新统计显示
function updateStats() {
    stageEl.textContent = stage;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
}

// 绘制地图
function drawMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];
            ctx.fillStyle = [
                COLORS.EMPTY,
                COLORS.BRICK,
                COLORS.STEEL,
                COLORS.WATER,
                COLORS.FOREST,
                COLORS.ICE,
                COLORS.BASE
            ][tile];
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            // 描边
            if (tile !== TILE.EMPTY) {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    
    // 绘制基地老鹰
    if (map[11][6] === TILE.BASE) {
        ctx.fillStyle = '#000';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🦅', 6.5 * TILE_SIZE, 11.5 * TILE_SIZE + 4);
    }
}

// 绘制坦克
function drawTank(tank) {
    if (!tank.active) return;
    
    const px = tank.x * TILE_SIZE;
    const py = tank.y * TILE_SIZE;
    const w = tank.width * TILE_SIZE;
    const h = tank.height * TILE_SIZE;
    
    ctx.fillStyle = tank.isPlayer ? COLORS.PLAYER : COLORS.ENEMY;
    ctx.fillRect(px, py, w, h);
    
    // 炮管
    ctx.fillStyle = '#000';
    let bw = 4, bh = 8;
    let bx = px + w/2 - bw/2;
    let by = py;
    
    switch(tank.direction) {
        case DIRECTION.UP: bx = px + w/2 - bw/2; by = py - bh; break;
        case DIRECTION.DOWN: bx = px + w/2 - bw/2; by = py + h; break;
        case DIRECTION.LEFT: bx = px - bh; by = py + h/2 - bw/2; bw = 8; bh = 4; break;
        case DIRECTION.RIGHT: bx = px + w; by = py + h/2 - bw/2; bw = 8; bh = 4; break;
    }
    ctx.fillRect(bx, by, bw, bh);
    
    // 边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, w, h);
    
    // 如果是装甲坦克，画个框表示
    if (tank.armor > 1) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
    }
}

// 绘制子弹
function drawBullet(bullet) {
    if (!bullet.active) return;
    ctx.fillStyle = COLORS.BULLET;
    ctx.fillRect(
        (bullet.x - 0.25) * TILE_SIZE,
        (bullet.y - 0.25) * TILE_SIZE,
        0.5 * TILE_SIZE,
        0.5 * TILE_SIZE
    );
}

// 主绘制函数
function draw() {
    // 清空画布
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawMap();
    
    // 绘制爆炸
    for (let explosion of explosions) {
        explosion.draw(ctx);
    }
    
    // 绘制子弹
    for (let bullet of bullets) {
        drawBullet(bullet);
    }
    
    // 绘制敌人
    for (let enemy of enemies) {
        drawTank(enemy);
    }
    
    // 绘制玩家
    if (player && player.active) {
        drawTank(player);
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    const now = Date.now();
    const dt = now - lastTime;
    lastTime = now;
    
    // 玩家连续移动
    if (player && player.active) {
        if (keys.up) { player.direction = DIRECTION.UP; movePlayer(); }
        if (keys.down) { player.direction = DIRECTION.DOWN; movePlayer(); }
        if (keys.left) { player.direction = DIRECTION.LEFT; movePlayer(); }
        if (keys.right) { player.direction = DIRECTION.RIGHT; movePlayer(); }
    }
    
    updateEnemies(dt);
    
    // 更新子弹
    for (let bullet of bullets) {
        bullet.update();
    }
    
    // 更新爆炸
    for (let explosion of explosions) {
        explosion.update();
    }
    
    // 清除不活跃的
    bullets = bullets.filter(b => b.active);
    explosions = explosions.filter(e => e.active);
    
    // 检查通关
    if (checkStageClear()) {
        score += 500;
        stage++;
        totalEnemies += 2;
        startNextStage();
    }
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// 下一关
function startNextStage() {
    createStage1();
    bullets = [];
    explosions = [];
    enemiesDestroyed = 0;
    enemies = [];
    if (player && !player.active) {
        spawnPlayer();
    }
    updateEnemyIcons();
    updateStats();
}

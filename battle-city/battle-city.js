// 坦克大战 Battle City - 完整重写
// 参考经典坦克大战规则实现

// 游戏常量
const TILE_SIZE = 24;
const MAP_WIDTH = 26;
const MAP_HEIGHT = 26;
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

// 方向
const DIR = {
    UP: {x: 0, y: -1},
    RIGHT: {x: 1, y: 0},
    DOWN: {x: 0, y: 1},
    LEFT: {x: -1, y: 0}
};

// 颜色
const COLOR = {
    BG: '#000000',
    PLAYER: '#00ff00',
    ENEMY: '#ff4444',
    BULLET: '#ffff00',
    BRICK: '#ad8850',
    STEEL: '#666666',
    WATER: '#0044ff',
    FOREST: '#008800',
    BASE: '#ffcc00'
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
let totalEnemies = 35;
let enemiesDestroyed = 0;
let gameRunning = false;
let gamePaused = false;
let lastTime = 0;
let animationId = null;

// DOM
const stageEl = document.getElementById('stage');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const enemyIconsEl = document.getElementById('enemyIcons');
const gameOverModal = document.getElementById('gameOverModal');

// 坦克类
class Tank {
    constructor(x, y, dir, isPlayer = false) {
        this.x = x; // 格子坐标
        this.y = y;
        this.width = 2; // 占2格
        this.height = 2;
        this.direction = dir;
        this.isPlayer = isPlayer;
        this.speed = isPlayer ? 2 : 1.5; // 像素每帧
        this.maxHp = isPlayer ? 1 : Math.random() > 0.8 ? 2 : 1;
        this.hp = this.maxHp;
        this.lastFire = 0;
        this.cooldown = isPlayer ? 300 : 800 + Math.random() * 500;
        this.active = true;
    }
    
    // 移动一格像素
    move(dt) {
        const speed = this.speed * dt / 16;
        const px = this.x * TILE_SIZE;
        const py = this.y * TILE_SIZE;
        
        let newPx = px + this.direction.x * speed;
        let newPy = py + this.direction.y * speed;
        
        // 边界检测
        if (newPx < 0 || newPx + this.width * TILE_SIZE > CANVAS_WIDTH) return false;
        if (newPy < 0 || newPy + this.height * TILE_SIZE > CANVAS_HEIGHT) return false;
        
        // 碰撞检测
        if (checkCollision(newPx, newPy, this.width * TILE_SIZE, this.height * TILE_SIZE)) {
            return false;
        }
        
        // 碰撞其他坦克
        for (let tank of [player, ...enemies]) {
            if (!tank.active || tank === this) continue;
            if (rectOverlap(
                newPx, newPy, this.width * TILE_SIZE, this.height * TILE_SIZE,
                tank.x * TILE_SIZE, tank.y * TILE_SIZE, tank.width * TILE_SIZE, tank.height * TILE_SIZE
            )) {
                return false;
            }
        }
        
        // 可以移动
        this.x = newPx / TILE_SIZE;
        this.y = newPy / TILE_SIZE;
        return true;
    }
    
    fire() {
        const now = Date.now();
        if (now - this.lastFire < this.cooldown) return;
        this.lastFire = now;
        
        // 子弹从坦克中心发出
        const cx = (this.x + this.width / 2) * TILE_SIZE;
        const cy = (this.y + this.height / 2) * TILE_SIZE;
        bullets.push(new Bullet(cx, cy, this.direction, this.isPlayer));
    }
    
    hit() {
        this.hp--;
        return this.hp <= 0;
    }
}

// 子弹类
class Bullet {
    constructor(x, y, dir, isPlayer) {
        this.x = x;
        this.y = y;
        this.direction = dir;
        this.isPlayer = isPlayer;
        this.speed = 5;
        this.active = true;
    }
    
    update() {
        if (!this.active) return;
        
        this.x += this.direction.x * this.speed;
        this.y += this.direction.y * this.speed;
        
        // 边界
        if (this.x < 0 || this.x > CANVAS_WIDTH || this.y < 0 || this.y > CANVAS_HEIGHT) {
            this.active = false;
            return;
        }
        
        // 碰撞地图
        const tileX = Math.floor(this.x / TILE_SIZE);
        const tileY = Math.floor(this.y / TILE_SIZE);
        const tile = map[tileY][tileX];
        
        if (tile === TILE.BRICK) {
            map[tileY][tileX] = TILE.EMPTY;
            this.active = false;
            if (this.isPlayer) score += 10;
            return;
        }
        
        if (tile === TILE.STEEL || (tile === TILE.BASE && !this.isPlayer)) {
            this.active = false;
            return;
        }
        
        if (tile === TILE.BASE && this.isPlayer) {
            // 玩家打中基地
            this.active = false;
            gameOver(false);
            return;
        }
        
        // 碰撞坦克
        if (this.isPlayer) {
            for (let enemy of enemies) {
                if (!enemy.active) continue;
                if (pointInRect(this.x, this.y, 
                    enemy.x * TILE_SIZE, enemy.y * TILE_SIZE, 
                    enemy.width * TILE_SIZE, enemy.height * TILE_SIZE)) {
                    if (enemy.hit()) {
                        addExplosion(
                            (enemy.x + enemy.width/2) * TILE_SIZE,
                            (enemy.y + enemy.height/2) * TILE_SIZE
                        );
                        enemiesDestroyed++;
                        enemy.active = false;
                        score += enemy.maxHp === 2 ? 400 : 100;
                        updateEnemyIcons();
                    }
                    this.active = false;
                    break;
                }
            }
        } else {
            // 敌人子弹打玩家
            if (player.active && pointInRect(this.x, this.y,
                player.x * TILE_SIZE, player.y * TILE_SIZE,
                player.width * TILE_SIZE, player.height * TILE_SIZE)) {
                this.active = false;
                player.hit();
                if (player.hp <= 0) {
                    addExplosion(
                        (player.x + player.width/2) * TILE_SIZE,
                        (player.y + player.height/2) * TILE_SIZE
                    );
                    playerDies();
                }
                return;
            }
        }
    }
    
    draw() {
        ctx.fillStyle = COLOR.BULLET;
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    }
}

// 爆炸
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = TILE_SIZE * 2;
        this.active = true;
    }
    
    update() {
        this.radius += 3;
        if (this.radius >= this.maxRadius) {
            this.active = false;
        }
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 165, 0, ${1 - this.radius / this.maxRadius})`;
        ctx.fill();
    }
}

// 矩形碰撞
function rectOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 <= x2 || x1 >= x2 + w2 || y1 + h1 <= y2 || y1 >= y2 + h2);
}

function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
}

// 检查移动碰撞
function checkCollision(px, py, w, h) {
    // 检查四个角
    const points = [
        [px, py],
        [px + w - 1, py],
        [px, py + h - 1],
        [px + w - 1, py + h - 1]
    ];
    
    for (let [x, y] of points) {
        const tx = Math.floor(x / TILE_SIZE);
        const ty = Math.floor(y / TILE_SIZE);
        const tile = map[ty][tx];
        if (tile === TILE.BRICK || tile === TILE.STEEL || tile === TILE.BASE) {
            return true; // 碰撞
        }
    }
    return false; // 没碰撞
}

// 添加爆炸
function addExplosion(x, y) {
    explosions.push(new Explosion(x, y));
}

// 创建第一关地图
function createStage() {
    // 初始化空地图
    map = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(TILE.EMPTY));
    
    // 边界钢铁
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
                map[y][x] = TILE.STEEL;
            }
        }
    }
    
    // 随机砖块
    for (let i = 0; i < 100; i++) {
        let x = 1 + Math.floor(Math.random() * (MAP_WIDTH - 4));
        let y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 6));
        if (map[y][x] === TILE.EMPTY) {
            map[y][x] = Math.random() > 0.3 ? TILE.BRICK : TILE.STEEL;
        }
    }
    
    // 中心竖墙
    for (let y = 5; y <= 20; y++) {
        map[y][12] = y % 2 === 0 ? TILE.STEEL : TILE.BRICK;
    }
    
    // 基地在底部中心 2x2
    const baseY = MAP_HEIGHT - 4;
    map[baseY][12] = TILE.BASE;
    map[baseY][13] = TILE.BASE;
    map[baseY+1][12] = TILE.BASE;
    map[baseY+1][13] = TILE.BASE;
    
    // 保护基地
    map[baseY-1][11] = TILE.BRICK;
    map[baseY-1][12] = TILE.BRICK;
    map[baseY-1][13] = TILE.BRICK;
    map[baseY-1][14] = TILE.BRICK;
    
    // 左右砖墙
    for (let y = 2; y <= baseY-2; y += 3) {
        map[y][3] = TILE.BRICK;
        map[y][MAP_WIDTH - 4] = TILE.BRICK;
    }
}

// 更新敌人图标
function updateEnemyIcons() {
    enemyIconsEl.innerHTML = '';
    for (let i = 0; i < totalEnemies; i++) {
        const div = document.createElement('div');
        div.className = 'enemy-icon' + (i < enemiesDestroyed ? ' destroyed' : '');
        enemyIconsEl.appendChild(div);
    }
}

// 玩家死亡
function playerDies() {
    lives--;
    updateStats();
    if (lives <= 0) {
        gameOver(false);
    } else {
        setTimeout(() => {
            spawnPlayer();
        }, 1000);
    }
}

// 生成玩家
function spawnPlayer() {
    player = new Tank(2, MAP_HEIGHT - 4, DIR.UP, true);
}

// 生成敌人
function spawnEnemy() {
    const spawnPoints = [
        [2, 2],
        [Math.floor(MAP_WIDTH / 2) - 1, 2],
        [MAP_WIDTH - 4, 2]
    ];
    
    const activeEnemies = enemies.filter(e => e.active).length;
    const remaining = totalEnemies - enemiesDestroyed - activeEnemies;
    if (remaining <= 0 || activeEnemies >= 2) return;
    
    const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const speed = Math.random() > 0.3 ? 1.5 : 2.5;
    const hp = Math.random() > 0.85 ? 2 : 1;
    const enemy = new Tank(sp[0], sp[1], DIR.DOWN, false);
    enemy.speed = speed;
    enemy.maxHp = hp;
    enemy.hp = hp;
    enemies.push(enemy);
}

// AI 敌人
function updateEnemies(dt) {
    for (let enemy of enemies) {
        if (!enemy.active) continue;
        
        // 随机换方向
        if (Math.random() < 0.02 * (dt / 16)) {
            const dirs = [DIR.UP, DIR.RIGHT, DIR.DOWN, DIR.LEFT];
            enemy.direction = dirs[Math.floor(Math.random() * 4)];
        }
        
        if (!enemy.move(dt)) {
            // 撞了换方向
            const dirs = [DIR.UP, DIR.RIGHT, DIR.DOWN, DIR.LEFT];
            enemy.direction = dirs[Math.floor(Math.random() * 4)];
        }
        
        // 开火
        if (Math.random() < 0.01 * dt) {
            enemy.fire();
        }
    }
    
    // 生成新敌人
    spawnEnemy();
}

// 检查过关
function checkStageClear() {
    return enemiesDestroyed >= totalEnemies && enemies.filter(e => e.active).length === 0;
}

// 游戏结束
function gameOver(victory) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    document.getElementById('gameOverTitle').textContent = victory ? '恭喜通关！' : '游戏结束';
    document.getElementById('finalScore').textContent = score;
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

// 更新统计
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
                COLOR.BG,
                COLOR.BRICK,
                COLOR.STEEL,
                COLOR.WATER,
                COLOR.FOREST,
                '#88ffff',
                COLOR.BASE
            ][tile];
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            if (tile !== TILE.EMPTY) {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    
    // 基地老鹰
    if (map[MAP_HEIGHT - 4][12] === TILE.BASE) {
        ctx.fillStyle = '#000';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🦅', (12.5) * TILE_SIZE, (MAP_HEIGHT - 3.5) * TILE_SIZE);
    }
}

// 绘制坦克
function drawTank(tank) {
    if (!tank.active) return;
    
    const x = tank.x * TILE_SIZE;
    const y = tank.y * TILE_SIZE;
    const w = tank.width * TILE_SIZE;
    const h = tank.height * TILE_SIZE;
    
    ctx.fillStyle = tank.isPlayer ? COLOR.PLAYER : COLOR.ENEMY;
    ctx.fillRect(x, y, w, h);
    
    // 炮管
    ctx.fillStyle = '#000';
    let bw = 4, bh = 10;
    let bx = x + w/2 - bw/2;
    let by = y;
    
    if (tank.direction === DIR.UP) {
        bx = x + w/2 - bw/2; by = y - bh;
    } else if (tank.direction === DIR.DOWN) {
        bx = x + w/2 - bw/2; by = y + h;
    } else if (tank.direction === DIR.LEFT) {
        bx = x - bh; by = y + h/2 - bw/2;
        [bw, bh] = [bh, bw];
    } else if (tank.direction === DIR.RIGHT) {
        bx = x + w; by = y + h/2 - bw/2;
        [bw, bh] = [bh, bw];
    }
    ctx.fillRect(bx, by, bw, bh);
    
    // 边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    
    // 装甲坦克显示
    if (tank.maxHp > 1) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    }
}

// 主绘制
function draw() {
    // 清屏
    ctx.fillStyle = COLOR.BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawMap();
    
    // 爆炸
    for (let exp of explosions) {
        exp.draw(ctx);
    }
    
    // 子弹
    for (let bullet of bullets) {
        bullet.draw();
    }
    
    // 敌人
    for (let enemy of enemies) {
        drawTank(enemy);
    }
    
    // 玩家
    if (player && player.active) {
        drawTank(player);
    }
}

// 主循环
function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    const now = Date.now();
    const dt = now - lastTime;
    lastTime = now;
    
    // 玩家移动
    if (player && player.active) {
        player.move(dt);
        // 按住连续开火
        if (keys.space) {
            player.fire();
        }
    }
    
    // 更新敌人
    updateEnemies(dt);
    
    // 更新子弹
    for (let bullet of bullets) {
        bullet.update();
    }
    bullets = bullets.filter(b => b.active);
    
    // 更新爆炸
    for (let exp of explosions) {
        exp.update();
    }
    explosions = explosions.filter(e => e.active);
    
    // 检查过关
    if (checkStageClear()) {
        score += 500;
        stage++;
        totalEnemies += 5;
        nextStage();
    }
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// 下一关
function nextStage() {
    createStage();
    bullets = [];
    explosions = [];
    enemies = [];
    enemiesDestroyed = 0;
    if (!player.active) {
        spawnPlayer();
    }
    updateEnemyIcons();
    updateStats();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // 绑定事件
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('restartBtn').addEventListener('click', startGame);
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        startGame();
    });
    
    // 触屏
    bindTouch();
    
    // 键盘
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    createStage();
    draw();
    updateEnemyIcons();
});

// 按键状态
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false
};

function handleKeyDown(e) {
    switch(e.keyCode) {
        case 38: keys.up = true; if (player) player.direction = DIR.UP; break;
        case 40: keys.down = true; if (player) player.direction = DIR.DOWN; break;
        case 37: keys.left = true; if (player) player.direction = DIR.LEFT; break;
        case 39: keys.right = true; if (player) player.direction = DIR.RIGHT; break;
        case 32: keys.space = true; e.preventDefault(); break;
        case 80: togglePause(); e.preventDefault(); break;
    }
}

function handleKeyUp(e) {
    switch(e.keyCode) {
        case 38: keys.up = false; break;
        case 40: keys.down = false; break;
        case 37: keys.left = false; break;
        case 39: keys.right = false; break;
        case 32: keys.space = false; break;
    }
}

// 触屏绑定
function bindTouch() {
    const btnMap = {
        btnUp: () => { if (player && player.active) player.direction = DIR.UP; },
        btnDown: () => { if (player && player.active) player.direction = DIR.DOWN; },
        btnLeft: () => { if (player && player.active) player.direction = DIR.LEFT; },
        btnRight: () => { if (player && player.active) player.direction = DIR.RIGHT; },
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
    totalEnemies = 35;
    
    createStage();
    spawnPlayer();
    updateEnemyIcons();
    updateStats();
    lastTime = Date.now();
    gameLoop();
    if (gameOverModal) gameOverModal.style.display = 'none';
}

// 俄罗斯方块游戏核心逻辑

// 游戏配置
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 20;

// 颜色定义
const COLORS = [
    null,
    '#00f0f0', // I - 青色
    '#0000f0', // J - 蓝色
    '#f0a000', // L - 橙色
    '#f0f000', // O - 黄色
    '#00f000', // S - 绿色
    '#a000f0', // T - 紫色
    '#f00000'  // Z - 红色
];

// 方块形状定义 (Tetrominos)
const SHAPES = [
    [], // 占位
    [[0, 0, 0, 0],  // I
     [1, 1, 1, 1],
     [0, 0, 0, 0],
     [0, 0, 0, 0]],
    [[2, 0, 0],     // J
     [2, 2, 2],
     [0, 0, 0]],
    [[0, 0, 3],     // L
     [3, 3, 3],
     [0, 0, 0]],
    [[4, 4],         // O
     [4, 4]],
    [[0, 5, 5],     // S
     [5, 5, 0],
     [0, 0, 0]],
    [[0, 6, 0],     // T
     [6, 6, 6],
     [0, 0, 0]],
    [[7, 7, 0],     // Z
     [0, 7, 7],
     [0, 0, 0]]
];

// 游戏状态
let canvas, ctx;
let nextCanvas, nextCtx;
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let gameRunning = false;
let gamePaused = false;
let dropInterval = 1000; // 毫秒
let lastDropTime = 0;
let animationId = null;

// DOM 元素
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const finalScoreElement = document.getElementById('finalScore');
const gameOverModal = document.getElementById('gameOverModal');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');
    
    // 绑定事件
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    restartBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', () => {
        gameOverModal.classList.add('hidden');
        startGame();
    });
    
    // 键盘控制
    document.addEventListener('keydown', handleKeyPress);
    
    // 绑定触屏控制
    bindTouchControls();
    
    // 初始化空棋盘
    initBoard();
    drawBoard();
});

// 初始化棋盘
function initBoard() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
}

// 创建新方块
function createPiece(type) {
    const shape = SHAPES[type].map(row => [...row]);
    return {
        type: type,
        shape: shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0
    };
}

// 随机生成下一个方块
function getRandomPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    return createPiece(type);
}

// 绘制方块网格
function drawMatrix(matrix, offsetX, offsetY, blockSize, context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = COLORS[value];
                context.fillRect(
                    (x + offsetX) * blockSize + 1,
                    (y + offsetY) * blockSize + 1,
                    blockSize - 2,
                    blockSize - 2
                );
                context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                context.lineWidth = 2;
                context.strokeRect(
                    (x + offsetX) * blockSize + 1,
                    (y + offsetY) * blockSize + 1,
                    blockSize - 2,
                    blockSize - 2
                );
                // 添加高光效果
                context.fillStyle = 'rgba(255, 255, 255, 0.3)';
                context.fillRect(
                    (x + offsetX) * blockSize + 3,
                    (y + offsetY) * blockSize + 3,
                    blockSize - 8,
                    4
                );
            }
        });
    });
}

// 绘制网格线
function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // 竖线
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
    
    // 横线
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
        ctx.stroke();
    }
}

// 绘制整个游戏画面
function drawBoard() {
    // 清空画布
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();
    
    // 绘制已落下的方块
    drawMatrix(board, 0, 0, BLOCK_SIZE, ctx);
    
    // 绘制当前方块
    if (currentPiece) {
        drawMatrix(currentPiece.shape, currentPiece.x, currentPiece.y, BLOCK_SIZE, ctx);
    }
    
    // 绘制下一个方块预览
    drawNextPiece();
}

// 绘制下一个方块预览
function drawNextPiece() {
    nextCtx.fillStyle = '#0a0a1a';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        // 居中显示
        const offsetX = (4 - nextPiece.shape[0].length) / 2;
        const offsetY = (4 - nextPiece.shape.length) / 2;
        drawMatrix(nextPiece.shape, offsetX, offsetY, NEXT_BLOCK_SIZE, nextCtx);
    }
}

// 碰撞检测
function collide(board, piece) {
    const [m, o] = [piece.shape, piece];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && 
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

// 合并方块到棋盘
function merge(board, piece) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + piece.y][x + piece.x] = value;
            }
        });
    });
}

// 旋转方块 - 顺时针90度
function rotate(piece) {
    const original = piece.shape;
    const rows = original.length;
    const cols = original[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    
    // 顺时针旋转 90 度
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = original[r][c];
        }
    }
    return rotated;
}

// 移动方块
function movePiece(dir) {
    if (!gameRunning || gamePaused) return;
    currentPiece.x += dir;
    if (collide(board, currentPiece)) {
        currentPiece.x -= dir;
    }
    drawBoard();
}

// 旋转当前方块
function rotatePiece() {
    if (!gameRunning || gamePaused) return;
    const oldShape = currentPiece.shape;
    currentPiece.shape = rotate(currentPiece);
    // 如果旋转后碰撞，尝试左右移动避让（墙踢）
    if (collide(board, currentPiece)) {
        currentPiece.shape = oldShape;
    }
    drawBoard();
}

// 让方块下落
function dropPiece() {
    if (!gameRunning || gamePaused) return;
    currentPiece.y++;
    if (collide(board, currentPiece)) {
        currentPiece.y--;
        merge(board, currentPiece);
        clearLines();
        spawnPiece();
        checkGameOver();
    }
    lastDropTime = Date.now();
    drawBoard();
}

// 直接落到底
function dropToBottom() {
    if (!gameRunning || gamePaused) return;
    while (!collide(board, currentPiece)) {
        currentPiece.y++;
    }
    currentPiece.y--;
    merge(board, currentPiece);
    clearLines();
    spawnPiece();
    checkGameOver();
    lastDropTime = Date.now();
    drawBoard();
}

// 清除满行并计算分数
function clearLines() {
    let linesCleared = 0;
    
    outer: for (let y = ROWS - 1; y > 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        
        // 清除这一行，上面的掉下来
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        y++;
        linesCleared++;
    }
    
    if (linesCleared > 0) {
        // 计分规则：消行越多分数越高
        // 1行 = 100 * level, 2行 = 300 * level, 3行 = 500 * level, 4行 = 800 * level
        const scoreMap = [0, 100, 300, 500, 800];
        score += scoreMap[linesCleared] * level;
        lines += linesCleared;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100); // 随着等级提高加速
        
        updateStats();
    }
}

// 更新分数显示
function updateStats() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
}

// 生成新方块
function spawnPiece() {
    currentPiece = nextPiece || getRandomPiece();
    nextPiece = getRandomPiece();
}

// 检查游戏是否结束
function checkGameOver() {
    if (collide(board, currentPiece)) {
        gameOver();
    }
}

// 游戏结束
function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    finalScoreElement.textContent = score;
    gameOverModal.classList.remove('hidden');
}

// 开始游戏
function startGame() {
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    initBoard();
    spawnPiece();
    updateStats();
    gameRunning = true;
    gamePaused = false;
    gameOverModal.classList.add('hidden');
    lastDropTime = Date.now();
    gameLoop();
}

// 暂停切换
function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    if (!gamePaused) {
        lastDropTime = Date.now();
        gameLoop();
    }
}

// 键盘处理
function handleKeyPress(e) {
    switch (e.keyCode) {
        case 37: // 左箭头
            movePiece(-1);
            e.preventDefault();
            break;
        case 39: // 右箭头
            movePiece(1);
            e.preventDefault();
            break;
        case 40: // 下箭头
            dropPiece();
            e.preventDefault();
            break;
        case 38: // 上箭头 - 旋转
            rotatePiece();
            e.preventDefault();
            break;
        case 32: // 空格 - 落底
            dropToBottom();
            e.preventDefault();
            break;
        case 80: // P - 暂停
            togglePause();
            e.preventDefault();
            break;
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    const now = Date.now();
    if (now - lastDropTime > dropInterval) {
        dropPiece();
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// 绑定触屏按钮事件
function bindTouchControls() {
    const touchLeft = document.getElementById('touchLeft');
    const touchRight = document.getElementById('touchRight');
    const touchRotate = document.getElementById('touchRotate');
    const touchDown = document.getElementById('touchDown');
    const touchDrop = document.getElementById('touchDrop');
    
    // 使用防抖动，防止 touchstart + click 触发两次
    let lastTriggerTime = 0;
    
    function handleAction(e, action) {
        const now = Date.now();
        // 如果 300ms 内已经触发过一次，就忽略这次（通常是 touchstart + click 重复）
        if (now - lastTriggerTime < 300) {
            return;
        }
        lastTriggerTime = now;
        e.preventDefault();
        action();
    }
    
    if (touchLeft) {
        touchLeft.addEventListener('click', (e) => handleAction(e, () => movePiece(-1)));
        touchLeft.addEventListener('touchstart', (e) => handleAction(e, () => movePiece(-1)), {passive: false});
    }
    
    if (touchRight) {
        touchRight.addEventListener('click', (e) => handleAction(e, () => movePiece(1)));
        touchRight.addEventListener('touchstart', (e) => handleAction(e, () => movePiece(1)), {passive: false});
    }
    
    if (touchRotate) {
        touchRotate.addEventListener('click', (e) => handleAction(e, rotatePiece));
        touchRotate.addEventListener('touchstart', (e) => handleAction(e, rotatePiece), {passive: false});
    }
    
    if (touchDown) {
        touchDown.addEventListener('click', (e) => handleAction(e, dropPiece));
        touchDown.addEventListener('touchstart', (e) => handleAction(e, dropPiece), {passive: false});
    }
    
    if (touchDrop) {
        touchDrop.addEventListener('click', (e) => handleAction(e, dropToBottom));
        touchDrop.addEventListener('touchstart', (e) => handleAction(e, dropToBottom), {passive: false});
    }
    
    // 阻止触摸缩放
    document.addEventListener('touchmove', (e) => {
        if (e.scale !== 1) { e.preventDefault(); }
    }, {passive: false});
    
    // 双击缩放禁用
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, {passive: false});
}

// 初始化时绑定触屏控制
document.addEventListener('DOMContentLoaded', () => {
    bindTouchControls();
});

# 俄罗斯方块开发文档

## 项目简介

基于 HTML5 + JavaScript 开发的经典俄罗斯方块游戏，支持键盘和虚拟按钮操作，适配 PC 和移动端，已部署到 GitHub Pages。

**在线地址：** https://xhb-ai.github.io/Test/

## 功能特性

### 核心功能
- ✅ 七种标准 Tetromino 方块（I, J, L, O, S, T, Z）
- ✅ 正确的顺时针 90 度旋转
- ✅ 碰撞检测
- ✅ 消行判定
- ✅ 下一个方块预览
- ✅ 分数/等级/消行数统计
- ✅ 等级提升加速机制

### 操作方式
- **键盘操作**：← → 移动，↑ 旋转，↓ 加速，空格 落底，P 暂停
- **虚拟按钮**：所有设备都显示，支持触摸和点击

### 响应式设计
- 移动端竖屏布局：从上到下排列
- 移动端横屏布局：三栏排列
- PC 端：三栏布局，支持键盘+鼠标点击

## 技术架构

### 文件结构
```
tetris/
├── index.html      # 主页面结构
├── style.css       # 样式表，响应式布局
├── tetris.js       # 游戏核心逻辑
├── server.py       # 本地测试服务器
├── README.md       # 项目说明
└── DEVLOG.md       # 开发文档
```

### 核心数据结构

#### 1. 棋盘
```javascript
board = Array(ROWS).fill().map(() => Array(COLS).fill(0))
- ROWS = 20 行数
- COLS = 10  列数
- 0 表示空，非0表示方块颜色编号
```

#### 2. 方块定义
```javascript
const SHAPES = [...] // 七种方块形状矩阵
const COLORS = [...] // 对应颜色
```

每个方块对象：
```javascript
{
  type: number,      // 方块类型 1-7
  shape: number[][], // 形状矩阵
  x: number,         // X坐标
  y: number          // Y坐标
}
```

### 核心算法

#### 顺时针旋转 90 度
```javascript
function rotate(piece) {
  const original = piece.shape;
  const rows = original.length;
  const cols = original[0].length;
  const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
  
  // 顺时针旋转公式
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = original[r][c];
    }
  }
  return rotated;
}
```

#### 碰撞检测
```javascript
function collide(board, piece) {
  // 检查每个非0格子是否和已有方块碰撞/出界
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
```

#### 消行处理
- 从下往上检查每一行是否满
- 满行删除，上面行数整体下落
- 根据消行数计算分数：`[0, 100, 300, 500, 800] × 等级`

### 计分规则

| 消行数 | 分数 |
|--------|------|
| 1行 | 100 × 等级 |
| 2行 | 300 × 等级 |
| 3行 | 500 × 等级 |
| 4行 | 800 × 等级 |

### 难度递增

- 每消除 10 行提升一级
- 下落间隔：`max(100ms, 1000ms - (level-1) × 100ms)`
- 最高速度：100ms 一格

## 开发日志

### 2026-03-18

#### v1.0 初始版本
- 完成核心游戏逻辑
- 支持键盘操作
- 基础界面

#### v1.1 移动端适配
- 增加虚拟方向按钮
- 响应式布局适配手机
- 横屏/竖屏不同布局

#### v1.2 Bug 修复
- **问题1**：移动跳两格
  - 原因：touchstart 和 click 同时绑定，触摸手机触发两次事件
  - 修复：确认事件绑定，避免重复触发
- **问题2**：旋转方向错误
  - 原因：原算法是逆时针旋转
  - 修复：改为标准顺时针 90 度旋转算法

#### v1.3 界面优化
- 所有设备始终显示虚拟按钮
- 更好的十字方向键布局
- 按钮更大更容易点击

## 部署

### GitHub Pages 部署
- 源代码：`main` 分支
- 部署分支：`gh-pages` 分支
- 访问：`https://<用户名>.github.io/<仓库名>/`

### 本地运行
```bash
cd tetris
python3 server.py [端口]
# 打开浏览器访问 http://localhost:端口
```

## 已知问题 & 后续优化

- [ ] 支持滑动手势控制
- [ ] 增加音效
- [ ] 保存最高分到本地存储
- [ ] 开始游戏前显示操作说明

## 技术总结

俄罗斯方块核心难点：
1. **旋转算法** - 正确的矩阵旋转
2. **碰撞检测** - 边界和已有方块检测
3. **消行处理** - 删除满行后上方下落
4. **移动端适配** - 触摸事件避免重复触发

这是一个完整的前端小项目，纯原生 JavaScript，无需任何框架，可以直接运行。

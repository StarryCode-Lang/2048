# 2048 · 数字合成

一款可以直接在手机、平板和电脑浏览器中游玩的完整 2048 游戏。支持 4×4、5×5、6×6 棋盘、液态玻璃界面、流畅滑动动画、背景音乐、多语言和公平的 AI 自动挑战。

![2048 · 数字合成](./public/og.png)

## 在线体验

[打开在线版本](https://mobile-2048-game.roberfan.chatgpt.site)

## 功能

- 4×4、5×5、6×6 三种棋盘，所有格子严格等大
- 鼠标、触摸滑动、方向键和 W/A/S/D 操作
- 跟手的移动、合并、光晕与粒子反馈
- 支持浅色、深色和 Liquid Glass 视觉风格
- 中文、English、Français、Español、Русский、العربية
- AI 自动挑战，支持极速、100ms、500ms 三档速度
- AI 挑战全程禁止撤回，不预知下一随机块
- 当前局和历史最高分完整日志导出
- 本地自动保存进度、主题、语言及各棋盘最高分

## 从源码运行

需要 [Node.js](https://nodejs.org/) 22.13 或更高版本。npm 会随 Node.js 一起安装。

```bash
git clone https://github.com/StarryCode-Lang/2048.git
cd 2048
npm ci
npm run dev
```

然后打开终端显示的本地地址，通常是 `http://localhost:5173`。

不需要先运行 `npm run build`；开发模式可以直接启动。

## 生产构建

```bash
npm ci
npm run build
npm start
```

默认的 `dev`、`build` 和 `start` 命令均可在 Windows、macOS 和 Linux 使用。

## 测试

```bash
npm run lint
npm run test:fairness
npm run test:ai
npm run test:replay
npm run test:i18n
npm test
```

公平性测试覆盖经典 2048 的核心规则：每次有效移动后，从所有空格中等概率选择一个位置，90% 生成 2、10% 生成 4；每个合并结果在同一步中只能合并一次；分数等于新合并数字之和。

## 技术栈

- React 19 + TypeScript
- Vinext / Vite
- Web Worker AI 搜索
- Web Audio API
- IndexedDB + LocalStorage

## 项目结构

```text
app/
├── ai/          # AI 搜索 Worker 与时间预算
├── game/        # 官方规则、移动与随机生成
├── i18n/        # 六种界面语言
├── replay/      # 完整对局日志编码与导出
├── page.tsx     # 游戏界面与交互
└── globals.css  # 响应式 Liquid Glass 样式
build/           # Sites 构建适配
public/          # 图标与社交预览图
scripts/         # 构建验证与 AI 基准
tests/           # 规则、AI、回放和国际化测试
worker/          # Cloudflare Worker 入口
```

根目录只保留框架、TypeScript、样式工具及部署流程必须读取的配置文件。项目约束和交接说明见 [`AGENTS.md`](./AGENTS.md)。

## 许可证

[MIT](./LICENSE)

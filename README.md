# 2048 · 数字合成

一款可以直接在手机、平板和电脑浏览器中游玩的完整 2048 游戏。支持 4×4、5×5、6×6 棋盘、液态玻璃界面、流畅滑动动画、背景音乐、多语言和公平的 AI 自动挑战。

![2048 · 数字合成](./public/og.png)

## 在线体验

[打开在线版本](https://ai2048.roberfan.chatgpt.site)

## 功能

- 4×4、5×5、6×6 三种棋盘，所有格子严格等大
- 鼠标、触摸滑动、方向键和 W/A/S/D 操作
- 跟手的移动、合并、光晕与粒子反馈
- 支持浅色、深色和 Liquid Glass 视觉风格
- 中文、English、Français、Español、Русский、العربية
- AI 自动挑战，4×4 使用高吞吐位棋盘 Expectimax，支持极速、100ms、500ms 三档速度；可按需切换 Expert afterstate 实验引擎
- AI 挑战全程禁止撤回，不预知下一随机块
- 当前局和历史最高分完整日志导出，也可导入并验证完整回放
- 本地自动保存进度、主题、语言及各棋盘最高分；支持安装为离线网页应用

## 数据与隐私

游戏不需要账号，也不接入广告或行为分析。进度、偏好和历史最高分只保存在当前浏览器中，不会上传到服务器；只有在你主动点击导出时，浏览器才会生成对局日志文件。清除站点数据会同时清除本地进度。

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
npm run build:verified
npm start
```

默认的 `dev`、`build`、`build:verified`、`start` 和 `verify` 命令均可在 Windows、macOS 和 Linux 使用。`install:ci` 仅供 Sites 的 Linux 构建环境调用。

## 测试

```bash
npm run verify
```

`verify` 会依次执行 TypeScript、ESLint、公平规则、AI、多种子质量门槛、回放重建、六语言、生产构建、真实资源路由和完整依赖审计。也可以单独运行 `npm run test:fairness`、`npm run test:ai`、`npm run test:replay`、`npm run test:i18n`、`npm run test:rendered`、`npm run audit:all` 或 `npm run audit:prod`。

公平性测试覆盖经典 2048 的核心规则：每次有效移动后，从所有空格中等概率选择一个位置，90% 生成 2、10% 生成 4；每个合并结果在同一步中只能合并一次；分数等于新合并数字之和。`npm run benchmark:ai:suite` 可运行 16 个固定种子的离线 AI 基准。

## 技术栈

- React 19 + TypeScript
- Vinext / Vite
- Web Worker AI 搜索与 Expert afterstate 实验引擎
- Web Audio API
- IndexedDB + LocalStorage

## 项目结构

```text
app/
├── ai/          # AI 搜索 Worker、4×4 位棋盘、时间预算与确定性模拟
├── audio/       # 背景音乐与合并音效
├── components/  # 可复用界面组件
├── game/        # 官方规则、移动、随机生成与版本化存档
├── hooks/       # 焦点管理等交互 Hook
├── i18n/        # 六种界面语言
├── replay/      # 完整对局日志编码、导入、持久化与重建
├── page.tsx     # 游戏界面与交互
└── globals.css  # 响应式 Liquid Glass 样式
build/           # Sites 构建适配
public/          # 图标、社交预览图、PWA 清单与离线 Service Worker
scripts/         # 构建验证与 AI 基准
tests/           # 规则、AI、回放和国际化测试
worker/          # Cloudflare Worker 入口
docs/            # AI 架构、研究依据与验证合同
```

根目录只保留框架、TypeScript、样式工具、许可证及部署流程必须读取的配置文件；依赖、构建结果、发布缓存、测试报告和编辑器临时文件均由 `.gitignore` 排除。AI 的信息边界、实现取舍和基准方法见 [`docs/ai.md`](./docs/ai.md)，贡献与发布流程见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)，安全问题报告方式见 [`SECURITY.md`](./SECURITY.md)，项目约束和交接说明见 [`AGENTS.md`](./AGENTS.md)，第三方授权见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。

## 许可证

[MIT](./LICENSE)

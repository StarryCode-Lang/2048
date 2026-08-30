# 代码结构与可塑性

当前基线：`package.json` 版本 `2.0.0`。本文件与 `CHANGELOG.md`、`docs/release.md` 一起随每次发布更新。

## 目录边界

```text
app/
├── ai/          # 搜索、位棋盘、Expert、Worker 与速度预算
├── audio/       # 音乐与合并音效
├── game/        # 规则、随机生成、存档与启动工具
├── hooks/       # 跨界面交互 Hook
├── i18n/        # 六种官方语言
├── replay/      # 日志、导入、持久化与确定性重建
├── ui/          # 玻璃菜单、控件图标等可复用界面原语
├── page.tsx     # 页面级状态编排与游戏流程；不承载通用 UI 原语
└── globals.css  # 全局设计令牌、响应式布局与可访问性降级
```

`page.tsx` 是当前唯一的页面控制器，负责把游戏、AI、回放和 UI 状态串起来；纯 UI 原语放在 `app/ui/`，规则和持久化不得反向依赖 UI。文件形状检查由 `npm run check:structure` 固定门槛，新增业务不应继续把页面控制器推过既定上限。

## 变更规则

- 规则、AI 与回放改动必须留在对应领域目录，并配套回归测试。
- 可复用的菜单、按钮、图标和焦点行为放在 `app/ui/` 或 `app/hooks/`，不要复制到页面控制器。
- 新增用户可见文字必须同时更新 `app/i18n/messages.ts`、README 功能说明和 `docs/accessibility.md`（如涉及交互）。
- 构建产物、缓存、测试报告和本地导出由 `.gitignore` 排除，不通过移动源码来“整理”生成目录。

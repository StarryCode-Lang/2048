# 2048 项目约定

## 目标与边界

- 同一份 `main` 源码同时服务 GitHub 开发者和在线 Sites 玩家。
- 保持经典 2048 公平规则：有效移动后从空格等概率选位，90% 生成 2、10% 生成 4；同一步每个新块只合并一次。
- AI 以得分优先、大数字块次优先；不得预知随机结果或自动撤回。
- 不因目录整理改变游戏、AI、回放格式或视觉行为。

## 目录职责

- `app/ai/`：AI 搜索、4×4 位棋盘、通用回退、速度预算与确定性模拟。
- `app/game/`：棋盘规则、随机生成与版本化本地存档。
- `app/replay/`：日志压缩、导入、持久化、导出和确定性重建。
- `app/i18n/`：联合国六种官方语言。
- `build/`、`worker/`：Sites/Cloudflare 发布适配层。
- `public/`：图标、PWA Manifest 与离线 Service Worker。
- `scripts/`：构建、包体预算与基准命令；`tests/`：自动化回归测试。
- `docs/ai.md`：AI 信息边界、算法取舍、研究来源和基准合同。

## 修改后的最低验证

```bash
npm run lint
npm run test:fairness
npm run test:ai
npm run test:replay
npm run test:i18n
npm run check:bundle
npm run build
```

更新线上版本时先提交并推送同一 SHA，再通过 Sites 创建版本和部署；不要维护两套分叉源码。

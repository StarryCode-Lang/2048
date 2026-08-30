# 2048 项目约定

当前文档基线：`v2.0.0`。用户可见行为、源码结构或发布流程变化时，必须同步更新相关文档并在 `CHANGELOG.md` 留痕。

## 目标与边界

- 同一份 `main` 源码同时服务 GitHub 开发者和在线 Sites 玩家。
- 保持经典 2048 公平规则：有效移动后从空格等概率选位，90% 生成 2、10% 生成 4；同一步每个新块只合并一次。
- AI 以得分优先、大数字块次优先；不得预知随机结果或自动撤回。
- 不因目录整理改变游戏、AI、回放格式或视觉行为。

## 目录职责

- `app/ai/`：AI 搜索、4×4 位棋盘、自适应专家、通用回退、速度预算与确定性模拟。
- `app/game/`：棋盘规则、随机生成与版本化本地存档。
- `app/replay/`：日志压缩、导入、持久化、导出和确定性重建。
- `app/ui/`：可复用界面原语、玻璃菜单、控件图标与视觉交互。
- `app/i18n/`：联合国六种官方语言。
- `build/`、`worker/`：Sites/Cloudflare 发布适配层。
- `public/`：图标、PWA Manifest 与离线 Service Worker。
- `scripts/`：构建、包体预算与基准命令；`tests/`：自动化回归测试。
- `docs/architecture.md`：目录边界、依赖方向和文件形状门槛。
- `docs/ai.md`：AI 信息边界、算法取舍、研究来源和基准合同。

Search 是稳定默认引擎。自适应专家只在前期使用 afterstate 评分，达到 256 或空格不超过 6 时回到 Search；只有长短局固定种子门槛同时通过时才能继续作为发布选项。

## 修改后的最低验证

```bash
npm run lint
npm run test:fairness
npm run test:ai
npm run test:replay
npm run test:i18n
npm run test:release
npm run check:bundle
npm run check:structure
npm run build
```

更新线上版本时先提交并推送同一 SHA，再通过 Sites 创建版本和部署；不要维护两套分叉源码。

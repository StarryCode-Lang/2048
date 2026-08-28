# AI 架构与验证

## 目标

AI 只读取玩家当前可见的棋盘，不读取随机数状态，不预测下一块，也不自动撤回。选择顺序以长期得分为主，并在高数字阶段优先维持最大块的角落与蛇形单调结构。

## 当前实现

浏览器 Worker 使用风险敏感的 Expectimax 与迭代加深：

1. 玩家节点枚举四个合法方向并选择最高价值。
2. 根部随机节点完整枚举所有空格以及 90% 的 2、10% 的 4。
3. 更深随机节点对空格做确定性分层采样，控制分支爆炸；空格很少时加入轻量最差分支权重，降低残局猝死率。
4. 换位表缓存重复局面，主变缓存优先搜索上一轮最有希望的方向。
5. 叶节点综合空格、可合并对、单调性、角落距离和锚定蛇形链；合法移动仍以即时得分为第一奖励。

4×4 棋盘走 `app/ai/bitboard.ts`：每格用 4 bit 表示指数，16 格拆成两个 32 bit 整数；四格行的 65,536 种状态在 Worker 启动时预计算移动、得分和启发式值。这样搜索中不再为每个节点反复创建 16 格数组。若棋盘总质量可能在当前搜索中产生 65536，或棋盘为 5×5/6×6，则自动回退到 `app/ai/worker.ts` 的通用数组实现，避免位宽截断。

## 为什么没有直接加载学习模型

2048 的一手研究表明，afterstate N-tuple 网络比纯人工启发式更强：早期 17 个四元组模型包含 860,625 个权重；后续多阶段 6-tuple 系统达到数千万参数，并通过 Expectimax 进一步增强。它们需要大量离线训练和明显更大的模型下载，而且公开强模型主要针对 4×4。

当前产品同时支持 4×4、5×5、6×6，并要求打开即玩。因此本版本采用体积很小、可完全回归验证的位棋盘 Expectimax。未来只有在以下条件同时满足时才引入学习模型：

- 模型权重来源和许可证清楚；
- 首次下载、解码和内存占用不明显影响移动端；
- 独立保留种子集证明分数和高块到达率提升；
- 5×5/6×6 有清晰回退，且公平信息边界不变。

## Expert 实验引擎

`app/ai/expert.ts` 提供按需加载的 afterstate N-tuple 风格实验引擎。它使用多组行列/角落 tuple、蛇形链和空格价值，对有效移动后的局面做确定性分层抽样，再进行一层后继移动比较。它不接收随机数状态、不读取未来生成结果，也不会修改默认 Search 引擎的缓存或回归基线。

界面中的 AI 引擎按钮默认仍为 Search；切换到 Expert 只影响当前浏览器本地的挑战。Expert 当前是可解释的轻量基线，不冒充已经训练完成的权重模型。只有通过固定种子、等墙钟预算、移动端内存与包体门禁后，才允许把它设为默认或替换为训练权重。

## 验证合同

- `tests/ai-bitboard.test.mjs` 穷举 50,625 种安全四格行，并在随机完整棋盘上与正式规则逐方向对照。
- 同一测试用固定节点预算比较位棋盘与通用实现，要求方向、策略、完成深度和节点数一致。
- `tests/ai-multiseed.test.mjs` 是发布门槛；`npm run benchmark:ai:suite` 输出 16 个固定种子的分数和最大块。
- `npm run benchmark:ai:engines` 使用相同种子和节点预算并排运行 Search/Expert，输出分数、到达高块数量和耗时差异；它用于研究，不会绕过发布门禁。
- 算法比较使用相同随机种子、相同步数和固定节点预算；墙钟测试单独衡量吞吐，不能代替质量结果。

## 主要研究来源

- Marcin Szubert、Wojciech Jaśkowski： [Temporal Difference Learning of N-Tuple Networks for the Game 2048](https://www.cs.put.poznan.pl/mszubert/pub/szubert2014cig.pdf)
- Wojciech Jaśkowski： [Mastering 2048 with Delayed Temporal Coherence Learning, Multi-Stage Weight Promotion, Redundant Encoding and Carousel Shaping](https://arxiv.org/abs/1604.05085)
- Kun-Hao Yeh 等： [Multi-Stage Temporal Difference Learning for 2048-like Games](https://arxiv.org/abs/1606.07374)
- Hung Guei、Li-Ping Chen、I-Chen Wu： [Optimistic Temporal Difference Learning for 2048](https://arxiv.org/abs/2111.11090)
- Robert Xiao： [2048-ai](https://github.com/nneonneo/2048-ai)，高性能 Expectimax、位棋盘和行查表实现。

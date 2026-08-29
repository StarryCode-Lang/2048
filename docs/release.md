# 发布合同

GitHub 与 Sites 必须来自同一份 `main` 提交。发布顺序固定为：

1. `npm run verify`，确认类型、Lint、规则、AI、回放、六语言、构建、渲染资源和依赖审计全部通过。
2. 将同一完整 SHA 推送到 GitHub 与 Sites 源仓库。
3. 使用该 SHA 的 `dist` 构建归档保存 Sites 版本，再部署该已保存版本。
4. 轮询部署至 `succeeded`，核对线上首页、Manifest、Service Worker、404 与安全响应头。

自适应 Expert 引擎只能作为实验选项发布。300 步全部达到 512、600 步全部达到 1024、等节点预算、包体、内存或移动端延迟任一门禁失败时，Search 仍保持默认，不能以局部样本宣称算法升级完成。

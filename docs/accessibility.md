# 可访问性验收

- 棋盘是可聚焦的 `region`，可用方向键或 W/A/S/D 操作；棋盘文本区以 `aria-live="polite"` 暴露当前布局。
- 菜单使用 `listbox`/`option` 语义，支持 Home、End、上下键和 Escape；弹出层以 fixed 定位并在视口边界内翻转。
- 新局确认、玩法说明、达成 2048 和结束对局都使用模态焦点管理；Escape 关闭当前浮层。
- 首次访问默认静音，声音只在用户明确操作后启动；尊重 `prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast` 与 forced-colors。
- 发布前应在 320、390、768、1440 宽度检查无横向溢出，并以键盘、屏幕阅读器和 200% 浏览器缩放完成手工抽查。

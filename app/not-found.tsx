import Link from "next/link";

export default function NotFound() {
  return (
    <main className="game-shell fallback-shell">
      <section className="fallback-card" aria-labelledby="not-found-title">
        <p className="eyebrow">页面不存在 · PAGE NOT FOUND</p>
        <h1 id="not-found-title">404</h1>
        <p>这个地址没有游戏页面。返回主界面即可继续当前浏览器中保存的进度。</p>
        <Link className="fallback-action" href="/">返回 2048</Link>
      </section>
    </main>
  );
}

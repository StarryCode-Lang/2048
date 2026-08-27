"use client";

import { useRouter } from "next/navigation";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <main className="game-shell fallback-shell">
      <section className="fallback-card" role="alert" aria-labelledby="error-title">
        <p className="eyebrow">暂时无法显示 · SOMETHING WENT WRONG</p>
        <h1 id="error-title">2048</h1>
        <p>游戏遇到了临时问题，你在当前浏览器中的已保存进度不会因此被删除。</p>
        <div className="fallback-actions">
          <button className="secondary-button" onClick={() => router.replace("/")}>返回首页</button>
          <button className="fallback-action" onClick={reset}>重新尝试</button>
        </div>
      </section>
    </main>
  );
}

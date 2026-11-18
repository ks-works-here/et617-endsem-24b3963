import Link from "next/link";
import { LabLink } from "./navigation";

export default function Home() {
  return <main className="shell">
    <section className="hero">
      <p className="eyebrow">CLASS 10 PHYSICS · REFRACTION</p>
      <h1>The Optics Lab</h1>
      <p>Can a convex lens always form a sharp image on a screen? Make a prediction, test it on the optical bench, and follow the evidence.</p>
      <LabLink />
    </section>
    <div className="cards">
      <article className="panel"><p className="eyebrow">≈ 10 MINUTES</p><h2>Virtual laboratory</h2><p>Move the lens controls and screen, compare trials, and revise your hypothesis. Your investigation is saved as you work.</p><Link href="/lab">Start or resume →</Link></article>
      <article className="panel"><p className="eyebrow">30 QUESTIONS</p><h2>Olympiad Challenge Arena</h2><p>Work through ray puzzles, numerical challenges, and experimental problems across three difficulty levels.</p><Link href="/olympiad">Enter the Arena →</Link></article>
      <article className="panel"><h2>Analytics</h2><p>Review your experiments and answers, inspect the clickstream, and download your records.</p><Link href="/analytics">View activity →</Link></article>
      <article className="panel"><h2>Exam Card</h2><p>ET617 selections · P5 - T8 - L6 - C4</p><Link href="/exam-card">View exam card →</Link></article>
    </div>
  </main>;
}

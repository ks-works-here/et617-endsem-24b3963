import type { Metadata } from "next";
import styles from "./exam-card.module.css";

export const metadata: Metadata = { title: "Personal Exam Card | The Optics Lab" };

const selections = [
  { code: "P5", label: "Problem", text: "Inquiry-based virtual laboratory" },
  { code: "T8", label: "Topic", text: "Refraction and image formation by lenses (Class 10)" },
  { code: "L6", label: "Learner", text: "High-achieving learner preparing for an Olympiad" },
  { code: "C4", label: "Constraint", text: "Resumable 10-minute learning sessions" },
];

export default function ExamCard() {
  return <main className="shell">
    <article className={styles.card} aria-labelledby="exam-card-title">
      <header className={styles.heading}>
        <p className="eyebrow">ET617 / End-semester examination</p>
        <h1 id="exam-card-title">Personal Exam Card</h1>
      </header>
      <dl className={styles.identity}>
        <div><dt>Identity token / Roll number</dt><dd className={styles.token}>24b3963</dd></div>
        <div><dt>Card combination</dt><dd>P5 - T8 - L6 - C4</dd></div>
      </dl>
      <dl className={styles.selections}>
        {selections.map(({ code, label, text }) => <div key={code} className={styles.selection}>
          <dt><span className={styles.code}>{code}</span><span className={styles.label}>{label}</span></dt>
          <dd>{text}</dd>
        </div>)}
      </dl>
      <footer className={styles.footer}>Student-declared card based on ET617 Section 2 selections</footer>
    </article>
  </main>;
}

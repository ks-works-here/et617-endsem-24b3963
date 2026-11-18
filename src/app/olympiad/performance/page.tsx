"use client";

import Link from "next/link";
import { useStored } from "../../navigation";
import { initial, snapshot, groupStats } from "../progress";
import { categories, levels, questions, type Question } from "../questions";

export default function Performance() {
  const { records, challenge } = useStored(snapshot, initial);
  const stats = groupStats(questions, records);
  const entries = Object.values(records);
  const seconds = entries.flatMap(record => record.seconds);
  const hints = entries.reduce((total, record) => total + record.hints, 0);
  const metrics = [
    ["Attempted", stats.attempted],
    ["Solved", stats.solved],
    ["Unsolved after attempt", stats.misses],
    ["Accuracy", stats.accuracy === null ? "—" : `${stats.accuracy}%`],
    ["Hints used", hints],
    ["Average first attempt", seconds.length ? `${Math.round(seconds.reduce((sum, time) => sum + time, 0) / seconds.length)} s` : "—"],
  ];
  const groups: { title: string; labels: string[]; key: "category" | "level" }[] = [
    { title: "By category", labels: categories, key: "category" },
    { title: "By difficulty", labels: levels, key: "level" },
  ];

  function statsFor(key: "category" | "level", index: number) {
    return groupStats(questions.filter((question: Question) => question[key] === index), records);
  }

  return <main className="shell arena">
    <header className="hero">
      <p className="eyebrow">OLYMPIAD CHALLENGE ARENA</p>
      <h1>Arena performance</h1>
      <Link href="/olympiad" className="button">← Back to questions</Link>
    </header>
    {challenge?.ended && <section className="panel">
      <h2>Challenge results</h2>
      <p>{challenge.mode} · {challenge.correct.length} of {challenge.queue.length} correct</p>
    </section>}
    <section className="panel">
      <h2>Overall progress</h2>
      <dl className="metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {stats.attempted === 0 && <p>Answer a question to start tracking your progress.</p>}
    </section>
    <div className="cards">{groups.map(({ title, labels, key }) => <section className="panel" key={key}>
      <h2>{title}</h2>
      <div className="table-wrap"><table>
        <thead><tr><th scope="col">{key === "category" ? "Category" : "Difficulty"}</th><th scope="col">Solved / tried</th><th scope="col">Accuracy</th></tr></thead>
        <tbody>{labels.map((label, i) => {
          const row = statsFor(key, i);
          return <tr key={label}><th scope="row">{label}</th><td>{row.solved}/{row.attempted}</td><td>{row.accuracy === null ? "—" : `${row.accuracy}%`}</td></tr>;
        })}</tbody>
      </table></div>
    </section>)}</div>
  </main>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { categories, levels, questions, type Question } from "./questions";
import { appSession, id, read, track, write } from "../store";
import { useStored } from "../navigation";
import RayBench from "../ray-bench";

const modes = ["Practice Mode", "Timed Challenge", "Mixed Challenge", "Weak Area Revision"];
type RecordEntry = { attempts: number; misses: number; solved: boolean; hints: number; seconds: number[]; revealed: boolean; marked: boolean };
type Challenge = { id: string; mode: string; queue: string[]; index: number; deadline: number; ended: boolean; correct: string[] };
const blank: RecordEntry = { attempts: 0, misses: 0, solved: false, hints: 0, seconds: [], revealed: false, marked: false };
const initial = { category: -1, level: -1, active: "", challenge: null as Challenge | null, records: {} as Record<string, RecordEntry>, drafts: {} as Record<string, string[]> };
const snapshot = () => JSON.stringify(read("arena", initial));
function challengeClock() { return Date.now(); }
function challengeOrder() {
  const shuffled = questions.map(q => ({ q, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(row => row.q);
  const startingLevel = Math.floor(Math.random() * levels.length);
  const balanced = categories.map((_, i) => shuffled.find(q => q.category === i && q.level === (i + startingLevel) % levels.length)!);
  return { shuffled, balanced };
}

function groupStats(bank: Question[], records: typeof initial.records) {
  const entries = bank.map(q => records[q.id] ?? blank);
  const attempted = entries.filter(e => e.attempts > 0).length;
  const solved = entries.filter(e => e.solved).length;
  const misses = entries.filter(e => e.attempts > 0 && !e.solved).length;
  const attempts = entries.reduce((n, e) => n + e.attempts, 0);
  const incorrect = entries.reduce((n, e) => n + e.misses, 0);
  return { attempted, solved, misses, accuracy: attempts ? Math.round((attempts - incorrect) / attempts * 100) : null };
}

export default function Arena() {
  const state = useStored(snapshot, initial);
  const [scope, setScope] = useState("All questions");
  const [submitted, setSubmitted] = useState<{ question: string; choice: number } | null>(null);
  const [now, setNow] = useState(0);
  const openedAt = useRef(0);
  const trackedOpen = useRef(false);
  const challenge = state.challenge;
  const running = !!challenge && !challenge.ended;
  const question = questions.find(q => q.id === state.active);
  const record = question ? state.records[question.id] ?? blank : blank;
  const draft = question ? state.drafts[question.id]?.[0] ?? "" : "";
  const selection = /^choice:\d+$/.test(draft) ? Number(draft.slice(7)) : -1;
  const graded = submitted !== null && submitted.question === question?.id && submitted.choice === selection;
  const correctChoice = graded && selection === question?.correct;
  const remaining = challenge?.deadline ? Math.max(0, Math.ceil((challenge.deadline - now) / 1000)) : null;
  const update = (patch: Partial<typeof initial>) => write("arena", { ...state, ...patch });

  useEffect(() => {
    if (trackedOpen.current) return;
    trackedOpen.current = true;
    const stored = read("arena", initial);
    const params = new URLSearchParams(window.location.search);
    const direct = questions.find(q => q.id === params.get("question"));
    track("olympiad_opened", stored.challenge?.id || appSession(), "olympiad", "Arena");
    if (direct && (!stored.challenge || stored.challenge.ended)) {
      write("arena", { ...stored, active: direct.id });
      track("olympiad_question_opened", appSession(), "olympiad", "Arena", { question_id: direct.id, category: categories[direct.category], difficulty: levels[direct.level] });
    }
  }, []);
  useEffect(() => {
    openedAt.current = performance.now();
    const reset = () => { openedAt.current = 0; };
    document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, [state.active]);
  useEffect(() => {
    if (!challenge?.deadline || challenge.ended) return;
    function tick() {
      const time = Date.now();
      setNow(time);
      const latest = read("arena", initial);
      const current = latest.challenge;
      if (current && !current.ended && current.deadline && current.deadline <= time) {
        write("arena", { ...latest, active: "", challenge: { ...current, ended: true } });
        track("olympiad_challenge_completed", current.id, "olympiad", "Arena", { mode: current.mode, status: "time expired", correct: current.correct.length, count: current.queue.length });
      }
    }
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [challenge]);

  function questionEvent(event: string, q: Question, session = running ? challenge.id : appSession(), extra = {}) {
    const prior = state.records[q.id] ?? blank;
    track(`olympiad_${event}`, session, "olympiad", "Arena", { question_id: q.id, category: categories[q.category], difficulty: levels[q.level], attempt_number: prior.attempts, hints_used: prior.hints, ...extra });
  }
  function open(q: Question) {
    update({ active: q.id });
    setSubmitted(null);
    questionEvent("question_opened", q);
    if ((state.records[q.id]?.attempts ?? 0) > 0) questionEvent("question_retried", q);
  }
  function mark(event: string, patch: Partial<RecordEntry>) {
    if (!question) return;
    update({ records: { ...state.records, [question.id]: { ...record, ...patch } } });
    questionEvent(event, question, undefined, patch);
  }
  function filter(key: "category" | "level", value: number) {
    update({ [key]: value });
    track(key === "category" ? "olympiad_category_selected" : "olympiad_difficulty_selected", appSession(), "olympiad", "Arena", { [key === "category" ? "category" : "difficulty"]: (key === "category" ? categories : levels)[value] ?? "All" });
  }
  const weakest = categories.map((_, i) => ({
    i, rate: groupStats(questions.filter(q => q.category === i), state.records).accuracy,
  })).filter(row => row.rate !== null && row.rate < 100).sort((a, b) => a.rate! - b.rate!);
  function start(mode: string) {
    if (mode === modes[0]) { setScope("All questions"); update({ challenge: null }); return; }
    const { shuffled, balanced } = challengeOrder();
    const weakBank = weakest.flatMap(({ i }) => shuffled.filter(q => q.category === i && !state.records[q.id]?.solved));
    const pool = mode === modes[3] ? weakBank : mode === modes[1] ? shuffled.filter(q => q.level >= 1) : balanced;
    if (!pool.length) return;
    const queue = pool.slice(0, 5).map(q => q.id);
    const time = challengeClock();
    setNow(time);
    const next = { id: id(), mode, queue, index: 0, deadline: mode === modes[1] ? time + 5 * 60_000 : 0, ended: false, correct: [] };
    update({ challenge: next, active: queue[0], drafts: Object.fromEntries(Object.entries(state.drafts).filter(([key]) => !queue.includes(key))) });
    setSubmitted(null);
    track("olympiad_challenge_started", next.id, "olympiad", "Arena", { mode, questions: queue });
    questionEvent("question_opened", pool[0], next.id);
  }
  function advance(finish = false) {
    if (!challenge || challenge.ended) return;
    const index = challenge.index + 1;
    const ended = finish || index >= challenge.queue.length;
    update({ challenge: { ...challenge, index: ended ? challenge.index : index, ended }, active: ended ? "" : challenge.queue[index] });
    setSubmitted(null);
    if (ended) track("olympiad_challenge_completed", challenge.id, "olympiad", "Arena", { mode: challenge.mode, correct: challenge.correct.length, count: challenge.queue.length, status: finish ? "ended early" : "finished" });
    else questionEvent("question_opened", questions.find(q => q.id === challenge.queue[index])!, challenge.id);
  }
  function submit() {
    if (!question || !question.options[selection] || (running && challenge.deadline > 0 && Date.now() >= challenge.deadline)) return;
    const correct = selection === question.correct;
    const seconds = openedAt.current ? (performance.now() - openedAt.current) / 1000 : 0;
    const nextRecord = { ...record, solved: record.solved || correct, attempts: record.attempts + 1, misses: record.misses + Number(!correct), seconds: record.attempts === 0 && seconds > 0 && seconds < 1800 ? [...record.seconds, seconds] : record.seconds };
    update({ records: { ...state.records, [question.id]: nextRecord }, ...(running && correct && !challenge.correct.includes(question.id) ? { challenge: { ...challenge, correct: [...challenge.correct, question.id] } } : {}) });
    if (record.attempts > 0) questionEvent("question_retried", question, undefined, { attempt_number: nextRecord.attempts });
    questionEvent("answer_submitted", question, undefined, { response: [question.options[selection]], choice_index: selection, correct, attempt_number: nextRecord.attempts });
    setSubmitted({ question: question.id, choice: selection });
  }
  const visible = questions.filter(q => (state.category === -1 || q.category === state.category) && (state.level === -1 || q.level === state.level)
    && (scope !== "Bookmarked" || state.records[q.id]?.marked) && (scope !== "Unsolved" || !state.records[q.id]?.solved)
    && (scope !== "Needs retry" || (state.records[q.id]?.misses && !state.records[q.id]?.solved)));
  const stats = groupStats(questions, state.records);
  const seconds = Object.values(state.records).flatMap(r => r.seconds);
  const totalHints = Object.values(state.records).reduce((sum, r) => sum + r.hints, 0);

  return <main className="shell arena">
    <section className="hero"><p className="eyebrow">CLASS 10 PHYSICS · LENSES</p><h1>Olympiad Challenge Arena</h1><p>Use ray geometry, experimental evidence, and the thin-lens equation to solve 30 original problems.</p></section>
    <section className="panel"><h2>Challenge modes</h2><div className="actions">{modes.map((mode, i) => <button className={i === 0 ? "primary" : ""} key={mode} disabled={running || (i === 3 && !weakest.some(row => questions.some(q => q.category === row.i && !state.records[q.id]?.solved)))} onClick={() => start(mode)}>{mode}</button>)}</div>
    <p>{running ? `${challenge.mode} · Question ${challenge.index + 1} of ${challenge.queue.length}${remaining !== null && now ? ` · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining` : ""}` : challenge?.ended ? `Challenge complete · ${challenge.correct.length}/${challenge.queue.length} correct` : weakest.length ? `Revision focus: ${categories[weakest[0].i]}` : "Timed mode gives you five minutes. Revision unlocks when your results identify an area to revisit."}</p>
    {running && <div className="actions"><button onClick={() => advance()}>Next question / skip</button><button onClick={() => advance(true)}>End challenge</button></div>}</section>
    <div className="arena-grid">
      {!running && <section className="panel"><h2>Question bank</h2><div className="filters"><label>Category<select value={state.category} onChange={e => filter("category", +e.target.value)}><option value={-1}>All categories</option>{categories.map((item, i) => <option key={item} value={i}>{item}</option>)}</select></label><label>Difficulty<select value={state.level} onChange={e => filter("level", +e.target.value)}><option value={-1}>All levels</option>{levels.map((item, i) => <option key={item} value={i}>Level {i + 1} · {item}</option>)}</select></label><label>Show<select value={scope} onChange={e => setScope(e.target.value)}>{["All questions", "Bookmarked", "Unsolved", "Needs retry"].map(item => <option key={item}>{item}</option>)}</select></label></div>
      <div className="question-list">{visible.length === 0 && <p>No questions match these filters.</p>}{visible.map(q => <button key={q.id} aria-pressed={q.id === state.active} onClick={() => open(q)}><span>{q.title}</span><small>{levels[q.level]}{state.records[q.id]?.solved ? " · Solved" : ""}{state.records[q.id]?.marked ? " · Bookmarked" : ""}</small></button>)}</div></section>}
      <section className="panel workspace">
        {question ? <><div className="section-head"><p className="eyebrow">LEVEL {question.level + 1} · {levels[question.level]} · {question.format}</p><button aria-pressed={record.marked} onClick={() => mark("question_bookmarked", { marked: !record.marked })}>{record.marked ? "Remove bookmark" : "Bookmark"}</button></div>
        <h2>{question.title}</h2><p>{question.prompt}</p>
        {question.diagram && <RayBench settings={question.diagram} reveal={record.revealed && !running} rayCount={question.id === "r1" && (!record.revealed || running) ? 1 : 2} screen={false} />}
        <form onSubmit={e => { e.preventDefault(); submit(); }}>
          <fieldset className="answer-choices"><legend>Choose one answer</legend>{question.options.map((option, i) => <label className="radio" data-result={graded && selection === i ? correctChoice ? "correct" : "incorrect" : undefined} key={option}>
            <input required type="radio" name={question.id} checked={selection === i} onChange={() => {
              setSubmitted(null);
              update({ drafts: { ...state.drafts, [question.id]: [`choice:${i}`] } });
            }} />
            <span>{option}</span>
            {graded && selection === i && <strong className="answer-mark" role="status"><span aria-hidden="true">{correctChoice ? "✓ " : "✕ "}</span>{correctChoice ? "Correct" : "Incorrect"}</strong>}
          </label>)}</fieldset>
          <button className="primary" type="submit" disabled={!question.options[selection]}>Submit Answer</button>
        </form>
        {graded && !correctChoice && question.feedback?.[selection] && <small className="answer-tip">{question.feedback[selection]}</small>}
        <div className="actions"><button disabled={record.hints >= question.hints.length} onClick={() => mark("hint_accessed", { hints: record.hints + 1 })}>Next hint ({record.hints}/{question.hints.length})</button><button disabled={running || record.revealed} onClick={() => mark("solution_revealed", { revealed: true })}>Show Solution</button></div>
        {record.hints > 0 && <ol>{question.hints.slice(0, record.hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
        {!running && record.revealed && <div className="feedback"><h3>Worked solution</h3><ol>{question.solution.map(step => <li key={step}>{step}</li>)}</ol></div>}
        </> : <p>Select a question or start a challenge to begin.</p>}
      </section>
    </div>
    <section className="panel"><h2>Arena performance</h2><dl className="metrics">{[["Attempted", stats.attempted], ["Solved", stats.solved], ["Unsolved after attempt", stats.misses], ["Attempt accuracy", stats.accuracy === null ? "—" : `${stats.accuracy}%`], ["Hints", totalHints], ["Average first attempt", seconds.length ? `${Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length)} s` : "—"]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    <div className="cards">{[categories, levels].map((group, axis) => <div key={axis}><h3>{axis === 0 ? "By category" : "By difficulty"}</h3>{group.map((label, i) => { const row = groupStats(questions.filter(q => (axis === 0 ? q.category : q.level) === i), state.records); return <p key={label}>{label} · {row.solved}/{row.attempted} solved{row.accuracy === null ? "" : ` · ${row.accuracy}% accuracy`}</p>; })}</div>)}</div></section>
  </main>;
}

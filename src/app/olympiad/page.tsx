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

function evaluate(q: Question, answers: string[]) {
  if (q.options) return Number(answers[0]) === q.correct ? [] : ["Reconsider which choice agrees with the ray behavior. Use the first hint to check your reasoning."];
  if (q.numbers) {
    const working = answers[q.numbers.length] ?? "";
    return q.numbers.flatMap((field, i) => {
      const match = answers[i]?.trim().replace(/[−–]/g, "-").match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*([^\d\s].*)?$/);
      if (!match) return [`${field.label}: enter a number or fraction.`];
      const unit = (match[3] ?? "").trim().toLowerCase();
      if (unit !== field.unit) return [`${field.label}: ${field.unit ? `give your answer in ${field.unit}` : "magnification has no unit"}.`];
      const value = Number(match[1]) / (match[2] ? Number(match[2]) : 1);
      const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.015, 0.005 * Math.abs(b));
      if (close(value, field.value)) return [];
      if (close(value, -field.value)) return [`${field.label}: check the Cartesian sign or image orientation.`];
      if ((field.formulaTrap !== undefined && close(value, field.formulaTrap)) || /1\s*\/\s*f\s*=\s*1\s*\/\s*v\s*\+\s*1\s*\/\s*u/.test(working)) return [`${field.label}: check the formula, especially the sign between the reciprocal terms.`];
      if (field.unit && [0.01, 0.1, 10, 100].some(factor => close(value, field.value * factor))) return [`${field.label}: check whether you converted the numerical value into ${field.unit}.`];
      return [`${field.label}: check the substituted values, reciprocal arithmetic, and rounding.`];
    });
  }
  const response = answers[0]?.toLowerCase() ?? "";
  return q.rubric?.every(rule => rule.test(response)) ? [] : ["Your response may be missing part of the explanation. Use the hint to identify the relevant ray, observation, or relationship and explain how it supports your conclusion."];
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
  const [feedback, setFeedback] = useState<{ question: string; text: string[] }>({ question: "", text: [] });
  const [now, setNow] = useState(0);
  const openedAt = useRef(0);
  const trackedOpen = useRef(false);
  const challenge = state.challenge;
  const running = !!challenge && !challenge.ended;
  const question = questions.find(q => q.id === state.active);
  const record = question ? state.records[question.id] ?? blank : blank;
  const answers = question ? state.drafts[question.id] ?? [] : [];
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
    setFeedback({ question: "", text: [] });
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
    setFeedback({ question: "", text: [] });
    track("olympiad_challenge_started", next.id, "olympiad", "Arena", { mode, questions: queue });
    questionEvent("question_opened", pool[0], next.id);
  }
  function advance(finish = false) {
    if (!challenge || challenge.ended) return;
    const index = challenge.index + 1;
    const ended = finish || index >= challenge.queue.length;
    update({ challenge: { ...challenge, index: ended ? challenge.index : index, ended }, active: ended ? "" : challenge.queue[index] });
    setFeedback({ question: "", text: [] });
    if (ended) track("olympiad_challenge_completed", challenge.id, "olympiad", "Arena", { mode: challenge.mode, correct: challenge.correct.length, count: challenge.queue.length, status: finish ? "ended early" : "finished" });
    else questionEvent("question_opened", questions.find(q => q.id === challenge.queue[index])!, challenge.id);
  }
  function submit() {
    if (!question || (running && challenge.deadline > 0 && Date.now() >= challenge.deadline)) return;
    const text = evaluate(question, answers);
    const correct = text.length === 0;
    const seconds = openedAt.current ? (performance.now() - openedAt.current) / 1000 : 0;
    const nextRecord = { ...record, solved: record.solved || correct, attempts: record.attempts + 1, misses: record.misses + Number(!correct), seconds: record.attempts === 0 && seconds > 0 && seconds < 1800 ? [...record.seconds, seconds] : record.seconds };
    update({ records: { ...state.records, [question.id]: nextRecord }, ...(running && correct && !challenge.correct.includes(question.id) ? { challenge: { ...challenge, correct: [...challenge.correct, question.id] } } : {}) });
    if (record.attempts > 0) questionEvent("question_retried", question, undefined, { attempt_number: nextRecord.attempts });
    questionEvent("answer_submitted", question, undefined, { response: answers, correct, attempt_number: nextRecord.attempts });
    setFeedback({ question: question.id, text: correct ? [question.rubric ? "Your explanation includes the expected ideas. Compare your reasoning with the worked solution." : "Your answer matches the expected result. Use the worked solution to compare methods."] : text });
  }
  const visible = questions.filter(q => (state.category === -1 || q.category === state.category) && (state.level === -1 || q.level === state.level)
    && (scope !== "Bookmarked" || state.records[q.id]?.marked) && (scope !== "Unsolved" || !state.records[q.id]?.solved)
    && (scope !== "Needs retry" || (state.records[q.id]?.misses && !state.records[q.id]?.solved)));
  const stats = groupStats(questions, state.records);
  const seconds = Object.values(state.records).flatMap(r => r.seconds);
  const totalHints = Object.values(state.records).reduce((sum, r) => sum + r.hints, 0);
  const input = (i: number, value: string) => {
    if (!question) return;
    const next = Array.from({ length: Math.max(answers.length, i + 1) }, (_, index) => index === i ? value : answers[index] ?? "");
    update({ drafts: { ...state.drafts, [question.id]: next } });
  };

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
          {question.options ? <fieldset><legend>Choose an answer</legend>{question.options.map((option, i) => <label className="radio" key={option}><input required type="radio" name={question.id} checked={answers[0] === String(i)} onChange={() => input(0, String(i))} />{option}</label>)}</fieldset> : question.numbers ? <>
          {question.numbers.map((field, i) => <label key={field.label}>{field.label}<input required value={answers[i] ?? ""} placeholder={field.unit ? `Include ${field.unit}` : "Number or fraction"} onChange={e => input(i, e.target.value)} /></label>)}
          <label>Working (optional)<textarea value={answers[question.numbers.length] ?? ""} onChange={e => input(question.numbers!.length, e.target.value)} /></label></> : <label>Your explanation<textarea required value={answers[0] ?? ""} onChange={e => input(0, e.target.value)} /></label>}
          <button className="primary" type="submit">Submit Answer</button>
        </form>
        {feedback.question === question.id && <div role="status" className="feedback">{feedback.text.map((line, i) => <p key={i}>{line}</p>)}</div>}
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

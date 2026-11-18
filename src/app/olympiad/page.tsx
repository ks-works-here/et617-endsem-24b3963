"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { categories, levels, questions, type Question } from "./questions";
import { appSession, id, read, track, write } from "../store";
import { useStored } from "../navigation";
import RayBench from "../ray-bench";
import { blank, groupStats, initial, snapshot, type RecordEntry } from "./progress";

const modes = ["Practice Mode", "Timed Challenge", "Mixed Challenge", "Weak Area Revision"];
function challengeClock() { return Date.now(); }
function challengeOrder() {
  const shuffled = questions.map(q => ({ q, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(row => row.q);
  const startingLevel = Math.floor(Math.random() * levels.length);
  const balanced = categories.map((_, i) => shuffled.find(q => q.category === i && q.level === (i + startingLevel) % levels.length)!);
  return { shuffled, balanced };
}

export default function Arena() {
  const state = useStored(snapshot, initial);
  const [scope, setScope] = useState("All questions");
  const [submitted, setSubmitted] = useState<{ question: string; choice: number } | null>(null);
  const [now, setNow] = useState(0);
  const openedAt = useRef(0);
  const trackedOpen = useRef(false);
  const solutionPanel = useRef<HTMLElement>(null);
  const focusSolution = useRef(false);
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
    if (!record.revealed || !focusSolution.current) return;
    focusSolution.current = false;
    solutionPanel.current?.focus();
  }, [record.revealed]);

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
  function toggleSolution() {
    if (!question) return;
    if (record.revealed) {
      update({ records: { ...state.records, [question.id]: { ...record, revealed: false } } });
      return;
    }
    focusSolution.current = true;
    mark("solution_revealed", { revealed: true });
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

  return <main className="shell arena">
    <section className="hero"><p className="eyebrow">CLASS 10 PHYSICS · LENSES</p><div className="section-head"><h1>Olympiad Challenge Arena</h1><Link className="button" href="/olympiad/performance">My performance →</Link></div><p>Use ray geometry, experimental evidence, and the thin-lens equation to solve 30 original problems.</p></section>
    <section className="panel"><h2>Challenge modes</h2><div className="actions">{modes.map((mode, i) => <button className={i === 0 ? "primary" : ""} key={mode} disabled={running || (i === 3 && !weakest.some(row => questions.some(q => q.category === row.i && !state.records[q.id]?.solved)))} onClick={() => start(mode)}>{mode}</button>)}</div>
    <p>{running ? `${challenge.mode} · Question ${challenge.index + 1} of ${challenge.queue.length}${remaining !== null && now ? ` · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining` : ""}` : challenge?.ended ? `Challenge complete · ${challenge.correct.length}/${challenge.queue.length} correct` : weakest.length ? `Revision focus: ${categories[weakest[0].i]}` : "Timed mode gives you five minutes. Revision unlocks when your results identify an area to revisit."}</p>
    {challenge?.ended && <p><Link href="/olympiad/performance">View challenge results →</Link></p>}
    {running && <div className="actions"><button onClick={() => advance()}>Next question / skip</button><button onClick={() => advance(true)}>End challenge</button></div>}</section>
    <div className="arena-grid">
      {!running && <section className="panel"><h2>Question bank</h2><div className="filters"><label>Category<select value={state.category} onChange={e => filter("category", +e.target.value)}><option value={-1}>All categories</option>{categories.map((item, i) => <option key={item} value={i}>{item}</option>)}</select></label><label>Difficulty<select value={state.level} onChange={e => filter("level", +e.target.value)}><option value={-1}>All levels</option>{levels.map((item, i) => <option key={item} value={i}>Level {i + 1} · {item}</option>)}</select></label><label>Show<select value={scope} onChange={e => setScope(e.target.value)}>{["All questions", "Bookmarked", "Unsolved", "Needs retry"].map(item => <option key={item}>{item}</option>)}</select></label></div>
      <div className="question-list">{visible.length === 0 && <p>No questions match these filters.</p>}{visible.map(q => {
        const progress = state.records[q.id];
        return <button key={q.id} aria-pressed={q.id === state.active} onClick={() => open(q)}>
          <span>{q.title}</span>
          <small className="question-statuses">
            <span>{levels[q.level]}</span>
            {progress?.marked && <span className="question-status status-bookmarked"><span className="bookmark-icon" aria-hidden="true" />Bookmarked</span>}
            {progress?.solved ? <span className="question-status status-solved">✓ Solved</span> : !!progress?.misses && <span className="question-status status-retry">↻ Needs retry</span>}
          </small>
        </button>;
      })}</div></section>}
      <section className="panel workspace">
        {question ? <><div className="section-head"><p className="eyebrow">LEVEL {question.level + 1} · {levels[question.level]} · {question.format}</p><button className="bookmark-toggle" aria-pressed={record.marked} onClick={() => mark("question_bookmarked", { marked: !record.marked })}><span className="bookmark-icon" aria-hidden="true" />{record.marked ? "Remove bookmark" : "Bookmark"}</button></div>
        <h2>{question.title}</h2><p>{question.prompt}</p>
        {question.diagram && <RayBench settings={question.diagram} reveal={record.revealed} rayCount={question.id === "r1" && !record.revealed ? 1 : 2} screen={false} />}
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
        <div className="actions"><button disabled={record.hints >= question.hints.length} onClick={() => mark("hint_accessed", { hints: record.hints + 1 })}>Next hint ({record.hints}/{question.hints.length})</button><button aria-expanded={record.revealed} aria-controls="worked-solution" onClick={toggleSolution}>{record.revealed ? "Hide Solution" : "Show Solution"}</button></div>
        <section id="worked-solution" ref={solutionPanel} className="feedback" aria-labelledby="worked-solution-title" hidden={!record.revealed} tabIndex={-1}>
          <h3 id="worked-solution-title">Worked solution</h3>
          <p><strong>Answer</strong> · {question.options[question.correct]}</p>
          <ol>{question.solution.map(step => <li key={step}>{step}</li>)}</ol>
        </section>
        {record.hints > 0 && <ol>{question.hints.slice(0, record.hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
        </> : <p>Select a question or start a challenge to begin.</p>}
      </section>
    </div>

  </main>;
}

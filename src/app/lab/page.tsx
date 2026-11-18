"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bench, measure, type Settings } from "../optics";
import RayBench from "../ray-bench";
import { type Details, getExperimentHistory, id, read, saveExperiment, track, write } from "../store";
import { useStored } from "../navigation";

const initial = { session: "", step: 0, paused: false, settings: bench, hypothesis: "", prediction: "", interpretation: "", reflection: "", transfer: "", hints: 0, last: "", explanation: false, mission: 0 };
const progress = () => JSON.stringify(read("lab", initial));
const steps = ["Mission", "Apparatus", "Experiment", "Interpret & revise", "Reflect"];
const times = ["0–1 min", "1–3 min", "3–6 min", "6–8 min", "8–10 min"];
const prompts = [
  "You moved the screen, but could not obtain a sharp image. What does that suggest about the nature of the emerging rays?",
  "After passing through the lens, are the rays actually converging or diverging?",
  "If you extend the diverging rays backwards, where do they appear to originate?",
  "Compare the object position with the focal point. Could this position change the type of image?",
];
const missions = [
  "Try to project a sharp image with the object inside the focal length.",
  "Find a convex-lens configuration with magnification about −1.",
  "Find two different positions that give equal absolute magnification.",
  "Approach the focal point from both sides and compare image positions.",
  "Keep object distance fixed and change focal length across it.",
  "Compare a concave and convex lens under identical object conditions.",
  "Use a sharp-screen measurement to infer focal length from u and v.",
];
const controls = [
  ["focal", "Focal length magnitude", 5, 45], ["distance", "Object distance", 3, 100],
  ["height", "Object height", 1, 15], ["screen", "Screen position", 1, 150],
] as const;
const format = (value: number | null, unit = "") => value === null ? "—" : `${Number(value.toFixed(2))}${unit}`;

function DistanceInput({ label, value, min, max, commit }: { label: string; value: number; min: number; max: number; commit: (value: number) => void }) {
  return <input key={value} aria-label={`${label} in centimetres`} type="number" min={min} max={max} step="any" defaultValue={value}
    onBlur={e => {
      const next = e.target.valueAsNumber;
      if (next >= min && next <= max && next !== value) commit(next);
      else e.target.value = String(value);
    }}
    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />;
}

export default function Lab() {
  const state = useStored(progress, initial);
  const history = useStored<ReturnType<typeof getExperimentHistory>>(() => JSON.stringify(getExperimentHistory()), []).filter(trial => trial.session === state.session);
  const last = history.find(trial => trial.id === state.last);
  const [message, setMessage] = useState("");
  const opened = useRef("");
  const elapsed = useStored(() => JSON.stringify(read("lab-time:" + state.session, 0)), 0);
  const result = measure(state.settings);
  const tested = !!last && ["type", "focal", "distance", "height"].every(key => state.settings[key as keyof Settings] === last.settings[key as keyof Settings]);
  const failedDemo = tested && !!last && last.prediction === "real" && result.nature === "virtual" && state.settings.type === "convex";
  const reveal = tested && (!failedDemo || state.explanation);
  const log = (event: string, details: Details = {}, experiment: string | null = state.last || null) =>
    track(event, state.session, "lens-bench", steps[state.step] ?? "Complete", { settings: state.settings, ...details }, experiment);
  const update = (patch: Partial<typeof initial>) => write("lab", { ...state, ...patch });
  useEffect(() => {
    if (!state.session || opened.current === state.session) return;
    opened.current = state.session;
    track("investigation_opened", state.session, "lens-bench", steps[state.step] ?? "Complete");
  }, [state.session, state.step]);
  const activeSession = state.session && !state.paused && state.step < 5 ? state.session : "";
  useEffect(() => {
    if (!activeSession) return;
    const key = "lab-time:" + activeSession;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") write(key, read(key, 0) + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  function start() {
    const session = id();
    write("lab", { ...initial, session, mission: state.mission });
    track("session_started", session, "lens-bench", "Mission", { mission: state.mission });
  }
  function settings(patch: Partial<Settings>, key: string, value: number | string, record: boolean) {
    update({ settings: { ...state.settings, ...patch } });
    if (record) log("experimental_variable_changed", { variable: key, value, settings: { ...state.settings, ...patch } });
  }
  function run() {
    if (!state.hypothesis.trim() || !state.prediction) { setMessage("Write a hypothesis and select a prediction before running the experiment."); return; }
    const experiment = id();
    const supported = state.prediction === result.nature;
    const observation = result.nature === "parallel" ? "Emerging rays are parallel. No finite screen position is sharp." : result.nature === "virtual" ? "No sharp image forms on the screen. The emerging rays diverge." : `Real, inverted image at ${format(result.v, " cm")}.`;
    saveExperiment({ id: experiment, session: state.session, timestamp: new Date().toISOString(), settings: state.settings, hypothesis: state.hypothesis.trim(), prediction: state.prediction, observation, supported });
    const details = { hypothesis: state.hypothesis.trim(), prediction: state.prediction, outcome: result.nature, supported, image_distance_cm: result.v, magnification: result.m, image_height_cm: result.height, screen_sharp: result.sharp };
    log("hypothesis_submitted", details, experiment);
    log("experiment_run", details, experiment);
    log("prediction_compared", details, experiment);
    if (!supported) log("experiment_unsuccessful", details, experiment);
    if (last) log("experiment_repeated", { previous_experiment: last.id, ...details }, experiment);
    update({ last: experiment, step: 3, hints: 0, explanation: false, interpretation: "", prediction: "" });
    setMessage("");
  }
  function revise() {
    if (!last || !state.hypothesis.trim() || !state.interpretation.trim() || state.hypothesis.trim() === last.hypothesis) {
      setMessage("Interpret the observation and change your hypothesis before saving the revision.");
      return;
    }
    saveExperiment({ ...last, interpretation: state.interpretation.trim(), revision: state.hypothesis.trim() });
    log("hypothesis_revised", { original: last.hypothesis, revision: state.hypothesis.trim(), interpretation: state.interpretation.trim() });
    setMessage("Revision saved. Change the setup and run a comparison trial.");
  }
  function finish() {
    if (!last || !state.reflection.trim() || !state.transfer.trim()) return;
    if (state.interpretation.trim()) saveExperiment({ ...last, interpretation: state.interpretation.trim() });
    log("challenge_completed", { transfer: state.transfer.trim(), mission: state.mission });
    log("investigation_completed", { reflection: state.reflection.trim() });
    log("session_completed", { active_seconds: elapsed });
    update({ step: 5 });
  }

  return <main className="shell">
    <p className="eyebrow">VIRTUAL LABORATORY · ≈ 10 MINUTES</p><h1>Lens bench investigation</h1>
    <ol className="stepper">{steps.map((step, i) => <li key={step} className={i === state.step ? "current" : ""}>{step}<small>{times[i]}</small></li>)}</ol>
    {!state.session || state.paused || state.step === 5 ? <section className="panel">
      <h2>{state.paused ? "Investigation paused" : state.step === 5 ? "Investigation complete" : "Can you bring the image into focus?"}</h2>
      {state.step === 5 && <><p>{history.length} trials · {history.filter(row => row.supported).length} predictions supported</p><blockquote>{state.reflection}</blockquote><p><Link href="/olympiad?question=c1">Try the related Olympiad question →</Link></p><p><Link href="/analytics">Review investigation evidence →</Link></p></>}
      {!state.paused && <label>Investigation mission<select value={state.mission} onChange={e => update({ mission: Number(e.target.value) })}>{missions.map((mission, i) => <option value={i} key={mission}>{mission}</option>)}</select></label>}
      <button className="primary" onClick={() => {
        if (state.paused) { log("session_resumed"); update({ paused: false }); }
        else start();
      }}>{state.paused ? "Resume Investigation" : state.step === 5 ? "Start another investigation" : "Start investigation"}</button>
    </section> : <>
      <div className="section-head"><p>{missions[state.mission]}</p><small>Active time {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</small><button onClick={() => { log("session_paused", { active_seconds: elapsed }); update({ paused: true }); }}>Pause investigation</button></div>
      {state.step === 0 ? <section className="panel"><h2>Mission briefing</h2><p>Predict what would happen before exploring the apparatus. You can refine your prediction before each run.</p><label>Initial hypothesis<textarea value={state.hypothesis} onChange={e => update({ hypothesis: e.target.value })} placeholder="I predict… because…" /></label><button className="primary" disabled={!state.hypothesis.trim()} onClick={() => update({ step: 1 })}>Explore apparatus</button></section> : <>
        <div className="lab-grid">
          <section className="panel"><h2>Optical bench</h2><RayBench settings={state.settings} reveal={reveal} />
            <dl className="metrics">{[["Object u", format(result.u, " cm")], ["Focal f", format(result.f, " cm")], ["Image v", reveal ? format(result.v, " cm") : "—"], ["Height", reveal ? format(result.height, " cm") : "—"], ["Magnification", reveal ? format(result.m) : "—"]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
            <p role="status">{tested ? reveal && result.nature === "parallel" ? "Parallel rays. No finite image distance." : result.sharp ? "Screen aligned. A sharp image is projected." : "No sharp image at this screen position." : "Run a trial to record image measurements."}</p>
          </section>
          <section className="panel"><h2>Apparatus</h2><label>Lens type<select value={state.settings.type} onChange={e => settings({ type: e.target.value as Settings["type"] }, "type", e.target.value, true)}><option value="convex">Convex</option><option value="concave">Concave</option></select></label>
          {controls.map(([key, name, min, max]) => <div key={key} className="control"><label>{name} (cm)<input type="range" min={min} max={max} step={0.1} value={state.settings[key]} onChange={e => settings({ [key]: +e.target.value }, key, +e.target.value, true)} /></label><DistanceInput label={name} min={min} max={max} value={state.settings[key]} commit={value => settings({ [key]: value }, key, value, true)} /></div>)}
          </section>
        </div>
        {state.step === 1 && <button className="primary" onClick={() => update({ step: 2 })}>Prepare experiment</button>}
        {state.step >= 2 && <section className="panel"><h2>{last ? "Plan the next trial" : "Predict and test"}</h2><label>Hypothesis<textarea aria-label="Hypothesis" value={state.hypothesis} onChange={e => update({ hypothesis: e.target.value })} /></label><label>Predicted outcome<select value={state.prediction} onChange={e => update({ prediction: e.target.value })}><option value="">Select an outcome</option><option value="real">Real image on a screen</option><option value="virtual">Virtual image</option><option value="parallel">Parallel rays, no finite image</option></select></label><button className="primary" onClick={run}>Run Experiment</button><p role="status">{message}</p></section>}
        {last && <section className="panel"><h2>Interpret the evidence</h2><p>{last.supported ? "The observation supports your prediction. Which ray behavior explains it?" : "The observation differs from your prediction. Move the screen and compare the outgoing rays."}</p>
          <p>{failedDemo && !state.explanation ? "The screen stays unfocused at every position." : last.observation}</p>
          {state.hints > 0 && <ol>{(failedDemo ? prompts : ["Compare the outgoing rays with the predicted image.", "Check where the object lies relative to F."]).slice(0, state.hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
          <div className="actions"><button disabled={state.hints >= (failedDemo ? 4 : 2)} onClick={() => { log("hint_accessed", { hint: state.hints + 1 }); update({ hints: state.hints + 1 }); }}>Next hint</button>
          {failedDemo && <button disabled={!state.interpretation.trim() || state.explanation} onClick={() => { log("explanation_opened", { interpretation: state.interpretation.trim() }); update({ explanation: true }); }}>Open explanation</button>}</div>
          {failedDemo && state.explanation && <p>Inside F, a convex lens sends rays out diverging. Their backward extensions meet on the object side, forming a virtual, erect, magnified image that cannot be projected. Move the object beyond F and compare.</p>}
          <label>Interpretation<textarea value={state.interpretation} onChange={e => update({ interpretation: e.target.value })} placeholder="What do the rays and screen tell you?" /></label>
          <div className="actions"><button onClick={revise}>Save revised hypothesis</button><button onClick={() => update({ step: 4 })}>Go to reflection</button></div>
        </section>}
        {state.step === 4 && <section className="panel"><h2>Transfer and reflection</h2><p>Two lenses share an object position of 24 cm. Their focal lengths are +12 cm and +30 cm. Which can project an image, and what evidence supports your prediction?</p><label>Transfer response<textarea value={state.transfer} onChange={e => update({ transfer: e.target.value })} /></label><label>What did your trials demonstrate?<textarea value={state.reflection} onChange={e => update({ reflection: e.target.value })} /></label><button className="primary" disabled={!state.transfer.trim() || !state.reflection.trim()} onClick={finish}>Complete investigation</button></section>}
        {history.length > 0 && <section className="panel"><h2>Trial history</h2>{history.map((trial, i) => <details key={trial.id}><summary>Trial {i + 1} · {trial.settings.type} · u = −{trial.settings.distance} cm · |f| = {trial.settings.focal} cm</summary><p>{trial.hypothesis}</p><p>{trial.id === last?.id && failedDemo && !state.explanation ? "Screen stayed unfocused." : trial.observation}</p>{trial.revision && <p>Revision: {trial.revision}</p>}</details>)}</section>}
      </>}
    </>}
  </main>;
}

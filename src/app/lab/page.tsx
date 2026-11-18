"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bench, measure, type Settings } from "../optics";
import RayBench from "../ray-bench";
import Theory from "./theory";
import { type Details, getExperimentHistory, id, read, saveExperiment, track, write, type Experiment } from "../store";
import { useStored } from "../navigation";

const initial = { session: "", step: 0, paused: false, settings: bench, hypothesis: "", prediction: "", interpretation: "", reflection: "", transfer: "", hints: 0, last: "", explanation: false, mission: 0 };
const progress = () => JSON.stringify(read("lab", initial));
const steps = ["Choose an idea", "Set up", "Predict & run", "Check result", "What you learned"];
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
const setupTips = [
  "Start with a convex lens, a 20 cm focal length, and the object 12 cm from the lens. After the first trial, move the screen and see whether the rays ever meet.",
  "Keep the convex lens and its focal length fixed. Change only the object distance and look for a magnification near −1.",
  "Keep the convex lens and its focal length fixed. Compare the magnitude of m at two object positions, including one inside F.",
  "Keep the convex lens and focal length fixed. Run trials with the object just inside F, exactly at F, and just outside F.",
  "Keep the object distance fixed. Use two convex focal lengths, one shorter and one longer than the object distance.",
  "Keep the focal-length magnitude, object distance, and object height fixed. Run one trial with each lens type.",
  "Use a convex lens with the object outside F. Move the screen until it is sharp, then use the signed object and screen distances to calculate f.",
];
const predictions: Record<string, string> = { real: "Real image on a screen", virtual: "Virtual image", parallel: "No finite image (parallel rays)" };
const controls = [
  ["focal", "Focal length magnitude", 5, 45], ["distance", "Object distance", 3, 100],
  ["height", "Object height", 1, 15], ["screen", "Screen position", 1, 150],
] as const;
const hypotheses = [
  "I expect a real image even inside the focal length.",
  "Moving outside F will form a real image.",
  "Inside F, a convex lens will form an upright virtual image.",
  "At F, the rays will leave parallel and no screen position will be sharp.",
  "At 2F, a convex lens will produce an inverted image the same size as the object.",
  "Two object positions can produce images with the same absolute magnification.",
  "Changing the focal length can change the image type even when the object stays put.",
  "A concave lens will produce an upright, smaller virtual image.",
  "I can infer focal length from the object distance and the position of the sharp screen image.",
];
const interpretations = {
  real: "The outgoing rays converge at the image position.",
  virtual: "The rays diverge and only their backward extensions meet.",
  parallel: "The outgoing rays are parallel and never meet at a finite distance.",
};
const transfers = [
  "The +12 cm lens projects a sharp image because 24 cm is outside F.",
  "The +30 cm lens projects a sharp image because 24 cm is inside F.",
  "Both lenses project sharp images because both are convex.",
];
const reflections = [
  "The object position relative to F changes the outcome for a convex lens.",
  "A screen forms a sharp image where the refracted rays converge.",
  "The signed image height and magnification describe image orientation and size.",
  "Changing the lens can change the outcome while the object stays in place.",
  "A sharp screen reading and the object distance can be used to infer focal length.",
];
const takeawayLabels = ["Distance changes the image", "Meeting rays make a sharp image", "Magnification shows size and orientation", "Swapping lenses changes the image", "A sharp image helps find focal length"];
const format = (value: number | null, unit = "") => value === null ? "—" : `${Number(value.toFixed(2))}${unit}`;

function TrialResult({ trial, previous, index, concealed }: { trial: Experiment; previous?: Experiment; index: number; concealed: boolean }) {
  const { type, distance, focal, height, screen } = trial.settings;
  const result = measure(trial.settings);
  const changed = previous && [
    type !== previous.settings.type && "lens type",
    distance !== previous.settings.distance && "object distance",
    focal !== previous.settings.focal && "focal length",
    height !== previous.settings.height && "object height",
    screen !== previous.settings.screen && "screen position",
  ].filter(Boolean);
  const observation = concealed ? "No sharp image on the screen"
    : result.nature === "real" ? `Real, upside-down image at ${format(result.v, " cm")} · ${result.sharp ? "screen in focus" : "screen out of focus at the saved position"}`
    : result.nature === "virtual" ? "Virtual, upright image · cannot project onto a screen"
    : "Rays leave parallel · no image at a finite distance";

  return <article className="trial-result">
    <div className="section-head"><h3>Trial {index + 1}</h3><small>{trial.supported ? "Prediction matched" : "Prediction differed"}</small></div>
    <p className="trial-settings"><strong>{type === "convex" ? "Convex" : "Concave"}</strong> · Object {distance} cm away, {height} cm tall · Focal length {focal} cm · Screen {screen} cm away</p>
    {changed && <p className="trial-settings">{changed.length ? `Changed: ${changed.join(", ")}` : "Same setup as the previous trial"}</p>}
    <dl><div><dt>You predicted</dt><dd>{predictions[trial.prediction] ?? trial.prediction}</dd></div><div><dt>You observed</dt><dd>{observation}</dd></div></dl>
  </article>;
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label>{label}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Select an answer</option>
    {value && !options.includes(value) && <option value={value}>{value} (saved response)</option>}
    {options.map(option => <option value={option} key={option}>{option}</option>)}
  </select></label>;
}

function LensChoice({ focal }: { focal: 12 | 30 }) {
  return <span className="lens-choice-diagram">
    <span className="lens-choice-axis" aria-hidden="true" />
    <span className="lens-choice-object" aria-hidden="true">↑</span>
    <span className="lens-choice-glass" aria-hidden="true" />
    <span className="lens-choice-focus" style={{ left: focal === 12 ? "39%" : "12%" }} aria-hidden="true">F</span>
  </span>;
}

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
  const [revisionMessage, setRevisionMessage] = useState("");
  const opened = useRef("");
  const elapsed = useStored(() => JSON.stringify(read("lab-time:" + state.session, 0)), 0);
  const result = measure(state.settings);
  const expectedInterpretation = last ? interpretations[measure(last.settings).nature] : "";
  const selectedInterpretation = Object.values(interpretations).includes(state.interpretation);
  const interpretationCorrect = state.interpretation === expectedInterpretation;
  const tested = !!last && ["type", "focal", "distance", "height"].every(key => state.settings[key as keyof Settings] === last.settings[key as keyof Settings]);
  const failedDemo = !!last && last.prediction === "real" && measure(last.settings).nature === "virtual" && last.settings.type === "convex";
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
    if (!state.hypothesis.trim() || !state.prediction) { setMessage("Choose a hypothesis and a prediction before running the experiment."); return; }
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
    if (last && state.interpretation.trim()) saveExperiment({ ...last, interpretation: state.interpretation.trim() });
    update({ last: experiment, step: 3, hints: 0, explanation: false, interpretation: "", prediction: "" });
    setMessage("");
    setRevisionMessage("");
  }
  function revise() {
    if (!last || !state.hypothesis.trim() || !state.interpretation.trim() || state.hypothesis.trim() === last.hypothesis) {
      setRevisionMessage("Choose an interpretation and a different hypothesis before saving the revision.");
      return;
    }
    saveExperiment({ ...last, interpretation: state.interpretation.trim(), revision: state.hypothesis.trim() });
    log("hypothesis_revised", { original: last.hypothesis, revision: state.hypothesis.trim(), interpretation: state.interpretation.trim() });
    setRevisionMessage("Revision saved. Change the setup and run a comparison trial.");
  }
  function finish() {
    if (!last || !state.reflection.trim() || !state.transfer.trim()) return;
    if (state.interpretation.trim()) saveExperiment({ ...last, interpretation: state.interpretation.trim() });
    log("challenge_completed", { transfer: state.transfer.trim(), correct: transfers.includes(state.transfer) ? state.transfer === transfers[0] : null, mission: state.mission });
    log("investigation_completed", { reflection: state.reflection.trim() });
    log("session_completed", { active_seconds: elapsed });
    update({ step: 5 });
  }

  return <main className="shell investigation">
    <header className="hero lab-hero"><p className="eyebrow">VIRTUAL LABORATORY · ≈ 10 MINUTES</p><h1>Lens bench investigation</h1></header>
    <Theory />
    <ol className="stepper" aria-label="Investigation steps">{steps.map((step, i) => <li key={step} aria-current={i === state.step ? "step" : undefined} className={i === state.step ? "current" : ""}>{step}</li>)}</ol>
    {!state.session || state.paused || state.step === 5 ? <section className="panel">
      <h2>{state.paused ? "Investigation paused" : state.step === 5 ? "Investigation complete" : "Can you bring the image into focus?"}</h2>
      {state.step === 5 && <><p>{history.length} trials · {history.filter(row => row.supported).length} predictions supported</p>
        {transfers.includes(state.transfer) && <div className="result-strip">
          <span>{state.transfer === transfers[0] ? "✓ Correct" : "Answer · +12 cm lens"}</span>
          <span>24 cm &gt; 12 cm · Real image</span><span>24 cm &lt; 30 cm · Virtual image</span>
        </div>}
        <p><strong>Your takeaway</strong> · {state.reflection}</p><p><Link href="/olympiad?question=c1">Try the related Olympiad question →</Link></p><p><Link href="/analytics">Review investigation evidence →</Link></p></>}
      {!state.paused && <label>Investigation mission<select value={state.mission} onChange={e => update({ mission: Number(e.target.value) })}>{missions.map((mission, i) => <option value={i} key={mission}>{mission}</option>)}</select></label>}
      <button className="primary" onClick={() => {
        if (state.paused) { log("session_resumed"); update({ paused: false }); }
        else start();
      }}>{state.paused ? "Resume Investigation" : state.step === 5 ? "Start another investigation" : "Start investigation"}</button>
    </section> : <>
      <div className="section-head lab-topline"><p><strong>Goal</strong> · {missions[state.mission]}</p><button onClick={() => { log("session_paused", { active_seconds: elapsed }); update({ paused: true }); }}>Pause investigation</button></div>
      {state.step === 0 ? <section className="panel"><h2>What do you think will happen?</h2><Choice label="Initial hypothesis" value={state.hypothesis} options={hypotheses} onChange={hypothesis => update({ hypothesis })} /><button className="primary" disabled={!state.hypothesis.trim()} onClick={() => update({ step: 1 })}>Explore apparatus</button></section> : <>
        {state.step < 4 && <div className="lab-grid">
          <section className="panel"><h2>{state.step === 1 ? "Set up the optical bench" : "Optical bench"}</h2><RayBench settings={state.settings} reveal={reveal} />
            {reveal && <dl className="metrics">{[["Image distance", format(result.v, " cm")], ["Image height", format(result.height, " cm")], ["Magnification", format(result.m)]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
            <p role="status">{tested ? reveal && result.nature === "parallel" ? "Parallel rays. No finite image distance." : result.sharp ? "Screen aligned. A sharp image is projected." : "No sharp image at this screen position." : ""}</p>
          </section>
          <section className="panel"><h2>{state.step === 3 ? "Test the screen" : "Bench controls"}</h2>{state.step < 3 && <><p>{setupTips[state.mission]}</p><label>Lens type<select value={state.settings.type} onChange={e => settings({ type: e.target.value as Settings["type"] }, "type", e.target.value, true)}><option value="convex">Convex</option><option value="concave">Concave</option></select></label></>}
          {controls.filter(([key]) => state.step !== 3 || key === "screen").map(([key, name, min, max]) => <div key={key} className="control"><label>{name} (cm)<input type="range" min={min} max={max} step={0.1} value={state.settings[key]} onChange={e => settings({ [key]: +e.target.value }, key, +e.target.value, true)} /></label><DistanceInput label={name} min={min} max={max} value={state.settings[key]} commit={value => settings({ [key]: value }, key, value, true)} /></div>)}
          </section>
        </div>}
        {state.step === 1 && <button className="primary" onClick={() => update({ step: 2 })}>Prepare experiment</button>}
        {state.step === 2 && <section className="panel"><h2>{last ? "Plan the next trial" : "Predict and test"}</h2><Choice label="Hypothesis" value={state.hypothesis} options={hypotheses} onChange={hypothesis => update({ hypothesis })} /><label>Predicted outcome<select value={state.prediction} onChange={e => update({ prediction: e.target.value })}><option value="">Select an outcome</option><option value="real">Real image on a screen</option><option value="virtual">Virtual image</option><option value="parallel">Parallel rays, no finite image</option></select></label><button className="primary" onClick={run}>Run Experiment</button><p role="status">{message}</p>{last && state.hypothesis !== last.hypothesis && <button onClick={revise}>Save revised hypothesis</button>}<p role="status">{revisionMessage}</p></section>}
        {last && state.step === 3 && <section className="panel" id="trial-evidence"><h2>What happened?</h2>
          <TrialResult trial={last} previous={history.at(-2)} index={history.length - 1} concealed={failedDemo && !state.explanation} />
          {state.hints > 0 && <ol>{(failedDemo ? prompts : ["Compare the outgoing rays with the predicted image.", "Check where the object lies relative to F."]).slice(0, state.hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
          <div className="actions"><button disabled={state.hints >= (failedDemo ? 4 : 2)} onClick={() => { log("hint_accessed", { hint: state.hints + 1 }); update({ hints: state.hints + 1 }); }}>Next hint</button>
          {failedDemo && <button disabled={!state.interpretation.trim() || state.explanation} onClick={() => { log("explanation_opened", { interpretation: state.interpretation.trim() }); update({ explanation: true }); }}>Open explanation</button>}</div>
          {failedDemo && state.explanation && <ol className="ray-explanation" aria-label="How the virtual image forms">
            <li><span aria-hidden="true">↗ ↘</span><strong>Rays spread out</strong></li>
            <li><span aria-hidden="true">⋯ ↖</span><strong>Trace dashed lines back</strong></li>
            <li><span aria-hidden="true">↑</span><strong>Upright virtual image</strong></li>
          </ol>}
          <Choice label="What do the rays and screen tell you?" value={state.interpretation} options={Object.values(interpretations)} onChange={interpretation => {
            update({ interpretation });
            if (interpretation) log("interpretation_selected", { interpretation, correct: interpretation === expectedInterpretation });
          }} />
          {selectedInterpretation && <p role="status">{interpretationCorrect ? "That explanation fits the observed rays." : "Check the outgoing ray paths and try another interpretation."}</p>}
          <div className="actions"><button onClick={() => update({ step: 2 })}>Try a different setup</button><button className="primary" onClick={() => update({ step: 4 })}>What did you learn?</button></div>
        </section>}
        {state.step === 4 && <section className="panel" id="trial-reflection">
          <h2>What did you learn?</h2>
          <fieldset>
            <legend>Which lens can make a sharp screen image?</legend>
            <p className="quiz-distance"><span aria-hidden="true">↑</span> Object distance · 24 cm</p>
            <div className="lens-choices">{["+12 cm lens", "+30 cm lens", "Both lenses"].map((label, index) => <label className="visual-choice" key={label}>
              <input type="radio" name="transfer" aria-label={label} checked={state.transfer === transfers[index]} onChange={() => update({ transfer: transfers[index] })} />
              <strong>{label}</strong>
              {index < 2 ? <LensChoice focal={index === 0 ? 12 : 30} /> : <span className="lens-pair" aria-hidden="true"><i /><i /></span>}
            </label>)}</div>
          </fieldset>
          <fieldset className="takeaway-choices">
            <legend>Pick one takeaway</legend>
            {takeawayLabels.map((label, index) => <label className="visual-choice" key={label}>
              <input type="radio" name="takeaway" checked={state.reflection === reflections[index]} onChange={() => update({ reflection: reflections[index] })} />
              {label}
            </label>)}
          </fieldset>
          <button className="primary" disabled={!state.transfer.trim() || !state.reflection.trim()} onClick={finish}>Complete investigation</button>
        </section>}
      </>}
    </>}
    {history.length > 0 && !state.paused && <details className="panel trial-history" open={state.step >= 4}>
      <summary><strong>Compare saved trials</strong> · {history.length} saved</summary>
      <div className="cards">{history.map((trial, i) => <TrialResult key={trial.id} trial={trial} previous={history[i - 1]} index={i} concealed={trial.id === last?.id && failedDemo && !state.explanation} />)}</div>
    </details>}
  </main>;
}

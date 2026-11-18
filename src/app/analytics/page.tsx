"use client";

import { useState } from "react";
import { download } from "../exports";
import { useStored } from "../navigation";
import { getEvents, getExperimentHistory, getExportHistory } from "../store";

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function Analytics() {
  const events = useStored<ReturnType<typeof getEvents>>(() => JSON.stringify(getEvents()), []);
  const experiments = useStored<ReturnType<typeof getExperimentHistory>>(() => JSON.stringify(getExperimentHistory()), []);
  const exports = useStored<ReturnType<typeof getExportHistory>>(() => JSON.stringify(getExportHistory()), []);
  const [filter, setFilter] = useState("All activity");
  const [message, setMessage] = useState("");
  const run = events.filter(e => e.event_type === "experiment_run");
  const supported = run.filter(e => e.details.supported === true).length;
  const count = (type: string) => events.filter(e => e.event_type === type).length;
  const arena = events.filter(e => e.event_type === "olympiad_answer_submitted");
  const completedSessions = [...new Map(events
    .filter(event => event.investigation_id === "lens-bench" && event.event_type === "session_completed")
    .map(event => [event.session_id, event])).values()].map((event, index) => {
      const seconds = event.details.active_seconds;
      return { ...event, number: index + 1, seconds: typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : null };
    });
  const activeSeconds = completedSessions.reduce((sum, session) => sum + (session.seconds ?? 0), 0);
  const configurations = new Map<string, number>();
  run.forEach(e => {
    const s = e.details.settings;
    if (!s || typeof s !== "object" || Array.isArray(s)) return;
    const name = `${s.type} · |f| ${s.focal} cm · object ${s.distance} cm`;
    configurations.set(name, (configurations.get(name) ?? 0) + 1);
  });
  const list = events.filter(e => filter === "All activity" || (filter === "Olympiad Arena" ? e.investigation_id === "olympiad" : e.investigation_id === "lens-bench")).reverse();
  return <main className="shell">
    <p className="eyebrow">INVESTIGATION RECORDS</p><h1>Learning analytics</h1>
    <section className="panel"><h2>Activity overview</h2><dl className="metrics">{[
      ["Experiments", run.length], ["Predictions supported", supported], ["Predictions unsupported", run.length - supported],
      ["Hypotheses submitted", count("hypothesis_submitted")], ["Revisions", count("hypothesis_revised")],
      ["Lab hints", count("hint_accessed")], ["Sessions completed", completedSessions.length], ["Time in completed labs", formatDuration(activeSeconds)],
      ["Arena answers", arena.length], ["Arena correct", arena.filter(e => e.details.correct).length], ["Arena hints", count("olympiad_hint_accessed")],
    ].map(([label, n]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl>
    <h3>Most explored configurations</h3>{configurations.size ? <ul>{[...configurations].sort((a,b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => <li key={label}>{label} · {n} trial{n === 1 ? "" : "s"}</li>)}</ul> : <p>Run a trial to record a configuration.</p>}</section>
    <section className="panel" aria-labelledby="session-durations">
      <h2 id="session-durations">Investigation durations</h2>
      <p>Active time for each completed session. Pauses and hidden-tab time are excluded.</p>
      {completedSessions.length ? <div className="table-wrap"><table>
        <thead><tr><th scope="col">Session</th><th scope="col">Completed</th><th scope="col">Active time</th></tr></thead>
        <tbody>{[...completedSessions].reverse().map(session => <tr key={session.session_id}>
          <th scope="row">Session {session.number}</th>
          <td><time dateTime={session.timestamp}>{new Date(session.timestamp).toLocaleString()}</time></td>
          <td>{session.seconds === null ? "Unavailable" : formatDuration(session.seconds)}</td>
        </tr>)}</tbody>
      </table></div> : <p>Complete an investigation to see its duration here.</p>}
    </section>
    <section className="panel"><h2>Experiment timeline</h2>{experiments.length ? <ol>{experiments.map(trial => <li key={trial.id}><details><summary>{new Date(trial.timestamp).toLocaleString()} · {trial.settings.type} · {trial.supported ? "Prediction supported" : "Prediction unsupported"}</summary><p><strong>Hypothesis:</strong> {trial.hypothesis}</p><p>Object {trial.settings.distance} cm from lens · |f| = {trial.settings.focal} cm · screen at {trial.settings.screen} cm</p><p><strong>Predicted:</strong> {trial.prediction} · <strong>Observed:</strong> {trial.observation}</p>{trial.interpretation && <p><strong>Interpretation:</strong> {trial.interpretation}</p>}{trial.revision && <p><strong>Revision:</strong> {trial.revision}</p>}</details></li>)}</ol> : <p>Completed trials will appear here.</p>}</section>
    <section className="panel"><div className="section-head"><h2>Clickstream</h2><label>Filter activity<select value={filter} onChange={e => setFilter(e.target.value)}>{["All activity", "Laboratory", "Olympiad Arena"].map(item => <option key={item}>{item}</option>)}</select></label></div>
      <p>{list.length} recorded events. Exports include the complete clickstream.</p><div className="event-list">{list.map(row => <details key={row.event_id}><summary>{new Date(row.timestamp).toLocaleTimeString()} · {row.event_type.replaceAll("_", " ")}</summary><pre>{JSON.stringify(row, null, 2)}</pre></details>)}</div></section>
    <section className="panel"><h2>Export history</h2><div className="actions">{(["CSV", "JSON", "Experiments"] as const).map(format => <button key={format} onClick={() => { const row = download(format); setMessage(`${row.format}: ${row.status} · ${row.records} records`); }}>Export {format === "Experiments" ? "experiments" : format}</button>)}</div><p role="status">{message}</p>
    {exports.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Format</th><th scope="col">File</th><th scope="col">Records</th><th scope="col">Status</th></tr></thead><tbody>{[...exports].reverse().map(row => <tr key={row.export_id}><td>{new Date(row.timestamp).toLocaleString()}</td><td>{row.format}</td><td>{row.filename}</td><td>{row.records}</td><td>{row.status}</td></tr>)}</tbody></table></div> : <p>No exports yet.</p>}</section>
  </main>;
}

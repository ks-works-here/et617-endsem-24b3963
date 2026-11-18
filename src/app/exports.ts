"use client";

import { appSession, getEvents, getExperimentHistory, id, saveExportLog, track, type EventRow } from "./store";

const columns: (keyof EventRow)[] = ["event_id", "session_id", "learner_id", "timestamp", "event_type", "investigation_id", "experiment_id", "step", "details"];
export function csv(events: EventRow[]) {
  const escape = (value: unknown) => `"${(value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll('"', '""')}"`;
  return [columns.join(","), ...events.map(row => columns.map(key => escape(row[key])).join(","))].join("\r\n");
}

export function download(format: "CSV" | "JSON" | "Experiments") {
  const timestamp = new Date().toISOString();
  const rows = format === "Experiments" ? getExperimentHistory() : getEvents();
  const filename = `optics-${format === "Experiments" ? "experiments" : "clickstream"}-${timestamp.replaceAll(":", "-")}.${format === "CSV" ? "csv" : "json"}`;
  let status = "download requested";
  let url = "";
  const anchor = document.createElement("a");
  try {
    const contents = format === "CSV" ? csv(rows as EventRow[]) : JSON.stringify(rows, null, 2);
    url = URL.createObjectURL(new Blob([contents], { type: format === "CSV" ? "text/csv;charset=utf-8" : "application/json" }));
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } catch {
    status = "failed";
  } finally {
    anchor.remove();
    if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const entry = { export_id: id(), timestamp, format, filename, records: rows.length, status };
  saveExportLog(entry);
  track("export_generated", appSession(), "analytics", "Export", entry);
  return entry;
}

import type { Settings } from "./optics";

export type Details = Record<string, string | number | boolean | null | Settings | string[]>;
export type EventRow = {
  event_id: string; session_id: string; learner_id: string; timestamp: string;
  event_type: string; investigation_id: string; experiment_id: string | null; step: string; details: Details;
};
export type Experiment = {
  id: string; session: string; timestamp: string; settings: Settings; hypothesis: string;
  prediction: string; observation: string; supported: boolean; interpretation?: string; revision?: string;
};
export type ExportRow = { export_id: string; timestamp: string; format: string; filename: string; records: number; status: string };
const cache = new Map<string, unknown>();

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem("optics." + key);
    if (cache.has(key)) return cache.get(key) as T;
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    if (value === null || typeof value !== typeof fallback || Array.isArray(value) !== Array.isArray(fallback)) return fallback;
    if (typeof fallback === "object" && !Array.isArray(fallback) && Object.keys(fallback as object).some(field => !(field in value))) return fallback;
    return value as T;
  } catch {
    return (cache.get(key) as T | undefined) ?? fallback;
  }
}

export function write<T>(key: string, value: T) {
  try {
    localStorage.setItem("optics." + key, JSON.stringify(value));
    cache.delete(key);
  } catch {
    cache.set(key, value);
  }
  window.dispatchEvent(new Event("optics-update"));
}

export const getEvents = () => read<EventRow[]>("events", []);
export const getEventsBySession = (id: string) => getEvents().filter(row => row.session_id === id);
export const getEventsByType = (type: string) => getEvents().filter(row => row.event_type === type);
export const getExperimentHistory = () => read<Experiment[]>("experiments", []);
export function saveExperiment(experiment: Experiment) {
  const history = getExperimentHistory();
  write("experiments", history.some(row => row.id === experiment.id)
    ? history.map(row => row.id === experiment.id ? experiment : row)
    : [...history, experiment]);
}
export const getExportHistory = () => read<ExportRow[]>("exports", []);
export const saveExportLog = (row: ExportRow) => write("exports", [...getExportHistory(), row]);
export const id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

export function track(event_type: string, session_id: string, investigation_id: string, step: string, details: Details = {}, experiment_id: string | null = null) {
  let learner_id = read("learner", "");
  if (!learner_id) {
    learner_id = id();
    write("learner", learner_id);
  }
  const row = { event_id: id(), session_id, learner_id, timestamp: new Date().toISOString(), event_type, investigation_id, experiment_id, step, details };
  write("events", [...getEvents(), row]);
  return row;
}

export function appSession() {
  try {
    const existing = sessionStorage.getItem("optics.app");
    if (existing) return existing;
    const session = id();
    sessionStorage.setItem("optics.app", session);
    return session;
  } catch {
    return id();
  }
}

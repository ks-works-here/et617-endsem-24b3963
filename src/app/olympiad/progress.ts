import { read } from "../store";
import type { Question } from "./questions";

export type RecordEntry = { attempts: number; misses: number; solved: boolean; hints: number; seconds: number[]; revealed: boolean; marked: boolean };
export type Challenge = { id: string; mode: string; queue: string[]; index: number; deadline: number; ended: boolean; correct: string[] };
export const blank: RecordEntry = { attempts: 0, misses: 0, solved: false, hints: 0, seconds: [], revealed: false, marked: false };
export const initial = { category: -1, level: -1, active: "", challenge: null as Challenge | null, records: {} as Record<string, RecordEntry>, drafts: {} as Record<string, string[]> };
export const snapshot = () => JSON.stringify(read("arena", initial));
export function groupStats(bank: Question[], records: typeof initial.records) {
  const entries = bank.map(q => records[q.id] ?? blank);
  const attempted = entries.filter(e => e.attempts > 0).length;
  const solved = entries.filter(e => e.solved).length;
  const misses = entries.filter(e => e.attempts > 0 && !e.solved).length;
  const attempts = entries.reduce((n, e) => n + e.attempts, 0);
  const incorrect = entries.reduce((n, e) => n + e.misses, 0);
  return { attempted, solved, misses, accuracy: attempts ? Math.round((attempts - incorrect) / attempts * 100) : null };
}

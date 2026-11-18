"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { appSession, getEventsBySession, read, track } from "./store";

const labFallback = { session: "", step: 0 };
export function LabLink() {
  const status = useStored(() => JSON.stringify(read("lab", labFallback)), labFallback);
  return <Link className="button primary" href="/lab">{status.session && status.step < 5 ? "Resume Investigation" : "Open investigation"} →</Link>;
}

export function useStored<T>(snapshot: () => string, fallback: T): T {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  return value ? JSON.parse(value) as T : fallback;
}

function subscribe(listener: () => void) {
  window.addEventListener("optics-update", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("optics-update", listener);
    window.removeEventListener("storage", listener);
  };
}

export default function Navigation() {
  useEffect(() => {
    const session = appSession();
    if (!getEventsBySession(session).some(e => e.event_type === "application_opened")) track("application_opened", session, "app", "navigation");
  }, []);
  return <header className="topbar"><Link className="brand" href="/"><span aria-hidden="true">◈</span> The Optics Lab</Link><nav aria-label="Main navigation"><Link href="/lab">Laboratory</Link><Link href="/olympiad">Olympiad Arena</Link><Link href="/analytics">Analytics</Link><Link href="/exam-card">Exam Card</Link></nav></header>;
}

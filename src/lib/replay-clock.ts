export interface ReplayAnchor {
  cursor: number;
  startedAt: number;
  speed: number;
}

// `now` and `startedAt` come from performance.now(), not sensor timestamps.
export function replayPosition(anchor: ReplayAnchor, now: number, end: number): number {
  const elapsed = Math.max(0, now - anchor.startedAt);
  return Math.min(end, Math.round(anchor.cursor + elapsed * anchor.speed));
}

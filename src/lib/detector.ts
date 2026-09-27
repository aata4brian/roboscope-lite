import type { DetectorState, Evidence, FaultType, Incident, Telemetry } from './types.ts';
import { expectedVelocity } from './simulator.ts';

export const RULES = {
  current: 4.5, velocity: 0.24, leftRpm: 25, slipRatio: 0.4, latency: 200,
  sustainMs: 800, rearmMs: 2000,
} as const;
export function initialDetector(): DetectorState { return { candidates: [], latched: {}, healthySince: {} }; }
const mean = (items: Telemetry[], fn: (p: Telemetry) => number) => items.reduce((sum, p) => sum + fn(p), 0) / items.length;

// Only observed telemetry enters the detector. It has no access to fault injection state.
export function inspectTelemetry(samples: Telemetry[], previous: DetectorState): { state: DetectorState; detections: { type: FaultType; startTime: number }[] } {
  const last = samples.at(-1);
  if (!last) return { state: previous, detections: [] };
  const window = samples.filter(p => p.timestamp >= last.timestamp - 1000);
  if (window.length < 3) return { state: previous, detections: [] };
  const conditions: Record<FaultType, boolean> = {
    'motor-stall': mean(window, p => p.leftMotorCurrent) > RULES.current && mean(window, p => p.linearVelocity) < RULES.velocity && mean(window, p => p.leftWheelRpm) < RULES.leftRpm,
    'wheel-slip': mean(window, expectedVelocity) > 0.35 && mean(window, p => 1 - p.linearVelocity / Math.max(0.01, expectedVelocity(p))) > RULES.slipRatio && mean(window, p => p.leftMotorCurrent) < RULES.current,
    'network-degradation': mean(window, p => p.networkLatency) > RULES.latency,
  };
  const state: DetectorState = { candidates: [], latched: { ...previous.latched }, healthySince: { ...previous.healthySince } };
  const detections: { type: FaultType; startTime: number }[] = [];
  for (const type of Object.keys(conditions) as FaultType[]) {
    if (!conditions[type]) {
      state.healthySince[type] ??= last.timestamp;
      if (last.timestamp - state.healthySince[type]! >= RULES.rearmMs) state.latched[type] = false;
      continue;
    }
    delete state.healthySince[type];
    const candidate = previous.candidates.find(c => c.type === type && last.timestamp - c.lastSeen <= 1500);
    const since = candidate?.since ?? last.timestamp;
    state.candidates.push({ type, since, lastSeen: last.timestamp });
    if (!state.latched[type] && last.timestamp - since >= RULES.sustainMs) {
      detections.push({ type, startTime: since });
      state.latched[type] = true;
    }
  }
  return { state, detections };
}

export function createIncident(type: FaultType, startTime: number, samples: Telemetry[], sessionId: string, ordinal: number): Incident {
  const p = samples.at(-1)!;
  const baseline = [...samples].reverse().find(s => s.timestamp <= startTime - 6000) ?? samples[0];
  const metrics: Record<FaultType, [keyof Telemetry, string, string][]> = {
    'motor-stall': [['leftMotorCurrent', 'Left motor current', 'A'], ['leftWheelRpm', 'Left wheel speed', 'rpm'], ['linearVelocity', 'Actual velocity', 'm/s'], ['motorTemperature', 'Motor temperature', '°C']],
    'wheel-slip': [['leftWheelRpm', 'Left wheel speed', 'rpm'], ['linearVelocity', 'Actual velocity', 'm/s'], ['encoderLeft', 'Left encoder count', 'ticks'], ['angularVelocity', 'Yaw rate', 'rad/s']],
    'network-degradation': [['networkLatency', 'Network latency', 'ms'], ['linearVelocity', 'Actual velocity', 'm/s']],
  };
  const evidence: Evidence[] = metrics[type].map(([metric, label, unit]) => ({ metric, label, unit, before: baseline[metric], after: p[metric], baselineAt: baseline.timestamp, timestamp: p.timestamp }));
  return {
    id: `${sessionId}-${String(ordinal).padStart(3, '0')}`, sessionId, type,
    severity: type === 'motor-stall' ? 'critical' : 'warning',
    detectedAt: p.timestamp, startTime, robotState: { ...p }, evidence,
    samples: samples.filter(s => s.timestamp >= p.timestamp - 30000), captureComplete: false,
  };
}

import type { Session, Telemetry } from './types.ts';
export const STORAGE_KEY = 'roboscope-lite:session:v1';
const fields: (keyof Telemetry)[] = ['timestamp','elapsed','sequence','x','y','heading','linearVelocity','angularVelocity','leftWheelRpm','rightWheelRpm','leftMotorCurrent','rightMotorCurrent','motorTemperature','battery','encoderLeft','encoderRight','networkLatency'];
const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const telemetry = (x: unknown): x is Telemetry => object(x) && fields.every(f => finite(x[f]));
const fault = (x: unknown) => ['motor-stall','wheel-slip','network-degradation'].includes(String(x));
const series = (x: unknown): x is Telemetry[] => Array.isArray(x) && x.length <= 3000 && x.every(telemetry) && x.every((p, i) => i === 0 || p.timestamp > x[i - 1].timestamp);

export function decodeSession(raw: string): Session {
  const s: unknown = JSON.parse(raw);
  if (!object(s) || s.version !== 1 || typeof s.id !== 'string' || !object(s.sim) || !series(s.samples) || !telemetry(s.sim.current) || !finite(s.sim.seed) || !finite(s.sim.startTimestamp) || !Number.isInteger(s.sim.tick) || Number(s.sim.tick) < 0 || Number(s.sim.tick) > 3000 || (s.sim.fault !== null && (!object(s.sim.fault) || !fault(s.sim.fault.type) || !finite(s.sim.fault.startTick))) || !object(s.detector) || !Array.isArray(s.detector.candidates) || !object(s.detector.latched) || !object(s.detector.healthySince) || !Array.isArray(s.incidents) || s.incidents.length > 12) throw new Error('Saved recording is invalid or uses an unsupported version. Reset the session to start a new recording.');
  if (!s.detector.candidates.every(c => object(c) && fault(c.type) && finite(c.since) && finite(c.lastSeen)) || !Object.values(s.detector.latched).every(v => typeof v === 'boolean') || !Object.values(s.detector.healthySince).every(finite)) throw new Error('Saved detector state is invalid. Reset the session to recover.');
  for (const i of s.incidents) {
    if (!object(i) || typeof i.id !== 'string' || typeof i.sessionId !== 'string' || !fault(i.type) || !['warning','critical'].includes(String(i.severity)) || !finite(i.detectedAt) || !finite(i.startTime) || !telemetry(i.robotState) || !series(i.samples) || !i.samples.length || typeof i.captureComplete !== 'boolean' || !Array.isArray(i.evidence) || !i.evidence.length || !i.evidence.every(e => object(e) && fields.includes(e.metric as keyof Telemetry) && typeof e.label === 'string' && typeof e.unit === 'string' && [e.before,e.after,e.baselineAt,e.timestamp].every(finite))) throw new Error('Saved incident data is incomplete. Reset the session to recover.');
  }
  return s as unknown as Session;
}

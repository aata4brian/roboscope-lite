import type { Incident, Session, Telemetry } from './types.ts';

export const STORAGE_KEY = 'roboscope-lite:session:v1';
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024;
const fields: (keyof Telemetry)[] = ['timestamp', 'elapsed', 'sequence', 'x', 'y', 'heading', 'linearVelocity', 'angularVelocity', 'leftWheelRpm', 'rightWheelRpm', 'leftMotorCurrent', 'rightMotorCurrent', 'motorTemperature', 'battery', 'encoderLeft', 'encoderRight', 'networkLatency'];
const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const timestamp = (x: unknown): x is number => finite(x) && Number.isSafeInteger(x) && x >= 0 && x <= 8640000000000000;
const identifier = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
const fault = (x: unknown) => ['motor-stall', 'wheel-slip', 'network-degradation'].includes(String(x));

function telemetry(x: unknown): x is Telemetry {
  return object(x) && fields.every(f => finite(x[f])) && timestamp(x.timestamp)
    && Number.isSafeInteger(x.sequence) && Number(x.sequence) >= 0 && Number(x.elapsed) >= 0;
}
function series(x: unknown): x is Telemetry[] {
  return Array.isArray(x) && x.length <= 3000 && x.every(telemetry)
    && x.every((p, i) => i === 0 || (p.timestamp > x[i - 1].timestamp && p.sequence > x[i - 1].sequence && p.elapsed > x[i - 1].elapsed));
}
function incident(x: unknown): x is Incident {
  if (!object(x) || !identifier(x.id) || !identifier(x.sessionId) || !fault(x.type)
    || !['warning', 'critical'].includes(String(x.severity)) || !timestamp(x.detectedAt)
    || !timestamp(x.startTime) || x.startTime > x.detectedAt || !telemetry(x.robotState)
    || !series(x.samples) || !x.samples.length || typeof x.captureComplete !== 'boolean'
    || !Array.isArray(x.evidence) || !x.evidence.length || x.evidence.length > fields.length) return false;
  const ordinal = Number(x.id.split('-').at(-1));
  const detectedAt = x.detectedAt;
  return x.id.startsWith(`${x.sessionId}-`) && Number.isSafeInteger(ordinal) && ordinal >= 1
    && x.robotState.timestamp === detectedAt && x.samples.some(p => p.timestamp === detectedAt)
    && x.samples.every(p => p.timestamp >= detectedAt - 30000 && p.timestamp <= detectedAt + 10000)
    && x.evidence.every(e => object(e) && fields.includes(e.metric as keyof Telemetry)
      && typeof e.label === 'string' && e.label.length <= 120 && typeof e.unit === 'string' && e.unit.length <= 24
      && finite(e.before) && finite(e.after) && timestamp(e.baselineAt) && e.baselineAt <= detectedAt && e.timestamp === detectedAt);
}

export function decodeSession(raw: string): Session {
  if (new TextEncoder().encode(raw).byteLength > MAX_RECORDING_BYTES) throw new Error('Recording exceeds the 8 MiB file limit.');
  let s: unknown;
  try { s = JSON.parse(raw); }
  catch { throw new Error('Recording is not valid JSON. Import a valid RoboScope recording or reset the session.'); }
  const invalid = () => new Error('Saved recording is invalid or uses an unsupported version. Import a valid RoboScope recording or reset the session.');
  if (!object(s) || s.version !== 1 || !identifier(s.id) || !object(s.sim) || !series(s.samples)
    || !telemetry(s.sim.current) || !finite(s.sim.seed) || !timestamp(s.sim.startTimestamp)
    || !Number.isInteger(s.sim.tick) || Number(s.sim.tick) < 0 || Number(s.sim.tick) > 3000
    || !object(s.detector) || !Array.isArray(s.detector.candidates)
    || !object(s.detector.latched) || !object(s.detector.healthySince)
    || !Array.isArray(s.incidents) || s.incidents.length > 12 || !s.incidents.every(incident)) throw invalid();
  const tick = Number(s.sim.tick);
  const now = s.sim.current.timestamp;
  if (s.sim.current.sequence !== tick || now !== s.sim.startTimestamp + tick * 200
    || s.samples.some(p => p.timestamp > now || p.sequence > tick)) throw invalid();
  if (s.sim.fault !== null && (!object(s.sim.fault) || !fault(s.sim.fault.type)
    || !Number.isInteger(s.sim.fault.startTick) || Number(s.sim.fault.startTick) < 0
    || Number(s.sim.fault.startTick) > tick)) throw invalid();
  if (s.detector.candidates.length > 3
    || !s.detector.candidates.every(c => object(c) && fault(c.type) && timestamp(c.since)
      && timestamp(c.lastSeen) && c.since <= c.lastSeen && c.lastSeen <= now)
    || new Set(s.detector.candidates.map(c => c.type)).size !== s.detector.candidates.length
    || !Object.entries(s.detector.latched).every(([key, value]) => fault(key) && typeof value === 'boolean')
    || !Object.entries(s.detector.healthySince).every(([key, value]) => fault(key) && timestamp(value) && value <= now)
    || new Set(s.incidents.map(i => i.id)).size !== s.incidents.length) throw invalid();
  return s as unknown as Session;
}

export function encodeSession(session: Session): string {
  const raw = JSON.stringify(session);
  decodeSession(raw);
  return raw;
}

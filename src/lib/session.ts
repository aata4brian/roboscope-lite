import type { FaultType, Session } from './types.ts';
import { MAX_TICKS } from './types.ts';
import { initialSim, injectFault, stepSimulation } from './simulator.ts';
import { createIncident, initialDetector, inspectTelemetry } from './detector.ts';

export function createSession(startTimestamp: number, id: string, incidents: Session['incidents'] = []): Session {
  return { version: 1, id, sim: initialSim(startTimestamp), samples: [], detector: initialDetector(), incidents: incidents.slice(-12) };
}
export function faultSession(session: Session, type: FaultType): Session {
  return { ...session, sim: injectFault(session.sim, type) };
}
export function advanceSession(session: Session): Session {
  if (session.sim.tick >= MAX_TICKS) return session;
  const step = stepSimulation(session.sim);
  const samples = step.packet ? [...session.samples, step.packet] : session.samples;
  const result = step.packet ? inspectTelemetry(samples.slice(-15), session.detector) : { state: session.detector, detections: [] };
  let incidents = session.incidents.map(incident => {
    if (incident.sessionId !== session.id || incident.captureComplete) return incident;
    const end = incident.detectedAt + 10000;
    return { ...incident,
      samples: step.packet && step.packet.timestamp <= end ? [...incident.samples, step.packet] : incident.samples,
      captureComplete: step.state.current.timestamp >= end,
    };
  });
  for (const detection of result.detections) {
    const ordinal = Math.max(0, ...incidents.filter(i => i.sessionId === session.id).map(i => Number(i.id.split('-').at(-1)))) + 1;
    incidents = [...incidents, createIncident(detection.type, detection.startTime, samples, session.id, ordinal)];
  }
  return { ...session, sim: step.state, samples, detector: result.state, incidents: incidents.slice(-12) };
}

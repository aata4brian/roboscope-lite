export type FaultType = 'motor-stall' | 'wheel-slip' | 'network-degradation';
export type Severity = 'critical' | 'warning';
export interface Telemetry {
  timestamp: number; elapsed: number; sequence: number;
  x: number; y: number; heading: number;
  linearVelocity: number; angularVelocity: number;
  leftWheelRpm: number; rightWheelRpm: number;
  leftMotorCurrent: number; rightMotorCurrent: number;
  motorTemperature: number; battery: number;
  encoderLeft: number; encoderRight: number; networkLatency: number;
}
export interface Evidence {
  metric: keyof Telemetry; label: string; unit: string;
  before: number; after: number; baselineAt: number; timestamp: number;
}
export interface Incident {
  id: string; sessionId: string; type: FaultType; severity: Severity;
  detectedAt: number; startTime: number; robotState: Telemetry;
  evidence: Evidence[]; samples: Telemetry[];
  captureComplete: boolean;
}
export interface SimState {
  seed: number; startTimestamp: number; tick: number; current: Telemetry;
  fault: { type: FaultType; startTick: number } | null;
}
export interface Candidate { type: FaultType; since: number; lastSeen: number; }
export interface DetectorState {
  candidates: Candidate[];
  latched: Partial<Record<FaultType, boolean>>;
  healthySince: Partial<Record<FaultType, number>>;
}
export interface Session {
  version: 1; id: string; sim: SimState; samples: Telemetry[];
  detector: DetectorState; incidents: Incident[];
}
export const FAULT_LABELS: Record<FaultType, string> = {
  'motor-stall': 'Motor Stall', 'wheel-slip': 'Wheel Slip',
  'network-degradation': 'Network Degradation',
};
export const DT = 0.2;
export const WHEEL_RADIUS = 0.065;
export const TRACK_WIDTH = 0.32;
export const ENCODER_TICKS = 360;
export const MAX_TICKS = 3000;
export const FAULT_DURATION = 18;

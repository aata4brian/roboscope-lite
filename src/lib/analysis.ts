import type { Incident, Telemetry } from './types.ts';
import { expectedVelocity } from './simulator.ts';

export function missingPackets(samples: Telemetry[]): number {
  return samples.slice(1).reduce((n, s, index) => n + Math.max(0, s.sequence - samples[index].sequence - 1), 0);
}
export function explainIncident(incident: Incident) {
  const p = incident.robotState;
  if (incident.type === 'motor-stall') return {
    title: 'Left drivetrain resistance',
    summary: `The left motor drew ${p.leftMotorCurrent.toFixed(2)} A while its wheel slowed to ${p.leftWheelRpm.toFixed(1)} rpm. Actual velocity fell to ${p.linearVelocity.toFixed(2)} m/s. The sustained combination is consistent with an obstruction or a stalled drivetrain.`,
    rule: '1 s rolling mean: left current > 4.5 A AND velocity < 0.24 m/s AND left wheel < 25 rpm, sustained ≥ 0.8 s.',
    checks: ['Inspect the left wheel for an obstruction.', 'Check gearbox and drivetrain resistance.', 'Inspect motor wiring and the motor driver.'],
  };
  if (incident.type === 'wheel-slip') return {
    title: 'Loss of wheel traction',
    summary: `Wheel rotation predicts ${expectedVelocity(p).toFixed(2)} m/s, but actual velocity is ${p.linearVelocity.toFixed(2)} m/s: a ${(100 * (1 - p.linearVelocity / expectedVelocity(p))).toFixed(0)}% discrepancy. Encoders still advance while unequal traction changes the trajectory.`,
    rule: '1 s rolling mean: expected velocity > 0.35 m/s AND speed discrepancy > 40% AND left current < 4.5 A, sustained ≥ 0.8 s.',
    checks: ['Inspect tire grip and the driving surface.', 'Check load distribution and wheel contact.', 'Compare wheel odometry with an independent velocity sensor.'],
  };
  const gaps = missingPackets(incident.samples.filter(s => s.timestamp <= incident.detectedAt));
  return {
    title: 'Degraded telemetry link',
    summary: `Observed latency reached ${p.networkLatency.toFixed(0)} ms. Sequence numbers reveal ${gaps} missing packets in the available pre-incident recording. Motion telemetry does not support a motor stall.`,
    rule: '1 s rolling mean: observed latency > 200 ms, sustained ≥ 0.8 s. Sequence gaps are supporting evidence.',
    checks: ['Check link quality, interference, and antenna placement.', 'Inspect congestion and transmission rate.', 'Check power stability at the network interface.'],
  };
}
export function timeLabel(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 19);
}
export function relativeTime(timestamp: number, detectedAt: number): string {
  const seconds = (timestamp - detectedAt) / 1000;
  return `T ${seconds >= 0 ? '+' : '−'} ${Math.abs(seconds).toFixed(1)} s`;
}

import { DT, WHEEL_RADIUS, TRACK_WIDTH, ENCODER_TICKS, FAULT_DURATION } from './types.ts';
import type { FaultType, SimState, Telemetry } from './types.ts';

// Stateless integer hash: a fixed seed and injection schedule produce identical data.
function noise(seed: number, tick: number, channel: number): number {
  let h = (seed ^ Math.imul(tick + 1, 374761393) ^ Math.imul(channel + 1, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function initialSim(startTimestamp: number, seed = 42): SimState {
  const current: Telemetry = {
    timestamp: startTimestamp, elapsed: 0, sequence: 0, x: 0, y: 0, heading: 0,
    linearVelocity: 0, angularVelocity: 0, leftWheelRpm: 0, rightWheelRpm: 0,
    leftMotorCurrent: 0, rightMotorCurrent: 0, motorTemperature: 28, battery: 100,
    encoderLeft: 0, encoderRight: 0, networkLatency: 0,
  };
  return { seed, startTimestamp, tick: 0, current, fault: null };
}
export function injectFault(state: SimState, type: FaultType): SimState {
  return state.fault ? state : { ...state, fault: { type, startTick: state.tick } };
}
export function stepSimulation(state: SimState): { state: SimState; packet: Telemetry | null } {
  const tick = state.tick + 1;
  const elapsed = tick * DT;
  const faultAge = state.fault ? (tick - state.fault.startTick) * DT : 0;
  const fault = faultAge >= FAULT_DURATION ? null : state.fault;
  const ramp = fault ? Math.min(1, faultAge / 1.6) : 0;
  const nominal = 0.68 + 0.055 * Math.sin(elapsed / 6);
  const turn = 0.095 + 0.045 * Math.sin(elapsed / 9);
  let leftSpeed = nominal - turn * TRACK_WIDTH / 2;
  let rightSpeed = nominal + turn * TRACK_WIDTH / 2;
  let leftLoad = 1.28 + 0.18 * noise(state.seed, tick, 0);
  let rightLoad = 1.3 + 0.18 * noise(state.seed, tick, 1);
  if (fault?.type === 'motor-stall') {
    leftSpeed *= 1 - ramp * 0.96;
    rightSpeed *= 1 - ramp * 0.74;
    leftLoad += ramp * 5.8;
    rightLoad += ramp * 0.7;
  }
  const leftWheelRpm = leftSpeed * 60 / (2 * Math.PI * WHEEL_RADIUS);
  const rightWheelRpm = rightSpeed * 60 / (2 * Math.PI * WHEEL_RADIUS);
  let contactLeft = leftSpeed;
  let contactRight = rightSpeed;
  if (fault?.type === 'wheel-slip') {
    contactLeft *= 1 - 0.82 * ramp;
    contactRight *= 1 - 0.59 * ramp;
    leftLoad -= 0.35 * ramp;
    rightLoad -= 0.2 * ramp;
  }
  const linearVelocity = (contactLeft + contactRight) / 2;
  const angularVelocity = (contactRight - contactLeft) / TRACK_WIDTH;
  const heading = state.current.heading + angularVelocity * DT;
  const middleHeading = state.current.heading + angularVelocity * DT / 2;
  // Simple thermal mass and cooling; current causes heat rather than an arbitrary jump.
  const heating = 0.013 * (leftLoad ** 2 + rightLoad ** 2);
  const cooling = 0.015 * (state.current.motorTemperature - 25);
  const packet: Telemetry = {
    timestamp: state.startTimestamp + tick * DT * 1000, elapsed, sequence: tick,
    x: state.current.x + linearVelocity * Math.cos(middleHeading) * DT,
    y: state.current.y + linearVelocity * Math.sin(middleHeading) * DT,
    heading, linearVelocity, angularVelocity, leftWheelRpm, rightWheelRpm,
    leftMotorCurrent: leftLoad, rightMotorCurrent: rightLoad,
    motorTemperature: state.current.motorTemperature + (heating - cooling) * DT,
    battery: Math.max(0, state.current.battery - (leftLoad + rightLoad) * DT / (3600 * 2.2) * 100),
    encoderLeft: state.current.encoderLeft + leftWheelRpm / 60 * DT * ENCODER_TICKS,
    encoderRight: state.current.encoderRight + rightWheelRpm / 60 * DT * ENCODER_TICKS,
    networkLatency: 18 + noise(state.seed, tick, 2) * 12 + (fault?.type === 'network-degradation' ? ramp * (260 + noise(state.seed, tick, 3) * 220) : 0),
  };
  const dropped = fault?.type === 'network-degradation' && ramp > 0.3 && noise(state.seed, tick, 4) < 0.32;
  return { state: { ...state, tick, current: packet, fault }, packet: dropped ? null : packet };
}
export function expectedVelocity(p: Telemetry): number {
  return (p.leftWheelRpm + p.rightWheelRpm) / 2 * 2 * Math.PI * WHEEL_RADIUS / 60;
}

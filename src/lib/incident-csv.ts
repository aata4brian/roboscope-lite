import type { Incident, Telemetry } from './types.ts';

const columns: [keyof Telemetry, string][] = [
  ['timestamp', 'timestamp_ms'], ['elapsed', 'elapsed_s'], ['sequence', 'sequence'],
  ['x', 'x_m'], ['y', 'y_m'], ['heading', 'heading_rad'],
  ['linearVelocity', 'linear_velocity_m_s'], ['angularVelocity', 'angular_velocity_rad_s'],
  ['leftWheelRpm', 'left_wheel_rpm'], ['rightWheelRpm', 'right_wheel_rpm'],
  ['leftMotorCurrent', 'left_motor_current_a'], ['rightMotorCurrent', 'right_motor_current_a'],
  ['motorTemperature', 'motor_temperature_c'], ['battery', 'battery_percent'],
  ['encoderLeft', 'encoder_left_ticks'], ['encoderRight', 'encoder_right_ticks'],
  ['networkLatency', 'network_latency_ms'],
];

function cell(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  // Imported IDs can start with a minus sign. Keep them as text in spreadsheets.
  const text = /^[\s]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

export function incidentCsv(incident: Incident): string {
  const header = ['incident_id', 'session_id', 'incident_type', 'telemetry_source',
    'capture_complete', 'time_utc', 'time_since_detection_s', ...columns.map(([, name]) => name)];
  const rows = incident.samples.map(sample => [
    incident.id, incident.sessionId, incident.type, 'simulation', incident.captureComplete,
    new Date(sample.timestamp).toISOString(), (sample.timestamp - incident.detectedAt) / 1000,
    ...columns.map(([key]) => sample[key]),
  ].map(cell).join(','));
  // Preserve only received packets: do not fill gaps or round measured values.
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

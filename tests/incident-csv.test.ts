import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, advanceSession, faultSession } from '../src/lib/session.ts';
import { incidentCsv } from '../src/lib/incident-csv.ts';
import type { FaultType, Session } from '../src/lib/types.ts';

function advance(session: Session, seconds: number) {
  for (let n = 0; n < seconds * 5; n++) session = advanceSession(session);
  return session;
}
function capture(type: FaultType, seconds = 20, id = 'csv') {
  const session = advance(createSession(Date.UTC(2026, 9, 13, 23, 59, 40), id), 35);
  return advance(faultSession(session, type), seconds).incidents[0];
}

for (const type of ['motor-stall', 'wheel-slip', 'network-degradation'] as FaultType[]) {
  test(`${type}: CSV preserves packet values, UTC dates, and relative detection times`, () => {
    const incident = capture(type);
    const original = JSON.stringify(incident);
    const csv = incidentCsv(incident);
    const [header, ...rows] = csv.trimEnd().split('\r\n').map(row => row.split(','));
    assert.equal(rows.length, incident.samples.length);
    assert.equal(header.length, 24);
    for (let n = 0; n < rows.length; n++) {
      const row = rows[n];
      const sample = incident.samples[n];
      assert.equal(row.length, header.length);
      assert.equal(row[3], '"simulation"');
      assert.equal(row[4], 'true');
      assert.equal(row[5], `"${new Date(sample.timestamp).toISOString()}"`);
      assert.equal(Number(row[6]), (sample.timestamp - incident.detectedAt) / 1000);
      const numeric = Object.fromEntries(header.slice(7).map((key, i) => [key, Number(row[i + 7])]));
      assert.deepEqual(Object.values(numeric), [sample.timestamp, sample.elapsed, sample.sequence,
        sample.x, sample.y, sample.heading, sample.linearVelocity, sample.angularVelocity,
        sample.leftWheelRpm, sample.rightWheelRpm, sample.leftMotorCurrent, sample.rightMotorCurrent,
        sample.motorTemperature, sample.battery, sample.encoderLeft, sample.encoderRight, sample.networkLatency]);
    }
    assert.ok(rows.some(row => Number(row[6]) < 0));
    assert.ok(rows.some(row => Number(row[6]) === 0));
    assert.ok(rows.some(row => Number(row[6]) > 0));
    assert.equal(JSON.stringify(incident), original);
    assert.ok(csv.endsWith('\r\n'));
  });
}

test('network export leaves dropped packets absent rather than filling the gaps', () => {
  const incident = capture('network-degradation');
  const rows = incidentCsv(incident).trimEnd().split('\r\n').slice(1);
  const sequences = rows.map(row => Number(row.split(',')[9]));
  assert.deepEqual(sequences, incident.samples.map(sample => sample.sequence));
  assert.ok(sequences.some((sequence, n) => n > 0 && sequence - sequences[n - 1] > 1));
});

test('an early export labels a partial capture and changes when capture completes', () => {
  const partial = capture('motor-stall', 5);
  assert.equal(partial.captureComplete, false);
  const rows = incidentCsv(partial).trimEnd().split('\r\n').slice(1);
  assert.ok(rows.every(row => row.split(',')[4] === 'false'));
  assert.ok(capture('motor-stall').samples.length > rows.length);
});

test('formula-like imported IDs are quoted text while negative measurements remain numeric', () => {
  const incident = capture('wheel-slip', 20, '-123');
  const rows = incidentCsv(incident).trimEnd().split('\r\n').slice(1);
  assert.ok(rows.every(row => row.startsWith('"\'-123-001","\'-123",')));
  assert.ok(rows.some(row => Number(row.split(',')[10]) < 0));
});

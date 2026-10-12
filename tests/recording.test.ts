import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, advanceSession, faultSession } from '../src/lib/session.ts';
import { decodeSession, encodeSession, MAX_RECORDING_BYTES } from '../src/lib/storage.ts';
import type { FaultType, Session } from '../src/lib/types.ts';

function advance(s: Session, seconds: number) {
  for (let n = 0; n < seconds * 5; n++) s = advanceSession(s);
  return s;
}
const EPOCH = Date.UTC(2026, 9, 13);
function recording(type: FaultType) {
  return advance(faultSession(advance(createSession(EPOCH, 'transfer'), 35), type), 20);
}

for (const type of ['motor-stall', 'wheel-slip', 'network-degradation'] as FaultType[]) {
  test(`${type}: exported recording preserves evidence, replay packets and deterministic continuation`, () => {
    const original = recording(type);
    const imported = decodeSession(encodeSession(original));
    assert.deepEqual(imported, original);
    assert.deepEqual(advance(imported, 10), advance(original, 10));
    assert.equal(imported.incidents[0].captureComplete, true);
  });
}
test('an imported partial capture continues without duplicating an incident', () => {
  const partial = advance(faultSession(advance(createSession(EPOCH, 'partial'), 35), 'motor-stall'), 5);
  assert.equal(partial.incidents.length, 1);
  assert.equal(partial.incidents[0].captureComplete, false);
  const continued = advance(decodeSession(encodeSession(partial)), 15);
  assert.equal(continued.incidents.length, 1);
  assert.equal(continued.incidents[0].captureComplete, true);
});
test('exports preserve archived incidents after a session reset', () => {
  const previous = recording('wheel-slip');
  const next = advance(createSession(EPOCH + 100000, 'next', previous.incidents), 5);
  assert.deepEqual(decodeSession(encodeSession(next)), next);
});
test('empty and maximum-length sessions can be transferred', () => {
  for (const s of [createSession(EPOCH, 'empty'), advance(createSession(EPOCH, 'full'), 600)]) {
    assert.deepEqual(decodeSession(encodeSession(s)), s);
  }
});

test('rejects broken ordering, IDs, detector keys and incident timing without mutating source', () => {
  const original = recording('motor-stall');
  const before = JSON.stringify(original);
  const changes: ((s: Session) => void)[] = [
    s => { s.samples[1].sequence = s.samples[0].sequence; },
    s => { s.samples[1].elapsed = s.samples[0].elapsed; },
    s => { s.samples[0].timestamp = 1e100; },
    s => { s.id = '../elsewhere'; },
    s => { s.incidents[0].id = 'transfer-bad'; },
    s => { s.incidents.push(s.incidents[0]); },
    s => { s.incidents[0].detectedAt += 100; },
    s => { s.incidents[0].startTime = s.incidents[0].detectedAt + 1; },
    s => { s.incidents[0].evidence[0].timestamp += 1; },
    s => { s.sim.tick += 1; },
    s => { s.detector.latched = { unexpected: true } as Session['detector']['latched']; },
    s => { s.detector.candidates = Array.from({ length: 4 }, () => ({ type: 'motor-stall', since: EPOCH, lastSeen: EPOCH })); },
  ];
  for (const change of changes) {
    const invalid = structuredClone(original);
    change(invalid);
    assert.throws(() => decodeSession(JSON.stringify(invalid)));
  }
  assert.equal(JSON.stringify(original), before);
});
test('rejects an oversized file before JSON parsing', () => {
  assert.throws(() => decodeSession(' '.repeat(MAX_RECORDING_BYTES + 1)), /8 MiB/);
});

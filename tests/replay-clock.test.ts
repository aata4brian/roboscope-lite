import test from 'node:test';
import assert from 'node:assert/strict';
import { replayPosition } from '../src/lib/replay-clock.ts';

const first = Date.UTC(2026, 9, 13);
const end = first + 40000;

for (const speed of [0.5, 1, 2]) {
  test(`${speed}x replay follows elapsed time at irregular timer intervals`, () => {
    const anchor = { cursor: first, startedAt: 123.5, speed };
    for (const elapsed of [50, 499, 1783, 5012]) {
      assert.equal(replayPosition(anchor, anchor.startedAt + elapsed, end), first + Math.round(elapsed * speed));
    }
  });
}

test('one delayed callback reaches the same position as many on-time callbacks', () => {
  const anchor = { cursor: first, startedAt: 100, speed: 2 };
  let frequent = first;
  for (let time = 200; time <= 5100; time += 100) frequent = replayPosition(anchor, time, end);
  assert.equal(replayPosition(anchor, 5100, end), frequent);
  assert.equal(frequent, first + 10000);
});

test('replay stops exactly at the final received timestamp', () => {
  assert.equal(replayPosition({ cursor: first, startedAt: 0, speed: 2 }, 100000, end), end);
});

test('a negative elapsed time cannot move the recording backwards', () => {
  assert.equal(replayPosition({ cursor: first + 1000, startedAt: 500, speed: 1 }, 499, end), first + 1000);
});

test('changing speed re-anchors at the current position without losing elapsed time', () => {
  const slow = { cursor: first, startedAt: 100, speed: 0.5 };
  const atChange = replayPosition(slow, 1350, end);
  const fast = { cursor: atChange, startedAt: 1350, speed: 2 };
  assert.equal(replayPosition(fast, 1350, end), atChange);
  assert.equal(replayPosition(fast, 1850, end), first + 1625);
});

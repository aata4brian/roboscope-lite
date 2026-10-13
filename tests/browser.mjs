import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { decodeSession, STORAGE_KEY, MAX_RECORDING_BYTES } from '../src/lib/storage.ts';
import { incidentCsv } from '../src/lib/incident-csv.ts';

// Test against the production server; this script owns and stops its server process.
const port = 3100;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { stdio: 'pipe' });
let logs = '';
server.stdout.on('data', data => { logs += data; });
server.stderr.on('data', data => { logs += data; });
let browser;
const results = [];
const errors = [];
const pass = name => { results.push(name); console.log(`PASS ${name}`); };
const file = raw => ({ name: 'recording.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function download(page, name = 'Export JSON') {
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const stream = await (await promise).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-13T00:00:00Z') });
  await page.goto(base);
  await page.getByRole('button', { name: 'Start simulation' }).waitFor();
  return { context, page };
}
async function noOverflow(page, width) {
  await page.setViewportSize({ width, height: 1000 });
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if(sizes.scroll > sizes.client + 1) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0,15).map(e => ({tag:e.tagName, cls:e.className, width:e.getBoundingClientRect().width, min:getComputedStyle(e).minWidth}))));
  assert.ok(sizes.scroll <= sizes.client + 1, `Horizontal page overflow at ${width}px: ${JSON.stringify(sizes)}`);
}
try {
  for (let n = 0; n < 100; n++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (n === 99) throw new Error(`Production server did not start: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--disable-dev-shm-usage'] });
  await mkdir('docs/screenshots', { recursive: true });
  let transferRaw;
  for (const label of ['Motor Stall', 'Wheel Slip', 'Network Degradation']) {
    const source = await newPage();
    await source.page.getByRole('button', { name: 'Start simulation' }).click();
    assert.equal(await source.page.getByRole('button', { name: 'Import JSON' }).isDisabled(), true);
    await source.page.clock.runFor(35000);
    await source.page.getByRole('button', { name: label, exact: false }).click();
    await source.page.clock.runFor(20000);
    await source.page.getByRole('button', { name: 'Pause', exact: true }).click();
    const raw = await download(source.page);
    const recording = decodeSession(raw);
    assert.equal(recording.incidents.length, 1);
    assert.equal(recording.incidents[0].captureComplete, true);
    transferRaw = raw;
    const target = await newPage();
    await target.page.getByLabel('Choose recording file').setInputFiles(file(raw));
    await target.page.getByRole('heading', { name: 'Review recording' }).waitFor();
    assert.equal(await target.page.locator('[data-testid="elapsed"]').textContent(), '0.0 s');
    await target.page.getByRole('button', { name: 'Replace with this recording' }).click();
    await target.page.getByRole('status').filter({ hasText: 'Imported' }).waitFor();
    assert.deepEqual(await saved(target.page), recording);
    assert.deepEqual(decodeSession(await download(target.page)), recording);
    await target.page.reload();
    await target.page.getByRole('button', { name: 'Resume simulation' }).waitFor();
    assert.deepEqual(await saved(target.page), recording);
    await target.page.getByRole('link', { name: new RegExp(`Open ${label} incident`) }).click();
    const priorStorage = await saved(target.page);
    assert.equal(await download(target.page, 'Export telemetry CSV'), incidentCsv(recording.incidents[0]));
    await target.page.getByRole('status').filter({ hasText: `Exported ${recording.incidents[0].samples.length} received packets` }).waitFor();
    assert.deepEqual(await saved(target.page), priorStorage);
    pass(`${label}: actual CSV download preserves received telemetry and does not change the recording`);
    // Next.js navigation and download handlers must finish before freezing timers.
    const now = await target.page.evaluate(() => Date.now());
    await target.page.clock.pauseAt(new Date(now + 1000));
    await target.page.getByRole('button', { name: 'Jump to detection' }).click();
    assert.equal(Number(await target.page.getByRole('slider', { name: 'Replay position' }).inputValue()), recording.incidents[0].detectedAt);
    await target.page.getByRole('button', { name: 'Rewind replay' }).click();
    await target.page.getByRole('combobox', { name: 'Playback speed' }).selectOption('2');
    await target.page.getByRole('button', { name: 'Replay incident' }).click();
    await target.page.clock.runFor(1000);
    assert.equal(Number(await target.page.getByRole('slider', { name: 'Replay position' }).inputValue()), recording.incidents[0].samples[0].timestamp + 2000);
    await target.page.getByRole('button', { name: 'Pause replay' }).click();
    if (label === 'Motor Stall') {
      const slider = target.page.getByRole('slider', { name: 'Replay position' });
      const first = recording.incidents[0].samples[0].timestamp;
      const last = recording.incidents[0].samples.at(-1).timestamp;
      const cursor = async () => Number(await slider.inputValue());
      for (const speed of [0.5, 1, 2]) {
        await target.page.getByRole('button', { name: 'Rewind replay' }).click();
        await target.page.getByRole('combobox', { name: 'Playback speed' }).selectOption(String(speed));
        await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
        await target.page.clock.runFor(1000);
        await target.page.getByRole('button', { name: 'Pause replay', exact: true }).click();
        assert.equal(await cursor(), first + 1000 * speed);
        await target.page.clock.runFor(500);
        assert.equal(await cursor(), first + 1000 * speed);
        await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
        await target.page.clock.runFor(1000);
        await target.page.getByRole('button', { name: 'Pause replay', exact: true }).click();
        assert.equal(await cursor(), first + 2000 * speed);
      }
      await target.page.getByRole('button', { name: 'Rewind replay' }).click();
      await target.page.getByRole('combobox', { name: 'Playback speed' }).selectOption('1');
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
      await target.page.clock.runFor(1000);
      await target.page.getByRole('combobox', { name: 'Playback speed' }).selectOption('2');
      await target.page.clock.runFor(1000);
      await target.page.getByRole('button', { name: 'Pause replay', exact: true }).click();
      assert.equal(await cursor(), first + 3000);
      pass('Replay rates 0.5x/1x/2x, pause/resume and mid-play speed changes preserve elapsed time');

      await target.page.getByRole('button', { name: 'Rewind replay' }).click();
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
      await target.page.clock.fastForward(2000);
      assert.equal(await cursor(), first + 4000);
      await target.page.clock.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      await target.page.clock.runFor(1000);
      await target.page.getByRole('button', { name: 'Pause replay', exact: true }).click();
      assert.equal(await cursor(), first + 6000);
      pass('A delayed timer catches up; changing the system clock does not jump the replay');

      await slider.press('Home');
      assert.equal(await cursor(), first);
      await slider.press('End');
      assert.equal(await cursor(), last);
      await slider.press('ArrowLeft');
      assert.equal(await cursor(), last - 100);
      pass('Replay slider Home/End/ArrowLeft reaches recording boundaries and steps by 100 ms');

      await target.page.getByRole('button', { name: 'Rewind replay' }).click();
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
      await target.page.clock.runFor(1000);
      await slider.scrollIntoViewIfNeeded();
      const box = await slider.boundingBox();
      assert.ok(box);
      await target.page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
      await target.page.mouse.down();
      await target.page.mouse.move(box.x + box.width * 0.65, box.y + box.height / 2, { steps: 5 });
      await target.page.mouse.up();
      const scrubbed = await cursor();
      assert.ok(scrubbed > first + (last - first) * 0.5 && scrubbed < last);
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).waitFor();
      await target.page.clock.runFor(1000);
      assert.equal(await cursor(), scrubbed);
      pass('Dragging the replay slider seeks within the recording and pauses playback');
      await slider.press('End');
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
      await target.page.clock.fastForward((last - first) / 2 + 500);
      assert.equal(await cursor(), last);
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).waitFor();
      await target.page.getByRole('button', { name: 'Replay incident', exact: true }).click();
      await target.page.clock.runFor(1000);
      assert.equal(await cursor(), first + 2000);
      await target.page.getByRole('button', { name: 'Pause replay', exact: true }).click();
      pass('Playback clamps and stops at the final packet; replaying again restarts from the first');
    }
    for (const width of [1440, 1280, 768, 390]) await noOverflow(target.page, width);
    if (label === 'Motor Stall') {
      await target.page.screenshot({ path: 'docs/screenshots/replay-mobile.png', fullPage: true });
      await target.page.setViewportSize({ width: 1440, height: 1000 });
      await target.page.screenshot({ path: 'docs/screenshots/replay-desktop.png', fullPage: true });
    }
    pass(`${label}: UI simulation → export → separate browser import → reload → replay at 2x`);
    await source.context.close();
    await target.context.close();
  }
  const { context, page } = await newPage();
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await page.clock.runFor(6000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await saved(page);
  const good = JSON.parse(transferRaw);
  const invalid = [
    '{broken',
    JSON.stringify({ ...good, version: 7 }),
    JSON.stringify({ ...good, incidents: [good.incidents[0], good.incidents[0]] }),
    JSON.stringify({ ...good, incidents: [{ ...good.incidents[0], id: 'bad-number' }] }),
    ' '.repeat(MAX_RECORDING_BYTES + 1),
  ];
  for (const raw of invalid) {
    await page.getByLabel('Choose recording file').setInputFiles(file(raw));
    await page.getByRole('alert').filter({ hasText: 'Unable to import' }).waitFor();
    assert.deepEqual(await saved(page), before);
  }
  pass('Five invalid/oversized files leave the existing recording unchanged');
  await page.getByLabel('Choose recording file').setInputFiles(file(transferRaw));
  await page.getByRole('button', { name: 'Cancel import' }).click();
  assert.equal(await page.getByRole('heading', { name: 'Review recording' }).count(), 0);
  assert.deepEqual(await saved(page), before);
  pass('Cancel import retains current session and archive');
  await page.getByLabel('Choose recording file').setInputFiles(file(transferRaw));
  for (const width of [1440, 1280, 768, 390]) await noOverflow(page, width);
  await page.getByRole('region', { name: 'Recording files' }).screenshot({ path: 'docs/screenshots/recording-import-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('region', { name: 'Recording files' }).screenshot({ path: 'docs/screenshots/recording-import-desktop.png' });
  pass('Dashboard/import preview and replay have no page overflow at 1440/1280/768/390px');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Replace with this recording' }).click();
  await page.getByRole('alert').filter({ hasText: 'works in memory' }).waitFor();
  assert.deepEqual(decodeSession(await download(page)), good);
  pass('Storage quota failure reports an in-memory fallback; imported recording remains exportable');
  await context.close();
  const recovery = await browser.newContext();
  await recovery.addInitScript(key => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  const recoverPage = await recovery.newPage();
  await recoverPage.goto(base);
  await recoverPage.locator('.error-banner').waitFor();
  await recoverPage.getByLabel('Choose recording file').setInputFiles(file(transferRaw));
  await recoverPage.getByRole('button', { name: 'Replace with this recording' }).click();
  assert.deepEqual(await saved(recoverPage), good);
  await recoverPage.getByRole('button', { name: 'Resume simulation' }).click();
  await recoverPage.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  pass('Valid import recovers a corrupted browser recording and re-enables simulation');
  await recovery.close();
  assert.deepEqual(errors, []);
  pass('No uncaught browser errors');
  await writeFile('docs/browser-results.json', JSON.stringify({ date: '2026-10-13', environment: 'local production build, headless Chromium', checks: results, uncaughtErrors: errors }, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

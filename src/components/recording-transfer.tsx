'use client';
import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { decodeSession, encodeSession, MAX_RECORDING_BYTES } from '@/lib/storage';
import type { Session } from '@/lib/types';
import { useSession } from './session-provider';

export function RecordingTransfer() {
  const { session, running, importRecording } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function download() {
    if (!session) return;
    setError('');
    try {
      const raw = encodeSession(session);
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `roboscope-${session.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Recording exported. Keep this file to replay it in another browser.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to export this recording.'); }
  }

  async function readFile(file: File | undefined) {
    setPending(null);
    setError('');
    setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_RECORDING_BYTES) throw new Error('Recording exceeds the 8 MiB file limit.');
      setPending(decodeSession(await file.text()));
    } catch { setError('Unable to import this file. Choose a valid RoboScope v1 JSON recording, up to 8 MiB. Your current recording has not changed.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  function apply() {
    if (!pending) return;
    try {
      importRecording(pending);
      setMessage(`Imported ${pending.samples.length} packets and ${pending.incidents.length} incidents. The simulation is paused.`);
      setPending(null);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to apply this recording.'); }
  }

  return <section className="recording-transfer" aria-label="Recording files">
    <div className="recording-transfer-heading"><div><h2>Recording files</h2><p>Back up a run or replay it in another browser. Files stay on your device.</p></div>
      <div className="recording-transfer-buttons">
        <button className="button quiet" onClick={download} disabled={!session || busy}><Download size={15}/> Export JSON</button>
        <button className="button quiet" onClick={() => input.current?.click()} disabled={running || busy}><Upload size={15}/> {busy ? 'Checking file…' : 'Import JSON'}</button>
        <input ref={input} type="file" accept=".json,application/json" aria-label="Choose recording file" className="sr-only" tabIndex={-1} disabled={running || busy} onChange={e => void readFile(e.target.files?.[0])}/>
      </div>
    </div>
    {running ? <p className="transfer-message">Pause the simulation to import a file.</p> : null}
    {pending ? <div className="recording-preview"><h3>Review recording</h3><p><span className="mono">{pending.id}</span> · {(pending.sim.tick * 0.2).toFixed(1)} s · {pending.samples.length} packets · {pending.incidents.length} incidents</p>
      <p>Applying this file replaces your current session and incident archive. Export your current recording first if you want to keep it.</p>
      <div className="recording-transfer-buttons"><button className="button primary" onClick={apply} disabled={running}>Replace with this recording</button><button className="button quiet" onClick={() => setPending(null)}>Cancel import</button></div>
    </div> : null}
    {error ? <p className="transfer-error" role="alert">{error}</p> : null}
    {message ? <p className="transfer-message" role="status">{message}</p> : null}
  </section>;
}

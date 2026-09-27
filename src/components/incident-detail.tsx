'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CircleAlert, Pause, Play, RotateCcw, ScanLine } from 'lucide-react';
import { useSession } from './session-provider';
import { ChartGrid, Metrics, Trajectory } from './visuals';
import { explainIncident, missingPackets, relativeTime, timeLabel } from '@/lib/analysis';
import { FAULT_LABELS } from '@/lib/types';
import type { Incident } from '@/lib/types';

export function IncidentDetail({ id }:{id:string}) {
  const {session,ready}=useSession();
  if(!ready) return <div className="loading-state" role="status">Loading incident recording…</div>;
  const incident=session?.incidents.find(i=>i.id===id);
  if(!incident) return <div className="missing-incident"><CircleAlert size={34}/><h1>Recording not found</h1><p>This incident is stored in the browser where it was recorded. It may have been removed from the latest 12 recordings.</p><Link className="button primary" href="/">Return to overview</Link></div>;
  return <Replay key={id} incident={incident}/>;
}
function Replay({incident}:{incident:Incident}) {
  const {session,running}=useSession();
  const samples=incident.samples;
  const first=samples[0].timestamp,last=samples.at(-1)!.timestamp;
  const [cursor,setCursor]=useState(first);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  useEffect(()=>{
    if(!playing)return;
    const timer=setInterval(()=>setCursor(t=>Math.min(last,t+100*speed)),100);
    return()=>clearInterval(timer);
  },[playing,speed,last]);
  useEffect(()=>{if(cursor>=last)setPlaying(false);},[cursor,last]);
  const sample=[...samples].reverse().find(p=>p.timestamp<=cursor)??samples[0];
  const gap=cursor-sample.timestamp>300;
  const analysis=explainIncident(incident);
  const startPlayback=()=>{if(cursor>=last)setCursor(first);setPlaying(true);};
  const before=(incident.detectedAt-first)/1000,after=(last-incident.detectedAt)/1000;
  const capturing=!incident.captureComplete&&session?.id===incident.sessionId&&running;
  const canResume=session?.id===incident.sessionId;
  const baseline=samples.find(s=>s.timestamp===incident.evidence[0]?.baselineAt);
  return <>
    <Link className="back-link" href="/"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="page-heading detail-heading"><div><div className="eyebrow">INCIDENT ANALYSIS <span className="mono">/ INC-{incident.id.slice(-3)}</span></div><h1>{FAULT_LABELS[incident.type]} <span className={`severity ${incident.severity}`}>{incident.severity}</span></h1><p>ROBOT-01 <span className="meta-separator"/> Detected {timeLabel(incident.detectedAt)} UTC <span className="meta-separator"/> Session <span className="mono">{incident.sessionId}</span></p></div><span className="analysis-badge"><ScanLine size={15}/> Evidence-based diagnosis</span></div>
    <section className="replay-panel"><div className="replay-top"><div><div className="eyebrow">INCIDENT REPLAY</div><p>{before.toFixed(1)} s before <span className="meta-separator"/> {after.toFixed(1)} s after detection</p></div><div className="replay-clock"><strong className="mono" data-testid="replay-clock">{timeLabel(cursor)}.{String(Math.floor(cursor%1000/100))}</strong><span className="mono">{relativeTime(cursor,incident.detectedAt)}</span></div></div>
      <div className="replay-controls"><button className="button primary" onClick={playing?()=>setPlaying(false):startPlayback}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?'Pause replay':'Replay incident'}</button><button className="button icon-button" aria-label="Rewind replay" onClick={()=>{setPlaying(false);setCursor(first);}}><RotateCcw size={16}/></button><div className="scrubber"><input type="range" aria-label="Replay position" min={first} max={last} step={100} value={Math.min(cursor,last)} onChange={e=>{setPlaying(false);setCursor(Number(e.target.value));}}/><div className="scrubber-labels mono"><span>{relativeTime(first,incident.detectedAt)}</span><button onClick={()=>{setPlaying(false);setCursor(incident.detectedAt);}}>Jump to detection</button><span>{relativeTime(last,incident.detectedAt)}</span></div></div><label className="speed-select"><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label></div>
      {!incident.captureComplete||before<29.9||gap?<div className="replay-note">{gap?'Telemetry gap: holding the last received state. ':''}{capturing?'Capturing post-event telemetry in the background. ':!incident.captureComplete?(canResume?'Partial recording: resume the source session to capture more post-event data. ':'Partial recording: the source session ended before post-event capture completed. '):''}{before<29.9?'Less than 30 seconds of pre-event history was available.':''}</div>:null}
    </section>
    <Metrics sample={sample}/>
    <div className="section-label"><h2>Recorded telemetry</h2><span><i className="cursor-key"/> Replay cursor <span className="meta-separator"/> <i className="detection-key"/> Detection</span></div>
    <section className="monitoring-grid"><ChartGrid samples={samples} cursor={cursor} incidentTime={incident.detectedAt}/><Trajectory samples={samples} sample={sample} incidents={[incident]}/></section>
    <section className="diagnosis-grid"><article className="diagnosis-card"><div className="eyebrow">LIKELY CAUSE</div><h2>{analysis.title}</h2><p>{analysis.summary}</p><div className="rule-block"><span className="tiny-label">DETECTION RULE</span><p>{analysis.rule}</p></div><div className="inspection"><h3>Recommended inspection</h3><ol>{analysis.checks.map(check=><li key={check}><span><Check size={13}/></span>{check}</li>)}</ol></div><p className="diagnosis-limit">A rule-based hypothesis from simulated data; it does not confirm a hardware root cause.</p></article>
      <article className="evidence-card"><div className="panel-heading"><h2>Signal evidence</h2><span className="tiny-label">AT DETECTION</span></div><p className="evidence-intro">Comparing received samples at {timeLabel(incident.evidence[0].baselineAt)} and {timeLabel(incident.detectedAt)} UTC.</p>{incident.evidence.map(e=><div key={e.metric} className="evidence-row"><span>{e.label}</span><div className="mono"><span>{e.before.toFixed(e.unit==='ticks'||e.unit==='ms'?0:2)}</span><ChevronRight size={13}/><strong>{e.after.toFixed(e.unit==='ticks'||e.unit==='ms'?0:2)}</strong><small>{e.unit}</small></div></div>)}{incident.type==='network-degradation'?<div className="evidence-row"><span>Missing packets before detection</span><strong className="mono">{missingPackets(samples.filter(s=>s.timestamp<=incident.detectedAt))}</strong></div>:null}<div className="evidence-foot"><Check size={14}/> Values are copied from received telemetry.</div></article></section>
    <section className="timeline-panel"><div className="panel-heading"><h2>Incident timeline</h2><span className="tiny-label">SENSOR TIMESTAMPS</span></div><div className="timeline">
      <div className="timeline-item"><span className="timeline-dot"/><span className="mono">{relativeTime(first,incident.detectedAt)}</span><strong>Recording begins</strong><small>{timeLabel(first)} UTC · first available packet in window</small></div>
      {baseline?<div className="timeline-item"><span className="timeline-dot"/><span className="mono">{relativeTime(baseline.timestamp,incident.detectedAt)}</span><strong>Comparison baseline</strong><small>{baseline.linearVelocity.toFixed(2)} m/s · {baseline.leftMotorCurrent.toFixed(2)} A left motor</small></div>:null}
      <div className="timeline-item"><span className="timeline-dot amber"/><span className="mono">{relativeTime(incident.startTime,incident.detectedAt)}</span><strong>Abnormal pattern begins</strong><small>Rolling sensor values first satisfy the rule</small></div>
      <div className="timeline-item"><span className="timeline-dot amber"/><span className="mono">T + 0.0 s</span><strong>Incident detected</strong><small>{timeLabel(incident.detectedAt)} UTC · condition sustained ≥ 0.8 s</small></div>
      <div className="timeline-item"><span className="timeline-dot"/><span className="mono">{relativeTime(last,incident.detectedAt)}</span><strong>{incident.captureComplete?'Post-event window captured':capturing?'Capture in progress':'Last available packet'}</strong><small>{samples.length} packets retained for replay</small></div>
    </div></section>
  </>;
}

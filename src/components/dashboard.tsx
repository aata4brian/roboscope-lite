'use client';
import Link from 'next/link';
import { ArrowRight, Check, CircleAlert, Clock3, MoveUpRight, Pause, Play, RotateCcw, Unplug, Waves, Zap } from 'lucide-react';
import { useSession } from './session-provider';
import { ChartGrid, Metrics, Trajectory } from './visuals';
import { FAULT_DURATION, FAULT_LABELS, MAX_TICKS } from '@/lib/types';
import type { FaultType } from '@/lib/types';
import { missingPackets, timeLabel } from '@/lib/analysis';

export function Dashboard() {
  const {session,ready,running,start,pause,reset,inject}=useSession();
  if (!ready || !session) return <div className="loading-state" role="status">Loading local recording…</div>;
  const sample=session.samples.at(-1);
  const fault=session.sim.fault;
  const window=session.samples.filter(p=>p.timestamp>=session.sim.current.timestamp-60000);
  const active=Object.entries(session.detector.latched).filter(([,v])=>v).map(([k])=>k);
  const critical=active.includes('motor-stall');
  const warning=active.length>0;
  const status=critical?'CRITICAL':warning?'WARNING':running?'RUNNING':sample?'PAUSED':'READY';
  const faultSeconds=fault?Math.max(0,FAULT_DURATION-(session.sim.tick-fault.startTick)*0.2):0;
  const faults: {type:FaultType;icon:typeof Zap;description:string}[]=[
    {type:'motor-stall',icon:Zap,description:'High current · low wheel speed'},
    {type:'wheel-slip',icon:Waves,description:'Wheel speed ≠ ground speed'},
    {type:'network-degradation',icon:Unplug,description:'Latency spikes · missing packets'},
  ];
  const latest=session.incidents.filter(i=>i.sessionId===session.id).at(-1);
  const packetAge=sample?(session.sim.current.timestamp-sample.timestamp)/1000:0;
  return <>
    <div className="page-heading"><div><div className="eyebrow">ROBOT OPERATIONS</div><h1>Telemetry overview</h1><p>Simulate a run. Inject a fault. Follow the evidence.</p></div><span className={`status-badge ${critical?'critical':warning?'warning':running?'healthy':''}`}><i/>{status}</span></div>
    <section className="simulation-toolbar" aria-label="Simulation controls"><div className="simulation-buttons"><button className="button primary" onClick={running?pause:start} disabled={session.sim.tick>=MAX_TICKS}>{running?<Pause size={15}/>:<Play size={15}/>} {running?'Pause':sample?'Resume simulation':'Start simulation'}</button><button className="button quiet" onClick={reset}><RotateCcw size={14}/> Reset session</button></div><div className="run-meta"><span><Clock3 size={14}/><b className="mono" data-testid="elapsed">{(session.sim.tick*0.2).toFixed(1)} s</b></span><span className="meta-separator"/><span className="mono">{session.samples.length} packets</span><span className="tiny-label">5 Hz</span></div></section>
    {session.sim.tick>=MAX_TICKS?<div className="info-banner">Recording complete: 10 minute session limit reached. Reset to start another run; saved incidents remain available.</div>:null}
    <Metrics sample={sample}/>
    <section className="fault-section"><div className="fault-title"><div className="eyebrow">FAULT INJECTION</div><span>{fault?`Active · auto-clears in ${faultSeconds.toFixed(1)} s`:session.sim.tick<25?'Available after 5 s of baseline':'18 s duration · one fault at a time'}</span></div><div className="fault-buttons">{faults.map(({type,icon:Icon,description})=><button key={type} className={`fault-button ${fault?.type===type?'fault-active':''}`} disabled={!running||session.sim.tick<25||!!fault} onClick={()=>inject(type)}><Icon size={18}/><span><strong>{FAULT_LABELS[type]}</strong><small>{description}</small></span><span className="fault-indicator">{fault?.type===type?<span className="status-dot"/>:'+'}</span></button>)}</div></section>
    <div className="section-label"><h2>Live telemetry</h2><span>{packetAge>0.5?`Signal gap · last packet ${packetAge.toFixed(1)} s ago`:running?'Streaming':sample?'Stream paused':'Awaiting simulation'}<span className="meta-separator"/>Last 60 s</span></div>
    <section className="monitoring-grid"><ChartGrid samples={window} incidentTime={latest?.detectedAt}/><Trajectory samples={session.samples} sample={sample} incidents={session.incidents.filter(i=>i.sessionId===session.id)}/></section>
    <div className="stream-strip"><span><span className={running?'status-dot':'status-dot idle'}/>{running?'Receiving telemetry':sample?'Recording paused':'No telemetry yet'}</span><span className="mono">{missingPackets(session.samples)} dropped packets <span className="meta-separator"/> Seed 42 <span className="meta-separator"/> Browser storage</span></div>
    <section id="incidents" className="incidents-section"><div className="section-label"><h2>Incident history <span className="count-pill">{session.incidents.length}</span></h2><span>Latest 12 recordings</span></div><div className="incident-table-wrap"><table className="incident-table"><thead><tr><th>INCIDENT / TYPE</th><th>DETECTED · UTC</th><th>SEVERITY</th><th>RECORDING</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{[...session.incidents].reverse().map((i,index)=><tr key={i.id}><td><Link href={`/incidents/${i.id}`} className="incident-link"><span className={`incident-icon ${i.severity}`}><CircleAlert size={16}/></span><span><strong>{FAULT_LABELS[i.type]}</strong><small className="mono">INC-{i.id.slice(-3)} <span> / {i.sessionId}</span></small></span></Link></td><td className="mono">{timeLabel(i.detectedAt)}<small>{i.sessionId!==session.id?'Previous session':`T + ${i.robotState.elapsed.toFixed(1)} s`}</small></td><td><span className={`severity ${i.severity}`}>{i.severity}</span></td><td><span className="recording-status">{i.captureComplete?<Check size={13}/>:<Clock3 size={13}/>} {i.captureComplete?'Ready to replay':i.sessionId===session.id&&running?'Capturing post-event':'Partial window'}</span></td><td><Link href={`/incidents/${i.id}`} className="open-incident" aria-label={`Open ${FAULT_LABELS[i.type]} incident ${index+1}`}><ArrowRight size={17}/></Link></td></tr>)}</tbody></table>{!session.incidents.length?<div className="empty-incidents"><CircleAlert size={25}/><div><strong>No incidents detected</strong><p>{sample?'Inject a fault above. The detector will watch for a sustained sensor pattern.':'Start a simulation, then inject a fault to create your first incident.'}</p></div></div>:null}</div></section>
    <div className="bottom-note"><MoveUpRight size={14}/><span>Detections come from sensor patterns. Open an incident to inspect its evidence and replay the recording.</span></div>
  </>;
}

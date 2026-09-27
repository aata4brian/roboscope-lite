'use client';
import { useId } from 'react';
import { Battery, Gauge, Radio, Thermometer, Zap } from 'lucide-react';
import type { Incident, Telemetry } from '@/lib/types';
import { expectedVelocity } from '@/lib/simulator';

export function Metrics({ sample }: { sample?: Telemetry }) {
  const items = [
    { label:'Actual velocity', value:sample?.linearVelocity.toFixed(2), unit:'m/s', icon:Gauge, foot: sample ? `Expected ${expectedVelocity(sample).toFixed(2)} m/s` : 'Independent ground speed' },
    { label:'Motor current', value:sample?.leftMotorCurrent.toFixed(2), unit:'A', icon:Zap, foot:sample ? `R ${sample.rightMotorCurrent.toFixed(2)} A · left shown` : 'Left / right drivetrain' },
    { label:'Temperature', value:sample?.motorTemperature.toFixed(1), unit:'°C', icon:Thermometer, foot:'Motor thermal model' },
    { label:'Link latency', value:sample?.networkLatency.toFixed(0), unit:'ms', icon:Radio, foot:sample && sample.networkLatency > 200 ? 'Above 200 ms threshold' : 'Telemetry transport' },
    { label:'Battery', value:sample?.battery.toFixed(1), unit:'%', icon:Battery, foot:'2.2 Ah simulated pack' },
  ];
  return <section className="metrics" aria-label="Robot metrics">{items.map(({label,value,unit,icon:Icon,foot}) => <article className="metric" key={label}><div className="metric-label">{label}<Icon size={15}/></div><div className="metric-value mono">{value ?? '—'}<span>{unit}</span></div><div className="metric-foot">{foot}</div></article>)}</section>;
}

interface Line { key: keyof Telemetry | 'expected'; color: string; label: string; }
export function TelemetryChart({title,unit,samples,lines,minimumMax,cursor,incidentTime}: {title:string;unit:string;samples:Telemetry[];lines:Line[];minimumMax:number;cursor?:number;incidentTime?:number}) {
  const id = useId().replaceAll(':','');
  const width = 360, height = 156, left = 38, right = 14, top = 14, bottom = 24;
  const start = samples[0]?.timestamp ?? 0;
  const end = Math.max(start + 1000, samples.at(-1)?.timestamp ?? 1000);
  const value = (p:Telemetry,line:Line) => line.key === 'expected' ? expectedVelocity(p) : p[line.key];
  const yMax = Math.max(minimumMax, ...samples.flatMap(p => lines.map(l => value(p,l)))) * 1.15;
  const x = (t:number) => left + (t - start) / (end - start) * (width - left - right);
  const y = (v:number) => height - bottom - v / yMax * (height - top - bottom);
  const path = (line:Line) => samples.map((p,index) => `${index === 0 || p.sequence - samples[index - 1].sequence > 1 ? 'M' : 'L'}${x(p.timestamp).toFixed(2)},${y(value(p,line)).toFixed(2)}`).join(' ');
  const last = cursor === undefined ? samples.at(-1) : [...samples].reverse().find(p=>p.timestamp<=cursor);
  return <article className="chart-card"><div className="chart-heading"><h3>{title} <span>{unit}</span></h3><span className="mono chart-reading">{last ? value(last,lines[0]).toFixed(unit==='ms'?0:2) : '—'}</span></div>
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>{title} over time. {last ? `Current ${value(last,lines[0]).toFixed(2)} ${unit}.` : 'Waiting for telemetry.'}</title>
      {[0,0.5,1].map(v=><g key={v}><line x1={left} x2={width-right} y1={y(v*yMax)} y2={y(v*yMax)} stroke="#283138" strokeDasharray="3 5"/><text x={left-9} y={y(v*yMax)+4} textAnchor="end" fill="#8b959b" fontSize="13">{(v*yMax).toFixed(yMax<3?1:0)}</text></g>)}
      {incidentTime && incidentTime>=start && incidentTime<=end ? <rect x={x(incidentTime)} y={top} width={Math.max(0,width-right-x(incidentTime))} height={height-top-bottom} fill="#e5a951" opacity="0.05"/> : null}
      {lines.map(line=><path key={line.key} d={path(line)} fill="none" stroke={line.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={line.key==='expected'?'4 4':undefined}/>)}
      {incidentTime && incidentTime>=start && incidentTime<=end ? <line x1={x(incidentTime)} x2={x(incidentTime)} y1={top} y2={height-bottom} stroke="#e5a951" strokeDasharray="3 4"/> : null}
      {cursor !== undefined ? <line data-testid="chart-cursor" x1={x(Math.max(start,Math.min(end,cursor)))} x2={x(Math.max(start,Math.min(end,cursor)))} y1={top} y2={height-bottom} stroke="#e8edf1" strokeWidth="1.2"/> : null}
      {[0,0.5,1].map(v=><text key={v} x={left+v*(width-left-right)} y={height-5} textAnchor={v===0?'start':v===1?'end':'middle'} fill="#8b959b" fontSize="13">{samples.length ? `${((start+v*(end-start)-(incidentTime ?? samples[0].timestamp))/1000).toFixed(0)}s` : `${v*60}s`}</text>)}
    </svg><div className="chart-legend">{lines.map(l=><span key={l.key}><i style={{background:l.color}}/>{l.label}</span>)}{!samples.length?<span className="chart-waiting">Awaiting stream</span>:null}</div>
  </article>;
}
export function ChartGrid({samples,cursor,incidentTime}:{samples:Telemetry[];cursor?:number;incidentTime?:number}) {
  const props={samples,cursor,incidentTime};
  return <div className="charts-grid">
    <TelemetryChart {...props} title="Velocity" unit="m/s" minimumMax={0.8} lines={[{key:'linearVelocity',color:'#6ecbb6',label:'Actual'},{key:'expected',color:'#6a7885',label:'From wheel RPM'}]}/>
    <TelemetryChart {...props} title="Motor current" unit="A" minimumMax={2} lines={[{key:'leftMotorCurrent',color:'#bc9bec',label:'Left motor'},{key:'rightMotorCurrent',color:'#697f96',label:'Right motor'}]}/>
    <TelemetryChart {...props} title="Temperature" unit="°C" minimumMax={35} lines={[{key:'motorTemperature',color:'#e4a96b',label:'Motor temperature'}]}/>
    <TelemetryChart {...props} title="Network latency" unit="ms" minimumMax={50} lines={[{key:'networkLatency',color:'#82b7e8',label:'Received packets'}]}/>
  </div>;
}
export function Trajectory({samples,sample,incidents=[]}:{samples:Telemetry[];sample?:Telemetry;incidents?:Incident[]}) {
  const width=380,height=342;
  const xs=[0,...samples.map(p=>p.x)],ys=[0,...samples.map(p=>p.y)];
  const minX=Math.min(...xs)-1,maxX=Math.max(...xs)+1,minY=Math.min(...ys)-1,maxY=Math.max(...ys)+1;
  const scale=Math.min((width-64)/(maxX-minX),(height-64)/(maxY-minY));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const x=(v:number)=>width/2+(v-cx)*scale,y=(v:number)=>height/2-(v-cy)*scale;
  const visible=sample?samples.filter(p=>p.timestamp<=sample.timestamp):samples;
  const d=visible.map((p,i)=>`${i===0||p.sequence-visible[i-1].sequence>1?'M':'L'}${x(p.x).toFixed(2)},${y(p.y).toFixed(2)}`).join(' ');
  const gridStep=Math.max(1,Math.ceil((maxX-minX)/7));
  const gridX=Array.from({length:Math.ceil((maxX-minX)/gridStep)+1},(_,i)=>Math.ceil(minX/gridStep)*gridStep+i*gridStep).filter(v=>v<=maxX);
  const gridY=Array.from({length:Math.ceil((maxY-minY)/gridStep)+1},(_,i)=>Math.ceil(minY/gridStep)*gridStep+i*gridStep).filter(v=>v<=maxY);
  return <article className="trajectory-card"><div className="panel-heading"><h3>Robot trajectory</h3><span className="tiny-label">TOP VIEW · m</span></div><svg viewBox={`0 0 ${width} ${height}`} className="trajectory-svg" role="img" aria-label="Robot trajectory in meters, with start, current position, and incident locations">
    {gridX.map(v=><g key={`x${v}`}><line x1={x(v)} x2={x(v)} y1={20} y2={height-22} stroke={v===0?'#3b464b':'#222d32'}/><text x={x(v)} y={height-7} fill="#77858b" textAnchor="middle" fontSize="12">{v}</text></g>)}
    {gridY.map(v=><g key={`y${v}`}><line x1={25} x2={width-15} y1={y(v)} y2={y(v)} stroke={v===0?'#3b464b':'#222d32'}/><text x={12} y={y(v)+3} fill="#77858b" textAnchor="middle" fontSize="12">{v}</text></g>)}
    <path d={d} stroke="#72cbb6" fill="none" strokeWidth="2"/>
    <circle cx={x(0)} cy={y(0)} r="4" fill="#151e23" stroke="#93a39f" strokeWidth="1.5"/>
    <text x={x(0)+9} y={y(0)+16} fill="#9aa8aa" fontSize="12">START</text>
    {incidents.filter(i=>!sample||i.detectedAt<=sample.timestamp).map(i=><g key={i.id}><circle cx={x(i.robotState.x)} cy={y(i.robotState.y)} r="7" fill="#d8a052" fillOpacity="0.15" stroke="#e6ad5b"/><title>{i.type}</title></g>)}
    {sample?<g data-testid="robot-position" transform={`translate(${x(sample.x)},${y(sample.y)}) rotate(${-sample.heading*180/Math.PI})`}><circle r="11" fill="#6ecbb6" fillOpacity="0.13"/><path d="M 9 0 L -6 -6 L -3 0 L -6 6 Z" fill="#8de3cb" stroke="#121c1d" strokeWidth="1"/></g>:null}
    {!sample?<text x={width/2} y={height/2-24} textAnchor="middle" fill="#8a979d" fontSize="12">Start simulation to plot the path</text>:null}
  </svg><div className="trajectory-coordinates mono"><span>X <b>{sample?.x.toFixed(2)??'0.00'}</b></span><span>Y <b>{sample?.y.toFixed(2)??'0.00'}</b></span><span>θ <b>{sample?((sample.heading*180/Math.PI%360+360)%360).toFixed(1):'0.0'}°</b></span></div><div className="trajectory-legend"><span><i className="legend-path"/>Observed path</span><span><i className="legend-incident"/>Incident</span></div></article>;
}

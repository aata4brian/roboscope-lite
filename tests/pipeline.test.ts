import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSim, injectFault, stepSimulation, expectedVelocity } from '../src/lib/simulator.ts';
import { createSession, advanceSession, faultSession } from '../src/lib/session.ts';
import { initialDetector, inspectTelemetry } from '../src/lib/detector.ts';
import { decodeSession } from '../src/lib/storage.ts';
import { explainIncident, missingPackets } from '../src/lib/analysis.ts';
import type { FaultType, Session } from '../src/lib/types.ts';

const EPOCH = Date.UTC(2026, 0, 1, 12);
function advance(s:Session,seconds:number){for(let n=0;n<seconds*5;n++)s=advanceSession(s);return s;}
function run(type:FaultType){let s=advance(createSession(EPOCH,'test'),35);s=faultSession(s,type);return advance(s,20);}

test('normal motion obeys wheel kinematics, encoders, battery and timestamp integration',()=>{
  const s=advance(createSession(EPOCH,'test'),60);
  const p=s.samples.at(-1)!;
  assert.equal(s.samples.length,300);
  assert.equal(p.timestamp,EPOCH+60000);
  assert.ok(Math.abs(p.linearVelocity-expectedVelocity(p))<1e-10);
  assert.ok(p.encoderLeft>10000 && p.encoderRight>p.encoderLeft);
  assert.ok(p.battery<100 && p.battery>97);
  assert.ok(Math.hypot(p.x,p.y)>1);
  assert.equal(s.incidents.length,0);
});
test('seed and fault schedule are reproducible',()=>{assert.deepEqual(run('motor-stall'),run('motor-stall'));});
test('stall increases current and temperature while slowing the robot',()=>{
  let sim=initialSim(EPOCH);
  for(let n=0;n<100;n++)sim=stepSimulation(sim).state;
  const before=sim.current;
  sim=injectFault(sim,'motor-stall');
  for(let n=0;n<35;n++)sim=stepSimulation(sim).state;
  assert.ok(sim.current.leftMotorCurrent>before.leftMotorCurrent*3);
  assert.ok(sim.current.linearVelocity<before.linearVelocity*0.3);
  assert.ok(sim.current.leftWheelRpm<before.leftWheelRpm*0.1);
  assert.ok(sim.current.motorTemperature>before.motorTemperature+1);
});
test('slip keeps encoders turning while actual speed and trajectory diverge',()=>{
  let normal=initialSim(EPOCH),slip=initialSim(EPOCH);
  slip=injectFault(slip,'wheel-slip');
  for(let n=0;n<50;n++){normal=stepSimulation(normal).state;slip=stepSimulation(slip).state;}
  assert.equal(slip.current.encoderLeft,normal.current.encoderLeft);
  assert.ok(slip.current.linearVelocity<expectedVelocity(slip.current)*0.4);
  assert.ok(Math.abs(slip.current.heading-normal.current.heading)>1);
  assert.ok(Math.hypot(slip.current.x-normal.current.x,slip.current.y-normal.current.y)>2);
});
for(const type of ['motor-stall','wheel-slip','network-degradation'] as FaultType[]){
  test(`${type}: actual telemetry generates exactly one matching incident`,()=>{
    const s=run(type);
    assert.equal(s.incidents.length,1);
    const i=s.incidents[0];
    assert.equal(i.type,type);
    assert.ok(i.detectedAt-i.startTime>=800);
    assert.equal(i.captureComplete,true);
    assert.ok(i.samples[0].timestamp>=i.detectedAt-30000);
    assert.ok(i.samples.at(-1)!.timestamp<=i.detectedAt+10000);
    for(const e of i.evidence){
      assert.equal(e.before,s.samples.find(p=>p.timestamp===e.baselineAt)![e.metric]);
      assert.equal(e.after,s.samples.find(p=>p.timestamp===e.timestamp)![e.metric]);
    }
    assert.ok(explainIncident(i).summary.length>50);
    // Replay recorded telemetry through a new detector: no fault controls or metadata.
    let detector=initialDetector();const detected:FaultType[]=[];
    s.samples.forEach((_,index)=>{const result=inspectTelemetry(s.samples.slice(Math.max(0,index-14),index+1),detector);detector=result.state;detected.push(...result.detections.map(d=>d.type));});
    assert.deepEqual(detected,[type]);
  });
}
test('network degradation produces real sequence gaps without disrupting simulated motion',()=>{
  const s=run('network-degradation');
  assert.ok(missingPackets(s.samples)>10);
  assert.ok(s.samples.some(p=>p.networkLatency>300));
  assert.ok(s.samples.every(p=>p.linearVelocity>0.5));
  assert.equal(s.sim.tick,275);
  assert.ok(s.samples.length<275);
});
test('a single current spike does not create an incident',()=>{
  const s=advance(createSession(EPOCH,'test'),10);
  const samples=s.samples.map(p=>({...p}));
  Object.assign(samples.at(-1)!,{leftMotorCurrent:9,leftWheelRpm:0,linearVelocity:0});
  const result=inspectTelemetry(samples,initialDetector());
  assert.equal(result.detections.length,0);
});
test('detector rearms after recovery and detects a second stall',()=>{
  let s=run('motor-stall');s=advance(s,8);s=faultSession(s,'motor-stall');s=advance(s,15);
  assert.equal(s.incidents.length,2);
  assert.notEqual(s.incidents[0].id,s.incidents[1].id);
});
test('early injection reports only available pre-event history',()=>{
  let s=advance(createSession(EPOCH,'early'),5);s=faultSession(s,'wheel-slip');s=advance(s,15);
  const i=s.incidents[0];assert.ok(i.detectedAt-i.samples[0].timestamp<30000);assert.equal(i.captureComplete,true);
});
test('reset preserves archived recordings and new session cannot alter them',()=>{
  const old=run('motor-stall');const archive=JSON.stringify(old.incidents);
  const next=advance(createSession(EPOCH+100000,'new',old.incidents),20);
  assert.equal(JSON.stringify(next.incidents),archive);
});
test('storage roundtrip preserves complete recordings; malformed versions and fields are rejected',()=>{
  const s=run('wheel-slip');assert.deepEqual(decodeSession(JSON.stringify(s)),s);
  assert.throws(()=>decodeSession('{oops'));
  assert.throws(()=>decodeSession(JSON.stringify({...s,version:9})));
  assert.throws(()=>decodeSession(JSON.stringify({...s,samples:[{timestamp:0}]})));
  assert.throws(()=>decodeSession(JSON.stringify({...s,incidents:[{...s.incidents[0],samples:[]}]})));
  assert.throws(()=>decodeSession(JSON.stringify({...s,incidents:[{...s.incidents[0],evidence:[]}]})));
});
test('session is bounded at 10 minutes and retains at most 12 incidents',()=>{
  let s=advance(createSession(EPOCH,'bounded'),600);const snapshot=JSON.stringify(s);s=advance(s,5);
  assert.equal(s.samples.length,3000);assert.equal(JSON.stringify(s),snapshot);
  const incidents=run('wheel-slip').incidents;
  const next=createSession(EPOCH,'new',Array.from({length:20},()=>incidents[0]));assert.equal(next.incidents.length,12);
});
test('incident IDs remain unique after retention rotates beyond twelve incidents',()=>{
  let s=advance(createSession(EPOCH,'retention'),10);
  for(let n=0;n<15;n++){s=faultSession(s,'motor-stall');s=advance(s,23);}
  assert.equal(s.incidents.length,12);
  assert.equal(new Set(s.incidents.map(i=>i.id)).size,12);
  assert.equal(s.incidents.at(-1)!.id,'retention-015');
});

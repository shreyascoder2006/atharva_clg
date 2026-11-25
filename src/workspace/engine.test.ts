import {describe,it,expect} from 'vitest';
import {simulate,defaultScenario,pathsTo,propose} from './engine';
import {holdings,portfolios} from './data';
describe('Climate exposure engine',()=>{
 it('reconciles both portfolios to 900 invested plus 100 cash',()=>{for(const p of portfolios)expect(p.positions.reduce((s,x)=>s+x.amount,0)).toBe(900);});
 it('finds third-order exposure and respects direction',()=>{expect(pathsTo('annapurna','Flood').some(p=>p.nodes[0]==='route'&&p.nodes.length>=4)).toBe(true);expect(pathsTo('vista','Flood')).toEqual([]);});
 it('leaves a disconnected holding unchanged',()=>{const r=simulate(holdings,defaultScenario);expect(r.impacts.vista).toBe(0);expect(r.losses.vista).toBe(0);});
 it('zero severity produces no incremental loss',()=>{expect(simulate(holdings,{...defaultScenario,severity:0}).incrementalLoss).toBeCloseTo(0);});
 it('increasing severity increases scenario loss',()=>{expect(simulate(holdings,{...defaultScenario,severity:95}).incrementalLoss).toBeGreaterThan(simulate(holdings,{...defaultScenario,severity:30}).incrementalLoss);});
 it('substitution reduces affected capacity shortfall',()=>{expect(simulate(holdings,{...defaultScenario,substitution:1}).incrementalLoss).toBeLessThan(simulate(holdings,{...defaultScenario,substitution:0}).incrementalLoss);});
 it('counts each position once and bounds disruption',()=>{const r=simulate(holdings,defaultScenario);expect(r.connected).toBeLessThanOrEqual(r.total);Object.values(r.impacts).forEach(v=>{expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(1);});expect(Object.values(r.losses).reduce((a,b)=>a+b,0)).toBeCloseTo(r.incrementalLoss);});
 it('changes financial outcomes when allocation changes',()=>{const a=simulate(propose(holdings,'himalaya',100),defaultScenario);const b=simulate(propose(holdings,'deccan',100),defaultScenario);expect(a.incrementalLoss).toBeGreaterThan(b.incrementalLoss);expect(a.total).toBe(1000);});
 it('rejects overspending and malformed inputs',()=>{expect(()=>propose(holdings,'himalaya',101)).toThrow();expect(()=>propose(holdings,'himalaya',NaN)).toThrow();});
 it('preserves baseline positions',()=>{const before=JSON.stringify(holdings);simulate(propose(holdings,'himalaya',50),defaultScenario);expect(JSON.stringify(holdings)).toBe(before);});
});

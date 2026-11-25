import {edges,entities,lookup} from './data';
import type {Hazard,Position} from './data';
export type Scenario={hazard:Hazard;severity:number;duration:number;substitution:number};
export const defaultScenario:Scenario={hazard:'Flood',severity:90,duration:6,substitution:.5};
export type RiskPath={nodes:string[];weight:number};
export type Result={scenario:Scenario;runId:string;date:string;series:Record<string,number[]>;impacts:Record<string,number>;losses:Record<string,number>;baselineLoss:number;stressedLoss:number;incrementalLoss:number;connected:number;total:number;coverage:number;affected:number;positions:Position[];timeline:{month:string;baseline:number;stressed:number;disruption:number}[]};
export function pathsTo(target:string,hazard:Hazard,maxDepth=6):RiskPath[]{
 const paths:RiskPath[]=[];
 function visit(id:string,path:string[],weight:number){if(path.length>maxDepth||path.slice(1).includes(id))return; if((lookup[id]?.hazards[hazard]??0)>.05)paths.push({nodes:path,weight:weight*(lookup[id].hazards[hazard]??0)}); for(const edge of edges.filter(x=>x.to===id)){if(!path.includes(edge.from))visit(edge.from,[edge.from,...path],weight*edge.share);}}
 visit(target,[target],1);return paths.sort((a,b)=>b.weight-a.weight);
}
export function simulate(positions:Position[],scenario:Scenario):Result{
 if(scenario.severity<0||scenario.severity>100||scenario.duration<1||scenario.duration>12||scenario.substitution<0||scenario.substitution>1)throw Error('Invalid scenario');
 if(positions.some(p=>!lookup[p.id]||!Number.isFinite(p.amount)||p.amount<0))throw Error('Invalid position');
 const series:Record<string,number[]>={};entities.forEach(n=>series[n.id]=[]);
 const calculate=(id:string,month:number,visited:Set<string>):number=>{
  if(visited.has(id))return 0;
  const next=new Set(visited);next.add(id);
  const recovery=scenario.hazard==='Drought'?Math.min(1,.4+month*.1):Math.max(.18,1-month/(scenario.duration+1)*.85);
  const direct=(lookup[id].hazards[scenario.hazard]??0)*scenario.severity/100*recovery;
  const propagated=edges.filter(e=>e.to===id).map(edge=>{
   const elapsed=(month+1)*30;
   const inventoryFactor=Math.max(0,Math.min(1,(elapsed-edge.buffer)/30));
   const replacement=elapsed>edge.switchDays?edge.alternative*scenario.substitution:0;
   return calculate(edge.from,month,next)*edge.share*inventoryFactor*(1-replacement);
  });
  return Math.min(1,Math.max(direct,0,...propagated));
 };
 for(let m=0;m<scenario.duration;m++)for(const node of entities)series[node.id].push(calculate(node.id,m,new Set()));
 const impacts=Object.fromEntries(entities.map(n=>[n.id,series[n.id].reduce((a,b)=>a+b,0)/scenario.duration]));
 const losses:Record<string,number>={};let baselineLoss=0,stressedLoss=0;
 for(const p of positions){const baseline=p.amount*p.pd*p.lgd;const stress=Math.min(1,impacts[p.id]*scenario.duration/6);const pd=Math.min(.95,p.pd+stress*.10);const lgd=Math.min(.9,p.lgd+stress*.12);losses[p.id]=p.amount*pd*lgd-baseline;baselineLoss+=baseline;stressedLoss+=baseline+losses[p.id];}
 const total=positions.reduce((s,p)=>s+p.amount,0);const connected=positions.filter(p=>pathsTo(p.id,scenario.hazard).some(p=>p.weight>=.2)).reduce((s,p)=>s+p.amount,0);
 const coverage=total?positions.reduce((s,p)=>s+p.amount*lookup[p.id].coverage,0)/total:0;
 const timeline=Array.from({length:scenario.duration},(_,i)=>({month:`M${i+1}`,baseline:+baselineLoss.toFixed(2),stressed:+positions.reduce((s,p)=>s+p.amount*(p.pd+series[p.id][i]*.10)*(p.lgd+series[p.id][i]*.12),0).toFixed(2),disruption:positions.length?Math.round(positions.reduce((s,p)=>s+series[p.id][i]*p.amount,0)/(total||1)*100):0}));
 return {scenario:{...scenario},runId:`CM-${Date.now().toString(36).toUpperCase()}`,date:new Date().toISOString(),series,impacts,losses,baselineLoss,stressedLoss,incrementalLoss:stressedLoss-baselineLoss,connected,total,coverage,affected:positions.filter(p=>impacts[p.id]>.05).length,positions:positions.map(x=>({...x})),timeline};
}
export function propose(positions:Position[],candidate:string,amount:number){if(!['himalaya','deccan'].includes(candidate)||!Number.isFinite(amount)||amount<0||amount>100)throw Error('Allocation must be between ₹0 and ₹100 crore');return [...positions,{id:candidate,amount,pd:.025,lgd:.4}];}
export function dependencyExposure(positions:Position[],hazard:Hazard){return entities.filter(n=>n.kind!=='company').map(n=>({entity:n,positions:positions.filter(p=>pathsTo(p.id,hazard).some(path=>path.nodes.includes(n.id)&&path.weight>=.2))})).map(x=>({...x,amount:x.positions.reduce((s,p)=>s+p.amount,0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);}
export const money=(n:number,digits=0)=>`₹${n.toLocaleString('en-IN',{maximumFractionDigits:digits,minimumFractionDigits:digits})}`;
export const percent=(n:number)=>`${Math.round(n*100)}%`;

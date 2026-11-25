import {useMemo} from 'react';
import {ReactFlow,Background,Controls,MarkerType} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {entities,edges,lookup} from './data';
import type {Result} from './engine';
export default function GraphView({result,selected,onSelect}:{result:Result;selected:string;onSelect:(id:string)=>void}){
 const model=useMemo(()=>{
  const columns=[['route','grid','water','port'],['orchard','steel','hotel','himalaya-site','deccan-site'],['fruit','factory','processor'],['annapurna','surya','meridian','himalaya','deccan','prism']];
  const visible=columns.flat();
  const nodes=columns.flatMap((col,x)=>col.map((id,y)=>({id,position:{x:x*245,y:y*91+(x===2?70:0)},data:{label:<div className="graph-node-content"><small>{lookup[id].kind}</small><strong>{lookup[id].short}</strong><span><i className={`dot ${result.impacts[id]>.12?'red':'green'}`}/>{Math.round(result.impacts[id]*100)}% capacity stress</span></div>},className:`climate-node ${selected===id?'active-node':''}`,style:{borderColor:selected===id?'#1f735c':result.impacts[id]>.12?'#ddbc9e':'#dce5df',background:result.impacts[id]>.12?'#fffaf4':'#fff',width:194,borderRadius:12}})));
  const graphEdges=edges.filter(e=>visible.includes(e.from)&&visible.includes(e.to)).map(e=>({id:e.id,source:e.from,target:e.to,animated:result.impacts[e.from]>.12,markerEnd:{type:MarkerType.ArrowClosed,color:result.impacts[e.from]>.12?'#c7955c':'#a5bbae'},style:{stroke:result.impacts[e.from]>.12?'#c7955c':'#a5bbae',strokeWidth:selected===e.from||selected===e.to?2.5:1.4},label:selected===e.to||selected===e.from?e.label:undefined}));
  return {nodes,edges:graphEdges};
 },[result,selected]);
 return <div className="graph-wrap"><div className="graph-caption">INFRASTRUCTURE <span>→</span> DEPENDENCIES <span>→</span> COMPANIES</div><ReactFlow nodes={model.nodes} edges={model.edges} onNodeClick={(_,n)=>onSelect(n.id)} fitView fitViewOptions={{padding:.16}} minZoom={.3} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} proOptions={{hideAttribution:false}}><Background gap={22} size={1} color="#d8e1d9"/><Controls showInteractive={false}/></ReactFlow><div className="graph-note">Impact flows left to right · All economic relationships are synthetic</div></div>;
}

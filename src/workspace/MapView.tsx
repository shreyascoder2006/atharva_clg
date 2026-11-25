import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Focus,Layers,MapPin,Minus,Plus,RotateCcw} from 'lucide-react';
import {entities,edges} from './data';
import type {Result} from './engine';
type Props={result:Result;selected:string;onSelect:(id:string)=>void};
export default function MapView({result,selected,onSelect}:Props){
 const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),markers=useRef<{marker:maplibregl.Marker;el:HTMLButtonElement;id:string}[]>([]),callback=useRef(onSelect);
 const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[tilted,setTilted]=useState(false);
 callback.current=onSelect;
 useEffect(()=>{
  if(!container.current)return;
  let m:maplibregl.Map;
  try{m=new maplibregl.Map({container:container.current,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#edf2ed'}}]},center:[79,23],zoom:3.35,minZoom:2.7,maxZoom:10,attributionControl:false,renderWorldCopies:false});map.current=m;}catch{setFailed(true);return;}
  let disposed=false;
  m.on('load',async()=>{try{
   const response=await fetch('/data/region.geojson');if(!response.ok)throw Error('Map data missing');const geography=await response.json();if(disposed)return;
   m.addSource('countries',{type:'geojson',data:geography});
   m.addLayer({id:'land',type:'fill',source:'countries',paint:{'fill-color':['case',['==',['get','name'],'India'],'#fbfcf7','#e3e9e1'],'fill-opacity':1}});
   m.addLayer({id:'borders',type:'line',source:'countries',paint:{'line-color':'#cdd7cd','line-width':1.2}});
   m.addSource('links',{type:'geojson',data:{type:'FeatureCollection',features:edges.filter(e=>['route','port','water'].includes(e.from)).map(e=>({type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:[entities.find(n=>n.id===e.from)!.coordinates,entities.find(n=>n.id===e.to)!.coordinates]}}))}});
   m.addLayer({id:'link-lines',type:'line',source:'links',paint:{'line-color':'#81a291','line-width':1.3,'line-dasharray':[2,3],'line-opacity':.65}});
   m.addSource('zones',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   m.addLayer({id:'zone-fill',type:'fill',source:'zones',paint:{'fill-color':'#d5a877','fill-opacity':.18}});
   m.addLayer({id:'zone-border',type:'line',source:'zones',paint:{'line-color':'#ba8651','line-width':1.2,'line-dasharray':[3,2]}});
   for(const n of entities.filter(n=>['company','infrastructure','region'].includes(n.kind))){
    const el=document.createElement('button');el.className='map-marker';el.title=`${n.name} · ${n.location}`;el.setAttribute('aria-label',`Inspect ${n.name}`);el.innerHTML=`<span class="marker-core"></span><span class="marker-label">${n.short}</span>`;el.onclick=()=>callback.current(n.id);
    const marker=new maplibregl.Marker({element:el}).setLngLat(n.coordinates).addTo(m);markers.current.push({marker,el,id:n.id});
   }
   setLoaded(true);
  }catch{if(!disposed)setFailed(true);}});
  return()=>{disposed=true;markers.current.forEach(x=>x.marker.remove());markers.current=[];m.remove();map.current=null;};
 },[]);
 useEffect(()=>{if(!loaded)return;markers.current.forEach(({el,id})=>{el.classList.toggle('selected',selected===id);el.classList.toggle('at-risk',result.impacts[id]>.12);el.classList.toggle('low-risk',result.impacts[id]<=.12);});
  const center: [number,number]=result.scenario.hazard==='Drought'?[75.15,18.65]:result.scenario.hazard==='Heat'?[76,25]:[77.05,31.71];const size=result.scenario.hazard==='Heat'?3:result.scenario.hazard==='Drought'?1.6:.9;
  const coordinates=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return[center[0]+Math.cos(a)*size,center[1]+Math.sin(a)*size*.65]});
  const source=map.current?.getSource('zones') as maplibregl.GeoJSONSource|undefined;source?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coordinates]}}]});
 },[loaded,result,selected]);
 return <div className="map-wrap"><div ref={container} className="map-canvas"/>{failed&&<div className="map-fallback"><MapPin size={32}/><h3>Geographic view unavailable</h3><p>Your assessment still works. Explore the connected entities in Graph view.</p></div>}<div className="map-top"><span className="map-mode"><span className="live-dot"/> INDIA · DEMO UNIVERSE</span><button className="map-chip" onClick={()=>{setTilted(!tilted);map.current?.easeTo({pitch:tilted?0:48,bearing:tilted?0:-12,duration:900});}}><Layers size={13}/>{tilted?'2D view':'Perspective'}</button></div><div className="map-country-label">I N D I A</div><div className="map-controls"><button title="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={16}/></button><button title="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={16}/></button><button title="Reset map" onClick={()=>map.current?.flyTo({center:[79,23],zoom:3.35,pitch:0,bearing:0})}><RotateCcw size={15}/></button></div><div className="map-bottom"><div><div className="legend"><span><i className="dot red"/>Scenario sensitive</span><span><i className="dot green"/>Lower modelled impact</span></div><small>Natural Earth · Public domain · Synthetic exposure zones</small></div><button className="focus-button" onClick={()=>{const c=result.scenario.hazard==='Drought'?[75.15,18.65]:[77.05,31.71];map.current?.flyTo({center:c as [number,number],zoom:6,pitch:35,duration:1200});}}><Focus size={14}/> Focus region</button></div></div>;
}

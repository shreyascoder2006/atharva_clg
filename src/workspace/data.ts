export type Hazard = 'Flood' | 'Heat' | 'Drought';
export type Kind = 'company' | 'facility' | 'supplier' | 'infrastructure' | 'commodity' | 'region';
export type Entity = {id:string;name:string;short:string;kind:Kind;sector:string;location:string;coordinates:[number,number];hazards:Partial<Record<Hazard,number>>;coverage:number;note:string};
export type Edge = {id:string;from:string;to:string;share:number;buffer:number;switchDays:number;alternative:number;label:string};
export type Position = {id:string;amount:number;pd:number;lgd:number};
const e=(id:string,name:string,short:string,kind:Kind,sector:string,location:string,coordinates:[number,number],hazards:Partial<Record<Hazard,number>>={},coverage=95,note='Fictional entity and dependencies created for this demonstration.'):Entity=>({id,name,short,kind,sector,location,coordinates,hazards,coverage,note});
export const entities:Entity[]=[
 e('route','Beas Valley access corridor','Beas corridor','infrastructure','Transport','Mandi, Himachal Pradesh',[77.05,31.71],{Flood:.92},100,'Synthetic disruption of a corridor in a real geographic region. This is not an observed flood footprint.'),
 e('grid','Northern distribution grid','Northern grid','infrastructure','Energy','Himachal Pradesh',[76.86,31.42],{Flood:.55,Heat:.2},88),
 e('water','Deccan water basin','Deccan basin','region','Water','Maharashtra',[75.15,18.65],{Drought:.88,Heat:.3},90),
 e('port','Western cargo gateway','Western gateway','infrastructure','Logistics','Gujarat',[69.72,22.82],{Flood:.35,Heat:.38},92),
 e('steel','Precision materials supplier','Precision materials','supplier','Manufacturing','Punjab',[75.86,30.90],{Heat:.32},84),
 e('orchard','Himalayan orchard collective','Orchard collective','supplier','Agriculture','Kullu, Himachal Pradesh',[77.11,31.96],{Flood:.72,Drought:.15},90),
 e('fruit','Fresh produce input','Fresh produce','commodity','Agriculture','Himachal Pradesh',[76.92,31.95],{},92),
 e('processor','Mountain produce processing','Mountain processing','facility','Consumer','Chandigarh',[76.78,30.73],{Heat:.22},93),
 e('factory','Northern components works','Components works','facility','Manufacturing','Punjab',[76.11,30.57],{Heat:.35},91),
 e('hotel','Valley hospitality properties','Valley properties','facility','Real estate','Manali, Himachal Pradesh',[77.19,32.24],{Flood:.45},96),
 e('himalaya-site','Himalaya distribution centre','Himalaya facility','facility','Logistics','Chandigarh',[76.69,30.77],{Heat:.22},94,'Fictional facility outside the synthetic flood footprint, dependent on the Beas access corridor.'),
 e('deccan-site','Deccan distribution centre','Deccan facility','facility','Logistics','Hyderabad, Telangana',[78.48,17.39],{Heat:.42,Drought:.12},78,'Fictional alternative with lower flood overlap but heat sensitivity and incomplete supplier evidence.'),
 e('surya','Surya Mobility','SURYA','company','Manufacturing','Pune, Maharashtra',[73.85,18.52],{},96),
 e('annapurna','Annapurna Foods','ANNA','company','Consumer','New Delhi',[77.20,28.61],{},94),
 e('meridian','Meridian Hospitality','MRDN','company','Real estate','Shimla, Himachal Pradesh',[77.17,31.10],{},96),
 e('aakash','Aakash Aviation','AKSH','company','Aviation','New Delhi',[77.10,28.55],{Heat:.25},90),
 e('setu','Setu Logistics','SETU','company','Logistics','Ahmedabad, Gujarat',[72.57,23.02],{},94),
 e('urja','Urja Renewables','URJA','company','Energy','Jaipur, Rajasthan',[75.78,26.91],{Heat:.18},98),
 e('narmada','Narmada Industrials','NARM','company','Manufacturing','Indore, Madhya Pradesh',[75.86,22.72],{},92),
 e('sahyadri','Sahyadri Agro','SAHY','company','Consumer','Nashik, Maharashtra',[73.79,20.0],{},85),
 e('vista','Vista Living','VSTA','company','Real estate','Bengaluru, Karnataka',[77.59,12.97],{Heat:.1},98),
 e('dakshin','Dakshin Power','DKSH','company','Energy','Chennai, Tamil Nadu',[80.27,13.08],{Heat:.35},94),
 e('prism','Prism Retail','PRSM','company','Consumer','Mumbai, Maharashtra',[72.88,19.07],{},91),
 e('sagar','Sagar Ports','SGAR','company','Logistics','Kochi, Kerala',[76.27,9.97],{Flood:.28},89),
 e('himalaya','Himalaya Cold Chain','HCC','company','Logistics','Chandigarh',[76.87,30.90],{},94),
 e('deccan','Deccan Cold Chain','DCC','company','Logistics','Hyderabad, Telangana',[78.7,17.6],{},78),
];
const link=(from:string,to:string,share:number,label:string,buffer=10,alternative=.2,switchDays=45):Edge=>({id:`${from}-${to}`,from,to,share,label,buffer,alternative,switchDays});
export const edges:Edge[]=[
 link('route','orchard',.95,'Access route',7,.1),link('orchard','fruit',1,'Produces',0,.12),link('fruit','processor',.85,'Critical input',12,.25),
 link('processor','annapurna',.85,'Supplies produce',15,.25),link('processor','prism',.7,'Supplies retail',18,.3),
 link('route','steel',.8,'Transport dependency',14,.25),link('steel','factory',.75,'Supplies components',21,.35),link('factory','surya',.8,'Production input',20,.35),
 link('route','hotel',.95,'Guest and goods access',5,.15),link('hotel','meridian',.85,'Operated properties',0,0),
 link('grid','hotel',.5,'Electricity supply',2,.4),link('grid','factory',.6,'Electricity supply',3,.3),
 link('route','himalaya-site',.9,'Primary distribution route',8,.15),link('himalaya-site','himalaya',.95,'Operated facility',0,0),
 link('water','sahyadri',.9,'Irrigation dependency',5,.15),link('water','narmada',.7,'Process water',12,.25),
 link('water','deccan-site',.2,'Water-dependent input',20,.35),link('deccan-site','deccan',.9,'Operated facility',0,0),
 link('port','setu',.8,'Cargo routing',12,.3),link('port','sagar',.4,'Coastal feeder network',20,.4),
 link('steel','narmada',.3,'Specialist input',25,.4),link('sahyadri','prism',.35,'Regional produce',20,.35),
];
export const lookup=Object.fromEntries(entities.map(x=>[x.id,x]));
const amounts=[120,100,90,85,80,75,70,65,60,55,50,50];
const ids=['surya','annapurna','meridian','aakash','setu','urja','narmada','sahyadri','vista','dakshin','prism','sagar'];
export const holdings:Position[]=ids.map((id,i)=>({id,amount:amounts[i],pd:.018+(i%4)*.003,lgd:.35+(i%3)*.025}));
export const portfolios=[{id:'growth',name:'Bharat Growth Portfolio',description:'Diversified institutional debt',positions:holdings},{id:'infra',name:'India Infrastructure Portfolio',description:'Infrastructure & productive assets',positions:holdings.map(p=>({...p,amount:['setu','urja','dakshin','sagar'].includes(p.id)?150:['surya','meridian','narmada','vista'].includes(p.id)?50:25}))}];
export const candidates=['himalaya','deccan'];
export const sourceLinks=[{name:'Himachal Pradesh 2023 assessment',type:'Historical context',url:'https://www.hpsdma.nic.in/index1.aspx?langid=1&lev=2&lid=5413&lsid=9086',description:'Official event documentation. Used as context, not evidence for the fictional companies or this hypothetical hazard footprint.'},{name:'Natural Earth',type:'Map geometry',url:'https://www.naturalearthdata.com/about/terms-of-use/',description:'Public-domain country geometry, bundled locally. Boundaries are for geographic context, not legal or regulatory use.'},{name:'World Bank Climate Knowledge Portal',type:'Research reference',url:'https://climateknowledgeportal.worldbank.org/index.php/download-data',description:'Reference for regional climate projections. Live projections are not integrated in this demonstration.'},{name:'Open-Meteo',type:'Planned data connector',url:'https://open-meteo.com/en/docs/historical-weather-api',description:'Historical reanalysis reference. Weather data is not a flood-depth model. No live weather feed is claimed.'}];

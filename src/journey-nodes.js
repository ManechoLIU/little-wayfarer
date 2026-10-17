// A place appears only when the person saves something worth keeping.
export function journeyNodes(entries,travelerId){
 return entries.filter(e=>e.travelerId===travelerId).slice(-10).map((e,index)=>({id:e.id,date:e.date,x:200+index*180,y:390+(index%2?18:-10),label:(e.body||e.note||e.memories?.map(m=>m.title).join(' · ')||e.date).slice(0,18),pending:false}));
}
export function daysOfEntries(entries,travelerId){
 const groups=new Map();for(const e of entries){if(e.travelerId!==travelerId)continue;if(!groups.has(e.date))groups.set(e.date,[]);groups.get(e.date).push(e);}
 return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([date,items])=>({date,entries:[...items].sort((a,b)=>b.timestamp-a.timestamp)}));
}

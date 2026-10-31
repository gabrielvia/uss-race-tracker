export type AgeInterval = { season: string; basis: string; min: number; max: number | null; source: unknown };
export function currentSeason(at = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(at);
  const year = Number(parts.find(p=>p.type==="year")!.value), month = Number(parts.find(p=>p.type==="month")!.value);
  return year - (month < 7 ? 1 : 0);
}
function nextBoundary(year:number):string {
  const target=Date.UTC(year+1,6,1);let instant=target;
  for(let i=0;i<3;i++){
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric",hourCycle:"h23"}).formatToParts(new Date(instant));
    const part=(name:string)=>Number(parts.find(p=>p.type===name)!.value);
    const local=Date.UTC(part("year"),part("month")-1,part("day"),part("hour"),part("minute"),part("second"));
    const correction=target-local;if(correction===0)break;instant+=correction;
  }
  return new Date(instant).toISOString();
}
export function deriveSkatingAge(evidence: AgeInterval[], at = new Date()) {
  const year = currentSeason(at), season = `${year}-${year+1}`;
  const base = {season, referenceSeason:season, timezone:"America/New_York", nextUpdateAt:nextBoundary(year), evidence};
  if (!evidence.length) return {...base,status:"not_available",min:null,max:null};
  if (new Set(evidence.map(e=>e.basis)).size !== 1) return {...base,status:"conflict",min:null,max:null,reason:"Age baseline rules require reconciliation."};
  const shifted = evidence.map(e=>{const delta=year-Number(e.season.slice(0,4));return {min:e.min+delta,max:e.max===null?Infinity:e.max+delta};});
  const min = Math.max(...shifted.map(e=>e.min)), max = Math.min(...shifted.map(e=>e.max));
  if (min>max || max<0) return {...base,status:"conflict",min:null,max:null,reason:"Published age evidence has no common age interval. Review the identity and source rules."};
  return {...base,status:min===max?"inferred":max===Infinity?"lower_bound":"range",min,max:max===Infinity?null:max};
}

export const filterColumns = { gender: "r.gender", division: "r.division_key", distance: "CASE WHEN r.distance_unit='laps' THEN 'laps:'||r.distance ELSE r.distance END", round: "r.round" } as const;
export type ResultFilters = Partial<Record<keyof typeof filterColumns | "event",string>>;
export function resultFilters(params:URLSearchParams):ResultFilters {
  const filters:ResultFilters = {};
  for(const key of Object.keys(filterColumns) as (keyof ResultFilters)[]) {
    const value=params.get(key);
    if(value!==null && (!value.trim() || value.length>100 || key==="distance"&&!/^(?:laps:\d{1,6}|\d{1,6}(?:\.\d{1,6})?)$/.test(value))) throw new Error("Use nonblank result filters up to 100 characters and a valid distance.");
    if(value) filters[key]=value;
  }
  const event=params.get("event");
  if(event!==null&&!/^[a-f0-9]{20}$/.test(event))throw new Error("Use a valid source event ID.");
  if(event)filters.event=event;
  return filters;
}
export function resultWhere(id:string,filters:ResultFilters,except?:keyof ResultFilters) {
  const clauses=["r.competition_id=?"],bindings:(string|number)[]=[id];
  for(const [key,value] of Object.entries(filters) as [keyof ResultFilters,string][]) {
    if(key===except)continue;
    if(key==="event"){clauses.push("r.event_key=?");bindings.push(value);}
    else if(key==="gender"&&value==="Mixed") clauses.push("e.gender='Mixed'");
    else if(key==="distance"){clauses.push("r.distance=? AND r.distance_unit=?");bindings.push(Number(value.replace(/^laps:/,"")),value.startsWith("laps:")?"laps":"metres");}
    else { clauses.push(`${filterColumns[key]}=?`);bindings.push(value); }
  }
  return {sql:" WHERE "+clauses.join(" AND "),bindings};
}

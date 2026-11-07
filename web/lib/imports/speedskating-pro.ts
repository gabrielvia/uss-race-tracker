import reviews from "@/lib/imports/reviewed-speedskating-pro-sources.json";
import { canonical, hash, officialMicros, VALIDATION_VERSION, type ImportPayload, type ValidationReport } from "@/lib/imports/validation";
import { sourceEventKey } from "@/lib/imports/events";
import { dimensions } from "@/lib/imports/dimensions";

export function validateSpeedPro(payload: ImportPayload) {
  const item=payload.item, report:ValidationReport={validationVersion:VALIDATION_VERSION,valid:false,coverage:"protocol-results",errors:[],warnings:[],events:[]};
  const add=(code:string,message:string)=>report.errors.push({code,path:"item",message});
  const pinned=reviews.sources.find((s:{sha256:string;itemSha256:string})=>s.sha256===item.source.sha256);
  if(!pinned || hash(canonical(item))!==pinned.itemSha256)add("SPEED_PRO_SOURCE_REVIEW","The complete item must exactly match its independently checked, PDF-bound source review and confirmed scoped identities.");
  const protocol="protocol" in item?item.protocol:undefined;
  const events="events" in item.evidence?item.evidence.events:[];
  if(!pinned || canonical(pinned.eventOrder)!==canonical(events.map(e=>sourceEventKey(item.competition.id,e))))add("SOURCE_EVENT_ORDER","Retain the reviewed physical page and column reading order for every source event occurrence.");
  const roster=item.evidence.roster, c=item.competition, url=new URL(item.source.url);
  if(!protocol || protocol.parser_version!=="reviewed-speedskating-pro-protocol/1") {add("SPEED_PRO_PROTOCOL","A complete reviewed protocol is required.");return {payload,report};}
  const [start,end]=c.season.split("-").map(Number);
  const validDate=(s:string)=>{const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;};
  if(url.protocol!=="https:" || url.username || url.password || url.hostname!=="assets.contentstack.io" || end!==start+1 || !validDate(c.startsOn) || !validDate(c.endsOn) || c.startsOn>c.endsOn || c.startsOn<`${start}-07-01` || c.endsOn>=`${end}-07-01`)add("SOURCE_METADATA","Retain official source metadata and a supported season.");
  if(roster.parser_version!=="reviewed-speedskating-pro-roster/1" || roster.issues.length || roster.observations.length!==roster.observation_count || roster.observation_count!==item.participants.length || roster.distinct_bib_count!==new Set(item.participants.map(p=>p.bib)).size || item.entries.length!==item.participants.length)add("SCOPED_ROSTER","All final-classification identities must remain separate, including reused bibs.");
  const entryMap=new Map(item.entries.map(e=>[e.participantId,e]));
  const observations=new Map(roster.observations.map(o=>[o.participant_id,o]));
  for(const person of item.participants){
    const entry=entryMap.get(person.id),o=observations.get(person.id);
    const divisionNumber=entry&&/^DIVISION (\d+) /.exec(entry.division)?.[1];
    if(!entry || !o || person.id!==`${c.id}:d${divisionNumber}-${person.bib}` || o.name!==o.raw_name || person.name!==(o.display_name??o.name) || person.affiliation!==o.affiliation_raw || entry.division!==o.division_raw || entry.rawName!==o.raw_name || entry.sourcePage!==o.page || entry.ageStatus!==null || ![undefined,"Male","Female"].includes(o.gender as string|undefined))add("SCOPED_IDENTITY","Preserve each original name/member/division binding; bib alone is not an identity.");
  }
  if(new Set(item.participants.map(p=>p.id)).size!==item.participants.length || new Set(item.results.map(r=>r.id)).size!==item.results.length || new Set(events.map(e=>sourceEventKey(c.id,e))).size!==events.length)add("DUPLICATE_ID","All scoped participants, event occurrences and results must have distinct IDs.");
  const mapped=dimensions(item);
  if(mapped.results.some(r=>r.status!=="source-mapped"))add("DIMENSION_EVIDENCE","Every result must bind to one official scoped entry.");
  if(canonical(protocol.scanned_pages)!==canonical(Array.from({length:roster.page_count},(_,i)=>i+1)) || canonical(protocol.event_labels)!==canonical(events.map(e=>e.event_label_raw)) || protocol.result_count!==item.results.length || protocol.issues.length || protocol.sha256!==item.source.sha256)add("COMPLETE_SOURCE","Account for every physical page, occurrence and source result.");
  if(canonical(protocol.classification_pages)!==canonical(protocol.classifications.map(c=>c.page)) || protocol.classifications.some(c=>c.rows.some(r=>!c.text_raw.split("\n").includes(r.row_raw))))add("CLASSIFICATION_SOURCE","Retain original classification page text and rows separately.");
  let offset=0,heatCount=0;
  const races=new Set<string>();
  for(const event of events){
    const key=sourceEventKey(c.id,event),rows=item.results.slice(offset,offset+event.result_count);offset+=event.result_count;heatCount+=event.heats.length;
    if(event.parser_version!=="reviewed-speedskating-pro-event/1" || event.result_count!==event.results.length || event.heat_count!==event.heats.length || event.event_number!==`RACE: ${/^race(\d+)$/.exec(event.heats[0]?.race_id)?.[1]}`)add("SOURCE_EVENT","Keep original repeated headings separate by their first official race number.");
    for(const proof of [event,roster])if(proof.sha256!==item.source.sha256 || proof.source_url!==item.source.url || proof.source_id!==item.source.id)add("SOURCE_MISMATCH","All evidence must refer to the same original PDF.");
    event.results.forEach((raw,i)=>{
      const pid=String(raw.participant_id),person=item.participants.find(p=>p.id===pid),entry=entryMap.get(pid),lap=raw.distance_unit==="laps";
      const expected={id:`${c.id}:${raw.race_id}:${raw.bib}`,participantId:pid,raceId:raw.race_id,distance:lap?raw.distance_laps:raw.distance_metres,distanceUnit:raw.distance_unit,eventKind:"individual",round:raw.round_raw,rank:raw.rank,status:raw.status_raw,timeRaw:raw.time_raw,timeMicroseconds:raw.time_microseconds,qualification:raw.qualification_raw,sourcePage:raw.source_page,eventKey:key,eventLabel:raw.event_label_raw,raceLabel:raw.race_label_raw,heatNumber:raw.heat_number,heatTotal:raw.heat_total,sourceNameRaw:raw.name_raw,lane:raw.lane_raw,pointsRaw:raw.points_raw,behindRaw:raw.behind_raw,sourceFields:raw.source_fields,...(raw.finish_note?{finishNote:raw.finish_note}:{})};
      if(canonical(rows[i])!==canonical(expected) || !person || person.bib!==raw.bib || observations.get(pid)?.raw_name!==raw.name_raw || person.affiliation!==raw.affiliation_raw || entry?.division!==raw.group_label || raw.event_label_raw!==event.event_label_raw || raw.event_number!==event.event_number || !event.pages.includes(raw.source_page) || raw.source_page>roster.page_count)add("RESULT_SOURCE_BINDING","Every source field and scoped identity must exactly match its normalized result.");
      if(raw.time_raw!==null ? officialMicros(raw.time_raw)!==raw.time_microseconds : raw.time_microseconds!==null)add("TIME_PRECISION","Retain exact official timing precision; NO TIME never establishes a measured performance.");
      if(raw.event_kind!=="individual" || (lap ? raw.distance_metres!==null || !raw.distance_laps : !raw.distance_metres || raw.distance_laps!==undefined))add("DISTANCE_UNIT","Keep literal lap counts separate without inferring metres.");
      if(!raw.status_raw && raw.time_raw===null && !raw.finish_note)add("MISSING_TIME","Preserve the original missing-time evidence.");
      if(raw.finish_note==="Printed time cannot be interpreted." && (raw.time_raw!==null || raw.status_raw!==null || !raw.source_fields?.Time || officialMicros(raw.source_fields.Time)!==null))add("UNREADABLE_TIME","Preserve the original invalid time separately from the comparable time.");
    });
    for(const heat of event.heats){
      if(races.has(heat.race_id) || rows.filter(r=>r.raceId===heat.race_id).length!==heat.result_count)add("SOURCE_RACE","Every unique race must account for exactly its source rows.");
      races.add(heat.race_id);
    }
    report.events!.push({eventKey:key,sourceEventNumber:event.event_number,label:event.event_label_raw,valid:true,resultCount:event.result_count,heatCount:event.heat_count,errors:[]});
  }
  if(offset!==item.results.length)add("SOURCE_RESULT_COUNT","No omitted or additional result rows are allowed.");
  report.counts={participants:item.participants.length,entries:item.entries.length,events:events.length,results:item.results.length,heats:heatCount};
  report.warnings=[{code:"REVIEWED_SCOPED_IDENTITIES",path:"item",message:"Official bibs can repeat across divisions. Keep the user-confirmed distinct skaters separate; no cross-competition identity or numeric age is inferred."},{code:"OFFICIAL_SOURCE_FIELDS",path:"item",message:"Original places, NO TIME, status words, qualifications, points and lap counts are preserved independently. Lap-count events do not establish metre-distance PBs/trends."}];
  report.valid=report.errors.length===0;
  return {payload,report};
}

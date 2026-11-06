type SourceResult = {time_raw:string|null;result_status?:string|null;finish_note?:string|null;source_fields_json?:string|null};
function fields(row:SourceResult):Record<string,string|null> {
  try {return row.source_fields_json ? JSON.parse(row.source_fields_json) : {};} catch {return {};}
}
export function officialTime(row:SourceResult) {
  return row.time_raw ?? fields(row).Time ?? "—";
}
export function officialStatus(row:SourceResult) {
  return fields(row).Status ?? row.result_status ?? (row.finish_note === "Printed time cannot be interpreted." ? "Unparseable time" : row.finish_note ? "Not recorded" : "—");
}

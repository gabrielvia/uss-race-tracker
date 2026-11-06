export type Competition = {
  id: string; title: string; discipline: string; season: string;
  starts_on: string; ends_on: string; location: string;
  source_id: string; source_url: string; participant_count: number; result_count: number; event_count: number;
};
export type Participant = { id: string; bib: string; name: string; affiliation: string; country?: string | null };
export type Entry = { id: string; participant_id: string; division: string; age_status: string | null; raw_name: string; source_page: number };
export type RaceResult = {
  distance_unit?: "metres" | "laps"; event_kind?: "individual" | "mass-start"; country?: string | null; source_name_raw?: string | null; lane?: string | null; points_raw?: string | null; behind_raw?: string | null; source_fields_json?: string | null;
  entry_id?: string|null; gender?:string; division_key?:string; scope_status?:string;
  id: string; participant_id: string; race_id: string; distance: number; round: string;
  rank: number | null; result_status: "PEN" | "DNS" | "DNF" | "DQ" | "FNT" | "YC" | "WDR" | null; time_raw: string | null; time_microseconds: number | null; qualification: string | null; source_page: number;
  event_key: string | null; event_label: string | null; race_label: string | null;
  heat_number: number | null; heat_total: number | null; finish_note?: string | null;
};
export type CompetitionEvent = {
  distance_unit?: "metres" | "laps"; event_kind?: "individual" | "mass-start";
  gender:string; division_key:string; competition_group:string|null; scope_status:string;
  id: string; source_event_number: string | null; label: string; group_label: string;
  distance: number; round: string; result_count: number; heat_count: number;
};
export type CompetitionDetail = {
  competition: Competition; matching:{results:number;events:number;participants:number}; options:Record<string,{value:string|number;count:number}[]>; filters:Record<string,string>; events: CompetitionEvent[]; archivedPdf?: string | null; supplementarySourcePages?: number; sourceTablesUrl?: string; classificationsUrl?: string; coverage: { kind: "selected-events" | "protocol-results"; eventCount: number; completeCompetition: false; layout?: "group-table" }; participants: Participant[]; entries: Entry[]; results: RaceResult[];
};

export type SkaterProfile = {
  identityStatus: string;
  age: {status:string;min:number|null;max:number|null;season:string;nextUpdateAt:string;reason?:string;evidence:{source:{category:string;page:number;sourceUrl:string;ruleVersion:string;baselineDate:string;ruleSource:{url:string;pages:number[]}}}[]};
  unresolvedAgeEvidence: unknown[];
};
export type CoverageData = {
  directory: { entries: number; sources: number; checkedAt: string };
  audit: { auditedSources: number; partlyParsedSources: number; uninspectedSources: number; pendingSources: number; lastCheckedAt: string | null };
  published: { competitionCount: number; resultCount: number; seasons: string[]; latestPublishedAt: string | null };
  seasons: { season: string; directorySources: number; auditedSources: number; pendingSources: number }[];
  reviews: { sourceId: string; url: string; title: string; status: string; parsedEvents: number; discoveredEvents: number; needsReviewEvents: number; sourceIssues: unknown[] }[];
};

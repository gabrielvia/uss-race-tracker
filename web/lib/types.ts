export type Competition = {
  id: string; title: string; discipline: string; season: string;
  starts_on: string; ends_on: string; location: string;
  source_id: string; source_url: string; participant_count: number; result_count: number; event_count: number;
};
export type Participant = { id: string; bib: string; name: string; affiliation: string };
export type Entry = { id: string; participant_id: string; division: string; age_status: string | null; raw_name: string; source_page: number };
export type RaceResult = {
  id: string; participant_id: string; race_id: string; distance: number; round: string;
  rank: number | null; result_status: "PEN" | "DNS" | "DNF" | "DQ" | "FNT" | "YC" | null; time_raw: string | null; time_microseconds: number | null; qualification: string | null; source_page: number;
  event_key: string | null; event_label: string | null; race_label: string | null;
  heat_number: number | null; heat_total: number | null; finish_note?: string | null;
};
export type CompetitionEvent = {
  id: string; source_event_number: string | null; label: string; group_label: string;
  distance: number; round: string; result_count: number; heat_count: number;
};
export type CompetitionDetail = {
  competition: Competition; events: CompetitionEvent[]; archivedPdf?: string | null; classificationsUrl?: string; coverage: { kind: "selected-events" | "protocol-results"; eventCount: number; completeCompetition: false }; participants: Participant[]; entries: Entry[]; results: RaceResult[];
};

export type SkaterProfile = {
  identityStatus: string;
  age: {status:string;min:number|null;max:number|null;season:string;nextUpdateAt:string;reason?:string;evidence:{source:{category:string;page:number;sourceUrl:string;ruleVersion:string;baselineDate:string;ruleSource:{url:string;pages:number[]}}}[]};
  unresolvedAgeEvidence: unknown[];
};

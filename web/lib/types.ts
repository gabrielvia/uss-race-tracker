export type Competition = {
  id: string; title: string; discipline: string; season: string;
  starts_on: string; ends_on: string; location: string;
  source_id: string; source_url: string; participant_count: number; result_count: number;
};
export type Participant = { id: string; bib: string; name: string; affiliation: string };
export type Entry = { id: string; participant_id: string; division: string; age_status: string | null; raw_name: string; source_page: number };
export type RaceResult = {
  id: string; participant_id: string; race_id: string; distance: number; round: string;
  rank: number | null; result_status: "PEN" | "DNS" | "DNF" | "DQ" | null; time_raw: string | null; time_microseconds: number | null; qualification: string | null; source_page: number;
  event_key: string | null; event_label: string | null; race_label: string | null;
  heat_number: number | null; heat_total: number | null;
};
export type CompetitionDetail = {
  competition: Competition; participants: Participant[]; entries: Entry[]; results: RaceResult[];
};

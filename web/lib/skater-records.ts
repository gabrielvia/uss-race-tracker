// Current projection only. A pending identity remains local to the selected
// participant even if its prior skater link still points to reviewed records.
export const participantRecordScope = `(r.participant_id=? OR l.status!='needs_review' AND l.skater_id=(SELECT skater_id FROM skater_links WHERE participant_key=? AND status!='needs_review'))`;
export const recordJoin = ` FROM results r
 JOIN participants p ON p.id=r.participant_id
 JOIN competitions c ON c.id=r.competition_id
 JOIN sources s ON s.id=c.source_id
 LEFT JOIN skater_links l ON l.participant_key=p.id
 LEFT JOIN competition_events e ON e.id=r.event_key
 LEFT JOIN entries en ON en.id=r.entry_id`;
export const recordSelect = `r.*,c.title competition_title,c.starts_on,c.ends_on,c.discipline,c.season,c.id competition_id,
 s.url source_url,p.name,p.affiliation,p.bib,en.division entry_division,en.source_page entry_page,
 e.gender event_gender,e.group_label,e.competition_group`;

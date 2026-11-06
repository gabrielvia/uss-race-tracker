import { database } from "@/lib/database";
import { canonical, hash } from "@/lib/imports/validation";
import { sourceNameSql, UOO_WINTER_CHALLENGE_SOURCE } from "@/lib/source-name";

const reviewer = "Automatic identity rule v2";
const independentClubs = new Set(["", "direct", "dir", "independent", "unaffiliated", "unattached", "n/a"]);
const nameKey = `LOWER(TRIM(${sourceNameSql()}))`;
const clubLabel = "LOWER(TRIM(p.affiliation))";
// Reviewed club label correspondences. The GSS abbreviation is also used by the club itself.
const clubKey = `CASE ${clubLabel}
  WHEN 'bay state speedskating' THEN 'bay state'
  WHEN 'danbury speedskating' THEN 'danbury'
  WHEN 'east penn speedskating club' THEN 'east penn'
  WHEN 'flushing meadows speedskating' THEN 'flushing meadows'
  WHEN 'garden state speedskating' THEN 'garden state'
  WHEN 'gss' THEN CASE WHEN s.sha256='${UOO_WINTER_CHALLENGE_SOURCE}' THEN 'garden state' ELSE ${clubLabel} END
  WHEN 'potomac speedskating' THEN 'potomac'
  WHEN 'saratoga winter club' THEN 'saratoga winter'
  ELSE ${clubLabel} END`;
const memberSource = `FROM participants p JOIN competitions c ON c.id=p.competition_id
  JOIN sources s ON s.id=c.source_id JOIN import_publications pub ON pub.competition_id=c.id
  JOIN skater_links l ON l.participant_key=p.id`;

// Include the complete active membership of every matching profile, so a
// conflicting entry from the same competition or an explicit review is visible.
const snapshotQuery = `WITH candidates AS (
  SELECT DISTINCT l.skater_id ${memberSource} WHERE ${nameKey}=? AND ${clubKey}=?
), evidence AS (
  SELECT json_object('key',p.id,'skater',l.skater_id,'competition',c.id,'status',l.status,
    'revision',l.revision,'batch',pub.batch_id,'name',${nameKey},'club',${clubKey},'url',s.url,
    'page',(SELECT MIN(o.source_page) FROM skater_observations o WHERE o.participant_key=p.id AND o.batch_id=pub.batch_id),
    'decisionReviewer',d.reviewer) row_json
  ${memberSource}
  LEFT JOIN identity_decisions d ON d.id=l.revision
  WHERE l.skater_id IN (SELECT skater_id FROM candidates)
  ORDER BY p.id
)
SELECT json_group_array(json(row_json)) snapshot FROM evidence`;

type Member = {
  key: string; skater: string; competition: string; status: string; revision: string; batch: string;
  name: string; club: string; url: string; page: number | null; decisionReviewer: string | null;
};

function proposedLinks(rows: Member[], name: string, club: string, competition: string) {
  if (rows.some(row => row.status === "needs_review")) return [];
  if (new Set(rows.map(row => row.competition)).size !== rows.length) return [];
  // A manual split creates its own reviewed profile. Keep that decision even
  // if all the other observations happen to be competition-local.
  if (rows.some(row => row.decisionReviewer && row.skater === hash(`reviewed-skater|${row.revision}`).slice(0, 20))) return [];

  const profiles = new Map<string, Member[]>();
  for (const row of rows) {
    const members = profiles.get(row.skater) ?? [];
    members.push(row);
    profiles.set(row.skater, members);
  }
  if (profiles.size < 2 || !rows.some(row => row.competition === competition && row.name === name && row.club === club)) return [];
  const groups = [...profiles.values()];
  const reviewed = groups.filter(members => members.length > 1 || members[0].status !== "competition-local");
  if (reviewed.length > 1) return [];
  // Prefer the established profile, then use a stable key for new links.
  const target = reviewed[0] ?? groups[0];
  const anchor = target.find(row => row.name === name && row.club === club)!;
  const sourceRef = (row: Member) => row.page === null ? row.url : `${row.url}#page=${row.page}`;
  const reason = `Same name (${name}) and club (${club}).`;
  return rows.filter(row => row.skater !== anchor.skater || !reviewed.length).map(row => {
    const other = row === anchor ? rows.find(member => member.skater !== anchor.skater)! : anchor;
    const refs = canonical([...new Set([sourceRef(row), sourceRef(other)])].sort());
    const id = hash(canonical({reviewer, key: row.key, revision: row.revision, target: anchor.skater, reason, refs}));
    return {id, key: row.key, revision: row.revision, from: row.skater, target: anchor.skater, reason, refs};
  });
}

export async function reconcileCompetitionIdentities(competition: string) {
  const db = database();
  const pairs = await db.prepare(`WITH current_pairs AS (
    SELECT DISTINCT ${nameKey} name, ${clubKey} club ${memberSource} WHERE c.id=?
  ) SELECT ${nameKey} name, ${clubKey} club ${memberSource}
  WHERE (${nameKey}, ${clubKey}) IN (SELECT name, club FROM current_pairs)
  GROUP BY ${nameKey}, ${clubKey}
  HAVING COUNT(DISTINCT l.skater_id)>1 AND COUNT(DISTINCT c.id)>1
  ORDER BY name, club`).bind(competition).all<{name: string; club: string}>();
  const now = new Date().toISOString();
  let decisions = 0;
  for (const {name,club} of pairs.results) {
    if (!name || independentClubs.has(club)) continue;
    const readSnapshot = async () => (await db.prepare(snapshotQuery).bind(name,club).first<{snapshot: string}>())?.snapshot ?? "[]";
    for (let attempt = 0; ; attempt++) {
      const snapshot = await readSnapshot();
      const updates = proposedLinks(JSON.parse(snapshot),name,club,competition);
      if (!updates.length) break;
      try {
        await db.batch([
          db.prepare(`INSERT INTO import_assertions (value) SELECT CASE WHEN (${snapshotQuery})=? THEN 1 ELSE 0 END`).bind(name,club,snapshot),
          db.prepare(`INSERT INTO identity_decisions (id,participant_key,previous_revision,previous_skater_id,skater_id,reviewer,reason,evidence_json,created_at)
            SELECT json_extract(value,'$.id'),json_extract(value,'$.key'),json_extract(value,'$.revision'),
              json_extract(value,'$.from'),json_extract(value,'$.target'),?,json_extract(value,'$.reason'),json_extract(value,'$.refs'),?
            FROM json_each(?)`).bind(reviewer,now,JSON.stringify(updates)),
          db.prepare(`UPDATE skater_links SET skater_id=json_extract(value,'$.target'),status='reviewed',revision=json_extract(value,'$.id')
            FROM json_each(?) WHERE participant_key=json_extract(value,'$.key')`).bind(JSON.stringify(updates)),
          db.prepare("DELETE FROM import_assertions"),
        ]);
        decisions += updates.length;
        break;
      } catch (error) {
        if (attempt === 2 || await readSnapshot() === snapshot) throw error;
      }
    }
  }
  return decisions;
}

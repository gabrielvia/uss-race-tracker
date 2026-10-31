// Recognized source suffixes are age-category evidence, not spelling aliases.
const ageSuffix = /\s+\((Jr\s+[A-E]|Sr|(?:Master\s+)?[MW]\s+\d+-\d+)\)$/i;
type Observation = { name: string; raw_name: string; age_status_raw: string | null };

export function rosterNameIsConsistent(observation: Observation): boolean {
  if (observation.name === observation.raw_name) return true;
  const suffix = ageSuffix.exec(observation.raw_name);
  return suffix !== null && observation.raw_name.slice(0, suffix.index) === observation.name
    && suffix[1].toLowerCase() === observation.age_status_raw?.toLowerCase();
}

export function resultNameMatches(rawName: string, observation: Observation): boolean {
  return rosterNameIsConsistent(observation) && (rawName === observation.name || rawName === observation.raw_name);
}

export function distanceLabel(value: number | string, unit = "metres"): string {
  if (String(value).startsWith("laps:")) return `${String(value).slice(5)} laps`;
  return `${value} ${unit === "laps" ? "laps" : "m"}`;
}

export function joinedSourceHeading(lines: [string, string], separateEventHeading = false): string | null {
  const [first, second] = lines;
  if (separateEventHeading) {
    const match = /^(?:(Group A) Picking 2(?:\+\(1\))? )?(Event #\d+)$/.exec(second);
    if (match) return [match[1], first, match[2]].filter(Boolean).join(" ");
  }
  if (/ \d+ Semi- Event #\d+$/.test(first) && second === "Finals") return first.replace(" Semi- Event #", " Semi-Finals Event #");
  if (/ \d+ Super Final Event #\d+$/.test(first) && second === "Finals") return first.replace(" Super Final Event #", " Super Final Finals Event #");
  if (/ \d+ Super Event #\d+$/.test(first) && second === "Final Finals") return first.replace(" Super Event #", " Super Final Finals Event #");
  return null;
}

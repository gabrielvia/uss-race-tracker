import type { RaceResult } from "@/lib/types";

// Status rows remain visible even when they have no comparable finishing time.
export function hasComparableTime(result: Pick<RaceResult, "result_status" | "time_microseconds">): boolean {
  return result.result_status === null && result.time_microseconds !== null;
}

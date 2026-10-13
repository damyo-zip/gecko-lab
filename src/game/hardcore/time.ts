/** Calendar dates, independent of the browser's timezone. No server/anti-cheat clock. */
export type GameDate = string;
const DAY = 86_400_000;
export function dateNumber(date: GameDate): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("날짜 형식이 올바르지 않습니다.");
  const value = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new Error("유효하지 않은 날짜입니다.");
  return value / DAY;
}
export function addDays(date: GameDate, count: number): GameDate {
  if (!Number.isSafeInteger(count)) throw new Error("날짜 간격은 정수여야 합니다.");
  return new Date((dateNumber(date) + count) * DAY).toISOString().slice(0, 10);
}
export function daysBetween(from: GameDate, to: GameDate): number { return dateNumber(to) - dateNumber(from); }
export function seoulDate(timestamp: number): GameDate {
  if (!Number.isFinite(timestamp)) throw new Error("시간 값이 올바르지 않습니다.");
  return new Date(timestamp + 9 * 3_600_000).toISOString().slice(0, 10);
}
export interface Clock { now(): number }
export const deviceClock: Clock = { now: () => Date.now() };

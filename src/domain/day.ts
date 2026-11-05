export const DAY_MS = 86_400_000;

/**
 * Day number on the user's own calendar (days since 1970-01-01, local midnight to local midnight).
 * `tzOffsetMin` is `Date#getTimezoneOffset()` (minutes UTC minus local); injectable so tests do not depend on the machine.
 * Turn a day number back into a calendar date with the UTC getters of `new Date(day * DAY_MS)`.
 */
export const dayOf = (ms: number, tzOffsetMin: number = new Date(ms).getTimezoneOffset()): number =>
  Math.floor((ms - tzOffsetMin * 60_000) / DAY_MS);

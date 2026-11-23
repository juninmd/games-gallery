/** Consecutive network failures before the app says it is offline: one blip is not an outage. */
export const OFFLINE_AFTER = 2;

/** A success resets the streak; HTTP errors are answers from a server, so they never count. */
export const nextFailures = (failures: number, ok: boolean) => (ok ? 0 : failures + 1);

export const isOffline = (failures: number) => failures >= OFFLINE_AFTER;

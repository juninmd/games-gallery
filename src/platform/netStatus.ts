import { isOffline, nextFailures } from "../domain/netHealth";

let failures = 0;
const listeners = new Set<() => void>();

/** Called by the HTTP layer after each request: `ok` = some server answered, even with an error status. */
export function reportRequest(ok: boolean) {
  const was = isOffline(failures);
  failures = nextFailures(failures, ok);
  if (was !== isOffline(failures)) listeners.forEach((l) => l());
}

export const subscribeNetStatus = (onChange: () => void) => {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
};

export const offlineNow = () => isOffline(failures);

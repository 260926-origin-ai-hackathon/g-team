const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstParts(now: Date): { date: string; time: string } {
  const j = new Date(now.getTime() + JST_OFFSET_MS).toISOString();
  return { date: j.slice(0, 10), time: j.slice(11, 19) };
}

/** switch_time(JST, "HH:MM[:SS]") を過ぎていて、今日まだ切り替えていなければ true */
export function isSwitchDue(now: Date, switchTime: string, lastSwitchedOn: string | null): boolean {
  const { date, time } = jstParts(now);
  const st = switchTime.length === 5 ? `${switchTime}:00` : switchTime;
  return time >= st && (lastSwitchedOn === null || lastSwitchedOn < date);
}

export function resetMs(dev: { reset_hours: number; test_mode: boolean }): number {
  return dev.test_mode ? 1000 : dev.reset_hours * 3600 * 1000;
}

export function pollSec(testMode: boolean): number {
  return testMode ? 5 : 600;
}

export const OFFLINE_MS = 30 * 60 * 1000;

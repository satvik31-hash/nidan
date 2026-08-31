// Everything is stored UTC and reasoned about in Asia/Kolkata.
//
// The blueprint is blunt about this: get it right on day one or appointment
// bugs will eat a day later. The trap is that a server in UTC and a clinic in
// IST disagree about what "today" is and about what "09:00" means, so a 9 a.m.
// availability rule silently becomes a 2:30 p.m. slot.
//
// The rule here: availability rules and clinic days are IST wall-clock; every
// instant crossing a boundary is UTC.

export const IST_OFFSET = "+05:30";

/** The calendar day in Asia/Kolkata, as YYYY-MM-DD. */
export function istDay(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** 0 = Sunday … 6 = Saturday, in Asia/Kolkata.
 *  Noon IST is 06:30 UTC on the same date, so the UTC weekday of that
 *  instant is the IST weekday with no edge cases. */
export function istWeekday(day: string): number {
  return new Date(`${day}T12:00:00${IST_OFFSET}`).getUTCDay();
}

/** An instant from an IST wall-clock day and "HH:MM". */
export function istInstant(day: string, time: string): Date {
  const [h, m] = time.split(":");
  return new Date(`${day}T${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}:00${IST_OFFSET}`);
}

/** Walk n IST calendar days from a given IST day. */
export function addIstDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00${IST_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return istDay(d);
}

/** The IST hour of an instant — used to bucket slots into morning/afternoon. */
export function istHour(d: Date | string): number {
  return Number(
    new Date(d).toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false,
    }),
  );
}

/** The IST minute-of-hour of an instant. */
export function istMinute(d: Date | string): number {
  return Number(
    new Date(d).toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata", minute: "2-digit",
    }),
  );
}

/** "09:15" — an instant as IST wall-clock, for showing a clinic time back. */
export function fmtIstTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

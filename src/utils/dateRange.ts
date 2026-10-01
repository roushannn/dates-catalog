// All range helpers return [start, end) ISO strings in local time, end exclusive.

export function atMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function currentWeekRange(now = new Date()): [string, string] {
  const today = atMidnight(now);
  const day = today.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(today, mondayOffset);
  const nextMonday = addDays(monday, 7);
  return [monday.toISOString(), nextMonday.toISOString()];
}

// Upcoming (or current) Saturday-Sunday.
export function upcomingWeekendRange(now = new Date()): [string, string] {
  const today = atMidnight(now);
  const day = today.getDay(); // 0 = Sunday .. 6 = Saturday
  let saturdayOffset: number;
  if (day === 6) saturdayOffset = 0;
  else if (day === 0) saturdayOffset = -1; // today is Sunday, weekend started yesterday
  else saturdayOffset = 6 - day;
  const saturday = addDays(today, saturdayOffset);
  const mondayAfter = addDays(saturday, 2);
  return [saturday.toISOString(), mondayAfter.toISOString()];
}

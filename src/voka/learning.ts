import type { VokaCard } from "./data";

export const MAX_LEARNING_POINTS = 4;
export const LEARNING_PAUSE_MINUTES = 120;

/** A list pause is based on the server-provided timestamp, not local storage. */
export function pauseMinutesLeft(until: string | null | undefined, now = Date.now()): number {
  if (!until) return 0;
  const timestamp = Date.parse(until);
  if (!Number.isFinite(timestamp)) return 0;
  const remaining = timestamp - now;
  // Rounding to the nearest minute avoids a spurious "121 min" when the
  // server starts a 120-minute pause a few milliseconds after the UI clock.
  if (remaining <= 0) return 0;
  return Math.max(1, Math.round(remaining / 60_000));
}

/** Cards can be learned only when they are due at position zero and not completed. */
export function isCardDue(card: Pick<VokaCard, "position" | "success_count">): boolean {
  return card.position === 0 && card.success_count < MAX_LEARNING_POINTS;
}

export function learningProgress(cards: Pick<VokaCard,"success_count">[]): number {
  if (cards.length === 0) return 0;
  const achieved = cards.reduce((total,card) =>
    total + Math.min(MAX_LEARNING_POINTS, Math.max(0,card.success_count)),0);
  return Math.round(achieved / (cards.length * MAX_LEARNING_POINTS) * 100);
}

/**
 * One rating per card in a round. The inverse orientation is randomly chosen
 * for lists configured to learn both directions.
 */
export function pickReverseDirection(bothDirections:boolean, random = Math.random): boolean {
  return bothDirections && random() < 0.5;
}

export type LearningPause =
  | {kind:"calendar";until:string}
  | {kind:"hours";minutes:number};

/**
 * Both restrictions must have expired. Show the one that ends later.
 * Calendar pauses take precedence when they extend beyond the two-hour pause.
 */
export function effectiveLearningPause(
  twoHourUntil:string|null|undefined,
  calendarUntil:string|null|undefined,
  now=Date.now()
):LearningPause|null {
  const hourEnd=twoHourUntil?Date.parse(twoHourUntil):NaN;
  const dayEnd=calendarUntil?Date.parse(calendarUntil):NaN;
  const hourValid=Number.isFinite(hourEnd)&&hourEnd>now;
  const dayValid=Number.isFinite(dayEnd)&&dayEnd>now;
  if(dayValid&&(!hourValid||dayEnd>=hourEnd))return {kind:"calendar",until:calendarUntil!};
  if(hourValid)return {kind:"hours",minutes:pauseMinutesLeft(twoHourUntil,now)};
  return null;
}

function calendarDayInZone(date:Date,zone:string):number {
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const number=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
  return Math.floor(Date.UTC(number("year"),number("month")-1,number("day"))/86_400_000);
}

/** The pause uses the timezone of the last learning session, including DST. */
export function calendarPauseDay(
  pauseUntil:string,zone:string,locale:string,now=Date.now()
):{tomorrow:boolean;weekday:string} {
  const target=new Date(pauseUntil);
  const timezone=zone||"UTC";
  const dayDistance=calendarDayInZone(target,timezone)-calendarDayInZone(new Date(now),timezone);
  const weekday=new Intl.DateTimeFormat(locale,{weekday:"long",timeZone:timezone}).format(target);
  return {tomorrow:dayDistance===1,weekday};
}

/** E.g. 64 minutes is "1:04 h", not "64 min"; keep minutes at 60. */
export function formatLearningPause(minutes:number, minuteUnit:string, hourUnit:string):string {
  const total=Math.max(0,Math.floor(minutes));
  if(total>60) return Math.floor(total/60)+":"+String(total%60).padStart(2,"0")+" "+hourUnit;
  return total+" "+minuteUnit;
}

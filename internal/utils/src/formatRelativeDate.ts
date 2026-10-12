// Human-readable relative date, anchored on calendar days (boundaries roll at
// midnight, not 24h windows). The wording is supplied via `labels` so this
// org-tier util stays language-neutral; ZH_HK_RELATIVE_DATE_LABELS is the
// default since every current consumer is HK-Cantonese. A non-Cantonese app
// passes its own labels rather than getting Chinese silently.
//
//   0       today
//   1       yesterday
//   2       dayBeforeYesterday
//   3–6     daysAgo(n)
//   7–13    lastWeekday(weekdayIndex)   (rolling 7-day window, weekday from the target date)
//   14+     absolute(date)
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const toDate = (d: Date | Temporal.Instant): Date =>
  d instanceof Date ? d : new Date(d.epochMilliseconds);

export type RelativeDateLabels = {
  today: string;
  yesterday: string;
  dayBeforeYesterday: string;
  daysAgo: (days: number) => string;
  lastWeekday: (weekdayIndex: number) => string;
  absolute: (date: Date) => string;
};

const ZH_HK_WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'] as const;

export const ZH_HK_RELATIVE_DATE_LABELS: RelativeDateLabels = {
  today: '今日',
  yesterday: '尋日',
  dayBeforeYesterday: '前日',
  daysAgo: days => `${days}日前`,
  lastWeekday: weekdayIndex => {
    const weekday = ZH_HK_WEEKDAY_CHARS[weekdayIndex];
    if (weekday === undefined) {
      throw new Error(`formatRelativeDate: invalid weekday ${weekdayIndex}`);
    }
    return `上個禮拜${weekday}`;
  },
  absolute: date => `${date.getMonth() + 1}月${date.getDate()}日`,
};

export const formatRelativeDate = (
  date: Date | Temporal.Instant,
  now: Date | Temporal.Instant = new Date(),
  labels: RelativeDateLabels = ZH_HK_RELATIVE_DATE_LABELS,
): string => {
  const normDate = toDate(date);
  const normNow = toDate(now);
  const diffDays = Math.floor(
    (startOfDay(normNow).getTime() - startOfDay(normDate).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  if (diffDays === 2) return labels.dayBeforeYesterday;
  if (diffDays >= 3 && diffDays <= 6) return labels.daysAgo(diffDays);
  if (diffDays >= 7 && diffDays <= 13) return labels.lastWeekday(normDate.getDay());
  return labels.absolute(normDate);
};

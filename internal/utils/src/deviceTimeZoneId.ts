// The device's time zone as an id Temporal accepts, for phone code to pass wherever Temporal needs
// "the device's zone". The engine reports whatever the OS hands it, and Android can hand it ids
// Temporal rejects (`GMT+08:00`, `Etc/Unknown`, `PST`); `Temporal.Now` would then throw on every
// call. Such a device gets its current UTC offset as a fixed-offset zone (`+08:00`) instead, right
// until the next DST change, which is the best the device itself knows.
export const deviceTimeZoneId = (): string => {
  const { timeZone } = new Intl.DateTimeFormat().resolvedOptions();
  return toTemporalTimeZoneId(timeZone) ?? currentUtcOffset();
};

// Older Hermes builds report no zone at all.
const toTemporalTimeZoneId = (timeZone: string | undefined): string | undefined => {
  if (timeZone === undefined) return undefined;
  try {
    return Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timeZone).timeZoneId;
  } catch {
    return undefined;
  }
};

const currentUtcOffset = (): string => {
  // biome-ignore lint/plugin/no-date: the OS's own UTC offset is only readable from Date when the engine cannot name its zone.
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.trunc(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
};

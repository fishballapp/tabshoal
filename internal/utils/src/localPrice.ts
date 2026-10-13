/** The currencies a price is listed in: dollars, pounds and euros. */
export type Currency = 'USD' | 'GBP' | 'EUR';

const GBP_TIME_ZONES = new Set([
  'Europe/London',
  'Europe/Belfast',
  'Europe/Guernsey',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
]);

const EUR_TIME_ZONES = new Set([
  'Africa/Ceuta',
  'Asia/Famagusta',
  'Asia/Nicosia',
  'Atlantic/Azores',
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Europe/Amsterdam',
  'Europe/Andorra',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Busingen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Lisbon',
  'Europe/Ljubljana',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Mariehamn',
  'Europe/Monaco',
  'Europe/Nicosia',
  'Europe/Paris',
  'Europe/Podgorica',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/San_Marino',
  'Europe/Tallinn',
  'Europe/Vatican',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Zagreb',
]);

/**
 * The currency a buyer most likely pays in: pounds in the UK and the Crown dependencies, euros in
 * the eurozone, dollars everywhere else. A checkout that prices by IP (Polar's) decides for itself;
 * the time zone is the nearest thing a page or an extension can read without asking.
 */
export const currencyForTimeZone = (timeZone: string): Currency => {
  if (GBP_TIME_ZONES.has(timeZone)) return 'GBP';
  if (EUR_TIME_ZONES.has(timeZone)) return 'EUR';
  return 'USD';
};

/** `£10`, `10 €`, `$10`: a price in the buyer's likely currency, in their locale's style. */
export const formatLocalPrice = (
  prices: Readonly<Record<Currency, number>>,
  timeZone: string,
  locale: string,
): string => {
  const currency = currencyForTimeZone(timeZone);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(prices[currency]);
};

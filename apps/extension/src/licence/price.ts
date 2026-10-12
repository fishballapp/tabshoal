/** The yearly price in each currency the Polar product carries: $10 / £10 / €10. */
export const YEARLY_PRICE = { USD: 10, GBP: 10, EUR: 10 } as const;

export type Currency = keyof typeof YEARLY_PRICE;

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
 * The currency Polar's checkout will most likely show. Polar decides from the buyer's IP; the
 * browser's time zone is the nearest thing an extension can read without asking.
 */
export const currencyFor = (timeZone: string): Currency => {
  if (GBP_TIME_ZONES.has(timeZone)) return 'GBP';
  if (EUR_TIME_ZONES.has(timeZone)) return 'EUR';
  return 'USD';
};

/** `£10`, `10 €`, `$10`: the yearly price in the buyer's likely currency, in their locale's style. */
export const formatYearlyPrice = (timeZone: string, locale: string) => {
  const currency = currencyFor(timeZone);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(YEARLY_PRICE[currency]);
};

import { type Currency, formatLocalPrice } from '@fishballapps/utils';

/** The yearly price in each currency the Polar product carries: $10 / £10 / €10. */
export const YEARLY_PRICE: Readonly<Record<Currency, number>> = { USD: 10, GBP: 10, EUR: 10 };

/** `£10`, `10 €`, `$10`: the yearly price in the buyer's likely currency, in their locale's style. */
export const formatYearlyPrice = (timeZone: string, locale: string) =>
  formatLocalPrice(YEARLY_PRICE, timeZone, locale);

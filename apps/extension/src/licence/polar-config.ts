export type PolarConfig = {
  api: string;
  organizationId: string;
  benefitId: string;
  checkoutUrl: string;
  portalUrl: string;
};

/**
 * Which Polar organization a build talks to. Every build uses the sandbox except `build:release`
 * (Vite's `release` mode), so any other build can be tested end to end with a sandbox key.
 */
export const POLAR = {
  sandbox: {
    api: 'https://sandbox-api.polar.sh',
    organizationId: '06b3e001-297b-4ebd-bd97-c2008176dde0',
    // The sandbox organization is shared by every Fishball app, so a key is checked against this
    // benefit too; without it another app's key would unlock TabShoal.
    benefitId: 'f0f2fed0-d2d7-4557-afae-e397296de3ec',
    checkoutUrl:
      'https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_uBuuTyoC9z88OCiDQfnSTkVAwcTwP7kWUaMAq0vp2ON/redirect',
    portalUrl: 'https://sandbox.polar.sh/fishball-ltd/portal',
  },
  production: {
    api: 'https://api.polar.sh',
    organizationId: '59680d4a-b970-4a15-8c58-6fb318c8ebf8',
    benefitId: '16529c55-9e8c-40d6-b308-7250d705016b',
    checkoutUrl: 'https://buy.polar.sh/polar_cl_EAQJ84JKOxoY1cqYk7z8FrSAXbDSZkxB9uSO60F60Wz',
    portalUrl: 'https://polar.sh/tabshoal/portal',
  },
} as const satisfies Record<'sandbox' | 'production', PolarConfig>;

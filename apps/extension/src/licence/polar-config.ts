/**
 * Which Polar organization a build talks to. Every build uses the sandbox except `build:release`
 * (Vite's `release` mode), so any other build can be tested end to end with a sandbox key.
 */
export const POLAR = {
  sandbox: {
    api: 'https://sandbox-api.polar.sh',
    organizationId: '06b3e001-297b-4ebd-bd97-c2008176dde0',
    // The organization is shared by every Fishball app, so a key is checked against this benefit
    // too; without it another app's key would unlock TabShoal.
    benefitId: 'f0f2fed0-d2d7-4557-afae-e397296de3ec',
    checkoutUrl:
      'https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_uBuuTyoC9z88OCiDQfnSTkVAwcTwP7kWUaMAq0vp2ON/redirect',
    portalUrl: 'https://sandbox.polar.sh/fishball-ltd/portal',
  },
  production: {
    api: 'https://api.polar.sh',
    organizationId: 'af3e0e60-236e-43cc-94e4-468e00c9f7b7',
    // ponytail: the production benefit and product aren't created yet, so a release build refuses
    // to run until these are set.
    benefitId: undefined,
    checkoutUrl: undefined,
    portalUrl: 'https://polar.sh/fishball-ltd/portal',
  },
} as const;

export type PolarConfig = {
  api: string;
  organizationId: string;
  benefitId: string;
  checkoutUrl: string;
  portalUrl: string;
};

/** The production settings, or an error naming what's missing; a release build stops on it. */
export const productionPolar = (): PolarConfig => {
  const { benefitId, checkoutUrl } = POLAR.production;
  if (benefitId === undefined || checkoutUrl === undefined) {
    throw new Error(
      'A release build needs the production Polar benefit ID and checkout link in src/licence/polar-config.ts.',
    );
  }
  return { ...POLAR.production, benefitId, checkoutUrl };
};

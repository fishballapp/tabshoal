import type { LicenceServer } from '@fishballapps/extension-licence/polar';
import { POLAR, type PolarConfig } from './polar-config';

export const polar: PolarConfig =
  import.meta.env.MODE === 'release' ? POLAR.production : POLAR.sandbox;

export const licenceServer: LicenceServer = {
  api: polar.api,
  organizationId: polar.organizationId,
  benefitIds: [polar.benefitId],
};

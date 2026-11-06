import type { FacadeAppearanceDef } from '..';

export const facade: FacadeAppearanceDef = {
  id: 'forge',
  wallAppearance: 'mur-en-bois',
  wallFeatures: {},
  features: {
    chimney: { prop: 'cheminee', base: 'toit', liftM: -0.3 },
  },
};

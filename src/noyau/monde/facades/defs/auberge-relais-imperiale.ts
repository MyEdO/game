import type { FacadeAppearanceDef } from '..';

export const facade: FacadeAppearanceDef = {
  id: 'auberge-relais-imperiale',
  wallAppearance: 'mur-a-ossature-en-bois',
  wallFeatures: {
    'window-band': 'mur-a-ossature-en-bois',
    'stone-entry': 'mur-en-pierre',
    gable: 'mur-a-ossature-en-bois',
  },
  features: {
    chimney: { prop: 'cheminee', base: 'toit', liftM: -0.3 },
    sign: { prop: 'enseigne', liftM: 2.2 },
  },
};

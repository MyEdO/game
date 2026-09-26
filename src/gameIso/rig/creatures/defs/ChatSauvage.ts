import type { CreatureDef } from '../types';

// Chat Sauvage (ZI) — petit félin agile. Gabarit quadrupède en silhouette féline (build 'feline' +
// queue 'leonine' fine), tête 'loup' (pas de tête féline dédiée au catalogue → la plus proche).
// Robe tigrée gris-fauve, rayures de flanc. Sans ce def, le record (sp=—) retombait sur bipède Humain.
export const creature: CreatureDef = {
  label: 'Chat Sauvage',
  id: "chat-sauvage",
  plan: 'quadruped',
  quad: {
    sl: 0.7, build: 'feline', girth: 0.82, bodyLen: 1.02, neckLen: 0.5, neckAngle: -6, legLen: 0.72,
    head: 'loup', tail: 'leonine', mane: 'sans', ears: 'pointues', foot: 'patte', headScale: 0.95, tailLen: 1.2, markings: 'rayures',
    palette: { corps: '#7d7160', corpsO: '#3f372b', corpsH: '#a89a83', cheveux: '#4a4032', cheveuxO: '#28221a', cuir: '#2c261e' },
  },
};

import type { CreatureDef } from '../types';

// Le Déchiqueteur de Cadavres (artwork ZI 5 p.58) : quadrupède ACCROUPI aux écailles gris-bleuté,
// CINQ têtes serpentines rouge vif sur longs cous gris (cluster `dechiqueteur`, cf. quadParts —
// même mécanisme que l'hydre/chimère), dos hérissé de piquants noirs, pieds griffus.
// Robe = @corps gris-bleu (+@corpsH reflet lavande) ; têtes = @cheveux rouge/@cheveuxO sombre.
export const creature: CreatureDef = {
  label: 'Le Déchiqueteur de Cadavres',
  id: "le-dechiqueteur-de-cadavres",
  plan: 'quadruped',
  quad: {
    // Silhouette artwork : corps massif tassé sur pattes courtes (accroupi), entrelacs de cous
    // dressé au-dessus du garrot, longue queue reptilienne.
    sl: 1.15, build: 'draconic', girth: 1.15, bodyLen: 1.05, neckLen: 1.35, neckAngle: -14, legLen: 0.7,
    head: 'dechiqueteur', tail: 'reptile', mane: 'sans', ears: 'pointues', foot: 'serre', ridge: 'epines', tailLen: 1.25,
    palette: { corps: '#5e6880', corpsO: '#252a34', corpsH: '#9aa0c2', cheveux: '#b23c28', cheveuxO: '#571812', cuir: '#454c5c' },
  },
};

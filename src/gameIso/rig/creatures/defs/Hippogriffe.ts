import type { CreatureDef } from '../types';

// Hippogriffe (artwork LDB 79 p.323, créature EN VOL) : AVANT-TRAIN D'AIGLE — tête et encolure
// BLANCHES à bec crochu jaune, poitrail brun-roux moucheté (foreCoat, robe des ailes), serres et
// tarses JAUNE VIF — sur un ARRIÈRE-TRAIN DE CHEVAL BLANC svelte et haut sur pattes (robe blanche
// pommelée gris-bleu, sabots sombres, queue de crin blanche). L'artwork le montre EN PLEIN VOL :
// un token posé au sol ne lévite pas (le vol vit dans l'état runtime `spread`, WingState), mais la
// silhouette de vol se porte AU REPOS par les ailes DRESSÉES à demi-ouvertes (wingPose 'dressees'
// + wingLift, patron pégase artwork LDB 79 p.325 — jamais couchées façon planeur sur la croupe) et
// l'envergure AMPLE (wingSpan). Contraste brun/blanc NET : famille @aile* brun-roux profond vs
// robe @corps* blanche.
export const creature: CreatureDef = {
  label: "Hippogriffe",
  id: "hippogriffe",
  plan: 'winged',
  quad: {
    sl: 1, build: 'equine', girth: 0.92, bodyLen: 0.96, neckLen: 0.95, neckAngle: -44, legLen: 1.14,
    head: 'aigle', tail: 'crin', ears: 'courtes', foot: 'sabot', frontFoot: 'serre',
    wings: 'plumes', wingSpan: 1.42, wingPose: 'dressees', wingLift: 17, mane: 'hirsute', foreCoat: 'plumes',
    headScale: 1.2, tailLen: 1.2, markings: 'taches',
    palette: {
      corps: '#e9eae2', corpsO: '#848b95', // robe blanche pommelée, ombres gris-bleu
      cheveux: '#f2efe6', cheveuxO: '#a9a494', // plumes d'encolure + queue de crin blanches
      cuir: '#4b4138', // sabots postérieurs sombres
      aile: '#8a5228', aileO: '#43280f', aileH: '#d8a95e', // plumage brun-roux, mouchetures dorées
      cuirAv: '#e3b32e', // tarses/serres jaune vif
    },
  },
};

import type { CreatureDef } from '../types';

// Chimère (ZI 6 p.66) — trois têtes DISTINCTES (léonine à crinière rayonnante + grand rapace à
// bec crochu + dragon-crocodile cornu à long museau), cluster `head: 'chimere'` sur le mécanisme
// de l'hydre. Corps « d'énorme chat difforme » massif (build ursine, girth fort), larges pattes
// à griffes incurvées ('patte'), GRANDES ailes membraneuses DRESSÉES à nervures
// (wingPose 'dressees'), longue queue fine dressée en S à pointe osseuse (art dédié de tail()),
// dorsale d'épines. Robe gris-argent de l'artwork (fourrure grise, crinière pâle, ombres
// ardoise). bodyLen/neckAngle calés pour que têtes + queue + ailes tiennent dans le gabarit.
export const creature: CreatureDef = {
  label: 'Chimère',
  id: "chimere",
  plan: 'winged',
  quad: {
    sl: 1.25, build: 'ursine', girth: 1.3, bodyLen: 1.02, neckLen: 1.05, neckAngle: -10, legLen: 0.85,
    head: 'chimere', tail: 'dressee', ears: 'pointues', foot: 'patte', wings: 'membrane', wingSpan: 1.25,
    wingPose: 'dressees', mane: 'hirsute', ridge: 'epines', tailLen: 1.1,
    palette: { corps: '#8b8779', corpsO: '#45463f', corpsH: '#c8c2ae', cheveux: '#d6cfbd', cheveuxO: '#77705e', cuir: '#4e483c' },
  },
};

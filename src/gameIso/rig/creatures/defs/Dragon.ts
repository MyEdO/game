import type { CreatureDef } from '../types';

// Dragon (LDB 79 l.42-50 : « immenses », Taille Énorme, Vol 80, Attaque caudale) — fidélité à
// l'artwork officiel (art-ref/ldb/page321_img7598.png) : posture RAMASSÉE de prédateur (pattes
// courtes, poitrail profond, girth↑ — pas un loup dressé), grandes ailes MEMBRANEUSES portées
// en PAIRE demi-ouverte même au repos (wingPose 'deployees' + wingSpan large : la silhouette
// identitaire — panneaux d'envers PÂLES entre les doigts comme sur l'artwork, aile lointaine
// basculée vers la queue), membrane bordeaux sombre distincte de la robe (famille @aile*,
// envers gris-rosé @aileH), très longue
// queue épineuse ENROULÉE autour de la bête au ras du sol (tail 'enroulee' — la traînante
// sortait de la boîte 120×150), écailles rouge/bordeaux crevassées, cou serpentin porté en
// avant, gueule allongée pleine de crocs, cornes d'ivoire verdâtre balayées en arrière
// (headgear 'cornes'), serres. Le museau reste DANS la boîte (à -40° d'encolure il sortait
// du cadre → « museau lisse sans crocs »).
export const creature: CreatureDef = {
  label: 'Dragon',
  id: "dragon",
  plan: 'winged',
  quad: {
    sl: 1.25, build: 'draconic', girth: 1.22, bodyLen: 1.02, neckLen: 0.95, neckAngle: -10,
    legLen: 0.75, head: 'dragon', headScale: 1.05, headgear: 'cornes', tail: 'enroulee',
    ears: 'pointues', foot: 'serre', wings: 'membrane', wingPose: 'deployees', wingSpan: 1.42,
    mane: 'sans', ridge: 'epines',
    palette: {
      corps: '#8f3430', corpsO: '#43120f', corpsH: '#c96f4e',
      aile: '#5f2136', aileO: '#2c0d18', aileH: '#c8b6bd',
      cheveux: '#b4bd93', cheveuxO: '#6b7350', cuir: '#4c3128',
    },
  },
};

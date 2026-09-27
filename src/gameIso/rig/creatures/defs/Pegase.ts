import type { CreatureDef } from '../types';

// Pégase — fidélité à l'artwork officiel (art-ref/ldb/page325_img7829.png) : cheval à robe
// BLANC ARGENTÉ pommelée (markings 'taches', ombres gris-bleu), paire d'IMMENSES ailes
// emplumées BRUN/DORÉ nettement distinctes de la robe (@aile*), portées DRESSÉES vers le
// haut/arrière (wingPose 'dressees' + wingLift 26 : sur l'artwork les deux ailes balaient à
// ~65-70° — l'aile lointaine (base -26°) doit elle aussi MONTER, jamais couchée sur la croupe ;
// wingSpan ample),
// encolure arquée portée HAUTE tête entière dans le cadre (neckAngle court), crinière et
// queue fauves (@cheveux).
// La BÊTE EST NUE (#1128) : le COLLIER D'HARNAIS DORÉ clouté au poitrail de l'artwork n'appartient
// pas à l'ESPÈCE — c'est un SET d'équipement (`quadruped/harnais/collier-dore-pegase`) qu'un record
// déclare et que le canal `deco` appose sur l'os qu'il chevauche. Le pégase noir, lui, s'en prit à
// ses éleveurs et fut poussé au nord (ZI 05 l.275) : aucun harnachement.
export const creature: CreatureDef = {
  label: 'Pégase',
  id: "pegase",
  plan: 'winged',
  quad: {
    sl: 0.95, build: 'equine', girth: 0.98, bodyLen: 0.96, neckLen: 0.95, neckAngle: -28,
    legLen: 1.18, head: 'cheval', tail: 'crin', tailLen: 1.05, ears: 'courtes', foot: 'sabot',
    wings: 'plumes', wingSpan: 1.36, wingPose: 'dressees', wingLift: 26, mane: 'crin', markings: 'taches',
    palette: {
      corps: '#e8eae4', corpsO: '#828b95', // robe blanc argenté pommelée, ombres gris-bleu
      cheveux: '#8d6e46', cheveuxO: '#4e3a22', // crinière/queue fauves
      aile: '#8a6a3e', aileO: '#48331c', aileH: '#c9a25e', // plumes brun/doré des ailes
      accent: '#c8963a', // or du COLLIER (#1128) : le collier vient d'un SET (`quadruped/harnais/
      // collier-dore-pegase`) apposé par la donnée ; sa teinte reste ici, où vit la palette du
      // porteur — même hex qu'à l'origine, l'extraction ne change aucune teinte.
      cuir: '#4a4238', // sabots
    },
  },
};

import type { CreatureDef } from '../types';
import { CHEVAL_PROFIL_COMPILE } from '../../quadruped/chevalProfilCompile';

// Cheval — fidélité à l'artwork officiel (art-ref/ldb/page316_img7313.png) : robe GRIS POMMELÉ
// (corps gris clair, ombres gris-bleu, pommelures) et crinière/queue GRIS ARGENTÉ fournies.
//
// LE PROFIL EST UN DESSIN, PAS UNE COMPOSITION (étalon #1082, vague P1b-MASSE) : la bête entière
// est tracée d'un trait dans le repère du monde (`quadruped/atelier/cheval-profil.dessin.mts`) puis
// compilée par os (`chevalProfilCompile.ts`) — silhouette, robe, crinière, queue et modelé des 16
// os y vivent ensemble.
// La BÊTE EST NUE (#1128) : le harnachement (selle, caparaçon, croupière, bride) n'appartient pas
// à l'ESPÈCE — c'est un SET d'équipement (`quadruped/harnais/sellerie-imperiale`) qu'un record
// déclare et que le canal `deco` appose sur les os qu'il chevauche. Un cheval de labour, un poulain
// ou une mule n'en portent pas ; un destrier oui.
// FACE et DOS restent au socle, comme chez l'étalon bovin : seule la vue de PROFIL porte un dessin
// entier, et ces deux vues n'ont AUCUN décor propre.
export const creature: CreatureDef = {
  label: "Cheval",
  id: "cheval",
  plan: 'quadruped',
  quad: {
    sl: 0.9, build: 'equine', girth: 1.04, bodyLen: 1.05, neckLen: 1.12, neckAngle: -50,
    legLen: 1.2, head: 'cheval', tail: 'crin', tailLen: 1.55, mane: 'crin', ears: 'courtes',
    foot: 'sabot', markings: 'taches',
    viewArt: { profile: CHEVAL_PROFIL_COMPILE },
    palette: {
      corps: '#c6cac5', corpsO: '#7b838c', corpsH: '#f1f2ef', // gris pommelé, ombres gris-bleu
      cheveux: '#878d93', cheveuxO: '#43484e', // crinière/queue gris argenté
      cuir: '#3c322a', // sabots
      // Jetons de SELLERIE (#1128) : le harnachement n'est plus dessiné dans la bête, il vient d'un
      // SET (`quadruped/harnais/`) apposé par la donnée ; ses teintes restent ici, où vit la palette
      // du porteur. `harnaisCuir` est DISTINCT de `cuir` (le sabot) : recolorier la corne ne doit
      // pas déteindre sur les cuirs de bride, ni l'inverse. Même hex que le cuir d'origine —
      // l'extraction ne change aucune teinte.
      harnaisCuir: '#3c322a', // cuirs de bride, étrivière, sangle
      drap: '#7e3424', // caparaçon rouge
      sangle: '#6f6d33', // selle matelassée + panneaux de croupière olive
      accent: '#c1953e', // or des médaillons, liserés, mors, étrier
    },
  },
};

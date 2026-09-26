import type { CreatureDef } from '../types';

// Chien de guerre — fidélité à l'artwork officiel (art-ref/ldb/page317_img7361.png) : DOGUE
// massif et musculeux, pas un chien courant. build 'feline' = poitrail PROFOND + taille creusée
// + arrière-main ronde et musclée, membres plus épais que 'canine' ; tête 'ours' = crâne LARGE,
// museau COURT écrasé, gueule ouverte à crocs (le rictus du molosse — 'loup' lisait museau fin
// pointu) ; petites oreilles rondes. girth 1.52 = masse du dogue.
// La BÊTE EST NUE (#1128) : le harnachement de l'artwork (caparaçon, plaque de croupe, plastron,
// gorgerin, collier à pointes) n'appartient pas à l'ESPÈCE — c'est un SET d'équipement
// (`quadruped/harnais/harnais-de-guerre-canin`) qu'un record déclare et que le canal `deco` appose
// sur les os qu'il chevauche. Un chien de compagnie, un chien de chasse ou un ratier n'en portent
// pas ; le molosse du statblock LDB, dont c'est l'illustration, oui.
export const creature: CreatureDef = {
  label: "Chien",
  id: "chien",
  plan: 'quadruped',
  quad: {
    sl: 0.8, build: 'feline', girth: 1.52, bodyLen: 0.92, neckLen: 0.36, neckAngle: -6,
    legLen: 0.48, head: 'ours', headScale: 1.05, tail: 'fouet', tailLen: 0.9, ears: 'rondes',
    foot: 'patte', mane: 'sans', ridge: 'sans', markings: 'sans',
    palette: {
      corps: '#8a5f3a', corpsO: '#3e2c1a', corpsH: '#b48a58', // robe fauve/brune de l'artwork
      cheveux: '#4a3320', cheveuxO: '#241708', // poil hérissé de nuque/crâne (le hérissement du molosse)
      cuir: '#241c14', // coussinets
      // Jetons du HARNACHEMENT (#1128) : le harnais vient d'un SET (`quadruped/harnais/
      // harnais-de-guerre-canin`) apposé par la donnée ; ses teintes restent ici, où vit la palette
      // du porteur. `harnaisCuir` est DISTINCT de `cuir` (le coussinet) : recolorier la patte ne
      // doit pas déteindre sur les cuirs du harnais, ni l'inverse. Mêmes hex qu'à l'origine —
      // l'extraction ne change aucune teinte.
      accent: '#98a0a8', // acier du harnais (plastron, liserés, pointes du collier)
      harnaisCuir: '#241c14', // sangles, caparaçon, dossière du collier
    },
  },
};

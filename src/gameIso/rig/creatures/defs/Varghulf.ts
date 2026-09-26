import type { CreatureDef } from '../types';

// Varghulf — « grandes bêtes aux allures de chauve-souris » (LDB 82 l.21-24), artwork
// art-ref/ldb/page329_img8024.png. Trois signatures de la figure : 1) l'immense ÉVENTAIL
// d'excroissances osseuses en forme d'ailes repliées qui domine le dos — membrane rousse
// dressée à demi-ouverte (wingPose 'dressees', wingSpan ample) TRAVERSÉE de longues lames
// d'os couleur corne (deco aileD/aileG) ; 2) palette TERREUSE — fourrure brun charbon,
// reflets fauves, membrane orange feu, serres et os couleur corne ; 3) posture TAPIE
// agressive — échine arquée (build 'rodent'), membres courts fléchis, encolure plongeante
// tête basse prête à bondir. Tête 'rat' (museau camus à truffe charnue, œil sombre),
// oreilles pointues, gueule à crocs, moignon de queue, fourrure hérissée + épines dorsales.

// Éventail d'os du dos : SABRES courbés (base LARGE → pointe aiguë, bord d'attaque nettement
// bombé vers l'arrière — jamais des lattes rectilignes), longueurs très IRRÉGULIÈRES (grande
// lame, épine courte intercalée, moignon bas) comme sur l'artwork, lambeaux de membrane
// DÉCHIRÉE orange accrochés entre les bases.
// (repère de l'art d'aile — quadAnchor : mêmes coordonnées que l'art 'dressees', même ×wingSpan).
const EVENTAIL_OS =
  `<g data-deco="eventail">` +
  // lambeaux de membrane déchirée entre les lames (bord inférieur en dents — artwork : voile
  // rousse en loques accrochée aux épars)
  `<path d="M-4.6 -1.4 Q-9 -14 -11.4 -26 L-13 -18.5 L-15.2 -22.5 Q-16.8 -10 -17.6 -3 Q-11 -4.6 -4.6 -1.4 Z ` +
  `M-11 1 Q-16.6 -5.4 -21.6 -11.5 L-22.2 -6.6 L-25.4 -8.8 Q-26.8 -2.6 -27.6 0.6 Q-19 -1.4 -11 1 Z" ` +
  `fill="@aile" stroke="@aileO" stroke-width="0.5" opacity="0.85"/>` +
  // lames en os corne franc — grande lame arquée, médiane, basse, plus une épine courte frontale
  `<path d="M-3.5 -1 Q-11 -30 -11.5 -57 Q-7 -29 0.5 -1.3 Z ` +
  `M-9.4 0.6 Q-19 -16 -25.5 -34 Q-15.6 -15 -6.2 0.9 Z ` +
  `M-14.2 2.1 Q-24.6 -4.2 -33.5 -11 Q-21.4 -3.2 -11.6 2.4 Z ` +
  `M-1.2 -1.2 Q-3.4 -14 -3.6 -27 Q-0.6 -13.6 1.4 -1 Z" ` +
  `fill="@cuir" stroke="#241708" stroke-width="0.45"/>` +
  // lames en os blanchi (variation de ton) — intermédiaires + épine intercalée + moignon bas
  `<path d="M-6.8 -0.2 Q-15 -24 -18.5 -45 Q-12 -23 -3.0 0.1 Z ` +
  `M-12 1.4 Q-22 -9.5 -30.5 -22 Q-18.4 -8.6 -9 1.7 Z ` +
  `M-5.4 -0.6 Q-10.4 -15.4 -13.4 -30 Q-7.6 -14.6 -3.6 -0.4 Z ` +
  `M-15.8 2.6 Q-21.8 0 -26 -3.4 Q-19.6 1 -13.8 2.9 Z" ` +
  `fill="@cuirH" stroke="#241708" stroke-width="0.45"/>` +
  // suintement rouille de la membrane le long de deux lames (accent orangé de l'artwork)
  `<path d="M-4.2 -5 Q-9 -26 -10.6 -48 M-8.6 -2 Q-16 -14 -21.6 -28" ` +
  `fill="none" stroke="@aileO" stroke-width="0.9" opacity="0.35"/>` +
  // nodosités d'articulation le long des lames (lecture « os », pas « piquant »)
  `<path d="M-7.6 -33 q1.4 0.9 2.7 0.5 M-10 -47 q1.2 0.8 2.3 0.4 M-12.8 -27 q1.4 0.9 2.6 0.5 ` +
  `M-16.2 -14.5 q1.4 1 2.7 0.7 M-20.4 -9.5 q1.3 1 2.6 0.8 M-9.6 -17 q1.4 0.9 2.7 0.6" ` +
  `fill="none" stroke="@cuirO" stroke-width="0.55" opacity="0.75"/>` +
  `</g>`;

// Accents de robe (artwork : fourrure charbon GRISONNANTE sur le dos, peau FAUVE ORANGÉE nue
// aux épaules/cuisses) — la robe @corps seule lisait « brun uni ». Repère local du tronc
// (profil : corps ≈ x -38..34, y -20..16).
const ROBE_ACCENTS =
  `<g data-deco="robe">` +
  `<ellipse cx="20" cy="6" rx="7" ry="5" fill="@corpsH" opacity="0.32"/>` +
  `<ellipse cx="-26" cy="4" rx="8" ry="6" fill="@corpsH" opacity="0.28"/>` +
  `<path d="M-18 -13 q3 2 6 1.4 M-8 -15 q3 2 6 1.4 M2 -15 q3 2 6 1.4 M12 -13 q3 2 6 1.4 ` +
  `M-13 -8 q3 2 6 1.4 M7 -9 q3 2 6 1.4" ` +
  `fill="none" stroke="#8b8174" stroke-width="0.9" opacity="0.5"/>` +
  `</g>`;

export const creature: CreatureDef = {
  label: 'Varghulf',
  id: "varghulf",
  plan: 'winged',
  quad: {
    sl: 1.12, build: 'rodent', girth: 1.35, bodyLen: 1.02, neckLen: 0.55, neckAngle: 34, legLen: 0.6,
    head: 'rat', headScale: 1.35, tail: 'courte', tailLen: 0.8, ears: 'pointues',
    foot: 'serre', wings: 'membrane', wingSpan: 1.9, wingPose: 'dressees',
    mane: 'hirsute', ridge: 'epines', markings: 'sans',
    deco: { aileD: EVENTAIL_OS, aileG: EVENTAIL_OS, 'tronc#profile': ROBE_ACCENTS },
    palette: {
      corps: '#4a4239', corpsO: '#211c16', corpsH: '#b0763c', // fourrure gris charbon, accents fauve orangé (peau des membres/mufle sur l'artwork)
      cheveux: '#2a1c11', cheveuxO: '#140d06', // hérissement sombre de l'échine
      aile: '#b05e24', aileO: '#571f08', aileH: '#e08c3f', // membrane orange feu (signature artwork)
      cuir: '#c9a06a', // serres et lames d'os couleur corne
    },
  },
};

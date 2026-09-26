import type { CreatureDef } from '../types';

// Manticore (LDB 79 l.150, artwork LDB 79 p.324) : gueule FÉLINE cerclée d'une crinière rousse
// flamboyante (@cheveux) à grands crocs (tête 'felin'), paire de CORNES SOMBRES qui percent la
// crinière (deco tete — trait de l'artwork), avant-train écailleux bleu-gris à dorsale d'épines
// (build 'draconic'), grandes ailes de chauve-souris VIOLET POURPRE dressées à demi-ouvertes
// (membrane + wingPose 'dressees', famille @aile* propre — la couleur signature de l'artwork),
// longue queue segmentée dressée derrière la croupe HÉRISSÉE DE PIQUANTS (deco queue) finie en
// DARD de scorpion (queue 'dard'). Gabarit AILÉ — distinct du griffon (cuir vs plumes).
export const creature: CreatureDef = {
  label: 'Manticore',
  id: "manticore",
  plan: 'winged',
  quad: {
    sl: 1.15, build: 'draconic', girth: 1.0, bodyLen: 1.06, neckLen: 0.6, neckAngle: -22, legLen: 0.95,
    head: 'felin', headScale: 1.25, tail: 'dard', tailLen: 1.15, ears: 'rondes', foot: 'patte',
    wings: 'membrane', wingSpan: 1.55, wingPose: 'dressees', mane: 'hirsute', ridge: 'epines',
    deco: {
      // cornes courbées vers l'extérieur, teinte sombre de la robe (@corpsO) pour trancher sur
      // la crinière rousse ; symétriques autour de l'axe → lisibles de face, profil et dos
      tete: `<g data-deco="cornes">` +
        `<path d="M-4.6 -9 Q-11 -13.6 -12.4 -21.5 Q-6.8 -16.5 -5.6 -10.2 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.45"/>` +
        `<path d="M4.6 -9 Q11 -13.6 12.4 -21.5 Q6.8 -16.5 5.6 -10.2 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.45"/>` +
        `<path d="M-8.6 -13 q1.7 0.7 2.5 1.8 M-10.2 -16.6 q1.5 0.7 2.3 1.7 M8.6 -13 q-1.7 0.7 -2.5 1.8 M10.2 -16.6 q-1.5 0.7 -2.3 1.7" stroke="@corpsH" stroke-width="0.5" fill="none" opacity="0.5"/>` +
        `</g>`,
      // piquants barbelés le long du fouet — dans le repère de l'art de queue (quadAnchor), le
      // rotate(-42) de l'art 'dard' (= axes monde) pour suivre l'arc vertical de la queue au
      // profil. Fill CLAIR (@corpsH) + spikes sur le bord EXTERNE (gauche, puis pivotant vers le
      // haut le long du crochet) : la 1re version en @corpsO se fondait dans le fond → « lisse ».
      // Clé #profile : seul l'art de queue du PROFIL porte ce rotate(-42) (tailBack, de dos, ne l'a pas).
      'queue#profile': `<g data-deco="piquants" transform="rotate(-42)">` +
        `<path d="M-4.2 -3.8 Q-7.8 -5.6 -9 -8.6 Q-5.8 -7.6 -3.6 -6.4 Z M-5 -9.6 Q-8.4 -11 -9 -14.2 Q-6.4 -13.4 -4.4 -12 Z M-4.8 -16.4 Q-8.2 -18 -9 -21.4 Q-5.8 -20.2 -4 -18.8 Z M-3.8 -23 Q-7 -25 -7.6 -28.4 Q-4.6 -26.8 -2.8 -25.2 Z M-1.8 -29 Q-4.4 -32 -4.4 -35.6 Q-1.6 -33 -0.4 -30.6 Z M2 -33.6 Q0.8 -37.6 2 -41 Q4 -37.8 3.6 -34.8 Z M8 -37 Q7.6 -41 9.2 -44 Q10.8 -40.4 10 -37.2 Z" fill="@corpsH" stroke="#1a140e" stroke-width="0.4"/>` +
        `</g>`,
    },
    palette: {
      corps: '#5c6478', corpsO: '#303648', corpsH: '#8f96aa', cheveux: '#c25a1e', cheveuxO: '#7b330f',
      aile: '#7d5a92', aileO: '#43305c', aileH: '#a887bd', // membrane violet pourpre (signature artwork)
      cuir: '#3f3a4c',
    },
  },
};

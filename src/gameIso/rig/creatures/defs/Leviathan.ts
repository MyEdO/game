import type { CreatureDef } from '../types';

// Léviathan (ZI 12 p.85 ; artwork ZI folio 85 — art-ref/zi/page088_full.png) : crustacé COLOSSAL
// (Taille Monstrueuse) dont la carapace hérissée de piquants disparaît sous une ÉPAVE agglomérée —
// coque échouée à bordés, mât rompu à tête recourbée + vergue + haubans, tour de pierre ruinée,
// espars en travers, ancre pendue à sa chaîne, cheminées de vers tubicoles. Deux yeux PROÉMINENTS
// sur longs pédoncules au centre du visage, entre les chélae. Chélae MASSIVES, dentelées
// (pinces perforatrices) et ASYMÉTRIQUES : la gauche domine nettement. Robe gris-vase incrustée,
// bois délavé et pierre grise (l'artwork est à l'encre — ≠ rouge-orangé du Granchio, même folio).

// Épave coiffant la carapace, au repère du corps (dos = -y, face = +y).
const EPAVE =
  // coque échouée en travers du dos, quille visible, bordés marqués
  `<path d="M-24 -6 Q-26 -20 -15 -27 Q-4 -32 5 -28 L3 -10 Q-10 -17 -24 -6 Z" fill="#6a5f4c" stroke="#3a332a" stroke-width="0.9" stroke-linejoin="round"/>` +
  `<path d="M-21.5 -9 Q-14 -16 2.5 -12 M-23 -13 Q-13 -21 3.5 -17 M-21 -19 Q-11 -26 4 -22" stroke="#3a332a" stroke-width="0.5" fill="none" opacity="0.6"/>` +
  // membrures rompues dépassant de la coque éventrée
  `<path d="M-14 -25 l-1 -5 M-8 -28 l0 -5 M-2 -29 l1 -4.6" stroke="#3a332a" stroke-width="1" stroke-linecap="round"/>` +
  // mât rompu incliné, tête RECOURBÉE en crosse (l'enroulement de l'artwork), vergue et haubans
  `<path d="M-7 -24 L-1 -50 q1.5 -5 -2 -6.5 q-3 -1 -3.5 1.8" stroke="#57493a" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
  `<path d="M-13 -41 L9 -47" stroke="#4a3e30" stroke-width="1.6" stroke-linecap="round"/>` +
  `<path d="M-13 -41 Q-18 -26 -21 -10 M9 -47 Q14 -30 17 -12 M-3.5 -46 Q-11 -32 -16 -20" stroke="#2c2620" stroke-width="0.55" fill="none" opacity="0.85"/>` +
  // lambeau de voile pendu à la vergue
  `<path d="M-13 -41 L-10 -32 L-5 -38 L-1 -29 L3 -37 L9 -47 Z" fill="#978b74" opacity="0.5"/>` +
  // tour de pierre ruinée à tribord : fût effondré d'un côté, créneaux brisés, meurtrière sombre
  `<path d="M8 -9 L9.5 -31 L13.5 -30.4 L13.5 -34.6 L17.5 -33.8 L17.5 -29.8 L21.5 -29 L24.5 -8 Z" fill="#84806f" stroke="#454236" stroke-width="0.9" stroke-linejoin="round"/>` +
  `<path d="M9.2 -26 h13 M9 -21 h14 M8.6 -16 h15 M8.3 -11.5 h16" stroke="#454236" stroke-width="0.45" opacity="0.55"/>` +
  `<path d="M13 -23.5 v2.5 M18.5 -23.5 v2.5 M15.5 -18.5 v2.5 M11.5 -13.7 v2.2 M19.5 -13.7 v2.2" stroke="#454236" stroke-width="0.45" opacity="0.55"/>` +
  `<rect x="14.2" y="-27.4" width="3" height="4.2" rx="1.4" fill="#26241d"/>` +
  // espars et planches piqués dans le fouillis, débordant des flancs
  `<path d="M-17 -8 L27 -18" stroke="#57493a" stroke-width="1.9" stroke-linecap="round"/>` +
  `<path d="M-28 -14 L9 -6" stroke="#443929" stroke-width="1.4" stroke-linecap="round"/>` +
  `<path d="M-5 -28 L12 -36" stroke="#4f4433" stroke-width="1.3" stroke-linecap="round"/>` +
  // ancre pendue à sa chaîne le long du flanc bâbord (jas, verge, pattes recourbées)
  `<path d="M-21 -6 Q-22.5 0 -23 4" stroke="#31313a" stroke-width="1.1" fill="none" stroke-dasharray="1.6 1.1"/>` +
  `<circle cx="-23.2" cy="5.2" r="1.1" fill="none" stroke="#31313a" stroke-width="0.8"/>` +
  `<path d="M-23.2 6.3 v6.6 M-26 8.4 h5.6 M-26.8 12.4 q3.6 4.4 7.2 0" stroke="#31313a" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
  `<path d="M-26.8 12.4 l-1 -1.7 M-19.6 12.4 l1 -1.7" stroke="#31313a" stroke-width="1" stroke-linecap="round"/>` +
  // cheminées de vers tubicoles au pied du fouillis, d'où sortent les pédoncules
  `<g fill="@cuir" stroke="@corpsO" stroke-width="0.5">` +
  `<path d="M-6.6 -3.6 q-0.9 -6.6 0.6 -8.4 q1.8 0.2 1.6 8.4 Z"/><path d="M-2.8 -2.8 q-0.8 -8.6 1 -10.4 q2 0.2 1.5 10.4 Z"/><path d="M1.8 -3.2 q-0.6 -7.4 1.2 -9 q1.7 0.2 1.3 9 Z"/><path d="M5.8 -4 q-0.5 -6 1 -7.4 q1.6 0.2 1.3 7.4 Z"/>` +
  `</g>` +
  `<path d="M-6 -11.8 a1.1 0.55 0 1 0 2.2 0 M-1.9 -13 a1.1 0.55 0 1 0 2.2 0 M2.6 -12 a1.1 0.55 0 1 0 2.2 0" stroke="#221c14" stroke-width="0.5" fill="none"/>` +
  // croûte de balanes incrustée sur le pourtour visible de la carapace
  `<circle cx="-16" cy="2" r="1.1" fill="@cuir" opacity="0.55"/><circle cx="18" cy="-1" r="1" fill="@cuir" opacity="0.5"/><circle cx="9" cy="6" r="0.9" fill="@cuir" opacity="0.5"/><circle cx="-9" cy="8" r="0.8" fill="@cuir" opacity="0.5"/>`;

export const creature: CreatureDef = {
  label: 'Léviathan',
  id: "leviathan",
  plan: 'crustace',
  crab: {
    sl: 1.15, girth: 1.22,
    spikes: 16, eyestalk: 2.4, clawScale: { G: 1.5, D: 1.12 }, clawTeeth: true,
    deco: { corps: EPAVE },
    palette: { corps: '#5f5a49', corpsO: '#302c20', corpsH: '#8e8870', cheveux: '#302c20', cheveuxO: '#191710', cuir: '#a49272' },
  },
};

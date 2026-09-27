import type { CreatureDef } from '../types';

// Il Potente Granchio (ZI 12 p.85 ; artwork ZI folio 85 — art-ref/zi/page088_full.png) : crabe
// TITANESQUE de Tilée (Casa di Ruggicor). Signature visuelle de l'artwork : la carapace hérissée
// de piquants est ENSEVELIE sous une épave accumulée (coque à bordés, mât brisé + vergue et voile
// en lambeaux, tour de briques ruinée, espars, os, ancre à sa chaîne, éponges tubulaires) ; les
// yeux sont portés par de LONGS pédoncules émergeant du fouillis ; les chélae sont massives et
// dentelées (pinces perforatrices). Robe rouge-orangé de crabe.

// Épave accrochée à la carapace, dessinée au repère du corps (dos = -y, face = +y).
const EPAVE =
  // coque échouée à bâbord (proue courbe, bordés apparents)
  `<path d="M-25 -8 Q-24 -24 -11 -29 L-6 -24 Q-17 -19 -19 -7 Z" fill="#75634c" stroke="#42362a" stroke-width="0.9" stroke-linejoin="round"/>` +
  `<path d="M-22.5 -10 Q-21 -21 -11.5 -26 M-24 -8.5 Q-23 -22 -11 -28" stroke="#42362a" stroke-width="0.5" fill="none" opacity="0.65"/>` +
  // mât brisé incliné (tête rompue), vergue, voile en lambeaux, haubans retombant sur la carapace
  `<path d="M-3 -12 L-9 -46 M-9 -46 L-12 -52" stroke="#63523d" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
  `<path d="M-18 -39 L4 -45" stroke="#54452f" stroke-width="1.7" stroke-linecap="round"/>` +
  `<path d="M-18 -39 L-15 -30 L-10 -36 L-6 -26 L-2 -34 L4 -45 Z" fill="#a49579" opacity="0.55"/>` +
  `<path d="M-18 -39 Q-16 -25 -8 -13 M4 -45 Q5 -30 2 -13" stroke="#8a7a5f" stroke-width="0.55" fill="none" opacity="0.8"/>` +
  // tour de briques ruinée à tribord (créneaux brisés, meurtrière)
  `<path d="M7 -11 L9 -33 L13 -32.4 L13 -36.5 L17 -35.8 L17 -31.8 L21 -31 L25 -9 Z" fill="#8d867a" stroke="#48423a" stroke-width="0.9" stroke-linejoin="round"/>` +
  `<path d="M9 -28 h13.5 M9 -23 h14.5 M8.5 -18 h15.5 M8 -13 h16.5" stroke="#48423a" stroke-width="0.45" opacity="0.55"/>` +
  `<path d="M12 -25.5 v2.5 M18 -25.5 v2.5 M15 -20.5 v2.5 M11 -15.5 v2.5 M19 -15.5 v2.5" stroke="#48423a" stroke-width="0.45" opacity="0.55"/>` +
  `<rect x="14" y="-28.5" width="3.2" height="4.4" rx="1.5" fill="#2b2721"/>` +
  // espars et planches en travers du fouillis
  `<path d="M-15 -6 L19 -19" stroke="#63523d" stroke-width="2" stroke-linecap="round"/>` +
  `<path d="M-20 -17 L11 -8" stroke="#4f4229" stroke-width="1.5" stroke-linecap="round"/>` +
  `<path d="M-4 -30 L9 -37" stroke="#5a4b36" stroke-width="1.4" stroke-linecap="round"/>` +
  // os pris dans l'épave
  `<path d="M1 -9 L9 -13" stroke="#ddd2b8" stroke-width="1.4" stroke-linecap="round"/>` +
  `<circle cx="1" cy="-9" r="1" fill="#ddd2b8"/><circle cx="9" cy="-13" r="1" fill="#ddd2b8"/>` +
  // ancre pendue à sa chaîne sur le flanc avant-bâbord
  `<path d="M-22 -7 Q-23 -1 -23.5 3" stroke="#34343b" stroke-width="1.1" fill="none" stroke-dasharray="1.7 1.1"/>` +
  `<circle cx="-23.5" cy="4.2" r="1.1" fill="none" stroke="#34343b" stroke-width="0.8"/>` +
  `<path d="M-23.5 5.3 v6.5 M-26.3 7.5 h5.6 M-27 11.5 q3.5 4.2 7 0" stroke="#34343b" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
  // éponges tubulaires au pied du fouillis (d'où émergent les pédoncules oculaires)
  `<g fill="#b57a48" stroke="#6e4526" stroke-width="0.5">` +
  `<path d="M-7 -4 q-1 -7 0.6 -9 q1.8 0.2 1.6 9 Z"/><path d="M-3.4 -3 q-0.8 -9 1 -11 q2 0.2 1.6 11 Z"/><path d="M1.2 -3.4 q-0.6 -8 1.2 -9.6 q1.8 0.2 1.4 9.6 Z"/><path d="M5.4 -4.2 q-0.6 -6.4 1 -8 q1.7 0.2 1.4 8 Z"/>` +
  `</g>` +
  `<path d="M-6.4 -12.6 a1.1 0.55 0 1 0 2.2 0 M-2.6 -13.8 a1.1 0.55 0 1 0 2.2 0 M2 -12.8 a1.1 0.55 0 1 0 2.2 0" stroke="#3f2513" stroke-width="0.5" fill="none"/>`;

export const creature: CreatureDef = {
  label: 'Il Potente Granchio',
  id: "il-potente-granchio",
  plan: 'crustace',
  crab: {
    sl: 1.1, girth: 1.16,
    spikes: 14, eyestalk: 2.2, clawScale: 1.35, clawTeeth: true,
    deco: { corps: EPAVE },
    palette: { corps: '#a8502e', corpsO: '#5e2818', corpsH: '#dc844a', cheveux: '#5e2818', cheveuxO: '#34160c', cuir: '#d8b89a' },
  },
};

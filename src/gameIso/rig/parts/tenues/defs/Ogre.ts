import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';
import { BODIES } from '../../bodies';

// Tenue d'OGRE (illustration LDB 77 p.314) : plaque-bedaine rivetée sur le torse nu, épaulières
// de cuir, jambières de peaux. C'est de l'ÉQUIPEMENT — le corps de CHAIR est composé depuis
// `BODIES['nu-ogre']` (panse tombante, 3 vues dédiées), jamais redessiné ici : la tenue ne pose
// que la ferraille par-dessus. Un PNJ ogre peut porter autre chose sur le même corps.
const OGRE = BODIES['nu-ogre'];
// plaque-bedaine RIVETÉE, calée sur le galbe de la panse (elle épouse le ventre, elle ne le fait pas)
const PLAQUE = `<path d="M-12.6 -2 Q0 -6.6 12.6 -2 C13 8 12.4 16 11 20.4 Q0 25.6 -11 20.4 C-12.4 16 -13 8 -12.6 -2 Z" fill="@metal" stroke="#3a4048" stroke-width="1"/>`
  + `<path d="M-11.4 -1.6 Q0 -5.6 11.4 -1.6 C11.6 4 11.4 8 11 11 Q0 6.4 -11 11 C-11.4 8 -11.6 4 -11.4 -1.6 Z" fill="#a4adbe" opacity="0.35"/>` // rehaut : le haut de plaque prend le jour
  + `<circle cx="0" cy="9" r="3.4" fill="#5a6068" stroke="#3a4048" stroke-width="0.6"/>`
  + `<circle cx="-7.4" cy="2" r="1.2" fill="#3a4048"/><circle cx="7.4" cy="2" r="1.2" fill="#3a4048"/>`
  + `<circle cx="-6.6" cy="17.4" r="1.2" fill="#3a4048"/><circle cx="6.6" cy="17.4" r="1.2" fill="#3a4048"/>`;
// jambe : chair d'ogre + jambière de peaux lanière
const JAMBE = `<g stroke-linejoin="round">${OGRE.jambe}`
  + `<path d="M-4.6 22 Q0 23.6 4.6 22 L4.2 44 L-4.2 44 Z" fill="@vet1" stroke="#4a3e28" stroke-width="0.6"/>`
  + `<path d="M-4.2 28 L4.2 30 M-4 35 L4 37" stroke="@cuir" stroke-width="1.6" stroke-linecap="round"/>`
  + `</g>`;

export const tenue: TenueDef = {
  label: 'Ogre',
  id: "ogre",
  palette: { vet1: '#7a6a4a' },
  set: {
    pied: BOTTE_CUIR,
    // torse = chair d'OGRE (le slot remplace le « Nu ») + plaque-bedaine par-dessus la panse.
    // 3 vues DÉDIÉES : sans elles, resolve.ts substituerait sa silhouette générique (torse humain
    // en tokens) de profil et de dos — la panse disparaîtrait sur 2 vues sur 3.
    torse: {
      front: `<g stroke-linejoin="round">${OGRE.torseFront}${PLAQUE}`
        + `<path d="M-11.2 -4 L-13 -14 M11.2 -4 L13 -14" stroke="@cuir" stroke-width="2.2" stroke-linecap="round"/>` // bretelles de la plaque
        + `</g>`,
      back: `<g stroke-linejoin="round">${OGRE.torseBack}`
        // sangles de la plaque, bouclées dans le dos (pas d'art de FACE plaqué : la plaque est devant)
        + `<path d="M-11 -12 L-4.6 -1 M11 -12 L4.6 -1" stroke="@cuir" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M-13.8 4.6 Q0 8.6 13.8 4.6 L13.4 9.4 Q0 13.4 -13.4 9.4 Z" fill="@cuir" stroke="#2c1e12" stroke-width="0.6"/>`
        + `<rect x="-2.2" y="5.4" width="4.4" height="5.2" rx="0.6" fill="@metal" stroke="#3a4048" stroke-width="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">${OGRE.torseProfile}`
        // la plaque épouse la panse ballonnée : bande de tranche suivant la courbe AVANT. Elle
        // s'arrête à y≈27 (haut de cuisse) : les os `cuisse` (z 3/6) passent DEVANT le torse (z 5)
        // — une plaque qui descend à la hanche se fait recouvrir par la jambière et part en vrille.
        + `<path d="M10.2 -1.4 C15.2 3.6 18.3 9.6 18.3 16.2 C18.3 18.6 18 20.8 17.4 22.8 L13.4 21.2 C13.7 19.6 13.9 17.8 13.8 16 C13.6 10.4 11.2 5.4 6.8 1.4 Z" fill="@metal" stroke="#3a4048" stroke-width="0.9"/>`
        + `<path d="M10.6 0.6 C14.6 5 16.9 10.2 17.1 15.8 C17.1 18 16.8 20 16.2 21.8 C15.6 16.4 13.6 10.6 9.4 5.6 Z" fill="#a4adbe" opacity="0.3"/>` // rehaut APRÈS la plaque, sinon écrasé
        + `<circle cx="16" cy="16" r="1.1" fill="#3a4048"/><circle cx="10.6" cy="4" r="1" fill="#3a4048"/>`
        + `<path d="M8.4 -3.6 L10.4 -13.6" stroke="@cuir" stroke-width="2.2" stroke-linecap="round"/>`
        + `</g>`,
    },
    // bras de chair + épaulière de cuir rivetée (haut du bras seul, avant-bras nu)
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-3.4 -3 Q0 -4.8 3.4 -3 L3 27 Q0 28.6 -3 27 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `<path d="M-5.5 -4 Q0 -7 5.5 -4 Q6.2 1 5 4.5 L4 8 Q0 9.8 -4 8 L-5 4.5 Q-6.2 1 -5.5 -4 Z" fill="@cuir" stroke="#2c1e12" stroke-width="0.8"/>`
      + `<path d="M-4.8 0.5 Q0 -1.4 4.8 0.5" stroke="#2c1e12" stroke-width="0.6" fill="none" opacity="0.8"/>`
      + `<circle cx="-2.8" cy="-2" r="0.7" fill="#3a4048"/><circle cx="2.8" cy="-2" r="0.7" fill="#3a4048"/>`
      + `</g>`,
    // jambe de chair d'ogre + jambière de peaux lanière (le bas finit dans la botte du slot `pied`).
    // 3 vues DÉDIÉES : en string front-only, resolve.ts substituait sa jambe GÉNÉRIQUE peinte au
    // token dominant (`vet1`) de profil et de dos → l'ogre avait des jambes OLIVE au lieu de la
    // chair. Une jambe est ~symétrique en révolution : même chair aux 3 vues, la lanière suit.
    jambes: {
      front: JAMBE,
      back: JAMBE,
      profile: JAMBE,
    },
  },
};

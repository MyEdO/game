import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Boucher Ogre (ADE II 02 l.953-991) — chaman-cuisinier ogre, prêtre du Grand Gueulard : gros
// TABLIER de cuir crème gorgé de sang, poche d'outils d'acier (couteaux + ciseaux), ceinture de
// dents d'os avec CRÂNE-trophée pendant, jupe de lanières déchiquetées, chaînes en bandoulière et
// enroulées à l'avant-bras (bande d'étoffe olive), pantalon sombre à ourlet de fourrure. Rendu sur
// le GABARIT OGRE (panse). Le corps de CHAIR est inclus dans les slots (le slot remplace « Nu »).
// Distinct de la tenue 'Ogre' générique (plaque-bedaine d'acier) : ici tablier + trophées.
export const tenue: TenueDef = {
  label: 'Boucher Ogre',
  id: "boucher-ogre",
  palette: {
    cuir: '#c9bca0', cuirO: '#93855f', cuirH: '#e6ddc6', // tablier de cuir crème taché
    vet1: '#2b2f34', vet1O: '#15181b', vet1H: '#3f464d', // pantalon charbon
    vet2: '#6c7883', vet2O: '#3c454c', vet2H: '#9aa6af', // bottes gris-bleu
    metal: '#7f8b98', metalO: '#39404a', metalH: '#b2bbc7', // acier : poche, outils, chaînes
    os: '#a7b4ac', osO: '#6f7e77', osH: '#cfd8d0', // crâne + dents d'os teintés de vert-de-gris
    fourrure: '#c6ccc6', fourrureO: '#8f968f', // ourlet de fourrure
    accent: '#61703f', accentO: '#3c4a25', accentH: '#8a985e', // bande d'étoffe olive à l'avant-bras
  },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      // FACE : tablier gorgé de sang, poche d'outils, ceinture de dents + crâne, jupe de lanières.
      front: `<g stroke-linejoin="round">`
        + `<path d="M-13 -28 Q0 -32 13 -28 Q13.6 -12 12 4 Q13 20 10.5 33 Q0 37 -10.5 33 Q-13 20 -12 4 Q-13.6 -12 -13 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-10 0 Q0 -4 10 0 Q12 16 9 30 Q0 34 -9 30 Q-12 16 -10 0 Z" fill="@peauO" opacity="0.15" stroke="none"/>`
        // chaîne au cou / en bandoulière
        + `<path d="M-8.6 -26.5 Q0 -18 8.6 -26.5" fill="none" stroke="@metalO" stroke-width="2.6" stroke-linecap="round"/>`
        + `<path d="M-8.6 -26.5 Q0 -18 8.6 -26.5" fill="none" stroke="@metal" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1.4 1.1"/>`
        // bretelles de cuir du tablier
        + `<path d="M-10.5 -25 L-9 -14 L-6 -14 L-7.5 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M10.5 -25 L9 -14 L6 -14 L7.5 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        // bavette du tablier (grande feuille de cuir bombée sur la panse)
        + `<path d="M-9 -14 Q0 -16.5 9 -14 Q12.5 -2 11.5 12 Q11 23 8.5 30 Q0 33 -8.5 30 Q-11 23 -11.5 12 Q-12.5 -2 -9 -14 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-9 -13.5 Q0 -15.5 9 -13.5 Q11.5 -3 11 10 L8.5 9 Q8.5 -2 7 -12 Q0 -14 -7 -12 Q-8.5 -2 -8.5 9 L-11 10 Q-11.5 -3 -9 -13.5 Z" fill="@cuirH" opacity="0.38" stroke="none"/>`
        + `<g stroke="@cuirO" stroke-width="0.4" fill="none" opacity="0.5"><path d="M-5 -10 Q-5.5 8 -4 27"/><path d="M0 -12 Q0 8 0 30"/><path d="M5 -10 Q5.5 8 4 27"/></g>`
        // lanières déchiquetées sous la ceinture
        + `<g fill="@cuir" stroke="@cuirO" stroke-width="0.4">`
        + `<path d="M-8 28 L-9 41 L-6 40 L-5.5 29 Z"/><path d="M-4.5 30 L-5.2 43 L-2.6 42 L-2.2 30 Z"/>`
        + `<path d="M-0.6 31 L-1 44.5 L1.4 43.5 L1.2 31 Z"/><path d="M3.4 30 L4 42.5 L6.6 41.5 L5.4 30 Z"/><path d="M6.6 28.5 L8.2 40 L9.2 39 L8 28.5 Z"/>`
        + `</g>`
        // SANG (couleurs littérales — le sang ne se recolore pas) : tablier DÉTREMPÉ, plus dense en bas
        + `<g stroke="none">`
        + `<path d="M-9 12 Q0 8 9.5 12 Q11 22 8 30 Q0 33.5 -8 30 Q-11 22 -9 12 Z" fill="#8f2b27" opacity="0.72"/>`
        + `<path d="M-6 2 Q-1 -2 3 2 Q7 6 5.6 14 Q4 22 -1 24 Q-6 22 -7 13 Q-8 6 -6 2 Z" fill="#9c2f29" opacity="0.9"/>`
        + `<path d="M-3 16 Q3 14 6 20 Q7 27 1.5 31 Q-5 33 -6 25 Q-7 19 -3 16 Z" fill="#7c211d" opacity="0.9"/>`
        + `<path d="M-0.4 31 L-1 44 L1 43.5 L1 31 Z" fill="#7c211d" opacity="0.88"/>`
        + `<circle cx="-8.4" cy="1" r="1.5" fill="#a5382f"/><circle cx="9.4" cy="5" r="1.3" fill="#8f2b27"/><circle cx="7.6" cy="19" r="1.7" fill="#a5382f"/><circle cx="-9" cy="14" r="1.2" fill="#8f2b27"/><circle cx="6" cy="27" r="1.3" fill="#9c2f29"/>`
        + `<circle cx="-4" cy="-6" r="0.9" fill="#a5382f"/><circle cx="3.4" cy="-8" r="0.8" fill="#8f2b27"/><circle cx="-6.4" cy="27" r="1.3" fill="#8f2b27"/>`
        + `<circle cx="-7.6" cy="35" r="1.1" fill="#7c211d"/><circle cx="7" cy="35" r="1.1" fill="#7c211d"/>`
        + `<path d="M-0.6 43 Q-0.9 47.5 0.2 48.5 Q1.4 47.5 1 43.5 Z" fill="#7c211d"/><path d="M-5 40 Q-5.3 43.5 -4.3 44.5 Q-3.4 43.5 -3.8 40 Z" fill="#7c211d"/>`
        + `</g>`
        // poche d'outils en acier (gradient partagé pour la profondeur métallique)
        + `<path d="M-5.6 -1 L5.6 -1 L5.1 12 Q0 13.6 -5.1 12 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M-5.6 -1 L5.6 -1 L5.4 1.6 L-5.4 1.6 Z" fill="@metalH" opacity="0.55" stroke="none"/>`
        + `<path d="M-2 2.5 Q1.5 1.6 3.4 5 Q3.6 9.5 0.4 11 Q-3 10 -3 6 Z" fill="#8f2b27" opacity="0.65" stroke="none"/>`
        // outils qui dépassent (couteaux + ciseaux)
        + `<g stroke-linejoin="round">`
        + `<path d="M-3.8 -1 L-3.3 -10.5 L-2.3 -10.5 L-2.5 -1 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.4"/>`
        + `<path d="M-1.4 -1 L-1 -8.8 L0 -8.8 L-0.2 -1 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.4"/>`
        + `<path d="M2.6 -1 L3.6 -9 M4.8 -1 L3.6 -9" stroke="@metal" stroke-width="0.9" fill="none"/>`
        + `<circle cx="2.2" cy="-0.2" r="1.05" fill="none" stroke="@metal" stroke-width="0.7"/><circle cx="5.2" cy="-0.2" r="1.05" fill="none" stroke="@metal" stroke-width="0.7"/>`
        + `</g>`
        // ceinture de dents d'os
        + `<path d="M-10 23.5 Q0 25.5 10 23.5 L10 26.5 Q0 28.5 -10 26.5 Z" fill="@osO" stroke="@osO" stroke-width="0.4" opacity="0.85"/>`
        + `<g fill="@os" stroke="@osO" stroke-width="0.3">`
        + `<path d="M-9 26 l-0.9 3 l1 0 Z"/><path d="M-6.6 26.6 l-0.8 3.2 l0.9 0 Z"/><path d="M6.6 26.6 l0.8 3.2 l-0.9 0 Z"/><path d="M9 26 l0.9 3 l-1 0 Z"/>`
        + `</g>`
        // crâne-trophée pendant
        + `<g stroke="@osO" stroke-width="0.5">`
        + `<path d="M-4.4 25.5 Q-4.7 21 0 20.4 Q4.7 21 4.4 25.5 Q4.4 29.5 2.8 31.4 L2.6 33.6 Q0 35.2 -2.6 33.6 L-2.8 31.4 Q-4.4 29.5 -4.4 25.5 Z" fill="@os"/>`
        + `<ellipse cx="-2" cy="25.4" rx="1.5" ry="1.8" fill="#26302c" stroke="none"/><ellipse cx="2" cy="25.4" rx="1.5" ry="1.8" fill="#26302c" stroke="none"/>`
        + `<path d="M0 27 l-1 3 l2 0 Z" fill="#26302c" stroke="none"/>`
        + `<path d="M-2.6 31.6 L2.6 31.6 L2.4 33.8 L-2.4 33.8 Z" fill="@osH" stroke="none"/>`
        + `<g stroke="@osO" stroke-width="0.35"><path d="M-1.3 31.6 L-1.3 33.8 M0 31.6 L0 33.8 M1.3 31.6 L1.3 33.8"/></g>`
        + `<path d="M-3.4 23 Q0 21.8 3.4 23" fill="none" stroke="@osH" stroke-width="0.5" opacity="0.7"/>`
        + `</g>`
        + `</g>`,
      // PROFIL : panse bombée vers l'avant (+x), tablier drapé sur TOUT le devant, crâne au flanc.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-5.5 -27 Q2 -30 6.5 -25 Q8.6 -6 10 10 Q10.6 22 7.6 32 Q1 36 -4.6 32 Q-6.2 12 -6 -10 Q-6 -22 -5.5 -27 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        // chaîne sur l'épaule
        + `<path d="M-3.6 -26.5 Q3 -22 6 -25.5" fill="none" stroke="@metalO" stroke-width="2.4" stroke-linecap="round"/>`
        + `<path d="M-3.6 -26.5 Q3 -22 6 -25.5" fill="none" stroke="@metal" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1.3 1"/>`
        // bretelle de cuir
        + `<path d="M-2 -25 L-0.5 -14 L2 -14 L1 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        // tablier : grande feuille de cuir drapée sur TOUTE la panse (couvre le devant)
        + `<path d="M-2.4 -14 Q6 -16 8.8 -12 Q11.4 0 11 12 Q10.6 23 8 31 Q1.5 33 -2.6 31 Q-3.4 8 -2.4 -14 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-0.5 -13.5 Q6 -15 8.8 -11.5 Q10.8 0 10.4 12 L8.4 11 Q8.6 0 6 -11 Q2 -13 -0.5 -12.5 Z" fill="@cuirH" opacity="0.32" stroke="none"/>`
        + `<g stroke="@cuirO" stroke-width="0.4" fill="none" opacity="0.5"><path d="M3.5 -10 Q3.8 8 3 28"/><path d="M6.8 -9 Q7.2 8 6.2 27"/></g>`
        // lanières déchiquetées
        + `<g fill="@cuir" stroke="@cuirO" stroke-width="0.4"><path d="M-0.6 30 L-1.2 42 L1.4 41 L1.8 31 Z"/><path d="M3.6 31 L4 42 L6.6 41 L5.6 31 Z"/><path d="M7 30 L7.6 40 L9 39.4 L8 30 Z"/></g>`
        // SANG : coulures verticales sur le tablier (jamais un aplat qui lirait « chair à vif »)
        + `<g stroke="none">`
        + `<path d="M0 6 Q6 3 10 11 Q10.4 20 7 29 Q2 32 -0.4 25 Q-1.2 13 0 6 Z" fill="#9c2f29" opacity="0.42"/>`
        + `<g fill="none" stroke-linecap="round">`
        + `<path d="M3 4 Q3.4 16 2.8 30" stroke="#7c211d" stroke-width="1.7" opacity="0.72"/>`
        + `<path d="M6.2 8 Q6.6 18 6 28" stroke="#7c211d" stroke-width="1.4" opacity="0.7"/>`
        + `<path d="M8.8 11 Q9 18 8.6 25" stroke="#8f2b27" stroke-width="1.2" opacity="0.6"/>`
        + `<path d="M4.6 2 Q4.8 14 4.4 27" stroke="#8f2b27" stroke-width="1" opacity="0.5"/>`
        + `</g>`
        + `<circle cx="9.2" cy="15" r="1.2" fill="#a5382f"/><circle cx="4.4" cy="22" r="1.3" fill="#7c211d"/><circle cx="7.4" cy="7" r="1" fill="#a5382f"/>`
        + `<path d="M0.8 41 Q0.6 45 1.6 46 Q2.6 45 2.2 41 Z" fill="#7c211d"/><path d="M5 41 Q4.8 44.5 5.8 45.5 Q6.6 44.5 6.4 41 Z" fill="#7c211d"/>`
        + `</g>`
        // crâne au flanc avant
        + `<g stroke="@osO" stroke-width="0.5"><path d="M3.6 24.5 Q3.4 20.5 7.4 20.2 Q11 21 10.6 25 Q10.4 28.5 8.8 30.2 L8.6 32 Q6.4 33.4 4.4 32 L4.2 30 Q3.6 28 3.6 24.5 Z" fill="@os"/><ellipse cx="6" cy="24.8" rx="1.4" ry="1.7" fill="#26302c" stroke="none"/><path d="M8.6 26 l-0.8 3 l1.6 0 Z" fill="#26302c" stroke="none"/><path d="M4.4 30.4 L8.6 30.4 L8.4 32.2 L4.6 32.2 Z" fill="@osH" stroke="none"/></g>`
        + `</g>`,
      // DOS : chair nue, bretelles de tablier CROISÉES + chaîne, noeud du tablier, lanières aux flancs.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-12.6 -28 Q0 -32 12.6 -28 Q13.2 -12 11.6 4 Q12.6 20 10 33 Q0 37 -10 33 Q-12.6 20 -11.6 4 Q-13.2 -12 -12.6 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 -26 L0 31" stroke="@peauO" stroke-width="0.8" opacity="0.4" fill="none"/>`
        + `<path d="M-10 -22 Q-6 -18 -3 -22 M10 -22 Q6 -18 3 -22" stroke="@peauO" stroke-width="0.6" fill="none" opacity="0.4"/>`
        // bretelles croisées
        + `<path d="M-9 -24.5 L8 -6 L6 -4.5 L-11 -23 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.4"/>`
        + `<path d="M9 -24.5 L-8 -6 L-6 -4.5 L11 -23 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.4"/>`
        // chaîne en travers du dos
        + `<path d="M-9 -23 Q0 -17 9 -23" fill="none" stroke="@metalO" stroke-width="2.4" stroke-linecap="round"/>`
        + `<path d="M-9 -23 Q0 -17 9 -23" fill="none" stroke="@metal" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1.3 1"/>`
        // ceinture + noeud du tablier
        + `<path d="M-11 23.5 Q0 25.5 11 23.5 L11 27 Q0 29 -11 27 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `<circle cx="0" cy="25.5" r="2.4" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M-2 26 L-6 33 L-4 33.6 L-1 27 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.4"/><path d="M2 26 L6 33 L4 33.6 L1 27 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.4"/>`
        // lanières visibles aux flancs
        + `<g fill="@cuir" stroke="@cuirO" stroke-width="0.4"><path d="M-9 27 L-10 39 L-7.5 38 L-7 27.5 Z"/><path d="M7 27.5 L8 38.5 L9.5 37.5 L8.6 27 Z"/></g>`
        // éclaboussures de sang (le boucher est maculé de partout)
        + `<g stroke="none"><circle cx="-8" cy="33" r="1" fill="#7c211d"/><circle cx="8.4" cy="33" r="1" fill="#7c211d"/><circle cx="-4" cy="6" r="1.1" fill="#8f2b27"/><circle cx="5" cy="10" r="1.2" fill="#8f2b27"/><circle cx="2" cy="-2" r="0.9" fill="#9c2f29"/><circle cx="-6" cy="16" r="0.9" fill="#7c211d"/><circle cx="6.6" cy="20" r="0.9" fill="#7c211d"/></g>`
        + `</g>`,
    },
    // bras de CHAIR + bande d'étoffe olive et chaîne enroulée à l'avant-bras.
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-4 -4 Q0 -6.5 4 -4 Q4.4 12 3.6 28 Q0 30 -3.6 28 Q-4.4 12 -4 -4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `<path d="M2.6 -3 Q3.2 12 2.4 27" fill="none" stroke="@peauH" stroke-width="0.6" opacity="0.4"/>`
      // bande d'étoffe olive
      + `<path d="M-4 13 Q0 11.6 4 13 L3.8 21 Q0 22.4 -3.8 21 Z" fill="@accent" stroke="@accentO" stroke-width="0.5"/>`
      + `<path d="M-4 14.5 Q0 13.2 4 14.5" fill="none" stroke="@accentH" stroke-width="0.5" opacity="0.6"/>`
      // chaîne enroulée (3 spires)
      + `<g stroke="@metalO" stroke-width="1.6" fill="none" stroke-linecap="round">`
      + `<path d="M-4 16 Q0 18 3.9 15.5"/><path d="M-3.9 19 Q0 21.4 3.8 18.6"/><path d="M-3.8 22.5 Q0 24.8 3.7 22"/>`
      + `</g>`
      + `<g stroke="@metal" stroke-width="0.8" fill="none" stroke-linecap="round" stroke-dasharray="1.1 1">`
      + `<path d="M-4 16 Q0 18 3.9 15.5"/><path d="M-3.9 19 Q0 21.4 3.8 18.6"/><path d="M-3.8 22.5 Q0 24.8 3.7 22"/>`
      + `</g>`
      // taches de sang sur la main/avant-bras
      + `<g stroke="none"><circle cx="-2" cy="26" r="1.1" fill="#8f2b27"/><circle cx="1.6" cy="9" r="0.9" fill="#9c2f29"/></g>`
      + `</g>`,
    // jambes de CHAIR + pantalon charbon, ourlet de fourrure et tige de botte gris-bleu.
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-4.6 0 Q-5 20 -4 38 L4 38 Q5 20 4.6 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-3 2 Q-3.4 20 -2.8 36" fill="none" stroke="@vet1H" stroke-width="0.5" opacity="0.4"/>`
        + `<path d="M-4.5 33 Q0 35 4.5 33 L4.7 40 Q0 42 -4.7 40 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.5"/>`
        + `<g stroke="@fourrureO" stroke-width="0.4" fill="none" opacity="0.6"><path d="M-3.5 34.5 L-3.8 39.5"/><path d="M-1.2 34.8 L-1.3 40.2"/><path d="M1.2 34.8 L1.3 40.2"/><path d="M3.5 34.5 L3.8 39.5"/></g>`
        + `<path d="M-4.6 39.5 Q0 41.5 4.6 39.5 L4.4 50 L-4.4 50 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M-3 41 Q-3.3 46 -3 49.5" fill="none" stroke="@vet2H" stroke-width="0.5" opacity="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 0 Q-4.2 7 -3.6 13 L-3.6 13 Q-4.4 26 -2.8 50 L4.2 50 Q4.8 26 3.8 13 Q4.4 7 3.6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-3.6 0 Q-4.4 20 -3.4 38 L4 38 Q4.6 20 3.8 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-4 18 Q-5 22 -2.6 26 Q2.6 27 4.4 23 Q5 19 3 16 Q0 17 -4 18 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.5" opacity="0.4"/>`
        + `<path d="M-3.6 33 Q0 35 4 33 L4.2 40 Q0 42 -3.4 40 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.5"/>`
        + `<g stroke="@fourrureO" stroke-width="0.4" fill="none" opacity="0.6"><path d="M-2.6 34.5 L-2.8 39.5"/><path d="M0.6 34.6 L0.5 40"/><path d="M3 34.4 L3.2 39.4"/></g>`
        + `<path d="M-3.4 39.5 Q0 41.5 4 39.5 L4 50 L-2.8 50 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.4 0 Q-4.8 26 -3 50 L3.8 50 Q4.6 26 4.4 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-4.4 0 Q-4.8 20 -3.8 38 L3.8 38 Q4.6 20 4.4 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-0.6 6 Q-2 22 -0.8 36" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-4.3 33 Q0 35 4.3 33 L4.5 40 Q0 42 -4.5 40 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.5"/>`
        + `<g stroke="@fourrureO" stroke-width="0.4" fill="none" opacity="0.6"><path d="M-3.3 34.5 L-3.6 39.5"/><path d="M-1 34.8 L-1.1 40.2"/><path d="M1 34.8 L1.1 40.2"/><path d="M3.3 34.5 L3.6 39.5"/></g>`
        + `<path d="M-4.4 39.5 Q0 41.5 4.4 39.5 L4.2 50 L-4.2 50 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M-3.4 46 L3.4 46" stroke="@vet2O" stroke-width="0.6" fill="none"/>`
        + `</g>`,
    },
  },
};

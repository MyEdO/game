import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Patrouilleur des karak (ADE I 07 l.17-19, l.138-154) — ranger nain des routes souterraines et
// des cols entre forteresses-karaks : casque d'acier arrondi à emblème gravé, lourd manteau
// matelassé CRÈME à grande pèlerine d'épaule (liseré bleu clair cousu, médaillons-crânes, grand
// rond de nœuds nains au ventre), ceinture de cuir + sacoche de hanche, rouleau de couchage bleu
// sanglé sur l'épaule, brassards d'acier, braies sombres à genouillère de métal, grosses bottes de
// cuir renforcées à bout d'acier. Barbe = trait d'espèce (rig), hors tenue. Hache/piolet = EN MAIN.
export const tenue: TenueDef = {
  label: 'Patrouilleur des karak',
  id: "patrouilleur-des-karak",
  palette: {
    metal: '#8b97a6', metalO: '#2c333d', metalH: '#c4cfdc',
    vet1: '#e8e0cb', vet1O: '#a89d78', vet1H: '#f5f1e4',
    vet2: '#5fa8ce', vet2O: '#2b6b8f', vet2H: '#a4d4ea',
    cuir: '#6b4a2b', cuirO: '#3a2513', cuirH: '#8f6838',
    braie: '#4a4640', braieO: '#2a2722', braieH: '#5f5a50',
    os: '#dcd4bd', 
  },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      // FACE — manteau crème matelassé, pèlerine d'épaule à liseré bleu + crânes, rond de nœuds
      // nains au ventre, ceinture + sacoche de hanche, rouleau de couchage sanglé sur l'épaule G.
      front: `<g stroke-linejoin="round">`
        + `<path d="M-14 -27 Q0 -32 14 -27 L13 4 L11 35 Q0 39 -11 35 L-13 4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-14 -27 Q-7 -31 0 -30 L0 37 Q-6 38 -11 35 L-13 4 Z" fill="@vet1H" opacity="0.4"/>`
        + `<path d="M7 -30 Q11 -4 9 35 L11 35 Q13 6 14 -27 Z" fill="@vet1O" opacity="0.4"/>`
        + `<g stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.5"><path d="M-6 -6 Q-6.6 14 -6 32"/><path d="M0 -6 Q0 14 0 34"/><path d="M6 -6 Q6.6 14 6 32"/></g>`
        // ceinture de cuir + boucle d'acier
        + `<path d="M-12.4 14 Q0 18 12.4 14 L12 20.5 Q0 24.5 -12 20.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-12 15.6 Q0 19.4 12 15.6" fill="none" stroke="@cuirH" stroke-width="0.5" opacity="0.6"/>`
        + `<rect x="-2.6" y="15.8" width="5.2" height="4.6" rx="0.7" fill="@metal" stroke="@metalO" stroke-width="0.5"/><rect x="-1.2" y="17" width="2.4" height="2.2" fill="@cuirO"/>`
        // sacoche de hanche (flanc gauche)
        + `<g stroke="@cuirO" stroke-width="0.6"><path d="M-13.6 20 Q-6.6 19 -6.2 22.5 Q-5.6 28 -7.2 32 Q-10 33.6 -12.8 32 Q-14.4 28 -14 22.5 Q-13.8 20.8 -13.6 20 Z" fill="@cuir"/><path d="M-13.8 20.4 Q-10 18.6 -6.4 20.6 L-6.8 25 Q-10 27 -13.4 25 Z" fill="@cuirH"/><path d="M-10.8 19.4 Q-10 18 -9.2 19.4 L-9.4 22 L-10.6 22 Z" fill="@cuirO"/></g>`
        // grand rond de nœuds nains (médaillon d'acier, ventre)
        + `<circle cx="0" cy="6.5" r="5.6" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<circle cx="0" cy="6.5" r="5.6" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.5"/>`
        + `<g fill="none" stroke="@metalO" stroke-width="0.9"><circle cx="0" cy="4.7" r="2.3"/><circle cx="-1.6" cy="7.4" r="2.3"/><circle cx="1.6" cy="7.4" r="2.3"/></g>`
        + `<g fill="none" stroke="@metalH" stroke-width="0.4" opacity="0.6"><circle cx="0" cy="4.7" r="2.3"/><circle cx="-1.6" cy="7.4" r="2.3"/><circle cx="1.6" cy="7.4" r="2.3"/></g>`
        // grande pèlerine d'épaule crème + liseré bleu cousu
        + `<path d="M-16 -24 Q0 -31 16 -24 Q19 -14 15.5 -3 Q8 1 0 1 Q-8 1 -15.5 -3 Q-19 -14 -16 -24 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-16 -24 Q-7 -30 0 -30 L0 1 Q-8 1 -15.5 -3 Q-19 -14 -16 -24 Z" fill="@vet1H" opacity="0.45"/>`
        + `<path d="M4 -29 Q9 -22 10 -12 Q11 -4 8.5 0.6 L15.5 -3 Q19 -14 16 -24 Q10 -28 4 -29 Z" fill="@vet1O" opacity="0.35"/>`
        + `<path d="M-15.5 -3 Q0 2 15.5 -3" fill="none" stroke="@vet2" stroke-width="1.5"/>`
        + `<path d="M-15 -4.2 Q0 0.8 15 -4.2" fill="none" stroke="@vet2H" stroke-width="0.5" opacity="0.7"/>`
        + `<g stroke="@vet2O" stroke-width="0.5" opacity="0.75"><path d="M-11 -2.6 l-0.5 1.5"/><path d="M-6 -1 l-0.3 1.6"/><path d="M0 -0.4 l0 1.7"/><path d="M6 -1 l0.3 1.6"/><path d="M11 -2.6 l0.5 1.5"/></g>`
        // col roulé de la pèlerine
        + `<path d="M-6 -26 Q0 -30 6 -26 Q7.5 -22 4 -20.5 Q0 -22.5 -4 -20.5 Q-7.5 -22 -6 -26 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.6"/>`
        // 2 médaillons-crânes sur la pèlerine (flanc droit) — contour sombre pour lire sur le crème
        + `<g stroke="@cuirO" stroke-width="0.45" fill="@os"><g transform="translate(6,-12.5)"><path d="M-1.9 0.7 Q-2.4 -2.4 0 -2.6 Q2.4 -2.4 1.9 0.7 Q1.1 2.2 0 1.9 Q-1.1 2.2 -1.9 0.7 Z"/><circle cx="-0.85" cy="-0.6" r="0.58" fill="@cuirO"/><circle cx="0.85" cy="-0.6" r="0.58" fill="@cuirO"/><path d="M-0.7 1.25 L0.7 1.25" stroke-width="0.4"/></g><g transform="translate(8.4,-8)"><path d="M-1.7 0.6 Q-2.1 -2.1 0 -2.3 Q2.1 -2.1 1.7 0.6 Q1 2 0 1.6 Q-1 2 -1.7 0.6 Z"/><circle cx="-0.75" cy="-0.5" r="0.52" fill="@cuirO"/><circle cx="0.75" cy="-0.5" r="0.52" fill="@cuirO"/><path d="M-0.6 1.1 L0.6 1.1" stroke-width="0.38"/></g></g>`
        // rouleau de couchage sanglé sur l'épaule gauche
        + `<g stroke="@vet2O" stroke-width="0.7"><path d="M-18 -24.5 Q-19 -20 -16.2 -17.5 L-8.5 -15.5 Q-6.4 -18.5 -7.6 -23 Q-13 -25.5 -18 -24.5 Z" fill="@vet2"/><path d="M-16.6 -23.4 L-8.6 -20.8" fill="none" stroke="@vet2H" stroke-width="0.8" opacity="0.6"/><ellipse cx="-8.8" cy="-18" rx="1.9" ry="3.1" fill="@vet2H" transform="rotate(22 -8.8 -18)"/><path d="M-8.8 -20.4 Q-6.9 -18 -8.8 -15.6 Q-10.7 -18 -8.8 -20.4" fill="none" stroke="@vet2O" stroke-width="0.5"/></g>`
        + `<g stroke="@cuir" stroke-width="0.9"><path d="M-14.6 -25 L-13.2 -17.8"/><path d="M-10.8 -24 L-9.4 -16.6"/></g>`
        + `</g>`,
      // DOS — manteau fermé, couture centrale, pèlerine couvrant le haut du dos, rouleau en travers.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-14 -27 Q0 -32 14 -27 L13 4 L11 35 Q0 39 -11 35 L-13 4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 -29 L0 37" fill="none" stroke="@vet1O" stroke-width="1" opacity="0.7"/>`
        + `<path d="M-13 -25 Q0 -29 13 -25 L12.6 -19 Q0 -23 -12.6 -19 Z" fill="@vet1H" opacity="0.35"/>`
        + `<g stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.5"><path d="M-6 -6 Q-6.6 14 -6 32"/><path d="M6 -6 Q6.6 14 6 32"/></g>`
        + `<path d="M-12.4 14 Q0 18 12.4 14 L12 20.5 Q0 24.5 -12 20.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-12 17.4 Q0 21 12 17.4" fill="none" stroke="@cuirO" stroke-width="0.5" opacity="0.6"/>`
        // pèlerine (dos)
        + `<path d="M-16 -24 Q0 -31 16 -24 Q18 -10 15 3 Q0 8 -15 3 Q-18 -10 -16 -24 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 -29 L0 6" fill="none" stroke="@vet1O" stroke-width="0.9" opacity="0.6"/>`
        + `<path d="M-15 3 Q0 8 15 3" fill="none" stroke="@vet2" stroke-width="1.5"/>`
        + `<path d="M-14.6 1.8 Q0 6.8 14.6 1.8" fill="none" stroke="@vet2H" stroke-width="0.5" opacity="0.7"/>`
        + `<g stroke="@vet2O" stroke-width="0.5" opacity="0.75"><path d="M-10 3 l-0.4 1.6"/><path d="M-5 4.6 l-0.2 1.7"/><path d="M0 5.2 l0 1.8"/><path d="M5 4.6 l0.2 1.7"/><path d="M10 3 l0.4 1.6"/></g>`
        // rouleau sanglé en travers du dos (épaule G -> hanche D)
        + `<g stroke="@vet2O" stroke-width="0.7"><path d="M-15 -20 Q-17 -18 -16 -15 L10 6 Q12 4 11 1 Z" fill="@vet2"/><path d="M-14.4 -18.4 L10.4 3.2" fill="none" stroke="@vet2H" stroke-width="0.8" opacity="0.55"/></g>`
        + `<g stroke="@cuir" stroke-width="0.9" opacity="0.9"><path d="M-8 -14 L-6.5 -8 M2 -4 L3.5 2"/></g>`
        + `</g>`,
      // PROFIL — buste étroit, pèlerine balayée en arrière, ceinture + sacoche, rouleau derrière l'épaule.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-6 -27 Q3 -31 8 -26 Q9 4 7 35 Q0 39 -6 35 Q-7 4 -6 -27 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-6 -27 Q0 -30 3 -30 L3 36 Q-2 37 -6 35 Q-7 4 -6 -27 Z" fill="@vet1H" opacity="0.4"/>`
        + `<path d="M4.6 -25 Q6 4 4.6 34" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        // ceinture + boucle (avant)
        + `<path d="M-6 14 Q1 17.5 8 14 L7.6 20.5 Q1 24 -6 20.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<rect x="3.4" y="15.4" width="4.4" height="4.4" rx="0.6" fill="@metal" stroke="@metalO" stroke-width="0.5"/>`
        // sacoche à la hanche
        + `<g stroke="@cuirO" stroke-width="0.6"><path d="M-6.4 20 Q-11.6 19.5 -11.8 23 Q-11.4 29 -9 32 Q-6.4 32.6 -5.4 29 Q-5 24 -5.6 20.6 Z" fill="@cuir"/><path d="M-6.2 20.4 Q-9.4 19.4 -11.6 21.6 L-11.4 25.6 Q-9 27 -6 25.6 Z" fill="@cuirH"/></g>`
        // pèlerine (profil : cape sur l'épaule, balayée en arrière)
        + `<path d="M2 -27 Q8 -30 8.5 -24 Q9 -14 6 -3 L-4 -2 Q-9 -6 -10 -16 Q-10.5 -24 -6 -27 Q-2 -29 2 -27 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-10 -16 Q-9 -6 -4 -2 L-4.5 -6 Q-8 -10 -8 -18 Z" fill="@vet1O" opacity="0.4"/>`
        + `<path d="M6 -3 Q1 1 -4 -2 Q-9 -6 -10 -16" fill="none" stroke="@vet2" stroke-width="1.4"/>`
        // rouleau de couchage derrière l'épaule
        + `<g stroke="@vet2O" stroke-width="0.7"><path d="M-8.5 -24 Q-12 -23 -12 -19 Q-11.5 -16 -8.5 -16.5 Q-6.5 -20 -8.5 -24 Z" fill="@vet2"/><ellipse cx="-10.4" cy="-20" rx="1.7" ry="2.9" fill="@vet2H" transform="rotate(-8 -10.4 -20)"/><path d="M-10.4 -22.2 Q-8.7 -20 -10.4 -17.8 Q-12.1 -20 -10.4 -22.2" fill="none" stroke="@vet2O" stroke-width="0.5"/></g>`
        + `<path d="M-9.6 -23.4 L-8.8 -16.8" stroke="@cuir" stroke-width="0.9" fill="none"/>`
        + `</g>`,
    },
    jambes: {
      // FACE — braies sombres, genouillère d'acier, tige de cuir sanglée, pied à bout d'acier.
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.8 0 Q-5.4 12 -4.8 24 L4.8 24 Q5.4 12 4.8 0 Z" fill="@braie" stroke="@braieO" stroke-width="0.8"/>`
        + `<path d="M-2.4 1 Q-2.8 12 -2.4 23" fill="none" stroke="@braieH" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M2.4 1 Q2.8 12 2.4 23" fill="none" stroke="@braieO" stroke-width="0.6" opacity="0.55"/>`
        // genouillère de métal
        + `<path d="M-4.8 12.5 Q0 10.4 4.8 12.5 Q5.6 16.2 4.4 20 Q0 22 -4.4 20 Q-5.6 16.2 -4.8 12.5 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-3.6 14 Q0 12.4 3.6 14" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.7"/>`
        + `<circle cx="0" cy="16.6" r="1" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        // haut de botte matelassé + tige de cuir
        + `<path d="M-4.6 19.5 Q0 21.5 4.6 19.5 L4.8 24 Q0 26 -4.8 24 Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4.8 23.5 Q0 25.5 4.8 23.5 L4.6 37 Q0 39 -4.6 37 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        // sangles à boucle
        + `<path d="M-4.7 28 Q0 30 4.7 28 M-4.8 33 Q0 35 4.8 33" fill="none" stroke="@cuirO" stroke-width="1.4"/>`
        + `<rect x="-1" y="27.4" width="2" height="1.8" rx="0.3" fill="@metal" stroke="@metalO" stroke-width="0.3"/>`
        + `<rect x="-1" y="32.4" width="2" height="1.8" rx="0.3" fill="@metal" stroke="@metalO" stroke-width="0.3"/>`
        // pied + bout de métal
        + `<path d="M-4.6 36 Q0 38 4.6 36 L5 44 Q4.8 48 3.6 49 L-3.6 49 Q-4.8 48 -5 44 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.4 44 Q0 46.5 4.4 44 L4.6 46.5 Q0 49 -4.6 46.5 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-3.4 45 Q0 47 3.4 45" fill="none" stroke="@metalH" stroke-width="0.4" opacity="0.6"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.8 0 Q-5.4 12 -4.8 24 L4.8 24 Q5.4 12 4.8 0 Z" fill="@braie" stroke="@braieO" stroke-width="0.8"/>`
        + `<path d="M0 1 Q-0.4 12 0 24" fill="none" stroke="@braieO" stroke-width="0.7" opacity="0.5"/>`
        + `<path d="M-4.6 19.5 Q0 21.5 4.6 19.5 L4.8 24 Q0 26 -4.8 24 Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4.8 23.5 Q0 25.5 4.8 23.5 L4.6 37 Q0 39 -4.6 37 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.7 28 Q0 30 4.7 28 M-4.8 33 Q0 35 4.8 33" fill="none" stroke="@cuirO" stroke-width="1.3"/>`
        + `<path d="M-4.6 36 Q0 38 4.6 36 L4.8 46 Q0 48 -4.8 46 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.6 41 Q0 43 4.6 41" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.6"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4 0 Q-4.8 12 -4 24 L4.4 24 Q5 12 4.2 0 Z" fill="@braie" stroke="@braieO" stroke-width="0.8"/>`
        + `<path d="M0.4 1 Q0 12 0.4 23" fill="none" stroke="@braieH" stroke-width="0.6" opacity="0.5"/>`
        // genouillère (avant du genou)
        + `<path d="M-3.6 12.5 Q1 10.4 4.8 12.8 Q5.6 16.4 4.4 20 Q0.4 22 -3.2 20 Q-4 16.4 -3.6 12.5 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-2.4 14 Q1 12.6 4 14.4" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.7"/>`
        + `<path d="M-4 19.5 Q0.4 21.5 4.4 19.5 L4.6 24 Q0.4 26 -4 24 Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4.2 23.5 Q0.4 25.5 4.4 23.5 L4.2 37 Q0.4 39 -4.2 37 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.2 28 Q0.4 30 4.4 28 M-4.2 33 Q0.4 35 4.4 33" fill="none" stroke="@cuirO" stroke-width="1.3"/>`
        // pied : talon à l'arrière (-x), bout d'acier à l'avant (+x)
        + `<path d="M-4.2 36 Q0.4 38 4.2 36 L6 44 Q6 48 4.6 49 L-3.6 49 Q-4.6 47 -4.4 43 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M2.6 44 Q4.4 45.6 6 44 L6 46.6 Q4.4 48.6 2.4 47 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>`
        + `</g>`,
    },
    // BRAS — manche crème (épaulette + coude), brassard d'acier à l'avant-bras, poignet bleu.
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q5.8 1 4.6 4 Q0 2 -4.6 4 Q-5.8 1 -5 -2 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-4.6 -1 Q-6 6 -4.8 13 L4.8 13 Q6 6 4.6 -1 Q0 -3 -4.6 -1 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2.6 0 Q-3.2 6 -2.6 12" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.5"/>`
        // brassard d'acier (avant-bras)
        + `<path d="M-4.8 12.4 Q0 15 4.8 12.4 L4.4 16 Q0 18 -4.4 16 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-4.4 15.6 Q0 17.6 4.4 15.6 L4 25.5 Q0 27.5 -4 25.5 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-4 19 Q0 21 4 19 M-3.9 22.5 Q0 24.5 3.9 22.5" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.7"/>`
        + `<path d="M-3.6 16.4 Q0 14.6 3.6 16.4" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.6"/>`
        // poignet bleu
        + `<path d="M-4 25.4 Q0 27.4 4 25.4 L3.8 29 Q0 30.6 -3.8 29 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q5.8 1 4.6 4 Q0 2 -4.6 4 Q-5.8 1 -5 -2 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-4.6 -1 Q-6 6 -4.8 13 L4.8 13 Q6 6 4.6 -1 Q0 -3 -4.6 -1 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 -2 Q0 6 0 12" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.4"/>`
        + `<path d="M-4.4 12.4 Q0 15 4.4 12.4 L4 25.5 Q0 27.5 -4 25.5 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-4.2 18 Q0 20 4.2 18 M-4 22 Q0 24 4 22" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.7"/>`
        + `<path d="M-4 25.4 Q0 27.4 4 25.4 L3.8 29 Q0 30.6 -3.8 29 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 -2 Q0 -5 4.6 -2 Q5.4 1 4.2 4 Q0 2 -4.2 4 Q-5.4 1 -4.6 -2 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-4.2 -1 Q-5.4 6 -4.4 13 L4.4 13 Q5.4 6 4.2 -1 Q0 -3 -4.2 -1 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 0 Q-0.4 6 0 12" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.5"/>`
        + `<path d="M-4.4 12.4 Q0 15 4.4 12.4 L4 25.5 Q0 27.5 -4 25.5 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-4.2 18 Q0 20 4.2 18 M-4 22 Q0 24 4 22" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.7"/>`
        + `<path d="M-3.4 16 Q0 14.4 3.4 16" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-4 25.4 Q0 27.4 4 25.4 L3.8 29 Q0 30.6 -3.8 29 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `</g>`,
    },
    // TÊTE — casque d'acier arrondi (dôme + rebord frontal + couvre-oreilles), emblème gravé au
    // front. Le visage nain et la barbe (trait d'espèce) passent SOUS le casque via composeRig.
    tete: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-10 -1 Q-11.4 -12 -3 -15.5 Q0 -16.6 3 -15.5 Q11.4 -12 10 -1 Q0 -5 -10 -1 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-9 -2 Q-10 -11 -2.6 -14 Q0 -12 -1 -3 Q-5 -4 -9 -2 Z" fill="@metalH" opacity="0.35"/>`
        // bandeau/rebord frontal
        + `<path d="M-10 -1.4 Q0 -5 10 -1.4 Q10.6 1 9 2.6 Q0 -1 -9 2.6 Q-10.6 1 -10 -1.4 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M-9.2 -1 Q0 -4.4 9.2 -1" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.6"/>`
        // couvre-oreilles latéraux
        + `<path d="M-10 -1.4 Q-11 3 -8.6 5.4 Q-6.6 4 -7 0.4 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M10 -1.4 Q11 3 8.6 5.4 Q6.6 4 7 0.4 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        // emblème gravé (croix à empattements) au front
        + `<g stroke="@metalO" stroke-width="0.8" fill="none" stroke-linecap="round"><path d="M0 -13 L0 -4.5"/><path d="M-3 -10.4 L3 -10.4"/><path d="M-1.5 -13 L1.5 -13"/><path d="M-2 -4.5 L2 -4.5"/></g>`
        + `<g stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.6"><path d="M0.3 -12.6 L0.3 -4.9"/><path d="M-2.6 -10.1 L2.6 -10.1"/></g>`
        // rivets
        + `<circle cx="-8" cy="-0.6" r="0.6" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="8" cy="-0.6" r="0.6" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-10 0 Q-11.4 -12 -3 -15.5 Q0 -16.6 3 -15.5 Q11.4 -12 10 0 Q0 4 -10 0 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M0 -15 Q0.4 -6 0 3" fill="none" stroke="@metalO" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-8.6 -12 Q0 -15 8.6 -12" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.5"/>`
        // couvre-nuque
        + `<path d="M-9 -0.5 Q0 3.5 9 -0.5 Q9.4 4 7.2 6.6 Q0 3.4 -7.2 6.6 Q-9.4 4 -9 -0.5 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<circle cx="-7" cy="-2" r="0.6" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="7" cy="-2" r="0.6" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-8 -0.5 Q-9 -12 -1 -15.4 Q4 -16.4 7 -12 Q8.6 -6 8 -0.5 Q0 -4 -8 -0.5 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-6.6 -2 Q-7.6 -11 -0.6 -13.6 Q2 -11 1 -3 Q-3 -4 -6.6 -2 Z" fill="@metalH" opacity="0.3"/>`
        // rebord frontal (+x) + couvre-nuque (-x)
        + `<path d="M-8 -0.8 Q0 -4 8 -0.8 Q8.4 1.4 6.6 3 Q0 -0.4 -6.6 3 Q-8.4 1.4 -8 -0.8 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        // couvre-oreille (près)
        + `<path d="M-0.6 0.4 Q-1 4.6 1.6 6.2 Q3.4 4.6 2.6 1 Q1 -0.6 -0.6 0.4 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        // emblème gravé (profil, côté)
        + `<g stroke="@metalO" stroke-width="0.7" fill="none"><path d="M3.4 -11.5 L3.4 -5"/><path d="M1 -8.4 L5.6 -8.4"/></g>`
        + `<circle cx="-5.4" cy="-1" r="0.6" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        + `</g>`,
    },
  },
};

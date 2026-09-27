import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Mangeur d'hommes (ADE II 02 l.855-901) — ogre mercenaire errant : « ils conservent toujours
// leur massue et leur PANSIÈRE bien-aimées » (l.861). D'après l'illustration ADE II 2 p.35 : grosse
// PANSIÈRE RONDE bombée (jante de bronze, champ d'acier, bosse-museau de bête au centre, rivets),
// épaulière d'or cannelée + dôme clouté, baudrier de cuir en travers, pendentif-clochette d'or,
// pagne en loques bordeaux + jambières rayées or/vert criardes. Le corps (panse, tête d'ogre) vit
// sur la race ; la tenue ne pose QUE l'équipement. Distincte de l'Ogre générique (plaque
// rectangulaire, peaux) : la pansière ronde à museau est la signature du Mangeur d'hommes.
export const tenue: TenueDef = {
  label: "Mangeur d'hommes",
  id: "mangeur-d-hommes",
  palette: {
    metal: '#8b94a6', metalO: '#454c58', metalH: '#b9c0cc',
    or: '#c39a3a', orO: '#7d6018', orH: '#e6c766',
    cuir: '#4a3320', cuirH: '#6a4c2e',
    vet1: '#7c413b', vet1O: '#48231f', // pagne bordeaux en loques
    vet2: '#43563a', // rayure olive des jambières
  },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      // FACE : chair pansue + pagne bordeaux (sous la plaque) + baudrier + PANSIÈRE ronde à museau + clochette
      front: `<g stroke-linejoin="round">`
        + `<path d="M-13 -28 Q0 -32 13 -28 L13 2 Q15 18 11 34 Q0 39 -11 34 Q-15 18 -13 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M-9 -20 Q0 -15 9 -20" stroke="@peauO" stroke-width="0.6" fill="none" opacity="0.5"/>`
        + `<path d="M0 -24 L0 -7" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.35"/>`
        + `<g stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.4"><path d="M-4 -18 Q-3 -14 -4 -10"/><path d="M3.5 -17 Q4.5 -13 3.5 -9"/><path d="M-8 -8 L-6.5 -5"/></g>`
        // pagne en loques (derrière la pansière, tucké sous elle), bas du torse
        + `<path d="M-11 24 Q0 27 11 24 L12 38 L10.4 46 L8.6 40 L6.6 47 L4.4 41 L2.2 47.5 L0 41.5 L-2.2 47.5 L-4.4 41 L-6.6 47 L-8.6 40 L-10.4 46 L-12 38 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<g stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.6"><path d="M-6 27 L-6.6 44"/><path d="M0 28 L0 45"/><path d="M6 27 L6.6 44"/></g>`
        + `<path d="M-3 30.5 L-3.2 42" stroke="@or" stroke-width="0.8" opacity="0.7"/><path d="M3.4 30.5 L3.6 43" stroke="@vet2" stroke-width="0.9" opacity="0.7"/>`
        // baudrier de cuir en travers
        + `<path d="M-12.5 -22 L11 16" stroke="@cuir" stroke-width="2.8" stroke-linecap="round"/>`
        + `<path d="M-12.5 -22 L11 16" stroke="@cuirH" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>`
        + `<rect x="-9.2" y="-14.4" width="5" height="4" rx="0.8" fill="@metal" stroke="@metalO" stroke-width="0.5" transform="rotate(28 -6.7 -12.4)"/>`
        // PANSIÈRE ronde bombée (couvre la panse)
        + `<circle cx="0" cy="13" r="14" fill="@or" stroke="@orO" stroke-width="0.9"/>`
        + `<circle cx="0" cy="13" r="12.6" fill="none" stroke="@orH" stroke-width="0.5" opacity="0.6"/>`
        + `<circle cx="0" cy="13" r="11.2" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M-9 6.5 Q-2 2.6 6.5 4.8" stroke="@metalH" stroke-width="1.2" fill="none" opacity="0.5"/>`
        + `<path d="M-8.5 21.5 Q0 24.5 8.5 21.5" stroke="@metalO" stroke-width="1.4" fill="none" opacity="0.4"/>`
        + `<g fill="@orH" stroke="@orO" stroke-width="0.4"><circle cx="13.4" cy="10" r="1.15"/><circle cx="11" cy="20.5" r="1.15"/><circle cx="0" cy="25.6" r="1.15"/><circle cx="-11" cy="20.5" r="1.15"/><circle cx="-13.4" cy="10" r="1.15"/></g>`
        // bosse-museau de bête (grave, gueule tombante)
        + `<path d="M-6 10.5 Q0 8 6 10.5 Q8.2 14.5 6.4 18.6 Q3.6 22.4 0 21.8 Q-3.6 22.4 -6.4 18.6 Q-8.2 14.5 -6 10.5 Z" fill="#5c626c" stroke="#2e323a" stroke-width="0.8"/>`
        + `<path d="M-5 11 Q0 8.8 5 11" stroke="#31353d" stroke-width="1" fill="none"/>`
        + `<path d="M-4.4 12.6 Q0 10.8 4.4 12.6" stroke="#9aa0aa" stroke-width="0.6" fill="none" opacity="0.55"/>`
        + `<path d="M-2.8 15.4 Q-1.8 17.6 -0.9 16.2 M2.8 15.4 Q1.8 17.6 0.9 16.2" stroke="#1e2126" stroke-width="1.1" fill="none"/>`
        + `<path d="M-3.4 20.4 Q0 18.4 3.4 20.4" stroke="#1e2126" stroke-width="0.8" fill="none"/>`
        + `<circle cx="-6.6" cy="4.4" r="1.4" fill="@metalH" stroke="@metalO" stroke-width="0.4"/><circle cx="6.6" cy="4.4" r="1.4" fill="@metalH" stroke="@metalO" stroke-width="0.4"/>`
        // clochette d'or pendue au cou (par-dessus la pansière)
        + `<path d="M0 -8 L0 -3.4" stroke="@cuir" stroke-width="0.8"/>`
        + `<path d="M-2.3 -3.4 Q0 -5 2.3 -3.4 Q2.8 -0.4 1.7 0.8 Q0 1.4 -1.7 0.8 Q-2.8 -0.4 -2.3 -3.4 Z" fill="@or" stroke="@orO" stroke-width="0.6"/>`
        + `<path d="M-1.9 -3 Q0 -4.2 1.9 -3" stroke="@orH" stroke-width="0.5" fill="none" opacity="0.7"/>`
        + `<circle cx="0" cy="0.6" r="0.6" fill="@orO"/>`
        + `</g>`,
      // DOS : chair + baudrier + SANGLES qui tiennent la pansière (buckle central) + pagne en loques
      back: `<g stroke-linejoin="round">`
        + `<path d="M-13 -28 Q0 -32 13 -28 L13 2 Q15 18 11 34 Q0 39 -11 34 Q-15 18 -13 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M0 -26 L0 30" stroke="@peauO" stroke-width="0.7" fill="none" opacity="0.5"/>`
        + `<path d="M-8 -18 Q-4 -14 -2 -18 M8 -18 Q4 -14 2 -18" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.4"/>`
        + `<path d="M-11 24 Q0 27 11 24 L12 38 L10.4 46 L8.6 40 L6.6 47 L4.4 41 L2.2 47.5 L0 41.5 L-2.2 47.5 L-4.4 41 L-6.6 47 L-8.6 40 L-10.4 46 L-12 38 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<g stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.6"><path d="M-6 27 L-6.6 44"/><path d="M0 28 L0 45"/><path d="M6 27 L6.6 44"/></g>`
        // sangles de la pansière : ceinture + bretelles vers les épaules + boucle
        + `<path d="M-13 13 Q0 16 13 13" stroke="@cuir" stroke-width="3" fill="none" stroke-linecap="round"/>`
        + `<path d="M-7 14 L-9 -24 M7 14 L9 -24" stroke="@cuir" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
        + `<rect x="-2.8" y="10.8" width="5.6" height="5.4" rx="0.8" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<circle cx="0" cy="13.5" r="1" fill="@metalO"/>`
        + `<path d="M-12.5 -21 L11 22" stroke="@cuir" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>`
        + `</g>`,
      // PROFIL : chair pansue de profil + pansière bombée vers l'avant + baudrier + pagne
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-7 -27 Q2 -31 8 -26 L9 2 Q12 18 7 34 Q0 39 -6 33 Q-8 16 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M2 -23 Q3 -12 2.4 2" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.4"/>`
        + `<path d="M-6 24 Q1 27 8 24 L8.6 38 L7 46 L5.2 40 L3.4 47 L1.6 41 L0 47 L-1.6 41.5 L-3.4 46 L-5 40 L-6.4 45 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<g stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.6"><path d="M-2 27 L-2 44"/><path d="M3 27 L3 43"/></g>`
        + `<path d="M-6 -22 L7 14" stroke="@cuir" stroke-width="2.6" stroke-linecap="round"/>`
        + `<path d="M-6 -22 L7 14" stroke="@cuirH" stroke-width="0.6" stroke-linecap="round" opacity="0.5"/>`
        + `<path d="M5.5 -8.5 L5.5 -4.8" stroke="@cuir" stroke-width="0.7"/>`
        + `<path d="M3.7 -4.8 Q5.5 -6.2 7.3 -4.8 Q7.6 -2.2 6.6 -1.3 Q5.5 -0.8 4.4 -1.3 Q3.4 -2.2 3.7 -4.8 Z" fill="@or" stroke="@orO" stroke-width="0.5"/>`
        // pansière bombée en avant (couvre la panse de profil)
        + `<ellipse cx="7.6" cy="13" rx="7.2" ry="11" fill="@or" stroke="@orO" stroke-width="0.8"/>`
        + `<ellipse cx="8.6" cy="13" rx="5.2" ry="8.4" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M11 9.5 Q14 13 11 16.5 Q9.4 15 9.6 13 Q9.4 11 11 9.5 Z" fill="#5c626c" stroke="#2e323a" stroke-width="0.6"/>`
        + `<ellipse cx="12.6" cy="12.6" rx="0.7" ry="1.1" fill="#1e2126"/>`
        + `<path d="M9.8 6 Q12 8 12 13" stroke="@metalH" stroke-width="0.8" fill="none" opacity="0.4"/>`
        + `<g fill="@orH" stroke="@orO" stroke-width="0.35"><circle cx="6.5" cy="4.5" r="1"/><circle cx="6.5" cy="21.5" r="1"/></g>`
        + `</g>`,
    },
    // bras de chair + épaulière (dôme clouté d'acier sur cannelures d'or) + bracelet de force au poignet
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-3.4 -3 Q0 -4.8 3.4 -3 L3 27 Q0 28.6 -3 27 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `<path d="M-2.4 6 L-2.2 22" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.35"/>`
      // cannelures d'or (débordent sous le dôme)
      + `<path d="M-6 -3 Q0 -6.5 6 -3 L5.2 6 Q0 8 -5.2 6 Z" fill="@or" stroke="@orO" stroke-width="0.6"/>`
      + `<g stroke="@orO" stroke-width="0.5" fill="none" opacity="0.8"><path d="M-3 -4 L-3.4 5.4"/><path d="M0 -5 L0 6"/><path d="M3 -4 L3.4 5.4"/></g>`
      + `<path d="M-5.4 -2.5 Q0 -5.4 5.4 -2.5" stroke="@orH" stroke-width="0.5" fill="none" opacity="0.7"/>`
      // dôme clouté d'acier (épaule)
      + `<path d="M-5.6 -3.5 Q0 -8.2 5.6 -3.5 Q6.4 1 5 4 Q0 5.8 -5 4 Q-6.4 1 -5.6 -3.5 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
      + `<path d="M-4.8 -3 Q0 -6.6 4.8 -3" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.7"/>`
      + `<g fill="@metalO"><circle cx="-3" cy="-1.8" r="0.7"/><circle cx="3" cy="-1.8" r="0.7"/><circle cx="0" cy="0.4" r="0.8"/><circle cx="-3" cy="2.4" r="0.6"/><circle cx="3" cy="2.4" r="0.6"/></g>`
      // bracelet de force au poignet
      + `<path d="M-3.1 22 Q0 23.4 3.1 22 L3.3 26.5 Q0 28 -3.3 26.5 Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>`
      + `<circle cx="0" cy="24.3" r="0.9" fill="@metalH" stroke="@metalO" stroke-width="0.35"/>`
      + `</g>`,
    jambes: {
      // FACE : chair + jambière rayée or/vert/bordeaux (criarde), tucked
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.5 0 Q-5 26 -3 50 L4 50 Q5 26 4.5 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-4.8 20 Q0 21.6 4.8 20 L4.4 49 L-4.4 49 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-2.8 21 L-2.4 49" stroke="@or" stroke-width="1.7"/>`
        + `<path d="M0.4 21.2 L0.6 49" stroke="@vet2" stroke-width="1.9"/>`
        + `<path d="M3 20.6 L2.8 49" stroke="@orH" stroke-width="0.9" opacity="0.75"/>`
        + `<path d="M-4 22 Q0 23.4 4 22" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `</g>`,
      // DOS : chair + jambière bordeaux, rayure discrète
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.5 0 Q-5 26 -3 50 L4 50 Q5 26 4.5 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-4.8 20 Q0 21.6 4.8 20 L4.4 49 L-4.4 49 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-1.6 21 L-1.2 49" stroke="@vet2" stroke-width="1.7" opacity="0.85"/>`
        + `<path d="M2 21 L2 49" stroke="@or" stroke-width="1.2" opacity="0.7"/>`
        + `<path d="M-4 24 Q0 25.4 4 24 M-4 34 Q0 35.4 4 34" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.55"/>`
        + `</g>`,
      // PROFIL : chair + jambière rayée le long du tibia
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.6 0 Q-4.4 26 -3.4 50 L3.4 50 Q4.2 26 3.6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-3.8 20 Q0 21.4 3.8 20 L3.4 49 L-3.4 49 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-1.2 21 L-1 49" stroke="@or" stroke-width="1.6"/>`
        + `<path d="M1.6 21 L1.6 49" stroke="@vet2" stroke-width="1.7"/>`
        + `<path d="M-3.2 22.5 Q0 23.8 3.2 22.5" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `</g>`,
    },
  },
};

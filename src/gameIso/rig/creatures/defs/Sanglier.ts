import type { CreatureDef } from '../types';

// Sanglier — fidélité à l'artwork officiel (art-ref/ldb/page318_img7412.png) : robe GRIS-BRUN
// grisonnante et mouchetée (pas un brun sombre uni), tête et hure PÂLES argentées, CRÊTE de soies
// dressées en dents de scie qui court du garrot à la croupe, corps COMPACT et voûté à l'avant-train
// dominant (bosse d'épaule haute, arrière fin), pattes courtes sur petits sabots clairs.
// LDB 78 l.58-61 (Cornes (Défenses), 1m50-1m80 de long, Armure (Peau 1)).
// La crête dorsale vit en `deco.encolure` : son repère est contre-calculé sur la ligne de dos suid
// × girth, et l'os encolure ne portant d'art qu'en PROFIL, le calque n'est émis que là — les vues
// de bout restent sans crête fantôme (garde : `quad-vues-ratchet.test.ts`, « un décor visant un os
// que la vue n'émet pas ne peint rien »).
export const creature: CreatureDef = {
  label: "Sanglier",
  id: "sanglier",
  plan: 'quadruped',
  quad: {
    sl: 0.84, build: 'suid', girth: 1.42, bodyLen: 0.92, neckLen: 0.3, neckAngle: 0,
    legLen: 0.56, head: 'sanglier', headScale: 1.3, tail: 'fouet', tailLen: 0.75,
    ears: 'pointues', foot: 'sabot', mane: 'hirsute', markings: 'taches',
    deco: {
      // crête de soies dressées garrot→croupe : dents de scie @cheveux (pâles) suivant la ligne
      // de dos suid (bosse d'épaule haute à l'avant, décrue vers l'arrière-train fin)
      encolure: `<g data-deco="crete-soies">` +
        `<path d="M3 -12 L0 -26 L-3.5 -20.5 L-7 -32 L-10.5 -24 L-14 -35 L-17.5 -25.5 L-21 -34 L-24.5 -23 L-28 -29 L-31.5 -15.5 L-35 -21 L-38.5 -11.5 L-42 -15 L-45.5 -7 L-49 -10 L-52.5 -4 L-56 -6.5 L-59 -1.5 L-60 1.5 Q-45 -4 -32 -12 Q-19 -23 -12 -22.5 Q-3 -18.5 3 -8.5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5" stroke-linejoin="round"/>` +
        // racine sombre de la crête (assise dans la robe) + quelques soies détachées
        `<path d="M2 -10 Q-3 -19 -12 -23 Q-19 -23.5 -31 -13.5 Q-44 -6.5 -59 0" fill="none" stroke="@cheveuxO" stroke-width="1.1" opacity="0.55"/>` +
        `<path d="M-5 -30 l-1.6 -3.4 M-15.5 -33.5 l-1.2 -3.6 M-26 -27.5 l-1.6 -3 M-40 -13.5 l-1.8 -2.6 M-51 -8 l-1.8 -2.2" stroke="@cheveux" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>` +
        `</g>`,
      // tête pâle grisonnante (artwork : hure et chanfrein argentés) — en PROFIL, bande de chanfrein
      // ajustée au crâne : coordonnées du repère de l'ART de tête (quadAnchor), où l'œil du gabarit
      // est en (6,2) → la bande passe SOUS les oreilles et AU-DESSUS de l'œil, plus de halo fumeux
      'tete#profile': `<g data-deco="hure-pale">` +
        `<path d="M-4.734 -1.775 Q-2.959 -5.325 1.183 -5.917 Q5.325 -5.325 8.284 -2.367 Q11.243 0 13.609 3.55 Q14.201 5.325 14.201 6.509 Q11.243 4.734 8.876 2.959 Q4.734 0 1.183 -0.592 Q-2.367 -0.888 -4.734 -1.775 Z" fill="@cheveux" opacity="0.8"/>` +
        `<ellipse cx="-0.592" cy="-3.55" rx="3.846" ry="2.071" fill="@cheveux" opacity="0.6"/>` +
        `<path d="M2.367 -2.959 Q5.917 -1.183 8.876 1.183 Q11.243 2.959 13.018 4.734" fill="none" stroke="@corpsH" stroke-width="0.828" opacity="0.5"/>` +
        `<path d="M-2.367 -3.55 l-0.592 -1.775 M0.592 -4.734 l0.118 -1.893 M3.55 -4.438 l0.592 -1.775 M6.509 -2.959 l0.828 -1.538 M9.467 -0.592 l0.947 -1.302" stroke="@cheveux" stroke-width="0.592" stroke-linecap="round" opacity="0.85"/>` +
        `</g>`,
      // face/dos : lavis centré doux (têtes symétriques, pas de chanfrein visible)
      'tete#front': `<g data-deco="grison"><ellipse cx="0" cy="-4.615" rx="6.923" ry="4.231" fill="@cheveux" opacity="0.6"/><path d="M-3.077 -6.923 l-0.923 -2.308 M0 -7.692 l0 -2.462 M3.077 -7.308 l0.769 -2.308" stroke="@cheveux" stroke-width="0.769" stroke-linecap="round" opacity="0.85"/></g>`,
      'tete#back': `<g data-deco="grison"><ellipse cx="0" cy="-4.615" rx="6.923" ry="4.231" fill="@cheveux" opacity="0.6"/></g>`,
      // robe contrastée (artwork : avant-train grisonnant pâle qui dévale vers un arrière-train
      // sombre, flanc moucheté) — repère local du tronc suid, bodyLen 0.92 → x∈[-40,30]
      'tronc#profile': `<g data-deco="robe-grisonnante">` +
        `<path d="M-8 -17 Q3 -26 13 -24 Q22 -21 27 -14 Q29 -8 28 -3 Q20 -9 11 -13 Q1 -16 -8 -13 Z" fill="@cheveux" opacity="0.32"/>` +
        `<path d="M-19 -12 Q-31 -13 -35.5 -10 Q-40 -6 -39.5 -1 Q-40 5 -35 10 Q-30 14 -18 14 Q-22 4 -21 -4 Z" fill="@corpsO" opacity="0.28"/>` +
        `<path d="M-14 -6 l2.4 -1 M-6 -3 l2.4 -1 M2 -6 l2.4 -0.8 M10 -4 l2.4 -0.8 M-10 3 l2.4 -0.8 M0 5 l2.4 -0.8 M-20 1 l2.4 -0.8 M8 5 l2.4 -0.8 M16 -8 l2.4 -0.8" stroke="@corpsH" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>` +
        `</g>`,
    },
    palette: {
      corps: '#544b3f', corpsO: '#2c251c', corpsH: '#aea489', // robe gris-brun grisonnante, mouchetée par markings
      cheveux: '#c4b89f', cheveuxO: '#5a4f3c', // soies PÂLES argentées (crête, hure, épi de nuque)
      cuir: '#96907e', // petits sabots clairs (l'artwork montre des pinces blanchâtres)
    },
  },
};

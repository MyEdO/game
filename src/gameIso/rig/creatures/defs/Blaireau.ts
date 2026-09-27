import type { CreatureDef } from '../types';

// Blaireau (européen, Meles meles — monture Taille Moyenne du Moot, pas d'illustration LDB :
// calé sur l'animal réel) : silhouette BASSE et RAMASSÉE (corps trapu allongé qui s'élargit
// vers l'arrière, pattes courtes et puissantes, dos voûté), port de tête bas (museau vers le
// sol), petite tête à museau court, petites oreilles rondes, queue courte. Robe : dos gris
// argenté grossier, pattes/dessous NOIRS. Build 'ursine' (masse basse sur pattes-poteaux) +
// tête 'ours' (museau court, seul mustélidé-compatible du catalogue) ; le SIGNE distinctif —
// le MASQUE facial blanc à raies noires museau→œil→oreille — est peint en `deco` PAR VUE sur
// l'os tete (couleurs littérales du masque, la robe suit les jetons @corps*).
export const creature: CreatureDef = {
  label: 'Blaireau',
  id: 'blaireau',
  plan: 'quadruped',
  quad: {
    // legLen 0.40 + girth 1.26 = ventre près du sol, masse ramassée ; neckAngle -55 (encolure
    // plongeante, tête portée BASSE devant le poitrail) — l'os tete contre-compense (rotation
    // monde constante), headPitch 0 garde le museau quasi horizontal, léger piqué.
    sl: 0.84, build: 'ursine', girth: 1.26, bodyLen: 1.05, neckLen: 0.26, neckAngle: -78, legLen: 0.4,
    head: 'ours', tail: 'courte', ears: 'rondes', foot: 'patte', mane: 'sans',
    deco: {
      // ---- MASQUE facial + museau : recouvre la tête 'ours' (gueule béante, oreilles) d'une
      // face de blaireau — blanc #ecebe6 / noir #17140f littéraux (masque, pas la robe).
      // PROFIL — repère de l'ART de tête (quadAnchor) ; rotate(6) comme headProfile 'ours'. UNE
      // raie balayée museau→œil→oreille côté proche, homologue LOINTAIN réduit à son bout
      // d'oreille en parallaxe au-dessus du crâne.
      'tete#profile': `<g transform="rotate(6)" data-deco="masque-blaireau">` +
        // face BLANCHE en coin effilé — couvre crâne + museau + TOUTE la gueule/mâchoire de base
        `<path d="M-11 -2.6 Q-12.2 -7.6 -8.2 -10.2 Q-3 -12.6 2 -11.2 Q7.4 -9.2 11.4 -5.2 L15.8 -0.6 Q16.4 0.8 15 2 Q12.6 7 7 10.4 Q1 13.6 -5 13.2 Q-10 12.6 -11.4 9.4 Q-12.6 5.6 -12 1.8 Z" fill="#ecebe6" stroke="#57534a" stroke-width="0.5"/>` +
        // menton/gorge NOIRS le long du bas de la joue (dessous sombre — couvre le débord de
        // mâchoire et les canines inférieures de la tête de base)
        `<path d="M-10.6 9 Q-5 13.2 1 14 Q8 14.8 13.2 8.6 Q14.6 6.2 12.6 4.8 Q8 8.4 2 10 Q-4 11.4 -9 8 Z" fill="#17140f"/>` +
        // raie NOIRE museau → œil → oreille (côté proche)
        `<path d="M15.6 0 Q9.4 -3.6 3.4 -5.4 Q-2.6 -7 -7.6 -6.6 L-8.2 -9.8 Q-2.6 -10.2 3.8 -8.4 Q10.4 -6.4 16 -1.6 Z" fill="#17140f"/>` +
        // homologue LOINTAIN de la paire (parallaxe) : bout d'oreille sombre au-dessus du crâne
        `<circle cx="-4.6" cy="-10.8" r="1.6" fill="#2a2620"/>` +
        // oreille ronde noire à fin liséré blanc, plantée au bout de la raie
        `<circle cx="-8" cy="-9.2" r="2.1" fill="#17140f" stroke="#ecebe6" stroke-width="0.5"/>` +
        // œil sombre DANS la raie noire
        `<circle cx="3.8" cy="-6.6" r="1.05" fill="#050403"/><circle cx="4.2" cy="-7" r="0.35" fill="#cfcabe" opacity="0.8"/>` +
        // truffe au bout du museau effilé
        `<ellipse cx="15.7" cy="0.1" rx="1.35" ry="1.1" fill="#0a0806"/>` +
        `</g>`,
      // FACE — repère : celui de l'art de tête (headFront 'ours', sans transform). Les DEUX
      // raies jumelles museau→œil→oreille sur face blanche (la raie droite = miroir scale(-1,1)).
      'tete#front': `<g data-deco="masque-blaireau">` +
        // face BLANCHE (couvre crâne + bajoues + gueule de l'ours de base)
        `<path d="M-11.6 -9.8 Q-13.6 3.8 -5.6 11.6 Q-2 14.9 0 14.9 Q2 14.9 5.6 11.6 Q13.6 3.8 11.6 -9.8 Q0 -15.2 -11.6 -9.8 Z" fill="#ecebe6" stroke="#57534a" stroke-width="0.6"/>` +
        // petites oreilles rondes noires (couvrent celles de base) — peintes AVANT la couronne :
        `<circle cx="-7.6" cy="-12.8" r="3.1" fill="#17140f" stroke="#b8b4a8" stroke-width="0.45"/>` +
        `<circle cx="7.6" cy="-12.8" r="3.1" fill="#17140f" stroke="#b8b4a8" stroke-width="0.45"/>` +
        // ... la COURONNE re-peinte PAR-DESSUS leur base → l'oreille rentre SOUS la calotte
        // (ancrée dans la silhouette du crâne, plus « lunettes perchées »)
        `<path d="M-11.6 -9.8 Q0 -15.2 11.6 -9.8 L10.6 -7.4 Q0 -12.4 -10.6 -7.4 Z" fill="#ecebe6"/>` +
        // raie noire GAUCHE : du museau, SUR l'œil, jusqu'à l'oreille — et son miroir droit
        `<path d="M-0.9 13.6 Q-2.8 5.6 -3.6 -1.8 Q-4.4 -8.4 -5.8 -12.6 L-10 -10.8 Q-8.4 -6.4 -7.4 -0.2 Q-6.4 6.4 -4.4 13 Z" fill="#17140f"/>` +
        `<g transform="scale(-1,1)"><path d="M-0.9 13.6 Q-2.8 5.6 -3.6 -1.8 Q-4.4 -8.4 -5.8 -12.6 L-10 -10.8 Q-8.4 -6.4 -7.4 -0.2 Q-6.4 6.4 -4.4 13 Z" fill="#17140f"/></g>` +
        // yeux sombres DANS les raies
        `<circle cx="-4.9" cy="-3.4" r="1.25" fill="#060504"/><circle cx="-4.5" cy="-3.8" r="0.4" fill="#cfcabe" opacity="0.8"/>` +
        `<circle cx="4.9" cy="-3.4" r="1.25" fill="#060504"/><circle cx="5.3" cy="-3.8" r="0.4" fill="#cfcabe" opacity="0.8"/>` +
        // truffe noire au bas de la bande médiane blanche + bouche fermée
        `<ellipse cx="0" cy="10.6" rx="2.1" ry="1.6" fill="#0a0806"/>` +
        `<path d="M-1.4 12.8 Q0 13.8 1.4 12.8" stroke="#3a352c" stroke-width="0.55" fill="none"/>` +
        `</g>`,
      // DOS — repère : celui de l'art de nuque (napeBack, sans transform). ARRIÈRE de crâne en
      // PELAGE (robe @corps) : AUCUN œil, AUCUN museau, AUCUNE joue blanche de face — au plus la
      // convergence DISCRÈTE des deux raies noires + la raie médiane blanche filant sur la nuque.
      'tete#back': `<g data-deco="masque-blaireau">` +
        // oreilles noires (couvrent les grandes oreilles 'ours' de base) — peintes AVANT le crâne
        `<circle cx="-8" cy="-13" r="4.4" fill="#17140f" stroke="#8a867c" stroke-width="0.5"/>` +
        `<circle cx="8" cy="-13" r="4.4" fill="#17140f" stroke="#8a867c" stroke-width="0.5"/>` +
        // ... le crâne re-peint PAR-DESSUS leur base → oreilles rentrées sous la calotte, et
        // l'ovale couvre TOUT l'art de nuque de base (shade/épi compris)
        `<path d="M-8.9 -12.4 Q-10.6 0 -5.3 9.4 Q0 13.8 5.3 9.4 Q10.6 0 8.9 -12.4 Q0 -16.6 -8.9 -12.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        // amorces des raies noires au SOMMET seulement (elles disparaissent derrière le crâne)
        `<path d="M-4.7 -13.5 Q-4.9 -10.6 -4.4 -7.6 L-2.5 -8 Q-2.9 -11 -2.8 -14 Z" fill="#17140f" opacity="0.9"/>` +
        `<path d="M4.7 -13.5 Q4.9 -10.6 4.4 -7.6 L2.5 -8 Q2.9 -11 2.8 -14 Z" fill="#17140f" opacity="0.9"/>` +
        // raie médiane BLANCHE sommet → nuque (s'estompe avant le bas du crâne)
        `<path d="M-1.2 -14.4 Q-1.6 -4 -0.9 5.6 L0.9 5.6 Q1.6 -4 1.2 -14.4 Q0 -15.2 -1.2 -14.4 Z" fill="#ecebe6" opacity="0.95"/>` +
        `</g>`,
      // ---- ROBE de profil : dos gris argenté grossier + dessous NOIR — recouvre aussi les
      // balafres de griffes héritées du tronc 'ursine + head ours' (propres à l'ours LDB).
      'tronc#profile': `<g data-deco="robe-blaireau">` +
        // patch de robe sur l'épaule (efface les balafres rouges de l'ours ; bodyLen 1.05)
        `<path d="M1 -20.5 L16 -20.5 L21.5 -8.5 L5 -7.5 Z" fill="@corps"/>` +
        // manteau dorsal ARGENTÉ grossier (garrot → croupe)
        `<path d="M-36 -14 Q-20 -20 -6 -23 Q6 -27 16 -23 Q24 -20 28 -13 L26 -6 Q14 -12 2 -15 Q-12 -17.5 -24 -14 Q-32 -11.5 -35 -8 Z" fill="@corpsH" opacity="0.5"/>` +
        // grain du pelage (mèches grossières couchées)
        `<path d="M-28 -14 q3 2.4 2.6 6 M-16 -17 q3 2.4 2.6 6 M-4 -19.5 q3 2.6 2.6 6 M8 -20 q3 2.6 2.6 6 M18 -17 q2.8 2.4 2.4 5.6" stroke="@corpsH" stroke-width="0.9" fill="none" opacity="0.5"/>` +
        // bande de flanc bas / ventre NOIRE (dessous sombre du blaireau)
        `<path d="M-42 8 Q-8 20 24 12 L26 17 Q-6 24 -43 13 Z" fill="#17140f" opacity="0.8"/>` +
        `</g>`,
      // poitrail NOIR de face (gorge + poitrine sombres entre les antérieurs)
      'tronc#front': `<path data-deco="poitrail-blaireau" d="M-10 -4 Q0 0 10 -4 Q10.5 7 5 16 Q0 20.5 -5 16 Q-10.5 7 -10 -4 Z" fill="#17140f" opacity="0.82"/>`,
    },
    palette: {
      corps: '#8f8d84', corpsO: '#3a3833', corpsH: '#c3c0b6', // dos gris argenté grossier
      cheveux: '#26231d', cheveuxO: '#141210', // touffes résiduelles sombres (barbe de gorge de base)
      cuir: '#1a1712', // pattes (griffes/coussinets) noires
    },
  },
};

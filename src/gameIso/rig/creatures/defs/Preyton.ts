import type { CreatureDef } from '../types';

// Preyton (ZI folio 60) — réf art : art-ref/zi/page063_full.png. Bête TORSE en gargouille
// ACCROUPIE : grandes ailes de chauve-souris déchiquetées portées DRESSÉES à demi-ouvertes
// (membrane + wingPose 'dressees' — elles dominent la silhouette, comme sur la gravure),
// avant-corps massif redressé (girth↑, encolure relevée neckAngle -40) sur pattes basses
// (legLen↓ = tapi), arrière-train léonin griffu (build 'feline', foot 'patte') et antérieurs
// de cerf difforme (frontFoot 'sabot'). Queue de reptile écailleuse : l'os 'reptile' file
// derrière + `deco` tronc = la BOUCLE annelée qui s'enroule au sol sous la bête (l'enroulement
// de l'artwork — le bout de queue traînant seul sortait du cadre, cf. basilic/hydre).
// Gueule bâillante à rangées de crocs et œil fendu = tête 'dragon' (seule mâchoire béante du
// vocabulaire), ramures acérées NOIRCIES (headgear 'bois' @cheveux quasi noir) sur l'épaisse
// toison hirsute d'encolure. Robe charbon-terreux de la gravure, serres couleur corne.
export const creature: CreatureDef = {
  label: 'Preyton',
  id: "preyton",
  plan: 'winged',
  quad: {
    sl: 1.1, build: 'feline', girth: 1.15, bodyLen: 0.92, neckLen: 0.7, neckAngle: -35, legLen: 0.78,
    head: 'dragon', headScale: 1.05, headgear: 'bois', ears: 'pointues',
    foot: 'patte', frontFoot: 'sabot', tail: 'reptile', tailLen: 1.25,
    wings: 'membrane', wingSpan: 1.5, wingPose: 'dressees', mane: 'hirsute', ridge: 'sans',
    deco: {
      tronc:
        `<g data-deco="queue-lovee" transform="translate(0,-8) scale(1,0.74)">` +
        `<path d="M-30 42 Q-42 49 -37 58 Q-24 65 -2 64.5 Q22 64 34 58 Q43.5 53 46.5 44 Q40 49 32 52.5 Q19 57 -2 57.5 Q-22 58 -29 53.5 Q-33 49.5 -26.5 43.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
        `<path d="M-31 46.5 q3.4 4 5 6.6 M-25.5 54.5 q1.6 3.6 2.2 6.6 M-17 56.8 q0.8 3.4 0.9 6.4 M-8 58.2 q0.4 3.2 0.4 6.2 M2 58.5 q0 3.2 -0.1 6 M12 57.7 q-0.4 3.2 -0.7 6 M22 55.7 q-0.9 3 -1.4 5.8 M31 52.3 q-1.5 2.8 -2.4 5.4 M39.5 47.5 q-2.2 2.6 -3.6 4.8" stroke="@corpsH" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.95"/>` +
        `<path d="M-30 42.6 Q-41 49 -36.6 57 Q-24 63.6 -2 63.1 Q21 62.6 33.4 56.8 Q42 51.8 45.6 44.4" stroke="@corpsH" stroke-width="0.8" fill="none" opacity="0.6"/>` +
        `<path d="M44.5 45.5 Q50 39 51 32.5 Q46 36.5 43 42.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
        `</g>`,
    },
    palette: { corps: '#3b332c', corpsO: '#171310', corpsH: '#6e6152', cheveux: '#1a1512', cheveuxO: '#0b0907', cuir: '#8a7a5e' },
  },
};

import type { CreatureDef } from '../types';

// Lion de Guerre de Chrace (ZI, artwork p.86) : grand lion PÂLE blanc-gris à crinière HÉRISSÉE
// blanche, gueule rugissante à crocs de sabre. Tête 'felin' (couronne de crinière rayonnante +
// gueule ouverte, le langage Manticore/Chimère) portée GROSSE (headScale), crinière 'hirsute'
// prolongée sur l'encolure et le dos, silhouette féline MASSIVE (girth/bodyLen hauts, membres
// ramassés = fauve tapi, pas lévrier). Robe blanc-gris froide, rehauts ivoire doré (les seules
// touches chaudes de l'artwork, sur la face), crinière blanche cernée de gris.
// Proie piétinée de l'artwork (crâne + plastron brisé sous les antérieurs) : deco du pied avant
// PROCHE, posée au sol devant/sous la patte (couleurs propres — ivoire d'os + acier — pour ne
// pas suivre la robe). Posture bondissante = `stance` (deltas de repos, profil) : avant-train
// tapi bas sur des antérieurs pliés jetés en avant, croupe haute, encolure plongeante, queue
// relevée en crosse — le port de l'artwork p.86.
const PROIE =
  `<g data-deco="crane-armure" transform="translate(2.2 -3) scale(1.35)">` +
  // plastron brisé (acier bosselé, bord déchiré)
  `<path d="M1.5 9.6 L11.5 9.4 L10.6 6.2 L8.8 6.8 L8 5.4 Q5 4.8 3 6.4 L2.6 7.8 Z" fill="#98a0a8" stroke="#4d5257" stroke-width="0.55"/>` +
  `<path d="M3.2 7.2 q3 -1.4 6.2 -0.4 M2.6 8.6 q3.6 -1 8 -0.2" stroke="#4d5257" stroke-width="0.4" fill="none" opacity="0.7"/>` +
  // crâne (calotte ivoire, orbite creuse, mâchoire)
  `<ellipse cx="5.6" cy="3.6" rx="3.3" ry="2.9" fill="#ddd5b8" stroke="#6f6852" stroke-width="0.55"/>` +
  `<path d="M3.4 4.8 L8.4 5.2 L8 6.6 L4 6.3 Z" fill="#cfc5a4" stroke="#6f6852" stroke-width="0.5"/>` +
  `<circle cx="6.9" cy="3.4" r="0.95" fill="#3a3527"/>` +
  `<path d="M4.6 6 v0.9 M5.8 6.1 v0.9 M7 6.2 v0.9" stroke="#6f6852" stroke-width="0.45"/>` +
  `</g>`;

export const creature: CreatureDef = {
  label: 'Lion de Guerre de Chrace',
  id: "lion-de-guerre-de-chrace",
  plan: 'quadruped',
  quad: {
    sl: 1.12, build: 'feline', girth: 1.18, bodyLen: 1.1, neckLen: 0.62, neckAngle: -8, legLen: 0.78,
    head: 'felin', headScale: 1.35, tail: 'leonine', tailLen: 1.3, ears: 'rondes', foot: 'patte', mane: 'hirsute',
    stance: {
      tronc: 9, croupe: -14,
      hautAvD: -30, basAvD: 26, piedAvD: -5, hautAvG: -12, basAvG: 6, piedAvG: 0,
      hautArD: 0, basArD: 4, piedArD: -4, hautArG: 2, basArG: 4, piedArG: -4,
      encolure: 14, tete: 4, queue: 160,
    },
    deco: { 'piedAvD#profile': PROIE },
    palette: {
      corps: '#d7d3c6', corpsO: '#7e7868', corpsH: '#f3ecd6', // robe pâle blanc-gris, rehaut ivoire doré (face)
      cheveux: '#eae7dc', cheveuxO: '#85887e', // crinière blanche hérissée, cernée gris froid
      cuir: '#4a463c',
    },
  },
};

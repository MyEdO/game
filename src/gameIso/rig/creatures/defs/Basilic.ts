import type { CreatureDef } from '../types';

// Basilic : grand saurien au regard mortel — calé sur l'artwork officiel LDB 79 p.319
// (art-ref/ldb/page319_img7475.png) : crête d'épines CONTINUE de la tête à la queue (pointes
// gris-sarcelle sur membrane orangée), gueule BÉANTE à crocs, yeux rouges incandescents, pattes
// musclées à GRIFFES de saurien. Quadrupède draconique : tête 'basilic' (gueule ouverte + crête),
// dorsale 'epines-continues' (qui se prolonge sur la queue 'reptile'), mane 'hirsute' en @cheveux
// (la crête sur l'encolure), pieds 'serre' (griffes longues). Robe vert-jaune venimeuse écailleuse.
export const creature: CreatureDef = {
  label: 'Basilic',
  id: "basilic",
  plan: 'quadruped',
  quad: {
    // Canon LDB 79 (l.15-16) : « créatures reptiliennes » solitaires, venimeuses, au regard
    // pétrifiant, avec Attaque caudale +8 (l.22) → corps long et profond, queue massive. Le plan
    // quadruped ne rend que 4 des 8 pattes canon — la lisibilité « reptile » prime. Membres hauts
    // et charpentés : silhouette de saurien dressé (artwork), pas de reptile trapu.
    sl: 1.25, build: 'draconic', girth: 1.12, bodyLen: 1.45, neckLen: 0.55, neckAngle: -6,
    legLen: 0.6, head: 'basilic', headScale: 1.28, tail: 'reptile', mane: 'hirsute', tailLen: 1.7,
    ears: 'courtes', foot: 'serre', ridge: 'epines-continues',
    // Robe de l'artwork : vert-jaune écailleux (+ ombre olive, reflet chartreuse), épines/crête
    // gris-sarcelle (@cheveux), serres cornées olive (@cuir).
    palette: { corps: '#7f9038', corpsO: '#414c1d', corpsH: '#b6c46a', cheveux: '#6f9598', cheveuxO: '#324b4c', cuir: '#8f7f4c' },
  },
};

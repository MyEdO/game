import type { AppendageDef } from '../types';

// Grandes cornes ivoire de chèvre balayées vers l'arrière (Gor/Ungor/Chamane).
// PROFIL : balaient haut-arrière (-x), pas en éventail L/R ; proche (claire) devant lointaine (cassée).
export const appendage: AppendageDef = {
  id: 'cornes-caprin',
  label: 'Cornes caprines',
  front: `<path d="M-6 -4 Q-12 -10 -10 -20 Q-7 -13 -3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/><path d="M6 -4 Q12 -10 10 -20 Q7 -13 3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/>`,
  profile: `<path d="M-1 -5 Q-9 -10 -12 -19 Q-7 -13 0 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/><path d="M3 -6 Q-2 -10 -5 -17 Q-1 -13 4 -8 Z" fill="#d9d0b6" stroke="#3a3026" stroke-width="0.5"/>`,
};

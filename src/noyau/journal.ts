/** Journal de la partie : son puits unique (#319, #939). */
import { fixedJetOpen, markFixedDie } from './fixedDieMark';
import type { Get, SetDesClesReservees } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';

export function creerActionsDuJournal(_get: Get, set: SetDesClesReservees) {
  return {
    // PUITS UNIQUE du journal : c'est ici — et nulle part ailleurs — qu'un jet dont le joueur a SAISI la
    // valeur laisse sa trace écrite (arbitrage #939 : marqué PARTOUT, rangée ET journal).
    log: (msg) => set((s) => {
      const lines = Array.isArray(msg) ? msg : [msg];
      return { journal: [...s.journal.slice(-40), ...(fixedJetOpen(s) ? lines.map(markFixedDie) : lines)] };
    }),
  } satisfies Partial<ActionsDuNoyau>;
}

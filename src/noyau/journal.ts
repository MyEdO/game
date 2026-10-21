/** Journal de la partie : son puits unique (#319, #939). */
import { fixedJetOpen, markFixedDie } from './fixedDieMark';
import type { Get, SetDesClesReservees } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import { bus, EVT } from './bus';

export function creerActionsDuJournal(get: Get, set: SetDesClesReservees) {
  return {
    // PUITS UNIQUE du journal : c'est ici — et nulle part ailleurs — qu'un jet dont le joueur a SAISI la
    // valeur laisse sa trace écrite (arbitrage #939 : marqué PARTOUT, rangée ET journal).
    log: (msg) => {
      const brutes = Array.isArray(msg) ? msg : [msg];
      const lignes = fixedJetOpen(get()) ? brutes.map(markFixedDie) : brutes;
      set((s) => ({ journal: [...s.journal.slice(-40), ...lignes] }));
      for (const texte of lignes) bus.emit(EVT.LIGNE_AU_JOURNAL, { texte });
    },
  } satisfies Partial<ActionsDuNoyau>;
}

/** Journal de la partie : son puits unique (#319, #939). */
import { fixedJetOpen } from './fixedDieMark';
import type { Get, SetDesClesReservees } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import { bus, EVT } from './bus';

export function creerActionsDuJournal(get: Get, set: SetDesClesReservees) {
  return {
    // PUITS UNIQUE du journal : c'est ici — et nulle part ailleurs — qu'un jet dont le joueur a SAISI la
    // valeur laisse sa provenance (arbitrage #939 : marqué PARTOUT, rangée ET journal).
    ecrireAuJournal: (msg) => {
      const deFixe = fixedJetOpen(get());
      const entrees = (Array.isArray(msg) ? msg : [msg])
        .map((entree) => (deFixe ? { ...entree, deFixe } : entree));
      set((s) => ({ journal: [...s.journal.slice(-40), ...entrees], lignesAuJournal: s.lignesAuJournal + entrees.length }));
      for (const entree of entrees) bus.emit(EVT.LIGNE_AU_JOURNAL, { entree });
    },
  } satisfies FabriqueDuNoyau;
}

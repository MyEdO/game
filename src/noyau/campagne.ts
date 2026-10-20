/** Mémoire de campagne : carnet d'indices, documents remis, héros désignés. */
import { togglePin, marquerVus } from './monde/clues';
import { decidingSeat } from './netOwnership';
import { coupleDIdentite } from './monde/identites';
import { reprendreLaSuite } from './combatEffects';
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';

export function creerActionsDeCampagne(get: Get, set: Set) {
  return {
    toggleCluePin: (indiceId) => set((s) => ({ clues: togglePin(s.clues, indiceId) })),
    /** NOUVEAUTÉ VUE, MARQUÉE PAR SON SIÈGE : le siège vient de `decidingSeat` (le siège agissant quand
     *  l'hôte applique l'intent d'un invité, sinon le siège local), jamais d'un argument — un siège ne
     *  marque vu que pour lui-même. */
    markCluesSeen: (affichés) => {
      const s = get();
      const clues = marquerVus(s.clues, affichés, decidingSeat(s));
      if (clues !== s.clues) set({ clues });
    },
    designerHerosOuvrir: (p) => {
      if (!get().party.some((h) => !h.dead)) return false;
      set({ pendingDesignationHeros: p });
      return true;
    },
    designerHerosChoisir: (heroId) => {
      const p = get().pendingDesignationHeros;
      if (!p) return;
      const vivants = get().party.filter((h) => !h.dead);
      if (heroId === undefined ? vivants.length > 0 : !vivants.some((h) => h.id === heroId)) return;
      set((st) => {
        if (heroId === undefined) return { pendingDesignationHeros: null };
        const couple = coupleDIdentite(st.party.find((h) => h.id === heroId));
        const { [p.etat]: _ancien, ...autres } = st.identitesFigees;
        return {
          etats: { ...st.etats, [p.etat]: heroId },
          identitesFigees: couple ? { ...autres, [p.etat]: couple } : autres,
          pendingDesignationHeros: null,
        };
      });
      reprendreLaSuite(get, set, p.suite);
    },
    remettreDocument: (doc) => set((s) => ({ document: { ...doc, remise: s.remisesDeDocument + 1 }, remisesDeDocument: s.remisesDeDocument + 1 })),
    // COOP : l'hôte ferme (patron `acquitterOuverture`) ; chez l'invité, la suite ne se joue jamais.
    closeDocument: () => {
      const doc = get().document;
      if (!doc || get().net.mode === 'guest') return;
      set({ document: null });
      reprendreLaSuite(get, set, doc.suite);
    },
  } satisfies Partial<ActionsDuNoyau>;
}

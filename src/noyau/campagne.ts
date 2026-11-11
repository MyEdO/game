/** Mémoire de campagne : carnet d'indices, documents remis, héros désignés. */
import { poserLEpingle, marquerVus } from './monde/clues';
import { decidingSeat } from './netOwnership';
import { coupleDIdentite } from './monde/identites';
import { reprendreLaSuite } from './combatEffects';
import { fenetreDuJeu } from './combatAuto';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import { garanti } from '../lib/garanti';
import { refuserGesteDuSiege } from './refusVisible';
import { t } from '../i18n';

export function creerActionsDeCampagne(get: Get, set: Set) {
  return {
    epinglerLIndice: (indiceId, epingle) => {
      if (!get().clues[indiceId]) { refuserGesteDuSiege(get, set, t('carnet.refus.indiceInconnu', { id: indiceId })); return; }
      set((s) => ({ clues: poserLEpingle(s.clues, indiceId, epingle) }));
    },
    /** NOUVEAUTÉ VUE, MARQUÉE PAR SON SIÈGE : le siège vient de `decidingSeat` (le siège agissant quand
     *  l'hôte applique l'intent d'un invité, sinon le siège local), jamais d'un argument — un siège ne
     *  marque vu que pour lui-même. */
    marquerLesIndices: (affiches) => {
      const s = get();
      const clues = marquerVus(s.clues, affiches, decidingSeat(s));
      if (clues !== s.clues) set({ clues });
    },
    ouvrirLaDesignation: (p) => {
      if (!get().party.some((h) => !h.dead)) return false;
      set({ pendingDesignationHeros: p });
      return true;
    },
    remettreLeDocument: (doc) => set((s) => ({ document: { ...doc, remise: s.remisesDeDocument + 1 }, remisesDeDocument: s.remisesDeDocument + 1 })),
  } satisfies FabriqueDuNoyau;
}

/** Le document se ferme et rejoue sa `suite` ; sa sortie est à l'hôte (`SURFACES_HORS_PENDING`). */
export function sortiesDeCampagne(get: Get, set: Set) {
  return {
    document: () => {
      const doc = garanti(get().document, 'document', 'document ouvert');
      set({ document: null });
      reprendreLaSuite(get, set, doc.suite);
    },
    // Plus aucun héros vivant à désigner (`MODAL_DEFS.designationHeros.sortieFermee`) : la suite du Flow se joue.
    designationHeros: () => {
      const p = garanti(get().pendingDesignationHeros, 'designationHeros', 'désignation ouverte');
      set({ pendingDesignationHeros: null });
      reprendreLaSuite(get, set, p.suite);
    },
  } satisfies Partial<SortiesDeFenetre>;
}

/** Le héros désigné pour l'état de campagne (`CorpsDesChoix`, EDO 02 l.91), parmi les vivants (`OUVERTS_DU_CHOIX`) :
 *  son identité se fige, la suite du Flow se joue. */
export function choixDeCampagne(get: Get, set: Set) {
  return {
    designationHeros: {
      heros: (heroId) => {
        const p = garanti(get().pendingDesignationHeros, heroId, 'désignation ouverte');
        set((st) => {
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
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** Le document remis quand sa fenêtre tient la main : son titre et son texte, le Markdown verbatim de la donnée. */
export function documentEnVue(s: Jeu): { titre: string; texte: string } | null {
  return s.document && fenetreDuJeu(s)?.cle === 'document' ? { titre: s.document.title, texte: s.document.text } : null;
}

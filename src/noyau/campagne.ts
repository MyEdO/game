/** Mémoire de campagne : carnet d'indices, documents remis, héros désignés. */
import { poserLEpingle, marquerVus } from './monde/clues';
import { decidingSeat } from './netOwnership';
import { coupleDIdentite } from './monde/identites';
import { jouerLesClotures, refuserUnSecondGeste } from './combatEffects';
import { fenetreDuJeu } from './combatAuto';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import { garanti } from '../lib/garanti';
import { refuserGesteDuSiege } from './refusVisible';
import { t } from '../i18n';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';
import type { DocumentDeNaufrage } from './shipwreck';

/** Le document d'auteur remis (Effet `document`) : `text` = Markdown, un paragraphe par bloc séparé d'une ligne vide ;
 *  `documentId` = l'entrée de `narratif.documents` remise, dont le texte est la prose du paquet. */
export interface DocumentDAuteur { genre: 'auteur'; title: string; text: string; source?: SourceRef; documentId?: string }

/** Le document remis : celui d'un auteur, ou les faits d'un naufrage que l'hôte rédige. */
export type DocumentRemis = DocumentDAuteur | DocumentDeNaufrage;

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
      refuserUnSecondGeste(get(), 'pendingDesignationHeros');
      set({ pendingDesignationHeros: p });
      return true;
    },
    remettreLeDocument: (doc) => {
      refuserUnSecondGeste(get(), 'document');
      set((s) => ({ document: { ...doc, remise: s.remisesDeDocument + 1 }, remisesDeDocument: s.remisesDeDocument + 1 }));
    },
  } satisfies FabriqueDuNoyau;
}

/** Le document se ferme et rejoue sa `suite` ; sa sortie est à l'hôte (`SURFACES_HORS_PENDING`). */
export function sortiesDeCampagne(get: Get, set: Set) {
  return {
    document: () => {
      const doc = garanti(get().document, 'document', 'document ouvert');
      set({ document: null });
      jouerLesClotures(get, set, doc.suite ?? []);
    },
    // Plus aucun héros vivant à désigner (`MODAL_DEFS.designationHeros.sortieFermee`) : la suite du Flow se joue.
    designationHeros: () => {
      const p = garanti(get().pendingDesignationHeros, 'designationHeros', 'désignation ouverte');
      set({ pendingDesignationHeros: null });
      jouerLesClotures(get, set, p.suite ?? []);
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
        jouerLesClotures(get, set, p.suite ?? []);
      },
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** Un document en vue : celui d'un auteur, son titre et son texte, le Markdown verbatim de la donnée ; ou les faits
 *  d'un naufrage tels quels. */
export type DocumentEnVue = { genre: 'auteur'; titre: string; texte: string } | DocumentDeNaufrage;

/** Le document remis quand sa fenêtre tient la main (`DocumentEnVue`). */
export function documentEnVue(s: Jeu): DocumentEnVue | null {
  const doc = s.document;
  if (!doc || fenetreDuJeu(s)?.cle !== 'document') return null;
  if (doc.genre === 'naufrage') return { genre: doc.genre, navire: doc.navire, cargaison: doc.cargaison, heros: doc.heros, rivage: doc.rivage };
  return { genre: 'auteur', titre: doc.title, texte: doc.text };
}

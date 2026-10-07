/**
 * Mode ATELIER du Compendium — bascule l'affordance d'ÉDITION (éditer/créer une fiche via l'éditeur de
 * données intégré). Défaut OFF, PERSISTANT (`persistedAtom`, primitive partagée `ui/persistedAtom.ts`),
 * DÉCOUVRABLE (bouton d'en-tête) : l'édition reste un pilier produit, jamais derrière un flag de build.
 * Source UNIQUE de l'état : toutes les vues du Compendium restent en phase.
 */
import { persistedAtom } from '../persistedAtom';

const atelierAtom = persistedAtom(
  'wfrp4.compendium.atelier',
  false,
  (raw) => raw === '1',
  (on) => (on ? '1' : '0'),
);

export function setAtelierMode(on: boolean): void {
  atelierAtom.set(on);
}

export function useAtelierMode(): boolean {
  return atelierAtom.use();
}

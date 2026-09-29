/**
 * Dotations de TEST (fixture partagée des tests d'emplacements de dotation) : remplace, le temps de
 * `fn`, les dotations de Classe et de Niveau 1 d'une carrière (`setDataset`), puis rend la donnée.
 */
import { careerLevels, classes, findCareerById, type TrappingRef } from './index';
import { setDataset } from './overrides';

export function avecDotations<T>(careerId: string, dotations: { classe?: TrappingRef[]; niveau?: TrappingRef[] }, fn: () => T): T {
  const niveaux = [...careerLevels];
  const classesAvant = [...classes];
  const classeId = findCareerById(careerId)?.class;
  const { classe, niveau } = dotations;
  if (niveau) setDataset('careerLevels', niveaux.map((l) => (l.career === careerId && l.level === 1 ? { ...l, trappings: niveau } : l)));
  if (classe) setDataset('classes', classesAvant.map((c) => (c.id === classeId ? { ...c, trappings: classe } : c)));
  try {
    return fn();
  } finally {
    setDataset('careerLevels', niveaux);
    setDataset('classes', classesAvant);
  }
}

/** Artiste (classe Courtisans) : un emplacement de Classe à branche imbriquée, et au Niveau 1 un joker,
 *  un objet, un `{choice}` dont une branche est un `{choice}` à joker, un objet de qualité. */
export const CARRIERE_FIXTURE = 'artiste';
export const DOTATIONS_FIXTURE: { classe: TrappingRef[]; niveau: TrappingRef[] } = {
  classe: [{ choice: [{ id: 'miroir-a-main' }, { id: 'fleuret', qualityChoice: true }] }],
  niveau: [
    { wildcard: 'arme' },
    { id: 'pinceau' },
    { choice: [{ choice: [{ id: 'dague' }, { wildcard: 'arme' }] }, { id: 'grande-hache' }] },
    { id: 'fleuret', qualityChoice: true },
  ],
};

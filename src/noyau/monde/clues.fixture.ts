/**
 * INDICES DE BANC (#670, #2415) : deux indices d'une affaire, le narratif qui les porte, un héros et une scène à départ,
 * partagés par les tests des indices du noyau et de leur liaison web.
 */
import { affichageDe, type ClueState, type IndiceAffiché } from './clues';
import { emptyNarratif } from './campaignNarratif';
import { emptyScene, type Scene } from './scene';
import type { Indice, NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import type { Combatant } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

export const IND: Indice = {
  id: 'ind-lettre',
  affaireId: 'aff-corbeau',
  kind: 'indice',
  titre: 'La lettre scellée',
  stades: [
    { id: 's1', prose: 'Une lettre cachetée de cire noire traîne sur le bureau.' },
    { id: 's2', prose: 'Le cachet porte les armes du corbeau — une correspondance secrète.' },
  ],
};

export const IND_MONO: Indice = {
  id: 'ind-mono',
  affaireId: 'aff-corbeau',
  kind: 'indice',
  titre: 'Le mouchoir brodé',
  stades: [{ id: 'unique', prose: 'Un mouchoir brodé d’un corbeau, oublié sur la scène.' }],
};

/** Ce que le Carnet affiche MAINTENANT de ces indices (présents). */
export const affichés = (clues: Record<string, ClueState>, ids: readonly string[]): IndiceAffiché[] =>
  ids.filter((id) => clues[id]).map((id) => affichageDe(id, clues[id]));

export const narratif: NarratifBlock = {
  ...emptyNarratif(),
  affaires: [{ id: 'aff-corbeau', titre: 'Le Corbeau noir' }],
  indices: [IND, IND_MONO],
  presetsPnj: [],
  objets: [],
};

export function hero(): Combatant {
  return (blessuresSurLeProfil({
    id: 'a', label: 'A', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  })) as unknown as Combatant;
}

export function fixtureScene(id: string): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

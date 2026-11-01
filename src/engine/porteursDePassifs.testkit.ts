/**
 * Les PORTEURS de passifs d'un combattant, branche par branche du collecteur (`trauma.ts › passiveMods`) :
 * chacun pose une liste `passive` sur le combattant, dans le champ qu'il nomme. Une entrée de catalogue
 * fabriquée (Trait, État, État psychologique, symptôme, talent) se pose par le seam `setDataset` ;
 * `resetData` la retire.
 */
import type { OpPassive } from './ops';
import type { Combatant } from './types';
import { datasetArray, setDataset } from '../data/overrides';

/** Id de l'entrée fabriquée et de l'instance qui la porte. */
export const ID_DE_PORTEUR = 'porteur-de-test';

const CATALOGUES = {
  traits: () => datasetArray('traits'),
  etats: () => datasetArray('etats'),
  psychologies: () => datasetArray('psychologies'),
  symptoms: () => datasetArray('symptoms'),
  talents: () => datasetArray('talents'),
};

/** Ajoute au dataset `cle` une entrée fabriquée qui porte `passive`, par le seam `setDataset`. */
export const ajouterAuCatalogue = (cle: keyof typeof CATALOGUES, entree: Record<string, unknown>) =>
  setDataset(cle, [...CATALOGUES[cle](), { id: ID_DE_PORTEUR, label: 'Porteur de test', ...entree }] as never);

/** Un porteur : son nom, le champ du combattant qu'il écrit, et sa pose de `passive` (mute `c`). */
export type Porteur = readonly [nom: string, champ: keyof Combatant, poser: (c: Combatant, passive: OpPassive[]) => void];

/** Chaque porteur du collecteur. */
export const PORTEURS: readonly Porteur[] = [
  ['mutation', 'mutations', (c, passive) => { c.mutations = [{ id: ID_DE_PORTEUR, label: 'Mutation de test', passive } as never]; }],
  ['objet porté', 'items', (c, passive) => { c.items = [{ uid: 'o1', trappingId: ID_DE_PORTEUR, label: 'Objet de test', equipped: true, passive } as never]; }],
  ['séquelle', 'traumas', (c, passive) => { c.traumas = [{ label: 'Séquelle de test', location: 'corps', ops: passive } as never]; }],
  ['effet actif', 'activeEffects', (c, passive) => { c.activeEffects = [{ label: 'Effet de test', bonus: 0, duration: { scale: 'permanent' }, passive }]; }],
  ['Trait appliqué', 'liveTraits', (c, passive) => { ajouterAuCatalogue('traits', { passive }); c.liveTraits = [{ id: ID_DE_PORTEUR } as never]; }],
  ['État', 'conditions', (c, passive) => { ajouterAuCatalogue('etats', { passive }); c.conditions = [{ id: ID_DE_PORTEUR, value: 1 } as never]; }],
  ['État psychologique', 'psychState', (c, passive) => { ajouterAuCatalogue('psychologies', { passive }); c.psychState = [{ type: ID_DE_PORTEUR } as never]; }],
  ['symptôme', 'diseases', (c, passive) => { ajouterAuCatalogue('symptoms', { passive }); c.diseases = [{ id: 'maladie-de-test', phase: 'active', symptoms: [{ symptomId: ID_DE_PORTEUR }] } as never]; }],
  ['talent', 'talents', (c, passive) => { ajouterAuCatalogue('talents', { passive }); c.talents = [{ talentId: ID_DE_PORTEUR, times: 1 }]; }],
];

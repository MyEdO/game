/**
 * COMBATTANT DE TEST VALIDE : un profil complet (chaque Caractéristique à 30 sauf surcharge), des
 * Blessures à `maxWounds` du profil, des listes de porteurs vides. Les coutures du moteur et la transition
 * de l'état réconcilient les Blessures de tout combattant qu'elles touchent (`blessuresReconciliees`,
 * `engine/characteristics.ts`) : une fixture qui omet une Caractéristique ou les Blessures n'est pas un
 * combattant. Aucune lecture du corpus de données.
 */
import { CHAR_KEYS, LOCALISATIONS_DE_COUP, type Characteristics, type Combatant } from './types';
import { maxWounds, blessuresDeBase } from './characteristics';
import { tableTotale } from '../lib/tableTotale';

/** Ce qu'un test fixe du combattant ; le profil se surcharge Caractéristique par Caractéristique. */
export type SurchargeDeCombattant = Omit<Partial<Combatant>, 'characteristics'> & { characteristics?: Partial<Characteristics> };

/** Le combattant `over` complété en combattant valide : `over.characteristics` surcharge le profil. */
export function combattantDeTest(over: SurchargeDeCombattant = {}): Combatant {
  const characteristics: Characteristics = { ...tableTotale(CHAR_KEYS, () => 30), ...over.characteristics };
  const max = maxWounds(characteristics, over.size);
  return {
    id: 'c', label: 'Combattant de test', kind: 'npc',
    movement: 4, advantage: 0,
    wounds: blessuresDeBase(max),
    armour: tableTotale(LOCALISATIONS_DE_COUP, () => 0),
    skills: [], talents: [], weapons: [], traits: [], conditions: [], activeEffects: [], liveTraits: [],
    ...over,
    characteristics,
  };
}

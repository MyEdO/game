/**
 * COMBATTANT DE TEST VALIDE : un profil complet (chaque Caractéristique à 30 sauf surcharge), des
 * Blessures de porteur né sur ce profil (`blessuresPosees`), des listes de porteurs vides. Les coutures du moteur et la transition
 * de l'état réconcilient les Blessures de tout combattant qu'elles touchent (`blessuresReconciliees`,
 * `engine/characteristics.ts`) : une fixture qui omet une Caractéristique ou les Blessures n'est pas un
 * combattant. Aucune lecture du corpus de données.
 */
import { CHAR_KEYS, LOCALISATIONS_DE_COUP, type Characteristics, type Combatant } from './types';
import { blessuresPosees } from './characteristics';
import { tableTotale } from '../lib/tableTotale';

/** Ce qu'un test fixe du combattant ; le profil se surcharge Caractéristique par Caractéristique. */
export type SurchargeDeCombattant = Omit<Partial<Combatant>, 'characteristics'> & { characteristics?: Partial<Characteristics> };

/** Profil complet de test : chaque Caractéristique à 30 sauf surcharge. */
export function profilDeTest(over: Partial<Characteristics> = {}): Characteristics {
  return { ...tableTotale(CHAR_KEYS, () => 30), ...over };
}

/** Le combattant `over` sans ses Blessures : `over.characteristics` surcharge le profil. */
function sansBlessuresDeTest(over: Omit<SurchargeDeCombattant, 'wounds'> = {}): Omit<Combatant, 'wounds'> {
  return {
    id: 'c', label: 'Combattant de test', kind: 'npc',
    movement: 4, advantage: 0,
    armour: tableTotale(LOCALISATIONS_DE_COUP, () => 0),
    skills: [], talents: [], weapons: [], traits: [], conditions: [], activeEffects: [], liveTraits: [],
    ...over,
    characteristics: profilDeTest(over.characteristics),
  };
}

/** Le combattant `over` complété en combattant valide : `over.characteristics` surcharge le profil. */
export function combattantDeTest(over: SurchargeDeCombattant = {}): Combatant {
  const { wounds, ...reste } = over;
  const sansBlessures = sansBlessuresDeTest(reste);
  return { ...sansBlessures, wounds: blessuresPosees(sansBlessures, wounds?.max, wounds?.current) };
}

/** Le littéral de combattant `fixture` né sur son propre profil : ses Blessures (`max`, `current`) reposées
 *  par `blessuresPosees`, l'écart calculé sur `fixture.characteristics`. Un profil incomplet (littéral partiel
 *  fusionné plus loin) est rendu tel quel : le littéral qui le complète s'y repose. */
export function blessuresSurLeProfil<T extends { readonly wounds: { readonly current: number; readonly max: number } }>(fixture: T): T {
  const profil = (fixture as { characteristics?: Partial<Characteristics> }).characteristics;
  if (!profil || !CHAR_KEYS.every((k) => Number.isFinite(profil[k]))) return fixture;
  const sansBlessures = fixture as unknown as Omit<Combatant, 'wounds'>;
  return { ...fixture, wounds: blessuresPosees(sansBlessures, fixture.wounds.max, fixture.wounds.current) };
}

/** Blessures de fixture : `base` au maximum à la naissance sur le profil de `porteur` (par défaut celui
 *  de `combattantDeTest`), `current` restantes ; le maximum suit ensuite ce profil (`blessuresPosees`). */
export function blessuresDeBase(base: number, current: number = base, porteur: Omit<Combatant, 'wounds'> = sansBlessuresDeTest()): Combatant['wounds'] {
  return blessuresPosees(porteur, base, current);
}

/** `combattantDeTest` blessé : `restantes` Points de Blessure sur le maximum de sa naissance. */
export function blesseDeTest(restantes: number, over: SurchargeDeCombattant = {}): Combatant {
  const c = combattantDeTest(over);
  c.wounds = { ...c.wounds, current: restantes };
  return c;
}

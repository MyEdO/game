import { describe, it, expect } from 'vitest';
import { enemyRigProfile, entityRigProfile } from './enemyProfile';
import type { Combatant, Weapon, ArmourPoints } from '../../engine/types';
import { findTrappingById } from '../../data';

/**
 * CARACTÉRISATION (golden) du MERGE d'apparence rig — capture la sortie ACTUELLE de `enemyRigProfile`
 * et `entityRigProfile` sur une matrice couvrant chaque chemin de précédence (base / record créature /
 * override d'instance / tenue). But : prouver que l'unification du merge (un seul `rigAppearance`) reste
 * BYTE-À-BYTE identique. On snapshote `appearance` + `tenue` seulement (l'équipement n'est PAS refactoré
 * et porte des uid aléatoires). Si un champ bouge après refactor, le diff vitest le pointe.
 */
const noArmour: ArmourPoints = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
function mk(id: string, name: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id, label: name, kind: 'enemy', characteristics: {} as Combatant['characteristics'],
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon],
    armour: { ...noArmour }, skills: [], talents: [], movement: 4, ...over,
  } as Combatant;
}
// Override d'authoring BRUT porté par `appearanceOverride` (EntityAppearance) — figé au rendu par
// `enemyRigProfile` (#187). Les yeux sont des CLÉS de catalogue (résolues en art par le figeage), et il
// n'y a pas de champ `gabarit` (celui-ci vient du perso/def de l'espèce, pas d'un override d'instance).
const ENEMY_CASES: [string, Combatant][] = [
  ['humain-nu', mk('en1', 'Soldat')],
  ['species-orc', mk('en2', 'x', { species: 'orc' })],
  ['species-gobelin', mk('en3', 'x', { species: 'gobelin' })],
  ['species-skaven', mk('en4', 'x', { species: 'skaven' })],
  ['override-sex-build', mk('en5', 'Soldat', { appearanceOverride: { sex: 'F', build: 0.7 } as never })],
  ['override-monster', mk('en6', 'Soldat', { appearanceOverride: { monster: { tete: 'lezard' } } as never })],
  ['override-colors-parts', mk('en7', 'Soldat', { appearanceOverride: { colors: { peau: '#112233' }, parts: { hair: 3 } } as never })],
  ['override-eyes', mk('en8', 'Soldat', { appearanceOverride: { eyes: { G: 'reptilien', D: 'noir' } } as never })],
  ['career-tenue', mk('en10', 'Cultiste', { career: 'flagellant' })],
];

const ENTITY_CASES: [string, string, number, Record<string, unknown> | undefined][] = [
  ['humain-nu', 'Soldat', 42, undefined],
  ['species-orc', 'x', 42, { species: 'orc' }],
  ['species-gobelin', 'x', 42, { species: 'gobelin' }],
  ['species-skaven', 'x', 42, { species: 'skaven' }],
  ['override-sex-build', 'Soldat', 42, { sex: 'F', build: 0.7 }],
  ['override-monster', 'Soldat', 42, { monster: { tete: 'lezard' } }],
  ['override-colors-parts', 'Soldat', 42, { colors: { peau: '#112233' }, parts: { hair: 3 } }],
  ['override-eyes', 'Soldat', 42, { eyes: { G: 'reptilien', D: 'noir' } }],
  ['override-features', 'Soldat', 42, { features: ['barbe'] }],
  ['tenue', 'Villageois', 42, { tenue: 'mendiant' }],
];

// On teste la parité des VALEURS, pas la forme de l'objet : l'ORDRE des clés (diffère entre builders) et
// la PRÉSENCE d'une clé à `undefined` (`monster`/`features` que l'ancien combat omettait) sont
// sémantiquement NEUTRES — le rig lit par nom, `appearance.x` vaut `undefined` clé présente ou absente.
const byKey = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)));

describe('CARACTÉRISATION — apparence rig (parité avant/après unification du merge)', () => {
  for (const [label, c] of ENEMY_CASES) {
    it(`enemyRigProfile · ${label}`, () => {
      const p = enemyRigProfile(c)!;
      expect({ appearance: byKey(p.appearance as never), tenue: p.tenue }).toMatchSnapshot();
    });
  }
  for (const [label, name, seed, opts] of ENTITY_CASES) {
    it(`entityRigProfile · ${label}`, () => {
      const p = entityRigProfile(findTrappingById, name, seed, opts as never)!;
      expect({ appearance: byKey(p.appearance as never), tenue: p.tenue }).toMatchSnapshot();
    });
  }
});

/**
 * PARITÉ D'ESPÈCE explo↔combat. Les cas de caractérisation ci-dessus n'exercent l'override
 * d'authoring QUE sur des combattants sans `creatureId` ni `species` (des humains) : ils ne peuvent
 * pas voir un override ÉCRASER une espèce résolue. Ici l'espèce vient du RECORD et l'override
 * d'authoring n'en porte pas (un simple réglage de couleurs dans l'inspecteur en produit un).
 */
const NON_HUMAINS: [string, string][] = [
  ['orc', 'orc'],
  ['gobelin', 'gobelin'],
  ['squelette', 'squelette'],
  ['troll', 'troll'],
];
describe('PARITÉ — un override d’authoring sans espèce ne remplace pas l’espèce du record', () => {
  for (const [id, species] of NON_HUMAINS) {
    it(`${id} · même espèce en exploration et en combat`, () => {
      const colors = { peau: '#556677' };
      const explo = entityRigProfile(findTrappingById, id, 42, { colors })!;
      const combat = enemyRigProfile(mk('e-' + id, id, { creatureId: id, appearanceOverride: { colors } as never }))!;
      expect(explo.appearance.species).toBe(species);
      expect(combat.appearance.species).toBe(explo.appearance.species);
    });
  }
});

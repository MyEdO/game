/**
 * #181/#182 — un PNJ armuré (garde-du-village, servant du bélier #156) DOIT rendre IDENTIQUEMENT
 * en combat et hors combat (doctrine « tenues + armures = defs SOURCE UNIQUE »). La cause racine :
 * un allié PNJ passe `side:'ally'` → `kind:'hero'` (camp) au spawn de combat, et le rendu routait la
 * dérivation d'apparence sur le CAMP (`c.kind === 'hero'`) au lieu de l'ORIGINE — il court-circuitait
 * `enemyRigProfile` et rendait via `equipFromCombatant` (items SEULS, aucune synthèse des PA) → armure
 * absente en combat, présente en explo. `rendersFromOwnInventory` route désormais sur l'origine.
 *
 * SECONDE cause de rupture (#774, trouvée en réfutation adversariale) : l'armure de statblock VISIBLE
 * (`armurePortee`) est un OVERRIDE d'authoring (`SceneEntity.appearance.armurePortee`, entité SANS
 * record) — `entityRigProfile` (explo) le lisait déjà (`opts.armurePortee`), mais `spawn.ts` ne portait
 * cet override dans `Combatant.appearanceOverride` QUE si un AUTRE champ (species/monster/couleurs…)
 * était aussi renseigné, et `enemyRigProfile` (combat) ne lisait que `cd?.armurePortee` (record, jamais
 * l'override) → une entité à statbloc `armurePortee: true` SANS AUTRE override était blindée en explo,
 * NUE en combat. Fixé : `spawn.ts` porte `armurePortee` dans sa condition d'attache, `enemyRigProfile`
 * lit `ov?.armurePortee ?? cd?.armurePortee` (symétrique d'`entityRigProfile`).
 */
import { describe, it, expect } from 'vitest';
import { spawnEnemy } from '../../../state/spawn';
import { enemyRigProfile, entityRigProfileFor, rendersFromOwnInventory } from '../enemyProfile';
import type { EnemyRigProfile } from '../enemyProfile';
import type { SceneEntity } from '../../../state/scene';
import type { Combatant } from '../../../engine/types';

const REF = 'garde-du-village';
const ID = 'servant-1';

/** Jeton de combat d'un servant PNJ allié, tel que `startCombat` le fabrique : spawn de bestiaire,
 *  puis basculement de camp (`side:'ally'` → `kind:'hero'`) + IA (`ai:true` → `aiControlled`). */
function allyCombatant(): Combatant {
  const c = spawnEnemy({ ref: REF }, ID, { x: 0, y: 0 });
  c.kind = 'hero'; // combatSlice.ts : `if (m.side === 'ally') enemies[i].kind = 'hero'`
  c.aiControlled = true; // `if (m.ai) enemies[i].aiControlled = true`
  return c;
}

/** Entité de scène (hors combat), MÊME id que le jeton de combat (identité unifiée explo↔combat). */
const explEntity = (): SceneEntity =>
  ({ kind: 'personnage', id: ID, label: 'Servant du bélier', pos: { x: 0, y: 0 }, ref: REF }) as SceneEntity;

const armourShape = (p: EnemyRigProfile | null) =>
  (p?.equip.armour ?? []).map((i) => ({ name: i.label, pa: i.pa, locs: i.locs })).sort((a, b) => a.name.localeCompare(b.name));
const weaponShape = (p: EnemyRigProfile | null) =>
  (p?.equip.weapons ?? []).map((w) => ({ name: w.label, type: w.type })).sort((a, b) => a.name.localeCompare(b.name));

describe('#181/#182 — parité apparence combat ↔ hors-combat d’un allié PNJ armuré', () => {
  it('le jeton de combat d’un allié PNJ de bestiaire N’est PAS rendu depuis son inventaire (→ profil synthétisé)', () => {
    // Root cause : router sur le camp (`kind === 'hero'`) le classait comme perso-joueur (items seuls).
    expect(rendersFromOwnInventory(allyCombatant())).toBe(false);
  });

  it('un vrai personnage-joueur (kind hero, sans creatureId ni IA) reste rendu depuis son inventaire', () => {
    const hero = { kind: 'hero', id: 'pc' } as Combatant;
    expect(rendersFromOwnInventory(hero)).toBe(true);
  });

  it('le profil de combat porte bien la couche ARMURE (synthétisée des PA du trait Armure 3)', () => {
    const prof = enemyRigProfile(allyCombatant());
    expect(armourShape(prof).length).toBeGreaterThan(0);
    expect(armourShape(prof).every((a) => (a.pa ?? 0) > 0)).toBe(true);
  });

  it('combat et hors-combat rendent la MÊME tenue, armure, armes et apparence de base', () => {
    const combat = enemyRigProfile(allyCombatant());
    const explore = entityRigProfileFor(explEntity(), true);
    expect(combat).not.toBeNull();
    expect(explore).not.toBeNull();
    // Tenue (couche vêtement du record) identique.
    expect(combat!.tenue).toBe(explore!.tenue);
    // Couche ARMURE identique (pièces synthétisées des mêmes PA) — le cœur de #181/#182.
    expect(armourShape(combat)).toEqual(armourShape(explore));
    // Armes et apparence de base (espèce/sexe/carrure/seed) identiques.
    expect(weaponShape(combat)).toEqual(weaponShape(explore));
    const app = (p: EnemyRigProfile) => ({ species: p.appearance.species, sex: p.appearance.sex, build: p.appearance.build, seed: p.appearance.seed });
    expect(app(combat!)).toEqual(app(explore!));
  });

  it('#774 : entité à statbloc SANS record, armurePortee en OVERRIDE d’authoring — MÊME armure en combat et en explo', () => {
    const NO_REF_ID = 'soudard-sans-record';
    const noRefCombat = () =>
      spawnEnemy({ statblock: { type: 'statblock', label: 'Soudard sans record', char: { B: 10 }, armour: 5 } }, NO_REF_ID, { x: 0, y: 0 }, {
        appearance: { armurePortee: true },
      });
    const noRefEntity = () =>
      ({
        kind: 'personnage', id: NO_REF_ID, label: 'Soudard sans record', pos: { x: 0, y: 0 },
        statblock: { label: 'Soudard sans record', char: { B: 10 }, armour: 5 },
        appearance: { armurePortee: true },
      }) as SceneEntity;
    const combat = enemyRigProfile(noRefCombat());
    const explore = entityRigProfileFor(noRefEntity(), true);
    expect(armourShape(combat).length).toBeGreaterThan(0); // #774 régression : nu en combat, blindé en explo
    expect(armourShape(combat)).toEqual(armourShape(explore));
  });
});

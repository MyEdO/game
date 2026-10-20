import { describe, it, expect } from 'vitest';
import { combatHooksOf } from '../noyau/combatHooks';
import '../noyau/combat/roundHooks'; // effet de bord : enregistre les hooks de fin de Round (dont recompute-auras)
import { groupsFor } from '../engine/groups';
import { castTestTalentDR } from '../engine/magic';
import { findCreatureById } from '../data';
import { combatTestPenalty } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/**
 * Aura de Dhar — DEUX entrées de `traits.json`, une par dieu (frenchy-bzh 295 l.233 « Les sorciers et
 * démons de Slaanesh à moins de 10 mètres… » ; 313 l.341 « …de Nurgle à moins de 11 mètres… »). Le hook
 * générique `recompute-auras` filtre les bénéficiaires par `aura.affectsGroups` (Groupe d'appartenance,
 * `groupMatch`) et touche l'émetteur si `aura.includesSelf`. Le Groupe de dieu est DÉCLARÉ par l'entrée
 * du bestiaire (`CreatureData.grantGroups`, lu par `groupsFor`), jamais posé à la main sur le combattant.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [], traits: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4,
  pos: { x: 5, y: 5 },
  ...over,
}) as unknown as Combatant;

const recompute = (combatants: Combatant[]) => {
  const hook = combatHooksOf('onRoundEnd').find((h) => h.id === 'recompute-auras')!;
  hook.run({ get: () => ({ scene: null }), battle: { combatants } } as never);
};

/** Groupes d'un démon du bestiaire, calculés comme au spawn (`spawn.ts` → `groupsFor`) : les Groupes
 *  DÉCLARÉS par l'entrée (`CreatureData.grantGroups` — sa catégorie ET celui de son dieu). */
const demonOf = (creatureId: string) => {
  const c = findCreatureById(creatureId)!;
  return groupsFor({ extras: c.grantGroups });
};

describe('Aura de Dhar — filtre par Groupe de dieu (affectsGroups) et porteur inclus (includesSelf)', () => {
  it('le Groupe de dieu est DÉCLARÉ par l’entrée du bestiaire, à côté de sa catégorie « demon »', () => {
    expect(demonOf('daemonette-de-slaanesh')).toEqual(['demon', 'slaanesh']);
    expect(demonOf('nurglings')).toEqual(['demon', 'nurgle']);
  });

  it('un démon de Slaanesh à 10 m de l’émetteur de Slaanesh gagne +1 DR (Focalisation ET Langue (Magick))', () => {
    const src = mk({ id: 's', traits: [{ id: 'aura-de-dhar-slaanesh' }] as never, groups: demonOf('daemonette-de-slaanesh') as never, pos: { x: 5, y: 5 } as never });
    const ally = mk({ id: 'a', groups: demonOf('daemonette-de-slaanesh') as never, pos: { x: 9, y: 5 } as never }); // 4 cases × 2 m = 8 m ≤ 10
    recompute([src, ally]);
    expect(castTestTalentDR(ally, 'focalisation')).toBe(1);
    expect(castTestTalentDR(ally, 'langue', 'magick')).toBe(1);
  });

  it('un démon de NURGLE dans l’aura de Slaanesh ne gagne RIEN (le croisement que « alliés » autorisait à tort)', () => {
    const src = mk({ id: 's', traits: [{ id: 'aura-de-dhar-slaanesh' }] as never, groups: demonOf('daemonette-de-slaanesh') as never, pos: { x: 5, y: 5 } as never });
    const other = mk({ id: 'n', groups: demonOf('nurglings') as never, pos: { x: 6, y: 5 } as never }); // adjacent, même camp
    recompute([src, other]);
    expect(other.auraMods ?? []).toEqual([]);
    expect(castTestTalentDR(other, 'focalisation')).toBe(0);
  });

  it('l’émetteur bénéficie de sa propre aura (« Cela vaut pour le démon porteur de l’Aura également »)', () => {
    const src = mk({ id: 's', traits: [{ id: 'aura-de-dhar-slaanesh' }] as never, groups: demonOf('daemonette-de-slaanesh') as never });
    recompute([src]);
    expect(castTestTalentDR(src, 'focalisation')).toBe(1);
    expect(castTestTalentDR(src, 'langue', 'magick')).toBe(1);
  });

  it('un guerrier slaaneshi non-lanceur est bien dans l’aura, mais le bonus ne s’applique à aucun de ses Tests', () => {
    const src = mk({ id: 's', traits: [{ id: 'aura-de-dhar-slaanesh' }] as never, groups: demonOf('daemonette-de-slaanesh') as never, pos: { x: 5, y: 5 } as never });
    const warrior = mk({ id: 'w', groups: ['humain', 'slaanesh'] as never, pos: { x: 6, y: 5 } as never });
    recompute([src, warrior]);
    expect(warrior.auraMods?.length).toBe(2); // le Groupe matche : l'aura le touche
    // …mais rien de ce qui est projeté ne touche un Test ordinaire : que du `skillDRBonus` d'incantation.
    expect(warrior.auraMods?.map((m) => (m.op as { op: string }).op)).toEqual(['skillDRBonus', 'skillDRBonus']);
    expect(combatTestPenalty(warrior)).toBe(0);
  });

  // Les deux contrats ci-dessous verrouillent la LECTURE DU TEXTE contre une « correction » de bonne foi.
  it('CAMP indifférent : un héros du Groupe du dieu, dans le rayon d’un démon ENNEMI, bénéficie', () => {
    // Le texte ne dit pas « alliés » (frenchy-bzh 295 l.233) : il vise les sorciers et démons DU DIEU.
    // Reposer un `affects:'allies'` ici rendrait ce test rouge — c'est exactement ce qu'on interdit.
    const src = mk({ id: 's', kind: 'enemy', traits: [{ id: 'aura-de-dhar-slaanesh' }] as never, groups: demonOf('daemonette-de-slaanesh') as never, pos: { x: 5, y: 5 } as never });
    const hero = mk({ id: 'h', kind: 'hero', groups: ['humain', 'slaanesh'] as never, pos: { x: 6, y: 5 } as never });
    recompute([src, hero]);
    expect(castTestTalentDR(hero, 'focalisation')).toBe(1);
  });

  it('SUR-INCLUSION assumée : un cultiste slaaneshi ni sorcier ni démon reçoit le +1 DR à Langue (Magick)', () => {
    // Borne de l'union de Groupes (cf. `aura.affectsGroups`, schemas/defs/traits.ts) : le filtre porte le
    // dieu, pas « sorcier OU démon » — la conjonction n'est pas exprimable. Mesuré, pas subi.
    const src = mk({ id: 's', traits: [{ id: 'aura-de-dhar-slaanesh' }] as never, groups: demonOf('daemonette-de-slaanesh') as never, pos: { x: 5, y: 5 } as never });
    const cultist = mk({ id: 'c2', groups: ['humain', 'cultiste', 'slaanesh'] as never, pos: { x: 6, y: 5 } as never });
    recompute([src, cultist]);
    expect(castTestTalentDR(cultist, 'langue', 'magick')).toBe(1);
  });

  it('portée par entrée : Nurgle porte à 11 m (5 cases = 10 m), là où Slaanesh s’arrête à 10 m', () => {
    const nurgle = mk({ id: 'n', traits: [{ id: 'aura-de-dhar-nurgle' }] as never, groups: demonOf('nurglings') as never, pos: { x: 5, y: 5 } as never });
    const far = mk({ id: 'f', groups: demonOf('nurglings') as never, pos: { x: 11, y: 5 } as never }); // 6 cases = 12 m > 11
    const near = mk({ id: 'p', groups: demonOf('nurglings') as never, pos: { x: 10, y: 5 } as never }); // 5 cases = 10 m ≤ 11
    recompute([nurgle, far, near]);
    expect(far.auraMods ?? []).toEqual([]);
    expect(castTestTalentDR(near, 'focalisation')).toBe(1);
  });

  it('Perturbant (aucun affectsGroups, aucun includesSelf) reste INCHANGÉ : touche tout le monde, sauf l’émetteur', () => {
    const p = mk({ id: 'p', traits: [{ id: 'perturbant' }] as never, groups: ['demon'] as never, pos: { x: 5, y: 5 } as never });
    const hero = mk({ id: 'h', kind: 'hero', groups: ['humain'] as never, pos: { x: 6, y: 5 } as never });
    recompute([p, hero]);
    expect(hero.auraMods).toEqual([{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }]);
    expect(p.auraMods ?? []).toEqual([]);
  });
});

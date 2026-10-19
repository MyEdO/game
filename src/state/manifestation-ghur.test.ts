/**
 * Manifestation de Ghur (Prédateur sanglant, bestiaire de Middenheim — #18). RAW : « les élémentaires
 * de Ghur sont immunisés contre les effets négatifs causés par des sorts du Domaine de la Bête. »
 *
 * Implémentation data-driven : capability `spellDomainImmunity: "bete"` sur le trait, lue PAR ID par
 * le chemin d'incantation (`immuneToSpellDomain`). Quand un Sort du Domaine immunisé applique ses
 * effets à un porteur, on saute l'application sur cette cible (interprétation : un Sort de la Bête
 * visant l'élémentaire est offensif par intention → ses effets ne mordent pas).
 *
 * NB clause 2 (vulnérabilité aux dégâts supplémentaires anti-démon/mort-vivant hors Bête) : pas de
 * système de « créature vulnérable comme un démon/mort-vivant » dans le moteur (les riders de Domaine
 * — Lumière/Vie — ciblent l'appartenance LITTÉRALE à un Groupe/Trait), donc non modélisée — rien
 * d'inventé (cf. parity.test.ts + commentaire de la capability).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast } from './combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { immuneToSpellDomain, spellDomainImmunityOf } from '../engine/traits/dispatch';
import { hasCondition } from '../engine/conditions';
import { effectiveChar } from '../engine/characteristics';
import type { CastResult } from '../engine/magic';
import type { Combatant } from '../engine/types';

const mob = (id: string, p: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind: 'creature',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 30, sociabilite: 20 },
    wounds: { current: 25, max: 25 }, advantage: 0, conditions: [], skills: [], talents: [], traits: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

// Sort de test OFFENSIF à effets négatifs sur la cible (1 État + 1 charMod), paramétré par Domaine —
// `domainId: 'bete'` = Domaine de la Bête (Ghur) ; sinon un autre Domaine (Feu) comme témoin négatif.
const spell = (domainId: string) =>
  ({
    id: `test-spell-${domainId}`, label: 'Sort de test', type: 'Magie des Arcanes',
    subType: domainId === 'bete' ? 'Bête' : 'Feu', domainId,
    cn: 4, range: { kind: 'distance', value: 20, unit: 'm' }, target: { kind: 'count', n: 1 },
    duration: { kind: 'rounds', value: 3 },
    effects: {
      kind: 'seq',
      steps: [{
        kind: 'do',
        effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'aveugle' }, { op: 'charMod', char: 'capacite-de-combat', mod: -10 }] },
      }],
    },
    family: 'arcane', curated: true,
  }) as unknown as Parameters<typeof applyCast>[4];

const ok: CastResult = { cast: true, roll: 21, target: 70, sl: 2, isCritical: false, isFumble: false, log: 'lancé' };

describe('Manifestation de Ghur — immunité aux Sorts du Domaine de la Bête (#18)', () => {
  beforeEach(() => {
    seedBattleRng(1);
    useGame.setState({ battle: null });
  });

  it('capability lue PAR ID : spellDomainImmunityOf → "bete" ; immuneToSpellDomain gate par Domaine', () => {
    const ghur = [{ id: 'manifestation-de-ghur' }];
    expect(spellDomainImmunityOf(ghur)).toBe('bete');
    expect(immuneToSpellDomain(ghur, 'bete')).toBe(true);
    expect(immuneToSpellDomain(ghur, 'feu')).toBe(false);
    expect(immuneToSpellDomain(ghur, null)).toBe(false);
    expect(immuneToSpellDomain([], 'bete')).toBe(false);
  });

  it('un Sort du Domaine de la Bête N’applique AUCUN effet au porteur de Manifestation de Ghur', () => {
    const immune = mob('ghur', { traits: [{ id: 'manifestation-de-ghur' }] });
    const caster = mob('mage', { kind: 'hero' });
    useGame.setState({ party: [immune] as Combatant[] });
    applyCast(useGame.getState, useGame.setState, caster, immune, spell('bete'), ok, false, false);
    expect(hasCondition(immune, 'aveugle')).toBe(false);
    expect(effectiveChar(immune, 'capacite-de-combat')).toBe(40); // charMod -10 NON appliqué
    expect(immune.activeEffects ?? []).toHaveLength(0);
  });

  it('le MÊME Sort de la Bête mord bien une créature normale (preuve que le sort est offensif)', () => {
    const normal = mob('orc');
    const caster = mob('mage', { kind: 'hero' });
    useGame.setState({ party: [normal] as Combatant[] });
    applyCast(useGame.getState, useGame.setState, caster, normal, spell('bete'), ok, false, false);
    expect(hasCondition(normal, 'aveugle')).toBe(true);
    expect(effectiveChar(normal, 'capacite-de-combat')).toBe(30); // 40 - 10
  });

  it('un Sort d’un AUTRE Domaine (Feu) applique bien ses effets au porteur de Manifestation de Ghur', () => {
    const immune = mob('ghur', { traits: [{ id: 'manifestation-de-ghur' }] });
    const caster = mob('mage', { kind: 'hero' });
    useGame.setState({ party: [immune] as Combatant[] });
    applyCast(useGame.getState, useGame.setState, caster, immune, spell('feu'), ok, false, false);
    expect(hasCondition(immune, 'aveugle')).toBe(true);
    expect(effectiveChar(immune, 'capacite-de-combat')).toBe(30);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { applyOpposedCritical } from '../noyau/combatFlow';
import { useGame, type BattleState } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { resetRule } from '../engine/policy';
import { hitLocationByShape, reverseRoll } from '../engine/combat';
import type { Combatant } from '../engine/types';
import type { SpellData } from '../data';
import { emptyScene } from '../noyau/monde/scene';

/**
 * #80 — LDB 18 l.53/55 : un Coup Critique re-tire la Localisation (1d100 FRAIS, jamais l'inversion de
 * la touche), et les Dégâts non-Critiques sont recalculés à cette nouvelle Localisation. La mêlée le
 * faisait déjà (`woundsAtCritLocation` + `chosenCritLocation`) ; on FIGE ici les deux autres chemins
 * où la loc était « par dé inversé » : le Projectile magique (`evaluateMissile`) et le Critique de
 * défense opposée (`applyOpposedCritical`).
 */
const mkTarget = (armour: Partial<Record<string, number>> = {}): Combatant =>
  ({
    id: 'T', name: 'Cible', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0, ...armour },
    skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
  }) as unknown as Combatant;

const caster = (): Combatant =>
  ({
    id: 'C', name: 'Mage', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
  }) as unknown as Combatant;

const missile = (): SpellData =>
  ({ id: 'dard', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8 }) as SpellData;

const critCast: CastResult = { cast: true, roll: 50, target: 60, sl: 2, isCritical: true, isFumble: false, log: '' };

describe('#80 Projectile magique — Dégâts recalculés à la Localisation fournie (evaluateMissile locOverride)', () => {
  it('locOverride → Localisation = override, Dégâts RÉ-ÉVALUÉS à cette loc (PA portés à cette loc)', () => {
    const tete = evaluateMissile(caster(), mkTarget({ tete: 4 }), missile(), critCast, 'tete');
    const corps = evaluateMissile(caster(), mkTarget({ tete: 4 }), missile(), critCast, 'corps');
    expect(tete.location).toBe('tete');
    expect(corps.location).toBe('corps');
    // Même coup, deux loc : la loc protégée (tête, 4 PA) encaisse exactement 4 Blessures de moins que le corps (0 PA).
    expect((corps.woundsLost ?? 0) - (tete.woundsLost ?? 0)).toBe(4);
  });

  it('sans override → Localisation = jet d’Incantation inversé (LDB 46, comportement inchangé)', () => {
    const r = evaluateMissile(caster(), mkTarget(), missile(), critCast);
    expect(r.location).toBe(hitLocationByShape(reverseRoll(critCast.roll), 'humanoide'));
  });
});

describe('#80 Critique de défense opposée — Localisation = 1d100 frais, décorrélée du jet (LDB 18 l.53)', () => {
  it('même seed, jet opposé différent → MÊME Critique (la loc vient du seed, pas de l’inversion du jet)', () => {
    const get = (() => ({ battle: { combatants: [] } })) as never;
    const set = (() => {}) as never;
    seedBattleRng(7);
    const v1 = mkTarget();
    const log1: string[] = [];
    applyOpposedCritical(get, set, v1, 11, {}, log1);
    seedBattleRng(7);
    const v2 = mkTarget();
    const log2: string[] = [];
    applyOpposedCritical(get, set, v2, 99, {}, log2);
    expect(v1.criticalWounds).toBe(1); // un Critique a bien été appliqué
    expect(v1.traumas).toEqual(v2.traumas); // jet 11 ≠ 99 → Critique IDENTIQUE : la loc ne dérive plus de l’inversion
    expect(log1).toEqual(log2);
  });
});

describe('#43.2 Critique de défense opposée — HÉROS blindé : étape de déviation (LDB 63 l.30)', () => {
  afterEach(() => resetRule('combat-critical-deflect'));

  it('héros victime AVEC armure → pousse une étape `self` (choix Dévier/Subir), Critique différé', () => {
    seedBattleRng(7);
    const h = mkTarget({ tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 }); // id 'T', kind 'hero'
    const battle = {
      combatants: [h], order: ['T'], baseOrder: ['T'], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, pendingCascade: null, pendingFateSave: null });
    applyOpposedCritical(useGame.getState, useGame.setState, h, 11, {}, []);
    const dev = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'deviation')?.deviation;
    expect(dev?.mode).toBe('self'); // suspendu : choix Dévier/Subir
    expect(h.criticalWounds ?? 0).toBe(0); // Critique toujours différé à la résolution (non appliqué à ce stade)
  });
});

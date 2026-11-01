import { describe, it, expect } from 'vitest';
import { applyOps, type GameOp } from './ops';
import { effectiveChar } from './characteristics';
import { effectiveMovement } from './encumbrance';
import { endOfRound } from './conditions';
import { liveMorphRef } from './polymorph';
import { hasTraitKey } from './traits/dispatch';
import { selfManeuverApplicable } from './creatureAttacks';
import { findManeuverById } from '../data';
import type { Combatant } from './types';
import { combattantDeTest } from './combattantDeTest.testkit';
import { desDuTest } from './dice.testkit';

/**
 * Transformation durable & réversible (op `transform`/`endTransform`) — Métamorphose de l'Enfant d'Ulric
 * (Middenheim p.116) : le tableau RAW est un DELTA appliqué au profil HUMAIN (M+1, CC+10, F/E/I/Ag+10,
 * Dex/Int−10, Soc−20 + Traits hybrides), PERSISTANT (jamais dissipé seul) et TOGGLABLE (retour à volonté).
 * Le `tag` groupe tous les effets → retrait atomique. Générique (aucun nom d'entité en dur dans le moteur).
 */
const HYBRIDE_ULRIC: GameOp[] = [
  { op: 'charMod', char: 'capacite-de-combat', mod: 10 }, { op: 'charMod', char: 'force', mod: 10 },
  { op: 'charMod', char: 'endurance', mod: 10 }, { op: 'charMod', char: 'initiative', mod: 10 },
  { op: 'charMod', char: 'agilite', mod: 10 }, { op: 'charMod', char: 'dexterite', mod: -10 },
  { op: 'charMod', char: 'intelligence', mod: -10 }, { op: 'charMod', char: 'sociabilite', mod: -20 },
  { op: 'moveMod', mod: 1 },
  { op: 'grantTrait', trait: { id: 'arme', value: { sum: [{ bonusOf: 'force' }, 4] } } },
  { op: 'grantTrait', trait: { id: 'morsure', value: { sum: [{ bonusOf: 'force' }, 3] } } }, { op: 'grantTrait', trait: { id: 'armure', value: 2 } },
  { op: 'grantTrait', trait: { id: 'peur', value: 2 } }, { op: 'grantTrait', trait: { id: 'pisteur' } },
  { op: 'grantTrait', trait: { id: 'vision-nocturne' } },
];

/** Humain à 30 partout : né au maximum dérivé, 3 + 6 + 3 = 12 (`combattantDeTest`). */
const human = (): Combatant => combattantDeTest({ id: 'u', label: 'Enfant d’Ulric', kind: 'enemy', traits: [{ id: 'metamorphose' }] });

const TAG = 'ulric-hybride';

describe('transform / endTransform — Métamorphose Enfant d’Ulric (delta RAW, Middenheim p.116)', () => {
  it('applique le DELTA du tableau + Traits hybrides + apparence, en une passe', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], { rng: desDuTest });
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(40); // +10
    expect(effectiveChar(c, 'force')).toBe(40);
    expect(effectiveChar(c, 'agilite')).toBe(40);
    expect(effectiveChar(c, 'dexterite')).toBe(20); // −10
    expect(effectiveChar(c, 'sociabilite')).toBe(10); // −20
    expect(effectiveChar(c, 'force-mentale')).toBe(30); // inchangé (— dans le tableau)
    expect(effectiveMovement(c)).toBe(5); // M+1
    expect(hasTraitKey(c.traits, 'peur')).toBe(true);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(true);
    expect(c.causesPeur).toBe(2); // scalaire psy re-dérivé (Peur 2 accordée — l'Indice, pas un booléen)
    expect(liveMorphRef(c)).toBe('enfant-d-ulric'); // forme hybride
  });

  it('Arme et Morsure prennent l’Indice formulé sur la Force de la forme hybride (Middenheim 04 l.29)', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], { rng: desDuTest });
    expect(c.traits?.find((t) => t.id === 'arme')?.value).toBe(8); // BF 4 (F 30 + 10) + 4
    expect(c.traits?.find((t) => t.id === 'morsure')?.value).toBe(7); // BF 4 + 3
  });

  it('la manœuvre « forme-hybride-ulric » de la donnée octroie Arme (BF +4) et Morsure (BF +3) (Middenheim 04 l.29)', () => {
    const transform = findManeuverById('forme-hybride-ulric')!.effects!.flatMap((e) => (e.flow.kind === 'do' && e.flow.effect.type === 'ops' ? e.flow.effect.ops : []))
      .find((o): o is Extract<GameOp, { op: 'transform' }> => o.op === 'transform')!;
    const octroi = (id: string) => transform.ops.find((o): o is Extract<GameOp, { op: 'grantTrait' }> => o.op === 'grantTrait' && o.trait.id === id)?.trait.value;
    expect(octroi('arme')).toEqual({ sum: [{ bonusOf: 'force' }, 4] });
    expect(octroi('morsure')).toEqual({ sum: [{ bonusOf: 'force' }, 3] });
  });

  it('PERSISTE : la forme ne se dissipe pas seule en fin de Round (durée permanente)', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], { rng: desDuTest });
    endOfRound(c, desDuTest); endOfRound(c, desDuTest); // deux frontières de Round
    expect(effectiveChar(c, 'force')).toBe(40); // toujours transformé
    expect(liveMorphRef(c)).toBe('enfant-d-ulric');
    expect(hasTraitKey(c.traits, 'peur')).toBe(true);
  });

  it('endTransform : retour ATOMIQUE à la forme de base (Caractéristiques, Traits, apparence)', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], { rng: desDuTest });
    applyOps(c, [{ op: 'endTransform', tag: TAG }], { rng: desDuTest });
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(30);
    expect(effectiveChar(c, 'force')).toBe(30);
    expect(effectiveChar(c, 'sociabilite')).toBe(30);
    expect(effectiveMovement(c)).toBe(4);
    expect(hasTraitKey(c.traits, 'peur')).toBe(false);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(false);
    expect(c.causesPeur).toBeFalsy(); // Peur retirée → scalaire re-dérivé absent
    expect(liveMorphRef(c)).toBeUndefined();
  });

  it('endTransform sur une forme absente = no-op (idempotent)', () => {
    const c = human();
    applyOps(c, [{ op: 'endTransform', tag: TAG }], { rng: desDuTest });
    expect(effectiveChar(c, 'force')).toBe(30);
    expect(liveMorphRef(c)).toBeUndefined();
  });

  it('effectId (pas le libellé) porte l’IDENTITÉ de la transformation — pose ET retrait complets, robustes à une collision de libellé', () => {
    const c = human();
    // Effet ÉTRANGER pré-existant dont le LIBELLÉ collisionne avec le tag (décoy) — jamais touché par transform/endTransform.
    const decoy = { label: TAG, bonus: 5, char: 'force-mentale' as const, duration: { scale: 'permanent' as const } };
    c.activeEffects = [decoy];

    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], { rng: desDuTest });
    const posed = (c.activeEffects ?? []).filter((e) => e !== decoy);
    expect(posed.length).toBeGreaterThan(0); // 8 charMod + 1 moveMod + 5 grantTrait + 1 morphRef
    expect(posed.every((e) => e.effectId === TAG)).toBe(true); // TOUT effet posé, y compris les charMod du profil

    applyOps(c, [{ op: 'endTransform', tag: TAG }], { rng: desDuTest });
    expect(c.activeEffects).toEqual([decoy]); // retrait EXACT des effets taggés — le décoy (même libellé) survit
    expect(effectiveChar(c, 'force')).toBe(30); // bien retourné à la forme de base
  });

  it('selfManeuverApplicable : gate DANS/HORS forme piloté par effectId (pas le libellé)', () => {
    const enter = findManeuverById('forme-hybride-ulric')!;
    const exit = findManeuverById('forme-humaine-ulric')!;
    const c = human();
    expect(selfManeuverApplicable(c, enter)).toBe(true); // hors forme → peut entrer
    expect(selfManeuverApplicable(c, exit)).toBe(false); // hors forme → ne peut PAS (déjà) en sortir

    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], { rng: desDuTest });
    expect(selfManeuverApplicable(c, enter)).toBe(false); // dans la forme → ne peut plus (re)entrer
    expect(selfManeuverApplicable(c, exit)).toBe(true); // dans la forme → peut en sortir

    // DÉCOY : un activeEffect au LIBELLÉ collisionnant avec le tag mais SANS effectId ne doit PAS suffire au gate.
    const d = human();
    d.activeEffects = [{ label: TAG, bonus: 0, duration: { scale: 'permanent' } }] as never;
    expect(selfManeuverApplicable(d, exit)).toBe(false);
  });
});

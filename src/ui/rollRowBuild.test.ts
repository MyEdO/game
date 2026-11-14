/**
 * MONTEUR MONO d'une rangée de jet (#1262) — `buildRollRow` : l'acteur passé UNE fois (Chance et
 * Résilience s'en dérivent au rendu), `rolled` dérivé de la donnée du jet, extras typés du site.
 */
import { describe, it, expect } from 'vitest';
import { buildRollRow, participantRow, tableRow, drawRow, worldRow, frozenOpposedRow, isBuiltRollRow } from './rollRowBuild';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({
    id: 'H1', label: 'Héros H1', kind: 'heros',
    characteristics: {}, skills: [], conditions: [], talents: [], fortune: 2, resilience: 3,
  }) as unknown as Combatant;

describe('#1262 — buildRollRow', () => {
  it('l’acteur est passé UNE fois (Chance/Résilience s’en dérivent au rendu, jamais recopiées)', () => {
    const h = hero();
    const r = buildRollRow({ row: {}, actor: h, onRoll: () => {} });
    expect(r.actor).toBe(h);
    expect(r).not.toHaveProperty('fortune');
    expect(r).not.toHaveProperty('resilience');
  });

  it('`rolled` se DÉRIVE de la donnée du jet (`row.d`), jamais déclaré par le site', () => {
    expect(buildRollRow({ row: {} }).rolled).toBe(false);
    const d = { roll: 30, target: 40, sl: 1, success: true } as never;
    expect(buildRollRow({ row: { d } }).rolled).toBe(true);
  });

  it('les extras TYPÉS du site passent tels quels (Test étendu, garde de règle…)', () => {
    const r = buildRollRow({ row: {} }, { extendedDr: { cum: 2, target: 5 }, rollBlocked: 'hors de portée' });
    expect(r.extendedDr).toEqual({ cum: 2, target: 5 });
    expect(r.rollBlocked).toBe('hors de portée');
  });

  it('le noyau passe intégralement (faits + handlers, aucun perdu en route)', () => {
    const noop = () => {};
    const r = buildRollRow({
      row: {}, actor: hero(), onRoll: noop, rerolled: true, lost: true,
      onReroll: noop, onDarkPact: noop, onBonusSL: noop, onForce: noop,
    });
    expect(r.rerolled).toBe(true);
    expect(r.lost).toBe(true);
    expect(r.onReroll).toBe(noop);
    expect(r.onDarkPact).toBe(noop);
    expect(r.onBonusSL).toBe(noop);
    expect(r.onForce).toBe(noop);
  });
});

/**
 * #1262 — la FAMILLE de constructeurs de la porte : chacun POSE la marque (`isBuiltRollRow`), un
 * littéral manuscrit ne l'a pas (et ne compile plus : la marque est REQUISE). Les formes
 * irréductibles ont leur constructeur DÉDIÉ plutôt qu'un littéral au site : porte-sélecteur de table,
 * tirage vif sans ligne de jet, rangée-monde sans acteur, témoin à jet figé.
 */
describe('#1262 L0 — la famille de la porte', () => {
  const d = { roll: 30, target: 40, sl: 1, success: true } as never;

  it('les 6 constructeurs posent la marque ; un littéral manuscrit ne la porte pas', () => {
    expect(isBuiltRollRow(buildRollRow({ row: {} }))).toBe(true);
    expect(isBuiltRollRow(participantRow({ key: 'h1', row: {}, actor: hero() }))).toBe(true);
    expect(isBuiltRollRow(tableRow({ key: 's:die', row: {} }))).toBe(true);
    expect(isBuiltRollRow(drawRow({ row: {}, onRoll: () => {} }))).toBe(true);
    expect(isBuiltRollRow(worldRow({ row: {}, onRoll: () => {} }))).toBe(true);
    expect(isBuiltRollRow(frozenOpposedRow({ revele: true, row: { d } }))).toBe(true);
    expect(isBuiltRollRow({ row: {}, rolled: false })).toBe(false);
  });

  it('`drawRow` : TIRAGE VIF sans ligne de jet — `rolled` suit la NOTE, jamais un `row.d` absent', () => {
    const avant = drawRow({ row: {}, rollLabel: 'Lancer sur le Tableau des Oups !', onRoll: () => {} });
    expect([avant.rolled, avant.rollLabel], 'pré-tirage : rien à afficher, la phase reste pré-jet').toEqual([false, 'Lancer sur le Tableau des Oups !']);
    const apres = drawRow({ row: { note: 'Oups ! 42 — Vous vous entaillez' }, onRoll: () => {} });
    expect(apres.rolled, 'la note EST le rendu du tirage : la dérivation du noyau (`!!row.d`) rendrait `false` ici').toBe(true);
    // Aucune influence, aucun cycle : la rangée ne porte que ce qu'on lui a donné.
    expect(Object.keys(apres).sort()).toEqual(['onRoll', 'rolled', 'row']);
  });

  it('la marque SURVIT au post-traitement par spread (le site retouche sa rangée)', () => {
    const r = participantRow({ key: 'h1', row: { d }, actor: hero() });
    expect(isBuiltRollRow({ ...r, flowKey: 'cascadeEnBande' as const, winner: 'win' })).toBe(true);
  });

  it('`participantRow` : identité de slot, interactivité et Test étendu ; `rolled` reste dérivé', () => {
    const r = participantRow({ key: 'h1', row: { d }, actor: hero(), interactive: false, rollLabel: 'Frapper', extendedDr: { cum: 1, target: 3 } });
    expect([r.key, r.interactive, r.rollLabel, r.extendedDr, r.rolled]).toEqual(['h1', false, 'Frapper', { cum: 1, target: 3 }, true]);
    // Rien d'optionnel n'est posé « à vide » : une clé absente reste absente (le site ne reçoit pas de bruit).
    expect(Object.keys(participantRow({ key: 'h1', row: {} })).sort()).toEqual(['key', 'rolled', 'row']);
  });

  it('`tableRow` : porte-sélecteur SANS `onRoll` — ni bouton de rangée, ni « Lancer » hissé', () => {
    const r = tableRow({ key: 's:die', row: {}, forcedRoll: { roll: null, target: 100, onSet: () => {}, fixed: true }, fixedMark: false });
    expect(r.rolled).toBe(false);
    expect(r.onRoll).toBeUndefined();
    expect(r.forcedRoll?.fixed).toBe(true);
    expect(r.fixedMark).toBe(false);
  });

  it('`worldRow` : rangée SANS acteur — aucune ressource de héros n’y est portée', () => {
    const r = worldRow({ row: { d }, onRoll: () => {} }, { key: 'monde' });
    expect(r.actor).toBeUndefined();
    expect([r.rolled, r.key]).toEqual([true, 'monde']);
  });

  it('`frozenOpposedRow` : témoin FIGÉ (`rolled` vrai même en valeur opaque `pending` — BargainModal:93)', () => {
    const r = frozenOpposedRow({ revele: true, row: { pending: { label: 'Marchandage', base: 40 } } });
    expect([r.rolled, r.interactive]).toEqual([true, false]);
  });

  it('`frozenOpposedRow` : non révélé, la rangée se masque — marque conservée', () => {
    const r = frozenOpposedRow({ revele: false, row: { d } });
    expect(r.row.d?.mask).toBe('roll');
    expect(isBuiltRollRow(r)).toBe(true);
  });
});

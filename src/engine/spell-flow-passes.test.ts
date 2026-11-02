/**
 * LES DEUX PASSES d'un Flow de Sort (`spellFlowFor`, #1463 β2) : une feuille suit son `on` ; un nœud
 * interactif (`test`, `choice`) se joue ENTIER dans une seule passe, jamais deux fois pour une même cible.
 */
import { describe, it, expect } from 'vitest';
import { spellFlowFor } from './flowCore';
import type { Flow } from '../data/schemas/defs-scenes/effets';

const feuille = (on: 'target' | 'caster', text: string): Flow => ({ kind: 'do', effect: { type: 'ops', on, ops: [{ op: 'narrative', text }] } });
const VIDE: Flow = { kind: 'seq', steps: [] };
const choix = (yes: Flow, no: Flow): Flow => ({ kind: 'choice', prompt: 'Choisir', yes, no });
const test = (success: Flow, fail: Flow): Flow => ({ kind: 'test', test: { skill: { id: 'esquive' }, difficulty: 'intermediaire' }, success, fail });

describe('spellFlowFor', () => {
  it('une feuille suit son `on`', () => {
    const f: Flow = { kind: 'seq', steps: [feuille('target', 'c'), feuille('caster', 'l')] };
    expect(spellFlowFor(f, 'target')).toEqual({ kind: 'seq', steps: [feuille('target', 'c'), VIDE] });
    expect(spellFlowFor(f, 'caster')).toEqual({ kind: 'seq', steps: [VIDE, feuille('caster', 'l')] });
  });

  it('un nœud aux feuilles des deux `on` se joue entier dans la passe de la cible, et seulement là', () => {
    for (const noeud of [choix(feuille('target', 'c'), feuille('caster', 'l')), test(feuille('caster', 'l'), feuille('target', 'c'))]) {
      expect(spellFlowFor(noeud, 'target')).toEqual(noeud);
      expect(spellFlowFor(noeud, 'caster')).toEqual(VIDE);
    }
  });

  it('un nœud aux seules feuilles du lanceur se joue dans sa passe', () => {
    const noeud = choix(feuille('caster', 'l'), feuille('caster', 'm'));
    expect(spellFlowFor(noeud, 'caster')).toEqual(noeud);
    expect(spellFlowFor(noeud, 'target')).toEqual(VIDE);
  });
});

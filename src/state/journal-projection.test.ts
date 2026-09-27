import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { traceLineOf, testTraceLabel } from '../engine/traceLine';
import { deElide } from '../i18n';
import { startCascade, runCascadeImmediate } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { FLOWS } from './rollFlowSpecs';
import type { CascadeStep, PendingReload, PendingTest } from './pendings';

/**
 * #1262 V3 Lj — LE JOURNAL EST UNE PROJECTION.
 *
 * La ligne de dé se DÉRIVE (`traceLineOf`) et ne s'émet QUE si aucune fenêtre ne l'a montrée ;
 * l'issue se DÉCLARE au flux (`spec.issue`) et se journalise au VERBE TERMINAL `apply`, une fois.
 */
describe('le dériveur — patron unique de la ligne de dé', () => {
  it('porteur + DR : « qui — libellé : dé/cible → issue (DR ±n) »', () => {
    expect(traceLineOf({ who: 'Brawn', label: 'Résistance', roll: 45, target: 60, sl: 2, success: true }))
      .toBe('Brawn — Résistance : 45/60 → réussi (DR +2).');
  });

  it('issue du DOMAINE quand il en a une plus précise que réussi/échec', () => {
    expect(traceLineOf({ who: 'Brawn', label: 'Faim', roll: 78, target: 30, sl: -5, success: false, issue: 'ÉCHEC' }))
      .toBe('Brawn — Faim : 78/30 → ÉCHEC (DR -5).');
  });

  it('sans porteur (le libellé nomme déjà qui lance) et sans DR (le jet n’en porte pas)', () => {
    expect(traceLineOf({ label: 'Contre-sort de Gunther', roll: 12, target: 55, sl: 4, success: true, issue: 'le Sort est DISSIPÉ' }))
      .toBe('Contre-sort de Gunther : 12/55 → le Sort est DISSIPÉ (DR +4).');
    expect(traceLineOf({ label: 'Épée — Disponibilité', roll: 33, target: 70, success: true, issue: 'disponible ×2' }))
      .toBe('Épée — Disponibilité : 33/70 → disponible ×2.');
  });

  it('libellé absent → « Test » (repli du patron, jamais une ligne muette)', () => {
    expect(traceLineOf({ who: 'Brawn', roll: 5, target: 40, sl: 3, success: true })).toContain('Brawn — Test : 5/40');
  });

  it('Test résolu SANS fenêtre : le libellé porte la Compétence ET sa Difficulté (elle ne se lit nulle part ailleurs)', () => {
    expect(traceLineOf({ who: 'Brawn', label: testTraceLabel('Résistance', 'difficile'), roll: 45, target: 60, sl: 2, success: true }))
      .toBe('Brawn — Test de Résistance Difficile (−20) : 45/60 → réussi (DR +2).');
  });

  /** La PRÉPOSITION s'élide devant une voyelle (« Test d'Initiative », jamais « Test de Initiative ») —
   *  une seule écriture, `deElide` (`src/i18n`), composée par le patron du catalogue. */
  it('le sujet du Test porte son ÉLISION : « d’Initiative » devant voyelle, « de Résistance » sinon', () => {
    expect(testTraceLabel('Initiative', 'intermediaire')).toBe('Test d’Initiative Intermédiaire (+0)');
    expect(testTraceLabel('Endurance', 'intermediaire')).toBe('Test d’Endurance Intermédiaire (+0)');
    expect(testTraceLabel('Agilité', 'intermediaire')).toBe('Test d’Agilité Intermédiaire (+0)');
    expect(testTraceLabel('Résistance', 'intermediaire')).toBe('Test de Résistance Intermédiaire (+0)');
    expect(testTraceLabel('Navigation', 'intermediaire')).toBe('Test de Navigation Intermédiaire (+0)');
    // PÉRIMÈTRE DÉCLARÉ du helper : le `h` n'est PAS élidé (aspiré vs muet, indécidable sur le mot).
    expect(deElide('Halfling')).toBe('de Halfling');
  });

  it('forme OPPOSÉE (#1294) : DEUX jets sur UNE ligne, issue par défaut vue du DÉFENSEUR', () => {
    expect(traceLineOf({
      attacker: { who: 'Gobelin', label: 'Force', roll: 33, target: 40, sl: 0 },
      defender: { who: 'Brawn', label: 'Résistance', roll: 21, target: 55, sl: 3 },
      winner: 'defender',
    })).toBe('Gobelin (Force) 33/40 (DR +0) vs Brawn (Résistance) 21/55 (DR +3) — résiste.');
    expect(traceLineOf({
      attacker: { who: 'Gobelin', label: 'Force', roll: 12, target: 60, sl: 4 },
      defender: { who: 'Brawn', label: 'Résistance', roll: 51, target: 55, sl: 0 },
      winner: 'attacker',
    })).toBe('Gobelin (Force) 12/60 (DR +4) vs Brawn (Résistance) 51/55 (DR +0) — l’emporte.');
  });

  it('forme OPPOSÉE : ÉGALITÉ parfaite → la ligne DIT le statu quo (LDB 12 l.160), jamais un vainqueur', () => {
    expect(traceLineOf({
      attacker: { who: 'Gobelin', label: 'Force', roll: 33, target: 40, sl: 1 },
      defender: { who: 'Brawn', label: 'Résistance', roll: 21, target: 40, sl: 1 },
      winner: 'tie',
    })).toBe('Gobelin (Force) 33/40 (DR +1) vs Brawn (Résistance) 21/40 (DR +1) — égalité, rien ne se passe.');
  });

  it('forme OPPOSÉE : le DR ACCORDÉ au défenseur (Piège-lame, LDB 62 l.280) reste LISIBLE en sus', () => {
    expect(traceLineOf({
      attacker: { who: 'Gobelin', label: 'Force', roll: 33, target: 40, sl: 0 },
      defender: { who: 'Brawn', label: 'Athlétisme', roll: 21, target: 55, sl: 3, slBonus: 1 },
      winner: 'defender', issue: 'la lame se BRISE',
    })).toBe('Gobelin (Force) 33/40 (DR +0) vs Brawn (Athlétisme) 21/55 (DR +3+1) — la lame se BRISE.');
  });
});

describe('partition anti-doublon — la ligne de dé n’existe QUE sans fenêtre', () => {
  const applied: { kind: string; success: boolean }[] = [];
  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    spyApplier('tally', applied, (step) => ({ kind: step.kind, success: !!step.result?.success }));
  });
  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    useGame.setState({ party: [h] });
    return h;
  }
  const step = (id: string, actorId: string): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: fixtureText(id), rollLabel: 'Résistance', base: 55, target: 55, result: null });

  it('pilote IMMÉDIAT (aucune fenêtre) : l’étape MONO reçoit SA ligne de dé, dérivée', () => {
    useGame.getState().seedRng(3);
    const h = hero();
    runCascadeImmediate(useGame.getState, useGame.setState, [step('s1', h.id)]);
    const traces = useGame.getState().journal.filter((l) => /^Brawn — Résistance : \d+\/55 → (réussi|échec) \(DR [+-]\d+\)\.$/.test(l));
    expect(traces, `journal:\n${useGame.getState().journal.join('\n')}`).toHaveLength(1);
  });

  it('« Tout lancer » (modale ouverte sur le BILAN, chaque rangée montre son dé) : AUCUNE ligne de dé', () => {
    useGame.getState().seedRng(3);
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id)] });
    useGame.getState().cascadeResolveAll();
    expect(useGame.getState().journal.filter((l) => /Résistance : \d+\/55/.test(l))).toEqual([]);
  });

  it('étape qui ARRIVE déjà résolue (son dé a été montré ailleurs) : aucune ligne de dé au pilote immédiat', () => {
    const h = hero();
    const resolved: CascadeStep = { ...step('s1', h.id), result: { roll: 12, target: 55, sl: 4, success: true } };
    runCascadeImmediate(useGame.getState, useGame.setState, [resolved]);
    expect(useGame.getState().journal.filter((l) => /Résistance : 12\/55/.test(l))).toEqual([]);
  });
});

describe('le verbe terminal `apply` — l’issue se journalise UNE fois, au goulot', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingCascade: null, pendingTest: null, pendingReload: null, journal: [] });
  });

  it('canal NARRATIF (Test de scène) : `apply` journalise l’issue déclarée, et l’acquittement n’en écrit pas une seconde', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    useGame.setState({ party: [h] });
    const pt: PendingTest = {
      actorId: h.id, actorName: h.label, skill: 'Athlétisme', skillValue: 50, difficulty: 'intermediaire',
      target: 50, roll: 12, success: true, sl: 3, isDouble: false, base: 50, mods: [], requireSL: 0,
    } as unknown as PendingTest;
    useGame.setState({ pendingTest: pt });
    useGame.getState().resolveTest();
    const issues = useGame.getState().journal.filter((l) => l.includes('Brawn réussit.'));
    expect(issues, `journal:\n${useGame.getState().journal.join('\n')}`).toHaveLength(1);
  });

  it('canal COMBAT (rechargement) : `apply` REND la ligne sans écrire au journal narratif (le site la tisse dans son `set`)', () => {
    const pr: PendingReload = {
      actorId: 'a', actorName: 'Brawn', weaponUid: 'w1', reload: 3, progressBefore: 0,
      skillValue: 50, difficulty: 'intermediaire', roll: 12, target: 50, sl: 2, success: true,
    } as PendingReload;
    const lines = FLOWS.reload.apply(useGame.getState, { p: pr, ctx: { after: 2, weapon: 'Arquebuse' } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Arquebuse');
    expect(useGame.getState().journal, 'canal COMBAT : rien dans le journal narratif').toEqual([]);
  });

  it('aucun pending, aucune issue déclarée → aucune ligne (le verbe est inerte, jamais une ligne forgée)', () => {
    expect(FLOWS.reload.apply(useGame.getState)).toEqual([]);
    expect(FLOWS.attack.apply(useGame.getState)).toEqual([]);
  });
});

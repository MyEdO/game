import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makeRNG, roll as rollDes, type DiceSpec } from '../engine/dice';
import {
  startCascade, runCascadeImmediate, stepInteraction, stepReady, roulerDe, lireEnTable, plageNaturelle,
  specDeEtape, tableSpec, registerTableStep, rollTableStep, tableStepNaturalRange,
} from './cascade';
import { dieStep, pushDie } from './rollSeam';
import { spyApplier } from './cascadeTestKit';
import { WORLD_STEP_OWNER } from './netOwnership';
import type { CascadeStep } from './pendings';

/**
 * ÉTAPE À DÉ NU (#1508) — un tirage dont le TOTAL est la conséquence (hauteur d'une chute, unités
 * d'une amputation, magnitude d'un effet) passe par LA MÊME PORTE qu'une table : même déclaration
 * (`CascadeDeTirage`), même roulage (`roulerDe`), même pose, même rangée. Doctrine utilisateur du
 * 2026-09-04 : « Vu que tous les jets passé par le même point d'entrée, il est inutile de se demander
 * si le jeu est configuré pour » — un site n'a aucune classe à choisir, il déclare son dé.
 *
 * Contrats POSITIFS, exercés par les VRAIES coutures du store (`cascadeDieRoll`/
 * `cascadeDieSetForcedRoll`/`cascadeNext`/`cascadeResolveAll`) et par le pilote immédiat.
 */
describe('Étape à DÉ NU — le tirage dont le total est la conséquence (#1508)', () => {
  const tombes: { roll: number; total: number }[] = [];

  beforeEach(() => {
    tombes.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    spyApplier('deSpy', tombes, (step) => ({ roll: step.de!.result!.roll, total: step.de!.result!.total }));
  });

  const chute = (id: string, over: Partial<Parameters<typeof dieStep>[0]> = {}) =>
    dieStep({
      id, kind: 'deSpy', label: fixtureText('Hauteur de chute'), icon: 'nav/dice',
      spec: { n: 2, sides: 10 }, unite: 'm', worldOwner: true, ...over,
    })!;

  it('(i) une étape `de` mintée n’est PAS prête, et `cascadeDieRoll` pose un total DANS la plage naturelle', () => {
    const st = chute('d1');
    expect(stepInteraction(st)).toBe('de');
    expect(stepReady(st, useGame.getState())).toBe(false);
    useGame.getState().seedRng(4);
    startCascade(useGame.getState, useGame.setState, { title: 'Chute', purpose: 'test', steps: [st] });
    useGame.getState().cascadeNext(); // pas encore tiré → no-op : la fenêtre force d'abord le dé
    expect(tombes).toHaveLength(0);
    useGame.getState().cascadeDieRoll('d1');
    const res = useGame.getState().pendingCascade!.participants[0].de!.result!;
    const plage = plageNaturelle({ n: 2, sides: 10 });
    expect(plage).toEqual({ min: 2, max: 20 });
    expect(res.roll).toBeGreaterThanOrEqual(plage.min);
    expect(res.roll).toBeLessThanOrEqual(plage.max);
    expect(res.total, 'sans mod ni plus, le total EST le naturel').toBe(res.roll);
    expect(stepReady(useGame.getState().pendingCascade!.participants[0], useGame.getState())).toBe(true);
    useGame.getState().cascadeNext();
    expect(tombes).toEqual([{ roll: res.roll, total: res.total }]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('(ii) `cascadeDieSetForcedRoll(n)` : total = n + mod, le dé posé n’est JAMAIS retiré', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'Chute', purpose: 'test', steps: [chute('d1', { mod: 3 })] });
    useGame.getState().cascadeDieSetForcedRoll('d1', 14);
    const etape = () => useGame.getState().pendingCascade!.participants[0];
    expect(etape().de!.result).toEqual({ roll: 14, total: 17 });
    expect(etape().fixed, 'la provenance du dé est marquée').toBe(true);
    // RE-POSE tant que l'étape est COURANTE (parité exacte avec la table) : le résultat se recalcule.
    useGame.getState().cascadeDieSetForcedRoll('d1', 5);
    expect(etape().de!.result).toEqual({ roll: 5, total: 8 });
    // Un dé POSÉ n'est jamais re-tiré, même par le verbe de lancer.
    useGame.getState().cascadeDieRoll('d1');
    expect(etape().de!.result).toEqual({ roll: 5, total: 8 });
  });

  it('(iii) hors plage : la saisie est RAMENÉE aux naturels que ces dés savent sortir (2d10 = 2..20)', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'Chute', purpose: 'test', steps: [chute('d1')] });
    const etape = () => useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll('d1', 99);
    expect(etape().de!.result, 'un 2d10 ne sort pas 99').toEqual({ roll: 20, total: 20 });
    useGame.getState().cascadeDieSetForcedRoll('d1', 0);
    expect(etape().de!.result, 'ni 0 — deux dés font au moins 2').toEqual({ roll: 2, total: 2 });
  });

  it('(iii bis) la PORTE refuse des dés non tirables : aucune étape ouverte, jamais un affichage validé d’office', () => {
    expect(() => dieStep({ id: 'muet', kind: 'deSpy', label: fixtureText('Rien'), spec: { n: 0, sides: 10 }, worldOwner: true }))
      .toThrow(/dés non tirables \(0d10\)/);
    expect(() => dieStep({ id: 'muet2', kind: 'deSpy', label: fixtureText('Rien'), spec: { n: 1, sides: 0 }, worldOwner: true }))
      .toThrow(/dés non tirables \(1d0\)/);
  });

  it('(iii ter) le RÉSOLVEUR est le dernier verrou : ni plancher silencieux sur les dés, ni d100 deviné', () => {
    // Un plancher (`Math.max(1, n)`) rendrait un dé que personne n'a déclaré — le socle LÈVE.
    expect(() => roulerDe({}, { n: 0, sides: 10 }, makeRNG(1))).toThrow(/dés non tirables \(0d10\)/);
    expect(() => roulerDe({}, { n: 2, sides: 0 }, makeRNG(1))).toThrow(/dés non tirables \(2d0\)/);
    // Un DÉ NU n'a aucune table où prendre ses dés : pas de repli d100 (une TABLE, elle, a le sien).
    expect(() => specDeEtape({})).toThrow(/dé NU sans `spec`/);
    expect(tableSpec({ tableId: 'test-invariance-table' }), 'la table, elle, donne son défaut').toBeTruthy();
  });

  it('(iv) `runCascadeImmediate` résout un `de` d’office ET le JOURNALISE (dé + total avec son unité)', () => {
    useGame.getState().seedRng(9);
    const out = runCascadeImmediate(useGame.getState, useGame.setState, [chute('d3', { forcedRoll: 13 })])!;
    expect(out[0].de!.result).toEqual({ roll: 13, total: 13 });
    expect(tombes).toEqual([{ roll: 13, total: 13 }]);
    const lignes = useGame.getState().journal.filter((l) => /Hauteur de chute/.test(l));
    expect(lignes, 'le journal est la SEULE surface de ce dé : il porte le dé ET le total en mètres').toEqual(
      ['Hauteur de chute : dé 13 → 13 m.'],
    );
  });

  it('(iv bis) « Tout lancer » résout les `de` restants par le MÊME résolveur', () => {
    useGame.getState().seedRng(11);
    startCascade(useGame.getState, useGame.setState, { title: 'Chute', purpose: 'test', steps: [chute('a'), chute('b')] });
    useGame.getState().cascadeResolveAll();
    expect(tombes).toHaveLength(2);
    for (const t of tombes) { expect(t.roll).toBeGreaterThanOrEqual(2); expect(t.roll).toBeLessThanOrEqual(20); }
  });

  it('le mint POSE la possession du monde, et `pushDie` APPEND à la séquence en cours (aucune fenêtre neuve)', () => {
    expect(chute('d1').worldOwner).toBe(true);
    expect(chute('d1', { worldOwner: false, actorId: 'h1' }).actorId).toBe('h1');
    startCascade(useGame.getState, useGame.setState, { title: 'Chute', purpose: 'test', steps: [chute('premier')] });
    pushDie(useGame.setState, { id: 'suite', kind: 'deSpy', label: fixtureText('Dégâts de la chute'), spec: { n: 1, sides: 10 }, worldOwner: true }, 'test');
    const p = useGame.getState().pendingCascade!;
    expect(p.participants.map((s) => s.id), 'UNE séquence, deux étapes — l’index d’append rend l’id unique').toEqual(['premier', 'suite-1']);
    expect(useGame.getState().suspendedCascades, 'aucune cascade suspendue : rien n’a ouvert de 2ᵉ fenêtre').toEqual([]);
  });

  it('le PORTEUR par défaut d’un dé de monde est le sentinel `WORLD_STEP_OWNER` (aucun personnage nommé)', () => {
    const st = chute('d1');
    expect(st.actorId).toBeUndefined();
    expect(st.worldOwner).toBe(true);
    expect(WORLD_STEP_OWNER, 'le sentinel existe et route la fenêtre au siège du monde').toBeTruthy();
  });

  it('`roulerDe` est PUR et honore `keepHighest` / `plus` / `mod` — un dé POSÉ prime sur tout', () => {
    const spec: DiceSpec = { n: 1, sides: 10, plus: 5 };
    expect(roulerDe({ forcedRoll: 4, mod: 2 }, spec, makeRNG(1)), 'naturel + plus + mod').toEqual({ roll: 4, total: 11 });
    // `keepHighest` rejoue le NATUREL : deux tirages, le meilleur retenu — mais jamais sous dé posé.
    const rng = makeRNG(7);
    const a = rollDes(1, 10, makeRNG(7));
    const b = rollDes(1, 10, (() => { const r = makeRNG(7); r.int(1, 10); return r; })());
    expect(roulerDe({ keepHighest: 2 }, { n: 1, sides: 10 }, rng)).toEqual({ roll: Math.max(a, b), total: Math.max(a, b) });
  });
});

/**
 * INVARIANCE DE FORME (#1508 T1) — le socle a SÉPARÉ le tirage (`roulerDe`) de sa lecture
 * (`lireEnTable`) ; une TABLE doit rendre EXACTEMENT ce qu'elle rendait, dé pour dé, seed par seed.
 * Le contrat compare `rollTableStep` à une RÉFÉRENCE écrite ici depuis le contrat d'origine (dé
 * naturel = `n` dés de `sides` faces totalisés, `+ mod`, plancher `clamp`) : deux implémentations
 * indépendantes, mêmes graines, zéro divergence.
 */
describe('INVARIANCE — une table rend le même dé après la séparation tirage / lecture', () => {
  const T = 'test-invariance-table';
  beforeEach(() => {
    registerTableStep(T, {
      label: 'Table d’invariance',
      die: 100,
      // La table COUVRE au-delà de 100 : les déclarations à `mod` positif doivent RESTER résolubles,
      // sinon la mesure d'invariance testerait le fail-fast de plage au lieu du dé (patron
      // `miscast-colere`, dont les Points de Péché poussent le dé effectif au-dessus de 100).
      rows: [{ min: 1, max: 30, id: 'a' }, { min: 31, max: 70, id: 'b' }, { min: 71, max: 120, id: 'c' }],
      lines: (die) => [`ligne ${die}`],
    });
  });

  /** LA RÉFÉRENCE — l'algorithme d'origine, écrit ici et nulle part ailleurs. */
  const reference = (decl: { spec?: DiceSpec; mod?: number; clamp?: boolean }, seed: number) => {
    const rng = makeRNG(seed);
    const n = decl.spec?.n ?? 1;
    const sides = decl.spec?.sides ?? 100;
    const naturel = rollDes(n, sides, rng);
    const brut = naturel + (decl.mod ?? 0);
    return { roll: naturel, die: decl.clamp ? Math.max(brut, 1) : brut };
  };

  it('80 graines × 4 déclarations : 0 divergence entre le résolveur et la référence', () => {
    const decls = [
      {},
      { mod: 10 },
      { mod: -20, clamp: true },
      { spec: { n: 2, sides: 10 } as DiceSpec, mod: 5 },
    ];
    const divergences: string[] = [];
    for (const d of decls) {
      for (let seed = 1; seed <= 80; seed++) {
        const attendu = reference(d, seed);
        const obtenu = rollTableStep({ tableId: T, ...d }, makeRNG(seed));
        if (obtenu.roll !== attendu.roll || obtenu.die !== attendu.die) {
          divergences.push(`seed ${seed} ${JSON.stringify(d)} : obtenu ${obtenu.roll}/${obtenu.die}, attendu ${attendu.roll}/${attendu.die}`);
        }
      }
    }
    expect(divergences, `Le dé d'une table a bougé — le lot #1508 T1 est un train de FORME :\n${divergences.join('\n')}`).toEqual([]);
  });

  it('la lecture est SÉPARABLE du tirage : `roulerDe` + `lireEnTable` = `rollTableStep`, dé pour dé', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const decl = { tableId: T, mod: 7 };
      const compose = lireEnTable(decl, roulerDe(decl, tableSpec(decl), makeRNG(seed)));
      expect(compose, `seed ${seed}`).toEqual(rollTableStep(decl, makeRNG(seed)));
    }
  });

  it('les DÉS d’une table se résolvent au même endroit que ceux d’un dé nu (`tableSpec` / `specDeEtape`)', () => {
    expect(tableSpec({ tableId: T }), 'la table donne son défaut').toEqual({ n: 1, sides: 100 });
    expect(tableSpec({ tableId: T, spec: { n: 2, sides: 10 } }), 'la déclaration l’emporte').toEqual({ n: 2, sides: 10 });
    expect(tableStepNaturalRange({ tableId: T, spec: { n: 2, sides: 10 } })).toEqual({ min: 2, max: 20 });
    expect(specDeEtape({ spec: { n: 3, sides: 6 } })).toEqual({ n: 3, sides: 6 });
  });
});

/** Type-only : une étape à dé NON résolue reste `'de'`, résolue elle bascule en `'affichage'`. */
describe('interaction d’une étape à dé', () => {
  it('résolue, l’étape n’est plus un tirage à faire', () => {
    const st: CascadeStep = { id: 'x', kind: 'deSpy', label: fixtureText('Chute'), de: { spec: { n: 1, sides: 10 } } };
    expect(stepInteraction(st)).toBe('de');
    expect(stepInteraction({ ...st, de: { ...st.de!, result: { roll: 4, total: 4 } } })).toBe('affichage');
  });
});

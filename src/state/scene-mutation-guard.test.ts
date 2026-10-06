import { describe, it, expect } from 'vitest';
import { scanSceneMutation } from '../../scripts/guards/lib/sceneMutation.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
import { detenteur } from '../detenteur.testkit';

/**
 * Garde-fou « immutabilité de la scène du store » — `src/state/vision.ts` et
 * `src/state/sceneMemo.ts` (`memoByRef`) reposent sur l'invariant qu'aucun code de `src/**` ne
 * réassigne un champ/tableau d'un porteur de `Scene` EN PLACE (`scene.<champ> = …`, alias,
 * `get().scene`, `.push(`/`.splice(` mutants…) : toute mise à jour produit une NOUVELLE scène par
 * spread. Scan AST réelle (compilateur TypeScript) — TOLÉRANCE ZÉRO, aucune baseline : le seul
 * site historique (`combatGeometry.ts` `removeEntities`) a été corrigé pour produire un spread.
 *
 * Portée GLOBALE (`src/**`, pas seulement `src/state/`) : l'invariant vaut pour tout porteur de la
 * scène du store, y compris hors `state/` (`src/gameIso/stage/useStagePointer.ts`,
 * `src/ui/editor/**` en manipulent aussi).
 *
 * Fixtures de test HORS SCOPE (une `scene` construite localement dans un test n'est jamais issue
 * du store) — d'où l'exclusion des fichiers `*.test.ts(x)`.
 *
 * `src/scenes/test-scenarios/**` EXCLU, ARGUMENTÉ (pas une baseline muette) : ces fichiers
 * CONSTRUISENT une `Scene` fraîche dans leur fabrique `construire` (`arena()`/`buildScene`) et la mutent
 * IMPÉRATIVEMENT pendant sa propre phase d'AUTHORING — avant toute exposition au store (elle n'est
 * rendue en `ScenarioConstruit.scene`, puis chargée via `set({ scene })`, qu'une fois COMPLÈTE).
 * `setEncounters` (`_shared.ts`) documente ce choix explicitement (« Mutation EN PLACE : les
 * scénarios construisent leur scène impérativement »). L'objet n'est donc JAMAIS un porteur de la
 * scène DU STORE au moment de la mutation — l'invariant ne s'y applique pas. Testé plus bas : si
 * cette exclusion devenait un cimetière (plus aucune mutation réelle dedans), le test le signale.
 */

/** Authoring-time (voir JSDoc ci-dessus) — jamais un porteur de la scène DU STORE. */
const AUTHORING_EXCLUDED = (rel: string) => rel.startsWith('src/scenes/test-scenarios/');

/** Corpus SCANNÉ une fois pour les deux assertions (l'invariant et la réalité de son exclusion) :
 *  les `.ts(x)` de `src/**` hors tests, rendus par la primitive de marche `readCorpus`, avec leurs
 *  sites de mutation, chemin RELATIF POSIX. Mémoïsation PARESSEUSE — la collecte Vitest ne paie
 *  rien, le premier `it` qui mesure paie le scan (#1801). */
const sites = detenteur(() => [...analyserCorpus(readCorpus(['src']))].map(({ fichier: { rel, text }, sourceFile }) => ({ rel, findings: scanSceneMutation(rel, text, sourceFile!) })));

describe('garde-fou « immutabilité de la scène du store » (AST, tolérance zéro)', () => {
  it('aucun code de src/** (hors authoring de test-scenarios) ne mute un champ d’un porteur de `scene` en place', () => {
    const offenders: string[] = [];
    for (const { rel, findings } of sites()) {
      if (AUTHORING_EXCLUDED(rel)) continue;
      for (const finding of findings) offenders.push(`${rel}:${finding.line} — ${finding.detail}`);
    }
    expect(
      offenders,
      'Mutation en place d’un champ de `scene` détectée — produire une NOUVELLE scène par spread ' +
        `(set({ scene: { ...scene, champ: nouvelleValeur } })) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('l’exclusion authoring de src/scenes/test-scenarios/ reste RÉELLE (sinon c’est un mort à retirer)', () => {
    const offenders: string[] = [];
    for (const { rel, findings } of sites()) {
      if (!AUTHORING_EXCLUDED(rel)) continue;
      offenders.push(...findings.map((f2) => `${rel}:${f2.line}`));
    }
    expect(offenders.length).toBeGreaterThan(0);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = 'function f(scene) { scene.entities = next; }';
    expect(scanSceneMutation('src/state/x.ts', regressed).length).toBe(1);
  });

  it.each([
    ['scene.entities = next', 'function f(scene) { scene.entities = next; }', true],
    ['scene.layers[0].tiles[3] = …', 'function f(scene) { scene.layers[0].tiles[3] = 1; }', true],
    ['scene.entities.splice(0,1)', 'function f(scene) { scene.entities.splice(0,1); }', true],
    ['scene.entities.length = 0', 'function f(scene) { scene.entities.length = 0; }', true],
    ['alias : const s = scene; s.entities = next', 'function f(scene) { const s = scene; s.entities = next; }', true],
    ['paramètre non nommé `scene` mais typé `Scene`', 'function f(sc: Scene) { sc.entities = []; }', true],
    [
      'déstructuration : const { entities } = scene; entities.push(e)',
      'function f(scene) { const { entities } = scene; entities.push(e); }',
      true,
    ],
    ['Object.assign(scene, { entities: next })', 'function f(scene) { Object.assign(scene, { entities: next }); }', true],
    ['delete scene.flags[k]', 'function f(scene) { delete scene.flags[k]; }', true],
    ['get().scene.entities = next', 'function f(get) { get().scene.entities = next; }', true],
    [
      'set((s) => { s.scene.entities = next; return {} })',
      'function f(set) { set((s) => { s.scene.entities = next; return {}; }); }',
      true,
    ],
    [
      'const draft = get().scene; draft.flags[k] = true',
      'function f(get) { const draft = get().scene; draft.flags[k] = true; }',
      true,
    ],
    [
      'mute(get().scene) — passage à un helper opaque, NON COUVERT (analyse interprocédurale requise)',
      'function f(get) { mute(get().scene); }',
      false,
    ],
  ] as const)('formulation « %s » — attendu détecté=%s', (_label, src, expected) => {
    const detected = scanSceneMutation('src/state/x.ts', src).length > 0;
    expect(detected).toBe(expected);
  });
});

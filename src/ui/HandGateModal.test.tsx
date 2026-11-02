import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollShell } from './RollShell';
import { buildRollRow } from './rollRowBuild';
import { testBreakdown } from './breakdown';
import { useGame } from '../state/store';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase, profilDeTest } from '../engine/combattantDeTest.testkit';

/**
 * ACCEPTATION de la couture `RollShell` → `forcedDieRow` : une modale de jet qui ne contient AUCUN code
 * de sélecteur de dé offre néanmoins le choix du dé, du seul fait qu'elle déclare son `flowKey`.
 *
 * RAW LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat » — la règle
 * est INCONDITIONNELLE ; elle ne peut donc pas dépendre du câblage manuel d'une modale. `handGate`
 * (Test de Dextérité de « Main ensanglantée », AA bras 46-50) est un flux à LENTILLE, sans `caps.picker` :
 * tout vient de la couche partagée.
 *
 * Le rendu passe par `RollShell` + le `flowKey` que la modale déclare (les composants CONNECTÉS au store
 * rendent `null` en SSR — zustand y sert son instantané INITIAL ; `RollShell`, lui, lit `getState()`).
 */
const HERO: Combatant = blessuresSurLeProfil({
  id: 'H', name: 'H', label: 'Héros', kind: 'hero',
  characteristics: profilDeTest({ dexterite: 40 }), wounds: blessuresDeBase(12), advantage: 0,
  conditions: [], traumas: [], resilience: 2, fortune: 0, weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
}) as unknown as Combatant;

/** Test de Dextérité RATÉ (88 vs 60) — le cas où la Résilience se dépense. */
function open() {
  useGame.setState({
    battle: { combatants: [HERO], log: [] } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingHandGate: {
      attackerId: 'H', skillValue: 60, difficulty: 'facile', target: 60, roll: 88, sl: -3, success: false,
    } as never,
  });
}

/** La rangée QUE REND `HandGateModal` (mêmes données), sous le `flowKey` qu'elle déclare. */
function shellHtml() {
  const pg = useGame.getState().pendingHandGate!;
  const row = buildRollRow({
    actor: HERO,
    row: { combatant: HERO, d: testBreakdown('Dextérité', pg.skillValue, { roll: pg.roll!, target: pg.target, sl: pg.sl, success: pg.success }, pg.difficulty) },
    onForce: () => {},
  });
  return renderToStaticMarkup(<RollShell flowKey="handGate" title="Main ensanglantée" rows={[row]} rolled actions={[]} />);
}

beforeEach(() => {
  resetDesFixes();
  useGame.setState({ pendingHandGate: null, battle: null });
});

// L'option « Dés fixés » est un SINGLETON de module : ce fichier l'ALLUME, il la REND. Le socle
// (`test-setup.ts`) la remet aussi à zéro — ceci ferme la fenêtre à l'intérieur même du fichier.
afterEach(() => resetDesFixes());

describe('sélecteur de dé HÉRITÉ de la coquille — modale sans aucun code local (flux `handGate`)', () => {
  it('la modale ne contient AUCUN code de sélecteur de dé, et déclare son flowKey', () => {
    const src = readFileSync('src/ui/HandGateModal.tsx', 'utf8');
    expect(src).not.toMatch(/picker|forcedRoll|SetForcedRoll|forcedDie/);
    expect(src).toContain('flowKey="handGate"');
  });

  it('Résilience dépensée → le choix du dé est offert, borné à la cible (LDB 17 l.68)', () => {
    open();
    expect(shellHtml()).not.toContain('Dé choisi');
    useGame.getState().handGateForceSuccess();
    expect(useGame.getState().pendingHandGate!.forced).toBe(true);
    const html = shellHtml();
    expect(html).toContain('Dé choisi'); // « Dé choisi (Je ne faillirai pas !) »
    expect(html).toContain('max="60"'); // borné à la cible : le choix doit RESTER une réussite
  });

  it('le dé choisi s’applique réellement au Test (le verbe existe pour ce flux)', () => {
    open();
    useGame.getState().handGateForceSuccess();
    useGame.getState().handGateSetForcedRoll(11);
    const pg = useGame.getState().pendingHandGate!;
    expect(pg.roll).toBe(11);
    expect(pg.success).toBe(true);
  });

  it('option « Dés fixés » ON → sélecteur de dé fixé, sans aucune Résilience dépensée', () => {
    open();
    setDesFixes(true);
    // L'étiquette du champ est une OFFRE (« Fixer le dé ») ; « Dé fixé » est la MARQUE de provenance
    // d'un jet DÉJÀ saisi (`.prow-fixed-mark`), qui n'a pas lieu d'être avant la saisie.
    expect(shellHtml()).toContain('Fixer le dé');
    expect(shellHtml()).not.toContain('Dé fixé');
    const resil = useGame.getState().battle!.combatants[0].resilience;
    useGame.getState().handGateSetForcedRoll(41);
    const pg = useGame.getState().pendingHandGate!;
    expect(pg.roll).toBe(41);
    expect(pg.success).toBe(true); // 41 ≤ 60 : réussite NATURELLE, pas forcée
    expect(pg.fixed).toBe(true);
    expect(useGame.getState().battle!.combatants[0].resilience).toBe(resil);
  });
});

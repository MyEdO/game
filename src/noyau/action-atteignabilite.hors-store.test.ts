/**
 * LE REGISTRE DES ACTIONS, côté noyau (spec HUD « Zone 12 », sondes du juge promues) : sa COHÉRENCE INTERNE (chaque id
 * de code déclaré à `actions.json` se résout, tout mode de ciblage a son action porteuse, `BattleState.action` se type
 * depuis le registre) et les sorties d'interlude, chacune par SON dispatcher. L'atteignabilité par une surface vivante,
 * la réciproque fail-closed de la console et la disposition data-driven se jouent en
 * `src/state/action-atteignabilite.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { ACTIONS } from '../data/index';
import { ACTION_GATES, ACTION_CANDIDATES, ACTION_RUN, REMEDES, MODES_HORS_REGISTRE, BATTLE_ACTION_MODES, actionGate, runAction } from './actionRegistry';
import { TARGETING_MODES, targetingModeLabel, CAST_MODE } from './targetingModes';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const TARGETING_SRC = readFileSync(fileURLToPath(new URL('./targetingModes.ts', import.meta.url)), 'utf8');

describe('registre des actions — cohérence interne (ids de code résolus)', () => {
  it('chaque `gate` déclaré existe dans ACTION_GATES (un id, ou chacun des ids composés)', () => {
    const bad = ACTIONS.filter((a) => [a.gate].flat().some((g) => !(g in ACTION_GATES))).map((a) => `${a.id} → ${a.gate}`);
    expect(bad, `gate(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  // Un gate de remède LIT l'État que son entrée déclare : sans cette déclaration il lève (fail-fast).
  // La donnée ne peut donc pas naître dans la forme que le code refuse.
  it('toute entrée de remède déclare un État (l’id résout au parse dans `etats.json`)', () => {
    expect(REMEDES.length, 'aucun remède au registre : la garde ne mesure rien').toBeGreaterThan(0);
    const bad = REMEDES.filter((a) => a.rule?.type !== 'etat');
    expect(bad.map((a) => `${a.id} → ${a.rule ? `${a.rule.type}:${a.rule.id}` : '(aucun foyer)'}`), 'État non déclaré').toEqual([]);
  });
  it('chaque `candidates` déclaré existe dans ACTION_CANDIDATES', () => {
    const bad = ACTIONS.filter((a) => a.candidates && !(a.candidates in ACTION_CANDIDATES)).map((a) => `${a.id} → ${a.candidates}`);
    expect(bad, `sélecteur(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `run` déclaré existe dans ACTION_RUN', () => {
    const bad = ACTIONS.filter((a) => a.run && !(a.run in ACTION_RUN)).map((a) => `${a.id} → ${a.run}`);
    expect(bad, `dispatcher(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `mode` déclaré est un TargetingMode existant (`targetingModes.ts`)', () => {
    const bad = ACTIONS.filter((a) => a.mode && !TARGETING_SRC.includes(`id: '${a.mode}'`)).map((a) => `${a.id} → ${a.mode}`);
    expect(bad, `mode(s) de ciblage inexistant(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('PARITÉ INVERSE — tout mode de ciblage a une action PORTEUSE au registre (aucun mode sans surface)', () => {
    // Méta d'abord : le catalogue énumérable doit couvrir les modes DÉCLARÉS dans la source (un mode
    // oublié au catalogue rendrait la parité verte à tort).
    const idsSource = [...new Set([...TARGETING_SRC.matchAll(/^\s*id: '([a-z-]+)'/gm)].map((m) => m[1]))];
    const horsCatalogue = idsSource.filter((id) => !TARGETING_MODES.some((m) => m.id === id));
    expect(horsCatalogue, `mode(s) déclaré(s) mais absent(s) de TARGETING_MODES :\n  ${horsCatalogue.join('\n  ')}`).toEqual([]);
    // Parité : un mode que le joueur peut atteindre sans action porteuse est un ciblage SANS SORTIE.
    const orphelins = TARGETING_MODES.filter((m) => !ACTIONS.some((a) => a.mode === m.id)).map((m) => m.id);
    expect(
      orphelins,
      `mode(s) de ciblage qu'aucune action ne porte (armer/sortir ce mode n'a aucune surface) :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([]);
  });
  /**
   * ARMEMENT — la valeur qu'une action pose dans `battle.action` (`armed`) est un MODE de ciblage du
   * catalogue, et c'est le `mode` que la MÊME entrée déclare. Conséquence lue par les consommateurs :
   * « quel geste arme le mode X ? » se résout par le champ `mode`/`armed`, l'id de l'entrée porteuse
   * étant libre (`cast-spell` arme `cast`, `push-engine` arme `push`).
   */
  it('tout `armed` déclaré est un mode du catalogue, égal au `mode` de son entrée (mode incantation → `cast-spell`)', () => {
    const armantes = ACTIONS.filter((a) => a.armed);
    expect(armantes.length, 'aucune action armante mesurée : la garde serait verte à vide').toBeGreaterThan(0);
    const bad = armantes
      .filter((a) => !TARGETING_MODES.some((m) => m.id === a.armed) || a.mode !== a.armed)
      .map((a) => `${a.id} → armed:${a.armed} / mode:${a.mode ?? '—'}`);
    expect(bad, `action(s) dont l'armement ne désigne pas son propre mode de ciblage :\n  ${bad.join('\n  ')}`).toEqual([]);
    // Résolution NOMMÉE du mode incantation : une seule entrée l'arme, et c'est `cast-spell`.
    const incantation = armantes.filter((a) => a.armed === CAST_MODE.id).map((a) => a.id);
    expect(incantation, `le mode ${CAST_MODE.id} doit être armé par une entrée unique`).toEqual(['cast-spell']);
  });

  it('un mode d’INTERLUDE porte son nom de phase, et sa sortie dit si Échap peut la prendre', () => {
    const interludes = ACTIONS.filter((a) => a.surface === 'interlude');
    expect(interludes.length, 'aucune action d’interlude : le bandeau n’aurait rien à rendre').toBeGreaterThan(0);
    const muets = interludes.filter((a) => !a.mode || !targetingModeLabel(a.mode)).map((a) => a.id);
    expect(muets, `interlude(s) dont le mode n'a pas de libellé de phase :\n  ${muets.join('\n  ')}`).toEqual([]);
    const sansVerdict = interludes.filter((a) => typeof a.exitSafe !== 'boolean').map((a) => a.id);
    expect(sansVerdict, `interlude(s) sans verdict exitSafe :\n  ${sansVerdict.join('\n  ')}`).toEqual([]);
  });
  it('chaque action rend un VERDICT sur un état réel (aucun gate ne jette, aucune raison muette)', () => {
    const active = blessuresSurLeProfil({
      id: 'H', kind: 'hero', advantage: 0, conditions: [], wounds: blessuresDeBase(10),
      weapons: [], items: [], skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    }) as unknown as Parameters<typeof actionGate>[1]['active'];
    const battle = {
      combatants: [active], order: ['H'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as Parameters<typeof actionGate>[1]['battle'];
    const muets = ACTIONS.filter((a) => {
      const v = actionGate(a.id, { active, battle, gameTime: 0 });
      return typeof v.ok !== 'boolean' || (!v.ok && !v.reason);
    }).map((a) => a.id);
    expect(muets, `Action(s) dont le gate ne rend pas un verdict motivé :\n  ${muets.join('\n  ')}`).toEqual([]);
    // Fail-closed : un id inconnu ne « passe » jamais.
    expect(actionGate('id-inexistant', { active, battle, gameTime: 0 }).ok).toBe(false);
  });
  it('`BattleState.action` se type DEPUIS le registre : `armed` + MODES_HORS_REGISTRE = BATTLE_ACTION_MODES', () => {
    const derives = new Set([
      ...ACTIONS.flatMap((a) => (a.armed ? [a.armed] : [])),
      ...Object.keys(MODES_HORS_REGISTRE),
    ]);
    expect([...derives].sort()).toEqual([...BATTLE_ACTION_MODES].sort());
  });
});

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * POURQUOI CHAQUE INTERLUDE PORTE SON PROPRE DISPATCHER (#1411 P0-B) — les sorties ne sont pas
 * interchangeables : `battleSelectAction` (sortie de la bordée) est AVALÉ sous un flux différé
 * (`combatBusy`, `combatSlice.ts:2876`), là où `fenetreFermer('cleave')`/`fenetreFermer('dualStrike')` sont justement les verbes
 * DE ces flux. Un dispatcher mutualisé rendrait la sortie muette dès qu'un flux se superpose. Le
 * témoin POSITIF (sans flux, la sortie mord) borne la mesure.
 */
describe('sorties d’interlude — le dispatcher mutualisé est inexprimable (témoin mesuré)', () => {
  /** Combat minimal réel : un héros ACTIF, une scène, le mode de bordée armé. */
  function combatArme(over: Partial<BattleState> = {}) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 7 });
    h.id = 'h1';
    h.pos = { x: 5, y: 5 };
    banc.setState({
      party: [h], scene: emptyScene('scene-test'), pendingCleave: null, pendingDualStrike: null, pendingCast: null,
      battle: {
        combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1, action: 'battery',
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
        log: [], over: null, ...over,
      } as unknown as BattleState,
    });
    return h;
  }

  it('TÉMOIN — sans flux différé, la sortie de bordée désarme bien le mode', () => {
    combatArme();
    runAction('battery-cancel', banc.getState);
    expect(banc.getState().battle!.action).toBeNull();
  });

  it('MESURE — sous un flux différé, la MÊME sortie est avalée (donc jamais partagée avec cleave/dual)', () => {
    const h = combatArme();
    banc.setState({ pendingCleave: { attackerId: h.id, hitIds: [], count: 0 } as never });
    runAction('battery-cancel', banc.getState);
    expect(
      banc.getState().battle!.action,
      'la sortie de bordée est avalée sous `combatBusy` — c’est pourquoi cleave/dual portent leurs propres verbes',
    ).toBe('battery');
    // … et le verbe DE ce flux, lui, passe : chaque interlude sort par SON dispatcher.
    runAction('cleave-end', banc.getState);
    expect(banc.getState().pendingCleave).toBeNull();
  });
});

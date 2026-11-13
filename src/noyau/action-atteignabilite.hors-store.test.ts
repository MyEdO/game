/**
 * LE REGISTRE DES ACTIONS, côté noyau (spec HUD « Zone 12 », sondes du juge promues) : sa COHÉRENCE INTERNE (tout mode
 * de ciblage a son action porteuse, chaque gate rend un verdict motivé) et les sorties d'interlude, chacune par SON
 * dispatcher. Qu'un id de code nommé par `actions.json` se résolve est tenu par la compilation (`defs/actions.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { ACTIONS } from '../data/index';
import { REMEDES, actionGate } from './actionRegistry';
import { TARGETING_MODES, targetingModeLabel, CAST_MODE } from './targetingModes';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

describe('registre des actions — cohérence interne', () => {
  // Un gate de remède LIT l'État que son entrée déclare : sans cette déclaration il lève (fail-fast).
  // La donnée ne peut donc pas naître dans la forme que le code refuse.
  it('toute entrée de remède déclare un État (l’id résout au parse dans `etats.json`)', () => {
    expect(REMEDES.length, 'aucun remède au registre : la garde ne mesure rien').toBeGreaterThan(0);
    const bad = REMEDES.filter((a) => a.rule?.type !== 'etat');
    expect(bad.map((a) => `${a.id} → ${a.rule ? `${a.rule.type}:${a.rule.id}` : '(aucun foyer)'}`), 'État non déclaré').toEqual([]);
  });
  it('tout mode de ciblage a une action PORTEUSE au registre (aucun mode sans surface)', () => {
    // Un mode que le joueur peut atteindre sans action porteuse est un ciblage SANS SORTIE.
    const orphelins = TARGETING_MODES.filter((m) => !ACTIONS.some((a) => a.mode === m.id)).map((m) => m.id);
    expect(
      orphelins,
      `mode(s) de ciblage qu'aucune action ne porte (armer/sortir ce mode n'a aucune surface) :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([]);
  });
  /**
   * ARMEMENT — « quel geste arme le mode X ? » se résout par le champ `mode` d'une entrée `armed`, l'id de l'entrée
   * porteuse étant libre (`incantation` arme `incantation`, `poussee` arme `poussee`).
   */
  it('le mode incantation est armé par une entrée unique, `incantation`', () => {
    const armantes = ACTIONS.filter((a) => a.armed);
    const incantation = armantes.filter((a) => a.mode === CAST_MODE.id).map((a) => a.id);
    expect(incantation, `le mode ${CAST_MODE.id} doit être armé par une entrée unique`).toEqual(['incantation']);
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
      id: 'H', kind: 'heros', advantage: 0, conditions: [], wounds: blessuresDeBase(10),
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
});

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * POURQUOI CHAQUE INTERLUDE PORTE SON PROPRE DISPATCHER (#1411 P0-B) — les sorties ne sont pas
 * interchangeables : `armerLeMode` (sortie de la bordée) est AVALÉ sous un flux différé
 * (`combatBusy`, `combatSlice.ts:2876`), là où `fenetreFermer('frappeMortelle')`/`fenetreFermer('secondeFrappe')` sont justement les verbes
 * DE ces flux. Un dispatcher mutualisé rendrait la sortie muette dès qu'un flux se superpose. Le
 * témoin POSITIF (sans flux, la sortie mord) borne la mesure.
 */
describe('sorties d’interlude — le dispatcher mutualisé est inexprimable (témoin mesuré)', () => {
  /** Combat minimal réel : un héros ACTIF, une scène, le mode de bordée armé. */
  function combatArme(over: Partial<BattleState> = {}) {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 7 });
    h.id = 'h1';
    h.pos = { x: 5, y: 5 };
    banc.setState({
      party: [h], scene: emptyScene('scene-test'), pendingCleave: null, pendingDualStrike: null, pendingCast: null,
      battle: {
        combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1, action: 'bordee',
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
        log: [], over: null, ...over,
      } as unknown as BattleState,
    });
    return h;
  }

  it('TÉMOIN — sans flux différé, la sortie de bordée désarme bien le mode', () => {
    combatArme();
    banc.jouerLaCase('annulation-bordee');
    expect(banc.getState().battle!.action).toBeNull();
  });

  it('MESURE — sous un flux différé, la MÊME sortie est avalée (donc jamais partagée avec cleave/dual)', () => {
    const h = combatArme();
    banc.setState({ pendingCleave: { attackerId: h.id, hitIds: [], count: 0 } as never });
    banc.jouerLaCase('annulation-bordee');
    expect(
      banc.getState().battle!.action,
      'la sortie de bordée est avalée sous `combatBusy` — c’est pourquoi cleave/dual portent leurs propres verbes',
    ).toBe('bordee');
    // … et le verbe DE ce flux, lui, passe : chaque interlude sort par SON dispatcher.
    banc.jouerLaCase('fin-balayage');
    expect(banc.getState().pendingCleave).toBeNull();
  });
});

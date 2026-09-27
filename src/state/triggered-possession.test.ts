/**
 * #1262 V1 lot 3 — POSSESSION des Tests DÉCLENCHÉS (`combat/triggeredTest.ts`) : bandes, étape mono,
 * étape de choix. Quatre portes, un seul défaut de fond : la fenêtre était rendue à l'HÔTE SEUL, ou le
 * jet roulé chez lui, alors que le porteur appartient à un AUTRE siège.
 *
 *  - les deux fabriques de BANDE (`frozenOpposedBatchStep` Surprise, `simpleBatchTestStep` Peur à
 *    l'approche) ne posaient NI `groupOwner` NI `actorId` : `modalArbiter` (entrée `cascade`) rendait
 *    `undefined`, donc l'hôte seul voyait la fenêtre où se tiennent les rangées d'autrui ;
 *  - `resolveFlowTest` et `resolveFlowChoice` lisaient `humanControlled` (affordance LOCALE — « qui a
 *    la main devant CET écran ») : le Test déclenché du héros d'un invité était roulé EN SILENCE chez
 *    l'hôte, et son « Vous pouvez… » tranché d'office par l'heuristique d'IA, Avantage dépensé compris.
 *
 * En SOLO les deux prédicats coïncident (`ownsLocally` vrai pour tous) : ces régressions y sont
 * INVISIBLES — d'où le harnais à deux sièges (#1262 B7). Deux formes de « second siège » servent ici,
 * toutes deux réelles : un INVITÉ qui possède un héros (`ownership`) et le siège MJ (`gmSeat`) qui
 * conduit les ennemis (bac-à-sable — `netOwnership.seatOwns`/`jetSurfaced`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applySurprise, approachFearTrigger, resolveFreeAttacks } from './combatFlow';
import { applyTriggeredEffects } from './triggeredEffects';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { hasCondition, addCondition, isOutOfAction, COND } from '../engine/conditions';
import { surfaceOf } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns, humanControlled } from './netOwnership';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { TriggeredEffect } from '../engine/flowCore';
import './combat/triggeredTest';

const NET0 = useGame.getState().net;
const g = useGame.getState;

/**
 * Combat RÉEL à deux sièges. `gmSeat` posé : le siège 1 conduit les ENNEMIS (bac-à-sable MJ) — c'est
 * la forme de second siège qui met des ENNEMIS dans une bande. Sans lui, le siège 1 possède le HÉROS.
 * `vivants` borne le nombre d'ennemis en jeu (une bande à un porteur ≠ une bande à plusieurs : la
 * possession posée n'est pas la même).
 */
function setupCoop(opts: { gmSeat?: number; vivants?: number } = {}): { H: Combatant; E: Combatant[] } {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  g().startScene(testScene);
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(opts.vivants ?? 1).forEach((e) => (e.dead = true));
  const vivants = enemies.slice(0, opts.vivants ?? 1);
  H.pos = { x: 10, y: 10 };
  vivants.forEach((e, i) => (e.pos = { x: 11 + i, y: 10 }));
  useGame.setState({ battle: { ...b }, pendingCascade: null, suspendedCascades: [] } as never);
  useGame.setState({
    net: {
      ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0],
      ...(opts.gmSeat != null ? { gmSeat: opts.gmSeat, ownership: {} } : { ownership: { [H.id]: 1 } }),
    },
  } as never);
  return { H, E: vivants };
}

const etapes = () => g().pendingCascade?.participants ?? [];
const bande = () => etapes().find((s) => s.kind === 'triggeredBatchTest');

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  seedBattleRng(4);
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] } as never);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  useGame.setState({ net: NET0, battle: null, pendingCascade: null, suspendedCascades: [] } as never);
});

describe('#1262 lot 3 — une BANDE nomme son porteur (sinon sa fenêtre échoit à l’hôte seul)', () => {
  it('Surprise d’embuscade (LDB 13 l.77) : bande à UN guetteur du siège MJ → l’étape porte SON `actorId`', () => {
    const { E } = setupCoop({ gmSeat: 1 });
    applySurprise(g, useGame.setState, 'enemies'); // les héros embusquent : les guetteurs sont les ennemis

    const step = bande();
    expect(step, 'les guetteurs conduits par le MJ forment bien une bande').toBeTruthy();
    expect(step!.participants!.map((p) => p.id)).toEqual([E[0].id]);
    expect(step!.actorId, 'une bande d’un seul porteur EST son porteur').toBe(E[0].id);
    expect(step!.groupOwner).toBeUndefined();
    expect(step!.aggregate, 'rangées INDÉPENDANTES — le socle n’a rien agrégé').toBe('none');
    expect(step!.meta?.opposed, 'l’opposition figée traverse le socle intacte').toBeTruthy();
    expect(modalOwnerOf(g()), 'la fenêtre n’est plus anonyme (elle échoyait à l’hôte)').toBe(E[0].id);
    expect(seatOwns(g(), 1, modalOwnerOf(g()) as string), 'elle est au siège MJ, qui conduit ce guetteur').toBe(true);
    expect(seatOwns(g(), 0, modalOwnerOf(g()) as string), 'et plus à l’hôte').toBe(false);
  });

  it('Surprise d’embuscade : bande à DEUX guetteurs → `groupOwner` (chaque siège tient SA rangée)', () => {
    setupCoop({ gmSeat: 1, vivants: 2 });
    applySurprise(g, useGame.setState, 'enemies');

    const step = bande();
    expect(step!.participants).toHaveLength(2);
    expect(step!.groupOwner, 'plus d’un porteur : la fenêtre est partagée').toBe(true);
    expect(step!.actorId, 'et n’appartient à personne en particulier').toBeUndefined();
    expect(modalOwnerOf(g())).toBe('*');
  });

  it('Peur à l’approche (LDB 21 l.27) : la bande des craintifs du MJ porte SA possession', () => {
    const { H, E } = setupCoop({ gmSeat: 1 });
    E[0].psychState = [{ type: 'peur', sourceId: H.id, indice: 2, calmeDR: 0 }] as Combatant['psychState'];

    approachFearTrigger(g, useGame.setState, H, { x: 30, y: 30 }); // le héros a fini PLUS PRÈS

    const step = bande();
    expect(step, 'le craintif conduit par le MJ a bien sa rangée').toBeTruthy();
    expect(step!.participants!.map((p) => p.id)).toEqual([E[0].id]);
    expect(step!.participants![0].result, 'rien n’a été roulé : la rangée est à jouer').toBeNull();
    expect(step!.actorId).toBe(E[0].id);
    expect(modalOwnerOf(g())).toBe(E[0].id);
    expect(seatOwns(g(), 1, E[0].id), 'la fenêtre est au siège qui conduit le craintif').toBe(true);
  });
});

describe('#1262 lot 3 — un Test déclenché HORS fin de Round ne se roule pas chez l’hôte', () => {
  /**
   * Le guetteur d'un autre siège est dans la BANDE depuis le lot 5c : le producteur (`applySurprise`)
   * compose sa bande sur la SURFACE, plus sur l'affordance locale. Il recevait auparavant une étape
   * MONO `triggeredTest` par la voie inline — la fenêtre remontait, mais hors de l'entrée de règle
   * partagée (LDB 13 l.77 : UN jet d'embusqueur contre TOUS les guetteurs).
   */
  it('Surprise (LDB 13 l.67-77) : le héros de l’invité tient SA rangée dans la bande, au lieu d’un jet muet', () => {
    const { H } = setupCoop();
    expect(humanControlled(g(), H), 'chez l’hôte, il ne pilote pas ce héros…').toBe(false);
    expect(surfaceOf(g, H.id), '…mais un siège humain le tient : son jet doit remonter').toBe(true);

    applySurprise(g, useGame.setState, 'party'); // les ennemis embusquent : le héros est le guetteur

    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, COND.surpris), 'aucune Surprise prononcée en silence chez l’hôte').toBe(false);
    expect(etapes().find((s) => s.kind === 'triggeredTest'), 'plus de voie MONO : la bande le porte').toBeUndefined();
    const step = bande();
    expect(step, 'l’étape influençable existe').toBeTruthy();
    expect(step!.participants!.map((p) => p.id)).toEqual([H.id]);
    expect(step!.participants![0].interactive, 'sa rangée est À JOUER').toBe(true);
    expect(step!.participants![0].result, 'c’est la fenêtre de l’invité qui jette').toBeNull();
    expect(step!.actorId, 'une bande d’un seul porteur EST son porteur').toBe(H.id);
    expect(step!.meta?.opposed, 'l’opposition figée de l’embuscade voyage avec l’étape').toBeTruthy();
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });

  /**
   * CONTRAT de la porte, figé (sonde 2 du juge) : `resolveFlowTest` ne filtre QUE sur la surface — un
   * porteur hors d'action reçoit son étape. Le gate d'Action du tour (`combatFlow`), lui, filtre : cette
   * divergence est MESURÉE et attend son arbitrage (#1265), elle ne s'harmonise pas au passage. Sans
   * cette sonde, ajouter `isOutOfAction` ici passerait toutes les suites.
   *
   * Chemin réel : le dispatcher (`applyTriggeredEffects`) laisse EXPRESSÉMENT passer un porteur hors
   * d'action qui réagit à SON PROPRE événement (`on:'self'` — une unité doit pouvoir réagir à sa chute),
   * puis route le Flow `test` vers `resolveFlowTest`. L'effet est fourni en FIXTURE (le dispatcher est
   * générique ; aucune entité authorée ne porte encore ce couple précis).
   */
  it('porteur INCONSCIENT d’un autre siège : son étape existe quand même (#1265 — aucune harmonisation)', () => {
    const { H } = setupCoop();
    addCondition(H, COND.inconscient, 1);
    const eff = {
      trigger: 'onWoundLoss', on: 'self',
      // `source` : l'entité porteuse, telle que `withSource` la tague au dispatcher — c'est d'elle que
      // l'étape DÉRIVE son enjeu (#1262 V2 L6d). Une fixture sans porteur ne serait pas le chemin réel.
      source: { kind: 'condition', id: 'empoisonne' },
      flow: { kind: 'test', test: { skill: 'resistance', difficulty: 'intermediaire', label: 'Tenir bon' }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } },
    } as unknown as TriggeredEffect;

    expect(isOutOfAction(H), 'sonde inerte sans ça : le porteur DOIT être hors d’action').toBe(true);
    expect(surfaceOf(g, H.id), 'et rester surfacé — hors d’action ne veut pas dire sans joueur').toBe(true);

    applyTriggeredEffects(g, H, [eff], 'onWoundLoss', { set: useGame.setState });

    const step = etapes().find((s) => s.kind === 'triggeredTest');
    expect(step, 'la porte ne filtre que sur la SURFACE : l’étape est là').toBeTruthy();
    expect(step!.actorId).toBe(H.id);
    expect(step!.result, 'et rien n’a été roulé à sa place').toBeFalsy();
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });
});

describe('#1262 lot 3 — un « Vous pouvez… » ne se tranche pas chez l’hôte', () => {
  it('Frappe réactive (LDB 10 l.496-500) : le CHOIX de l’invité existe, et son Avantage est intact', () => {
    const { H, E } = setupCoop();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    H.advantage = 3; // payable : l'heuristique inline aurait dit OUI et débité

    resolveFreeAttacks(g, useGame.setState, H, 'onCharged', E[0]);

    const choix = etapes().find((s) => s.kind === 'triggeredChoice');
    expect(choix, 'la décision de l’invité n’est plus prise à sa place').toBeTruthy();
    expect(choix!.actorId).toBe(H.id);
    expect(choix!.defaultChoice, 'Renoncer par défaut').toBe('no');
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id)).toBe(true);
    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.advantage, 'l’hôte n’a pas dépensé l’Avantage d’autrui').toBe(3);
    expect(h.freeAttacksThisTurn?.['frappe-reactive'], 'et n’a lancé aucune riposte').toBeUndefined();
  });

  /**
   * L'opt-in du DISPATCHER (`applyTriggeredEffects`, filtre `eff.optional`). Aucune donnée authorée ne
   * porte aujourd'hui un `optional` HORS `onRoundEnd` (seul Contrôle de la Frénésie l'est, et la fin de
   * Round le COLLECTE par ailleurs) : l'effet est donc fourni en FIXTURE — le dispatcher est générique,
   * c'est bien son chemin réel qui est exercé, avec le routeur installé par le store.
   */
  it('dispatcher : un effet OPT-IN atteint le porteur d’un autre siège au lieu d’être jeté', () => {
    const { H } = setupCoop();
    const eff = {
      trigger: 'onHit', on: 'self', optional: true,
      flow: { kind: 'test', test: { skill: 'calme', difficulty: 'intermediaire', label: 'Se ressaisir' }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } },
    } as unknown as TriggeredEffect;

    applyTriggeredEffects(g, H, [eff], 'onHit', { set: useGame.setState });

    const choix = etapes().find((s) => s.kind === 'triggeredChoice');
    expect(choix, 'le « Vous pouvez » de l’invité n’est plus filtré à l’entrée du dispatcher').toBeTruthy();
    expect(choix!.actorId).toBe(H.id);
    expect(modalOwnerOf(g())).toBe(H.id);
  });
});

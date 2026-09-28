/**
 * Garde STRUCTURELLE de la possession par PARTICIPANT (#942, ferme #949) : pour CHAQUE flux
 * `kind:'multi'` de `FLOW_VERBS` — énumération de la table, jamais une liste locale —
 *  (a) un flux à `pidIsActor:true` est `coop` et expose TOUS ses verbes dans `COMBAT_INTENTS` ;
 *  (b) un flux `pidIsActor:true` route le JET sur le PROPRIÉTAIRE du participant : le siège qui
 *      possède le héros est ACCEPTÉ, tout autre siège (hôte compris) est REFUSÉ — même quand la
 *      modale hôte dirait '*' (étape de groupe) ou désignerait un TIERS (le navire) ;
 *  (c) tout flux multi DÉCLARE sa politique `pidIsActor` (aucun trou silencieux) et un flux
 *      `pidIsActor:false` (`pid` = id d'étape/de Round) n'entre JAMAIS dans la dérivation.
 */
import { describe, it, expect } from 'vitest';
import { FLOW_VERBS, participantOwnedIntents, flowActionName } from './flowVerbs';
import { intentAllowedFor, ROUTES } from './netOwnership';
import { COMBAT_INTENTS } from '../net/intents';
import type { GameState } from './store';

type Entry = { kind: 'mono' | 'multi'; verbs: readonly string[]; coop?: boolean; pidIsActor?: boolean };
const ENTRIES = Object.entries(FLOW_VERBS) as [string, Entry][];
const MULTI = ENTRIES.filter(([, w]) => w.kind === 'multi');

const H_OWNER = 'h2'; // héros du siège 1
const H_HOST = 'h1'; // héros du siège 0 (hôte)

/** État minimal : 2 héros possédés par 2 sièges différents, un 3ᵉ siège spectateur, le navire au siège 2
 *  (pour que le owner de modale des flux d'équipage désigne un TIERS et non le propriétaire du héros). */
const base = (over: Partial<GameState>): GameState =>
  ({
    net: {
      mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Béa' },
      ownership: { h2: 1, ship1: 2 }, slots: [0, 1, 0, 0],
    },
    party: [{ id: H_HOST }, { id: H_OWNER }],
    battle: { order: [H_HOST, H_OWNER], turn: 0, combatants: [
      { id: H_HOST, kind: 'hero' }, { id: H_OWNER, kind: 'hero' }, { id: 'e1', kind: 'enemy' },
    ] },
    ...over,
  }) as unknown as GameState;

const parts = [{ id: H_HOST, result: null }, { id: H_OWNER, result: null }];
/** Cascade d'accueil des flux qui vivent en ÉTAPE (owner '*' : la modale ouvrirait TOUT à TOUS). */
const groupCascade = {
  pendingCascade: { participants: [{ id: 's0', kind: 'x', groupOwner: true }], cursor: 0 },
} as unknown as Partial<GameState>;

/** Un pending OUVERT par flux (les 2 héros en participants) — table totale, vérifiée ci-dessous. */
const FIXTURES: Record<string, Partial<GameState>> = {
  flee: {
    ...groupCascade,
    pendingDisengage: { moverId: H_HOST, fuir: { participants: [
      { id: H_HOST, kind: 'backstab', result: null }, { id: H_OWNER, kind: 'calme', calme: null },
    ] } },
  } as unknown as Partial<GameState>,
  counterspell: { ...groupCascade, pendingCounterspell: { participants: parts } } as unknown as Partial<GameState>,
  opposition: { ...groupCascade, pendingCastOpposition: { kind: 'resist', char: 'fm', participants: parts } } as unknown as Partial<GameState>,
  forceDoor: {
    ...groupCascade,
    pendingForceDoor: { label: 'Porte', doorBE: 3, doorB: 10, doorBmax: 10, participants: parts },
  } as unknown as Partial<GameState>,
  shipManeuver: { pendingShipManeuver: { shipId: 'ship1', participants: parts } } as unknown as Partial<GameState>,
  shipBattery: { pendingShipBattery: { shipId: 'ship1', targetId: 'e1', side: 'babord', participants: parts } } as unknown as Partial<GameState>,
  crewTest: { pendingCrewTest: { shipId: 'ship1', participants: parts } } as unknown as Partial<GameState>,
  cascadeBatch: {
    pendingCascade: { participants: [{ id: 'batch', kind: 'stagePosteBatch', participants: parts }], cursor: 0 },
  } as unknown as Partial<GameState>,
};

describe('flux MULTI — possession par participant (dérivée de FLOW_VERBS)', () => {
  it('(c) tout flux multi DÉCLARE sa politique pidIsActor (aucun trou silencieux)', () => {
    const sans = MULTI.filter(([, w]) => typeof w.pidIsActor !== 'boolean').map(([k]) => k);
    expect(sans, 'flux multi sans `pidIsActor` — trancher la politique dans FLOW_VERBS').toEqual([]);
  });

  it('(c) un flux pidIsActor:false n’entre PAS dans la dérivation (pid = étape/Round, pas un acteur)', () => {
    const derives = new Set(participantOwnedIntents());
    const fuites: string[] = [];
    for (const [prefix, w] of MULTI) {
      if (w.pidIsActor) continue;
      for (const v of w.verbs) if (derives.has(flowActionName(prefix, v))) fuites.push(flowActionName(prefix, v));
    }
    expect(fuites, 'intent d’un flux à pid NON-acteur dans la dérivation de possession').toEqual([]);
  });

  it('(a) tout flux multi à pid-acteur est coop : sans intent, le geste de l’invité s’exécute EN LOCAL', () => {
    // `netFlow.interceptGuestActions` n'enrobe que `GUEST_INTENTS` : une rangée par participant
    // pilotable sans intent → store invité divergent au lieu d'un refus (défaut #949).
    const sans = MULTI.filter(([, w]) => w.pidIsActor && !w.coop).map(([k]) => k);
    expect(sans, 'flux multi à rangées par propriétaire sans `coop` — surface invité manquante').toEqual([]);
  });

  it('(a) chaque flux multi coop expose TOUS ses verbes dans COMBAT_INTENTS', () => {
    const manquants: string[] = [];
    for (const [prefix, w] of MULTI) {
      if (!w.coop) continue;
      for (const v of w.verbs) {
        const intent = flowActionName(prefix, v);
        if (!COMBAT_INTENTS.has(intent)) manquants.push(intent);
      }
    }
    expect(manquants, 'verbe de flux multi coop sans intent — la surface invité ne converge pas chez l’hôte').toEqual([]);
  });

  /**
   * `resist` (auto-succès du Talent Résistance (Menace)) DÉPENSE une ressource de son porteur : sur un
   * flux multi il ne peut pas retomber sur le repli universel, qui rend le owner de la MODALE — `'*'`
   * sur une étape partagée, donc TOUS les sièges. Tout `xResist` multi exposé porte donc une route
   * (dérivée par participant, ou nominative sur l'acteur de l'étape). C'est la condition qui a levé le
   * filtre historique `v !== 'resist'` de `coopFlowIntents` (#1050, angle mort #965).
   */
  it('(a) tout `resist` de flux multi exposé est ROUTÉ (jamais laissé au repli universel)', () => {
    const exposes = MULTI.filter(([, w]) => w.coop && w.verbs.includes('resist')).map(([k]) => flowActionName(k, 'resist'));
    expect(exposes, 'précondition : au moins un flux multi expose `resist`').not.toEqual([]);
    const nus = exposes.filter((n) => !COMBAT_INTENTS.has(n) || !ROUTES.has(n));
    expect(nus, '`resist` multi exposé sans route — n’importe quel siège brûlerait la Résistance d’autrui').toEqual([]);
  });

  it('exhaustivité : chaque flux multi coop à pid-acteur a sa fixture de possession', () => {
    const sans = MULTI.filter(([k, w]) => w.coop && w.pidIsActor && !(k in FIXTURES)).map(([k]) => k);
    expect(sans, 'flux multi coop sans fixture — la garde de possession ne le couvre pas').toEqual([]);
  });

  for (const [prefix, w] of MULTI) {
    if (!w.coop || !w.pidIsActor) continue;
    it(`(b) ${prefix} : le siège propriétaire du participant est ACCEPTÉ, tout autre siège REFUSÉ`, () => {
      const s = base(FIXTURES[prefix]);
      for (const v of w.verbs) {
        if (v === 'cancel') continue;
        const intent = flowActionName(prefix, v);
        const args = (x: string) => (v === 'setForcedRoll' ? [x, 42] : [x]);
        // Le participant du siège 1 : SON siège agit, l'hôte et le siège TIERS sont refusés.
        expect(intentAllowedFor(s, 1, intent, args(H_OWNER)), `${intent}(${H_OWNER}) siège propriétaire`).toBe(true);
        expect(intentAllowedFor(s, 2, intent, args(H_OWNER)), `${intent}(${H_OWNER}) siège TIERS`).toBe(false);
        expect(intentAllowedFor(s, 0, intent, args(H_OWNER)), `${intent}(${H_OWNER}) hôte non propriétaire`).toBe(false);
        // Le participant de l'hôte : symétrique (le siège 1 ne roule pas le jet du héros de l'hôte).
        expect(intentAllowedFor(s, 0, intent, args(H_HOST)), `${intent}(${H_HOST}) siège propriétaire`).toBe(true);
        expect(intentAllowedFor(s, 1, intent, args(H_HOST)), `${intent}(${H_HOST}) siège TIERS`).toBe(false);
      }
    });
  }
});

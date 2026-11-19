/**
 * Garde STRUCTURELLE de la possession par PARTICIPANT (#942, ferme #949) : pour CHAQUE flux
 * `kind:'multi'` de `FLOW_VERBS` — énumération de la table, jamais une liste locale —
 *  (a) les verbes de jet (`jet<Verbe>(flux, …)`) sont exposés dans `COMBAT_INTENTS` et ROUTÉS, jamais laissés au
 *      repli universel ;
 *  (b) un flux `pidIsActor:true` route le JET sur le PROPRIÉTAIRE du participant : le siège qui
 *      possède le héros est ACCEPTÉ, tout autre siège (hôte compris) est REFUSÉ — même quand la
 *      modale hôte dirait '*' (étape de groupe) ou désignerait un TIERS (le navire) ;
 *  (c) tout flux multi DÉCLARE sa politique `pidIsActor` (aucun trou silencieux) et un flux
 *      `pidIsActor:false` (`pid` = id d'étape/de Round) ne prend JAMAIS son `pid` pour un acteur ;
 *  (d) un verbe de fenêtre (`estVerbeDeFenetre` : annulation, clôture) n'appartient à aucune rangée : sa route
 *      rend la décision au repli universel, le owner de la modale.
 */
import { describe, it, expect } from 'vitest';
import { estVerbeDeFenetre, FLOW_VERBS, NOM_DU_VERBE_DE_JET, type RollVerb } from './flowVerbs';
import { intentAllowedFor, ROUTES } from './netOwnership';
import { COMBAT_INTENTS } from './intentionsDeSiege';
import type { Jeu } from './etat';
import { cascadeDeTest } from './cascade.testkit';
import { testDeRegle } from '../engine/reglesChiffrees';
import { cleDeFixture } from './noyau.testkit';

type Entry = { kind: 'mono' | 'multi'; verbs: readonly RollVerb[]; pidIsActor?: boolean };
const ENTRIES = Object.entries(FLOW_VERBS) as [string, Entry][];
const MULTI = ENTRIES.filter(([, w]) => w.kind === 'multi');

/** Les arguments du geste de jet `v` sur `flux`, la rangée `pid` posée (`VerbesDeJet`). */
const argsDuGeste = (flux: string, v: RollVerb, pid: string): unknown[] => (v === 'imposerLeResultat' ? [flux, 42, pid] : [flux, pid]);

const H_OWNER = 'h2'; // héros du siège 1
const H_HOST = 'h1'; // héros du siège 0 (hôte)

/** État minimal : 2 héros possédés par 2 sièges différents, un 3ᵉ siège spectateur, le navire au siège 2
 *  (pour que le owner de modale des flux d'équipage désigne un TIERS et non le propriétaire du héros). */
const base = (over: Partial<Jeu>): Jeu =>
  ({
    net: {
      mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Béa' },
      ownership: { h2: 1, ship1: 2 }, slots: [0, 1, 0, 0],
    },
    party: [{ id: H_HOST }, { id: H_OWNER }],
    battle: { order: [H_HOST, H_OWNER], turn: 0, combatants: [
      { id: H_HOST, kind: 'heros' }, { id: H_OWNER, kind: 'heros' }, { id: 'e1', kind: 'ennemi' },
    ] },
    ...over,
  }) as unknown as Jeu;

const parts = [{ id: H_HOST, base: 40, target: 40, result: null }, { id: H_OWNER, base: 40, target: 40, result: null }];
/** Cascade d'accueil des flux qui vivent en ÉTAPE (owner '*' : la modale ouvrirait TOUT à TOUS). */
const groupCascade = {
  pendingCascade: cascadeDeTest([{ id: 's0', kind: cleDeFixture('x'), groupOwner: true }]),
} as unknown as Partial<Jeu>;

/** Un pending OUVERT par flux (les 2 héros en participants) — table totale, vérifiée ci-dessous. */
const FIXTURES: Record<string, Partial<Jeu>> = {
  fuite: {
    ...groupCascade,
    pendingDisengage: { moverId: H_HOST, fuir: { participants: [
      { id: H_HOST, kind: 'backstab', result: null }, { id: H_OWNER, kind: 'touche', test: testDeRegle('fuite', 'touche-en-fuyant'), jet: null },
    ] } },
  } as unknown as Partial<Jeu>,
  contreSort: { ...groupCascade, pendingCounterspell: { participants: parts } } as unknown as Partial<Jeu>,
  opposition: { ...groupCascade, pendingCastOpposition: { test: { characteristic: 'force-mentale' }, participants: parts } } as unknown as Partial<Jeu>,
  enfoncerLaPorte: {
    ...groupCascade,
    pendingForceDoor: { label: 'Porte', doorBE: 3, doorB: 10, doorBmax: 10, participants: parts },
  } as unknown as Partial<Jeu>,
  manoeuvreDuNavire: { pendingShipManeuver: { shipId: 'ship1', participants: parts } } as unknown as Partial<Jeu>,
  tirDeBatterie: { pendingShipBattery: { shipId: 'ship1', targetId: 'e1', side: 'babord', participants: parts } } as unknown as Partial<Jeu>,
  cascadeEnBande: {
    pendingCascade: cascadeDeTest([{ id: 'batch', kind: 'etapePosteEnBande', participants: parts }]),
  } as unknown as Partial<Jeu>,
  // Chute volontaire du groupe (#700) : la fenêtre appartient à l'initiateur (l'hôte), chaque rangée à SON siège.
  chute: {
    pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: H_HOST, participants: parts.map((p) => ({ ...p, interactive: true, attempt: true })) },
  } as unknown as Partial<Jeu>,
};

describe('flux MULTI — possession par participant (dérivée de FLOW_VERBS)', () => {
  it('(c) tout flux multi DÉCLARE sa politique pidIsActor (aucun trou silencieux)', () => {
    const sans = MULTI.filter(([, w]) => typeof w.pidIsActor !== 'boolean').map(([k]) => k);
    expect(sans, 'flux multi sans `pidIsActor` — trancher la politique dans FLOW_VERBS').toEqual([]);
  });

  it('(c) un flux pidIsActor:false ne prend pas son `pid` pour un acteur : un héros posé en rangée n’y donne aucune possession', () => {
    const s = base({});
    const fuites: string[] = [];
    for (const [flux, w] of MULTI) {
      if (w.pidIsActor) continue;
      for (const v of w.verbs) {
        if (estVerbeDeFenetre(v)) continue;
        if (intentAllowedFor(s, 1, NOM_DU_VERBE_DE_JET[v], argsDuGeste(flux, v, H_OWNER)) === true && intentAllowedFor(s, 0, NOM_DU_VERBE_DE_JET[v], argsDuGeste(flux, v, H_OWNER)) === false) fuites.push(`${NOM_DU_VERBE_DE_JET[v]}@${flux}`);
      }
    }
    expect(fuites, 'geste d’un flux à pid NON-acteur routé sur le propriétaire du héros posé en rangée').toEqual([]);
  });

  it('(a) chaque verbe de jet est exposé dans COMBAT_INTENTS et ROUTÉ (jamais laissé au repli universel)', () => {
    // `transmettreLesIntentions` (`reseau.ts`) n'enrobe que `GUEST_INTENTS` : un geste sans intent s'exécuterait EN LOCAL
    // chez l'invité (défaut #949) ; un geste au repli rendrait le owner de la MODALE — `'*'` sur une étape partagée,
    // donc TOUS les sièges brûleraient la Résistance ou la Résilience d'autrui (#1050, angle mort #965).
    const nus = Object.values(NOM_DU_VERBE_DE_JET).filter((n) => !COMBAT_INTENTS.has(n) || !ROUTES.has(n));
    expect(nus, 'verbe de jet sans intent ou sans route').toEqual([]);
  });

  it('un flux inconnu, ou qui n’accepte pas le verbe, n’est possédé par AUCUN siège', () => {
    const s = base(FIXTURES.counterspell);
    for (const seat of [0, 1, 2]) {
      expect(intentAllowedFor(s, seat, 'jetLancer', ['zz-inconnu', H_OWNER]), `siège ${seat}, flux inconnu`).toBe(false);
      expect(intentAllowedFor(s, seat, 'jetResister', ['contreSort', H_OWNER]), `siège ${seat}, Résistance sur le Contre-sort`).toBe(false);
    }
  });

  it('exhaustivité : chaque flux multi à pid-acteur a sa fixture de possession', () => {
    const sans = MULTI.filter(([k, w]) => w.pidIsActor && !(k in FIXTURES)).map(([k]) => k);
    expect(sans, 'flux multi sans fixture — la garde de possession ne le couvre pas').toEqual([]);
  });

  for (const [flux, w] of MULTI) {
    if (!w.pidIsActor) continue;
    it(`(b) ${flux} : le siège propriétaire du participant est ACCEPTÉ, tout autre siège REFUSÉ`, () => {
      const s = base(FIXTURES[flux]);
      for (const v of w.verbs) {
        if (estVerbeDeFenetre(v)) continue;
        const intent = NOM_DU_VERBE_DE_JET[v];
        const args = (x: string) => argsDuGeste(flux, v, x);
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

  it('(d) l’annulation et la clôture d’un flux multi se rendent au repli universel, jamais à une rangée', () => {
    const verdicts: string[] = [];
    for (const [flux, w] of MULTI) {
      if (!(flux in FIXTURES)) continue;
      const s = base(FIXTURES[flux]);
      for (const v of w.verbs.filter(estVerbeDeFenetre)) {
        for (const seat of [0, 1, 2]) {
          const verdict = ROUTES.get(NOM_DU_VERBE_DE_JET[v])!.rule(s, seat, [flux]);
          if (verdict !== null) verdicts.push(`${NOM_DU_VERBE_DE_JET[v]}@${flux} siège ${seat} : ${verdict}`);
        }
      }
    }
    expect(verdicts, 'verbe de fenêtre tranché par une rangée au lieu du repli').toEqual([]);
  });

  it('jetRegler(\'chute\', \'tenter\') : la DÉCLARATION d’une rangée de chute appartient au siège de SON tombant, jamais au propriétaire de la fenêtre', () => {
    const s = base({ pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: H_HOST, participants: parts.map((p) => ({ ...p, interactive: true, attempt: null })) } } as unknown as Partial<Jeu>);
    expect(intentAllowedFor(s, 1, 'jetRegler', ['chute', 'tenter', true, H_OWNER]), 'le siège du héros déclare pour lui').toBe(true);
    expect(intentAllowedFor(s, 0, 'jetRegler', ['chute', 'tenter', true, H_OWNER]), 'l’hôte, qui possède la fenêtre, ne déclare pas pour le héros d’un autre').toBe(false);
    expect(intentAllowedFor(s, 2, 'jetRegler', ['chute', 'tenter', false, H_OWNER]), 'siège TIERS').toBe(false);
    expect(intentAllowedFor(s, 1, 'jetRegler', ['chute', 'tenter', false, H_HOST]), 'le siège 1 ne déclare pas pour le héros de l’hôte').toBe(false);
    expect(intentAllowedFor(s, 0, 'jetRegler', ['chute', 'tenter', false, H_HOST])).toBe(true);
  });

  it('jetRegler(\'chute\', \'suspendre\') (EDO 01 l.231) : même route, le siège du tombant déclare s’il se suspend', () => {
    const s = base({ pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, suspendu: 2, initiateurId: H_HOST, participants: parts.map((p) => ({ ...p, interactive: true, attempt: null, suspendre: null })) } } as unknown as Partial<Jeu>);
    expect(intentAllowedFor(s, 1, 'jetRegler', ['chute', 'suspendre', true, H_OWNER]), 'le siège du héros déclare sa suspension').toBe(true);
    expect(intentAllowedFor(s, 0, 'jetRegler', ['chute', 'suspendre', true, H_OWNER]), 'l’hôte ne suspend pas le héros d’un autre').toBe(false);
    expect(intentAllowedFor(s, 2, 'jetRegler', ['chute', 'suspendre', true, H_OWNER]), 'siège TIERS').toBe(false);
  });
});

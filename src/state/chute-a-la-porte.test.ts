import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { applyLeafOps, ouvrirChute, runFlow, checkTriggers, differerLaSuite, pushCombatStep, runPureFlowLines, OPS_DIFFEREES } from './combatEffects';
import { openSequence } from './rollSeam';
import { buildAuthorPerilSteps } from './authorPerils';
import { SEA_PERIL_INTERRUPT } from './seaVoyageFlow';
import type { MapRoute } from './worldMap';
import type { Cloture, PendingCascade } from './pendings';
import { emptyScene, type Dialogue } from './scene';
import { runCombatFlow, bandeTriggeredTest } from './combat/triggeredTest';
import { seedBattleRng } from './battleRng';
import './combatFlow'; // injecte le walker de COMBAT dans la porte des dés (registerSuiteCombat)
import { draineCascade } from './cascadeTestKit';
import { stepInteraction, suspendActiveCascade, runCascadeImmediate, pushStep, startCascade, resolveRemainingCascade, registerCascadeApplier } from './cascade';
import { checkPartyWiped } from './partyWipe';
import { canFixDie } from './netOwnership';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { demandesDeDes, applyOps, cleDeDe, gelerOpsCtx,
  OPS_CTX_GELES, OPS_CTX_PAR_REFERENCE, OPS_CTX_REBATIS, OPS_CTX_HORS_CANAL,
  type GameOp, type OpsCtx } from '../engine/ops';
import { applyFall } from '../engine/movement';
import { rollShipCritical } from '../engine/shipCritical';
import { SHIP_CRIT_SET } from '../data/shipCriticals';
import { makeRNG, roll as rollDes } from '../engine/dice';
import { hasCondition } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { EffectOp, Flow } from './flow';

/**
 * #1508 T2 — LA CHUTE PASSE PAR LA PORTE. Les deux dés d'une chute du gréement (hauteur `2d10 m`,
 * MDG 13 l.684-688 ; Dégâts `1d10`, LDB 15 l.80) ne tombent plus SOUS `applyOps` : le moteur les
 * DEMANDE (`demandesDeDes`), la couche `state` les OUVRE en étapes à dé nu appendues à la séquence en
 * cours (`opsDe`/`chuteDe`), et ce qui est tombé revient à l'op par `OpsCtx.des`.
 *
 * Doctrine (utilisateur 2026-09-04) : « Vu que tous les jets passé par le même point d'entrée, il est
 * inutile de se demander si le jeu est configuré pour » — le site ne classe pas son dé, la porte décide.
 *
 * Contrats POSITIFS, exercés par les VRAIES coutures (données de `ship-criticals.json`, `applyLeafOps`,
 * les verbes de cascade du store).
 */

/** Marin minimal — BE 3, PA 0, assez de PB pour encaisser 3×20 m. */
const marin = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, label: id, kind: 'npc',
    characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 42, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
    skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
    armour: { corps: 0 }, wounds: { current: 200, max: 200, base: 200 }, advantage: 0, ...over,
  }) as unknown as Combatant;

/** Le patrouilleur : 25 m → Taille MOYENNE (MDG 12 l.126) ; le nid-de-pie est une Amélioration d'instance. */
const coque = (): Combatant => ({ id: 'hull', creatureId: 'bateau-de-patrouille', upgrades: [{ id: 'nid-de-pie' }] } as unknown as Combatant);

/** Les ops de la branche d'ÉCHEC de « Mât brisé » (d10 = 10), telles qu'AUTHORÉES. */
const opsDeChute = (): GameOp[] => {
  const fail = rollShipCritical('greement', makeRNG(1), 10, SHIP_CRIT_SET).crewHit!.test!.fail as { effect: { ops: GameOp[] } };
  return fail.effect.ops;
};
const feuille = (ops: GameOp[]): EffectOp => ({ type: 'ops', on: 'target', ops } as unknown as EffectOp);

const BE = 3; // Endurance 31 → Bonus d'Endurance 3

afterEach(() => resetDesFixes());

describe('(i) le moteur DEMANDE ses dés — `demandesDeDes` sur les ops RÉELLES de « Mât brisé »', () => {
  const ops = opsDeChute();

  it('un gabier sur une coque MOYENNE : DEUX dés — la hauteur (2d10 m) puis les Dégâts (1d10)', () => {
    const d = demandesDeDes(ops, marin('gabier', { shipStation: 'greement' } as Partial<Combatant>), { hull: coque() });
    expect(d.map((x) => x.cle)).toEqual([cleDeDe(0, 'hauteur'), cleDeDe(0, 'degats')]);
    expect(d[0].spec, 'MDG 13 l.687 : Moyenne à Grande → 2d10 mètres').toEqual({ n: 2, sides: 10 });
    expect(d[0].unite).toBe('m');
    expect(d[1].spec, 'LDB 15 l.80 : +1d10 Dégâts').toEqual({ n: 1, sides: 10 });
    expect(d[1].unite, 'des Blessures se lisent nues').toBeUndefined();
  });

  it('depuis le NID-DE-PIE la hauteur est un ENTIER (25 m) : UN seul dé, celui des Dégâts', () => {
    const d = demandesDeDes(ops, marin('vigie', { shipStation: 'nid-de-pie' } as Partial<Combatant>), { hull: coque() });
    expect(d.map((x) => x.cle)).toEqual([cleDeDe(0, 'degats')]);
  });

  it('ÉNUMÉRATION PURE : aucune Blessure posée, aucun État — rien n’est joué en la demandant', () => {
    const gabier = marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);
    demandesDeDes(ops, gabier, { hull: coque() });
    expect(gabier.wounds.current).toBe(200);
    expect(gabier.conditions).toEqual([]);
  });
});

describe('(ii) le dé POSÉ remplace le tirage — `OpsCtx.des` lu par l’op `fall`', () => {
  it('hauteur 13 + Dégâts 7 posés → 3×13 + 7 − BE, et AUCUN dé n’est retiré', () => {
    const gabier = marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);
    const des = new Map([[cleDeDe(0, 'hauteur'), 13], [cleDeDe(0, 'degats'), 7]]);
    applyOps(gabier, opsDeChute(), { rng: makeRNG(99), hull: coque(), des });
    expect(200 - gabier.wounds.current).toBe(3 * 13 + 7 - BE);
  });

  it('SANS pose, l’op tire elle-même à la MÊME position du rng (pilote headless inchangé)', () => {
    const gabier = marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);
    applyOps(gabier, opsDeChute(), { rng: makeRNG(5), hull: coque() });
    // Le rng est consommé dans l'ORDRE de l'op : hauteur (2d10) puis Dégâts (1d10).
    const oracle = makeRNG(5);
    const metres = rollDes(2, 10, oracle);
    const degats = rollDes(1, 10, oracle);
    expect(200 - gabier.wounds.current).toBe(Math.max(0, 3 * metres + degats - BE));
  });

  it('le foyer de la formule reste `applyFall` : mêmes Blessures, même État qu’un appel direct', () => {
    const parLOp = marin('op', { shipStation: 'greement' } as Partial<Combatant>);
    const parLaBrique = marin('brique');
    const des = new Map([[cleDeDe(0, 'hauteur'), 6], [cleDeDe(0, 'degats'), 9]]);
    applyOps(parLOp, opsDeChute(), { rng: makeRNG(1), hull: coque(), des });
    applyFall(parLaBrique, 6, 9);
    expect(parLOp.wounds.current).toBe(parLaBrique.wounds.current);
    expect(hasCondition(parLOp, 'a-terre')).toBe(hasCondition(parLaBrique, 'a-terre'));
  });
});

describe('(iii) l’applier OUVRE : deux étapes à dé nu, possédées par la victime, POSABLES', () => {
  const gabier = () => useGame.getState().party.find((c) => c.id === 'gabier')!;

  beforeEach(() => {
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('gabier', { kind: 'hero', shipStation: 'greement' } as Partial<Combatant>), coque()],
    });
  });

  const ouvrir = () => applyLeafOps(useGame.getState, useGame.setState, gabier(), feuille(opsDeChute()), { hull: coque() });

  it('rien n’est encaissé à l’application : la porte ouvre la HAUTEUR d’abord', () => {
    expect(ouvrir(), 'la feuille est DIFFÉRÉE : elle n’a pas de journal, elle n’est pas encore jouée').toBe(OPS_DIFFEREES);
    const p = useGame.getState().pendingCascade!;
    expect(p.participants).toHaveLength(1);
    const st = p.participants[0];
    expect(stepInteraction(st)).toBe('de');
    expect(st.de!.spec).toEqual({ n: 2, sides: 10 });
    expect(st.actorId, 'une magnitude SUBIE se joue au siège de qui la subit').toBe('gabier');
    expect(gabier().wounds.current, 'aucune Blessure avant les dés').toBe(200);
  });

  it('le dé POSÉ à chaque étape décide seul : Dégâts = 3×hauteur + d10 − BE', () => {
    ouvrir();
    const hauteur = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(hauteur.id, 11);
    useGame.getState().cascadeNext();
    // La 2ᵉ étape (les Dégâts) n'a PAS été mintée d'avance : elle s'append à la résolution de la 1ʳᵉ.
    const p = useGame.getState().pendingCascade!;
    const degats = p.participants[p.cursor];
    expect(degats.de!.spec).toEqual({ n: 1, sides: 10 });
    expect(gabier().wounds.current, 'toujours rien : le second dé n’est pas tombé').toBe(200);
    useGame.getState().cascadeDieSetForcedRoll(degats.id, 4);
    useGame.getState().cascadeNext();
    expect(200 - gabier().wounds.current).toBe(3 * 11 + 4 - BE);
  });

  it('les deux étapes sont FIXABLES par le siège qui tient la victime (option « Dés fixés »)', () => {
    setDesFixes(true);
    ouvrir();
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(canFixDie(useGame.getState(), st.actorId)).toBe(true);
  });

  it('LANCÉES (jamais posées), les deux étapes mènent à la même conséquence — via le pilote de fenêtre', () => {
    useGame.getState().seedRng(12);
    ouvrir();
    expect(draineCascade(useGame.getState)).toEqual(['opsDe', 'opsDe']);
    const perte = 200 - gabier().wounds.current;
    expect(perte, 'hauteur 2..20 m, dé 1..10, BE 3').toBeGreaterThanOrEqual(3 * 2 + 1 - BE);
    expect(perte).toBeLessThanOrEqual(3 * 20 + 10 - BE);
  });

  it('depuis le NID-DE-PIE (hauteur entière), UNE seule étape suffit', () => {
    useGame.setState({ party: [marin('vigie', { kind: 'hero', shipStation: 'nid-de-pie' } as Partial<Combatant>), coque()] });
    const vigie = useGame.getState().party[0];
    applyLeafOps(useGame.getState, useGame.setState, vigie, feuille(opsDeChute()), { hull: coque() });
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.de!.spec).toEqual({ n: 1, sides: 10 });
    useGame.getState().cascadeDieSetForcedRoll(st.id, 6);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade, 'un seul dé, une seule étape').toBeNull();
    const apres = useGame.getState().party.find((c) => c.id === 'vigie')!;
    expect(200 - apres.wounds.current).toBe(3 * 25 + 6 - BE);
  });

  it('la RANGÉE porte le dé et son unité — ce que la fenêtre montre EST le tirage', () => {
    ouvrir();
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 9);
    const pose = useGame.getState().pendingCascade!.participants[0];
    expect(pose.de!.result).toEqual({ roll: 9, total: 9 });
    expect(pose.de!.unite, 'la hauteur se lit en mètres (MDG 13 l.684)').toBe('m');
    expect(pose.fixed, 'dé SAISI : la rangée le marque').toBe(true);
  });

  it('AUCUN siège à la manœuvre (marin PNJ) : le socle TIRE le dé d’office — jamais une fenêtre orpheline', () => {
    useGame.setState({
      pendingCascade: null, journal: [],
      party: [marin('matelot', { shipStation: 'greement' } as Partial<Combatant>), coque()],
    });
    useGame.getState().seedRng(21);
    const matelot = useGame.getState().party[0];
    applyLeafOps(useGame.getState, useGame.setState, matelot, feuille(opsDeChute()), { hull: coque() });
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.de!.result, 'aucun siège ne le tient : le socle le tire à l’ouverture').not.toBeNull();
    expect(draineCascade(useGame.getState)).toContain('opsDe');
    expect(useGame.getState().pendingCascade, 'la séquence se referme : les deux dés sont tombés').toBeNull();
    const apres = useGame.getState().party.find((c) => c.id === 'matelot')!;
    expect(apres.wounds.current, 'la chute est bien encaissée, ses deux dés à la porte compris').toBeLessThan(200);
  });

  it('DEUX tombants dans la MÊME séquence : chaque dé ne sert QUE la feuille qui l’a ouverte', () => {
    // L'identité d'une grappe est l'ID de sa PREMIÈRE étape (unique par l'index d'append de `pushDie`),
    // pas `acteur + horloge` : les deux feuilles ci-dessous partagent leur instant de jeu, et leurs
    // quatre dés portent les deux MÊMES clés (`#0.hauteur`, `#0.degats`). Une identité par horloge les
    // ferait se relire l'un l'autre — A encaisserait la hauteur de B, et le dé montré serait jeté.
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('A', { kind: 'hero', shipStation: 'greement' } as Partial<Combatant>),
        marin('B', { kind: 'hero', shipStation: 'greement' } as Partial<Combatant>), coque()],
    });
    const par = (id: string) => useGame.getState().party.find((c) => c.id === id)!;
    const CTX = { hull: coque(), now: 1000 }; // MÊME instant de jeu pour les deux feuilles
    applyLeafOps(useGame.getState, useGame.setState, par('A'), feuille(opsDeChute()), CTX);
    applyLeafOps(useGame.getState, useGame.setState, par('B'), feuille(opsDeChute()), CTX);
    expect(useGame.getState().pendingCascade!.participants.map((s) => s.actorId)).toEqual(['A', 'B']);
    // Poses par ACTEUR, dans l'ordre où ses dés s'ouvrent : A hauteur 2 puis dégâts 1, B hauteur 9 puis
    // dégâts 10. Les valeurs sont choisies pour que tout croisement change le total.
    const aPoser: Record<string, number[]> = { A: [2, 1], B: [9, 10] };
    for (let garde = 0; useGame.getState().pendingCascade && garde < 20; garde++) {
      const p = useGame.getState().pendingCascade!;
      const st = p.participants[p.cursor];
      if (!st) break;
      if (st.de && !st.de.result) {
        const v = aPoser[st.actorId!]?.shift();
        expect(v, `étape sans pose prévue : ${st.id}`).toBeDefined();
        useGame.getState().cascadeDieSetForcedRoll(st.id, v!);
      }
      useGame.getState().cascadeNext();
    }
    expect(200 - par('A').wounds.current, 'A : 3×2 m + 1 − BE').toBe(3 * 2 + 1 - BE);
    expect(200 - par('B').wounds.current, 'B : 3×9 m + 10 − BE').toBe(3 * 9 + 10 - BE);
  });

});

describe('(iv) une chute de hauteur CONNUE ouvre AUSSI son dé (`chuteDe`)', () => {
  beforeEach(() => {
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('h1', { kind: 'hero' } as Partial<Combatant>), marin('h2', { kind: 'hero' } as Partial<Combatant>)],
    });
  });
  const par = (id: string) => useGame.getState().party.find((c) => c.id === id)!;

  it('effondrement / chute de selle / Effet d’auteur : UNE étape par tombant, rien en silence', () => {
    ouvrirChute(useGame.setState, par('h1'), 4);
    ouvrirChute(useGame.setState, par('h2'), 4);
    const p = useGame.getState().pendingCascade!;
    expect(p.participants.map((s) => s.kind)).toEqual(['chuteDe', 'chuteDe']);
    expect(p.participants.map((s) => s.actorId)).toEqual(['h1', 'h2']);
    expect(p.participants.map((s) => s.de!.spec)).toEqual([{ n: 1, sides: 10 }, { n: 1, sides: 10 }]);
    expect(par('h1').wounds.current, 'aucun dégât avant le dé').toBe(200);
  });

  it('le dé POSÉ décide : 3×4 m + d10 − BE, et l’État À Terre vient d’`applyFall`', () => {
    ouvrirChute(useGame.setState, par('h1'), 4);
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 8);
    useGame.getState().cascadeNext();
    expect(200 - par('h1').wounds.current).toBe(3 * 4 + 8 - BE);
    expect(hasCondition(par('h1'), 'a-terre'), 'perte (17) > BE (3), LDB 15 l.84').toBe(true);
  });

  it('l’étape est FIXABLE par le siège du tombant', () => {
    setDesFixes(true);
    ouvrirChute(useGame.setState, par('h1'), 4);
    expect(canFixDie(useGame.getState(), useGame.getState().pendingCascade!.participants[0].actorId)).toBe(true);
  });

  it('la cible RETIRÉE entre l’ouverture et la pose : la conséquence est DITE, jamais perdue', () => {
    ouvrirChute(useGame.setState, par('h1'), 4);
    const st = useGame.getState().pendingCascade!.participants[0];
    // Le tombant quitte le jeu pendant que sa fenêtre est ouverte (mort, fuite, scène close). L'applier
    // n'a plus de corps où poser les Blessures : il le NOMME au journal au lieu de rendre en silence.
    useGame.setState({ party: useGame.getState().party.filter((c) => c.id !== 'h1') } as never);
    useGame.getState().cascadeDieSetForcedRoll(st.id, 8);
    useGame.getState().cascadeNext();
    const lu = [...useGame.getState().journal, ...draineCascade(useGame.getState)].join(' | ');
    expect(lu, `la conséquence est morte en silence : ${lu}`).toMatch(/n’est plus en jeu/);
    expect(useGame.getState().pendingCascade, 'la séquence se referme').toBeNull();
  });

  it('la LIGNE dit ce que LA CHUTE a coûté, et le journal garde l’ordre : chute PUIS soin', () => {
    // La conséquence se lit par DIFFÉRENCE de Blessures : mesurée après que la suite a joué, elle
    // annonçait le SOLDE (− la chute + le soin), pas la chute. Ici la chute coûte 17 et le soin en rend
    // 27 (plafond) : un journal qui parle de 10 (ou qui soigne avant de faire tomber) est faux.
    seedBattleRng(3);
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('blessé', { kind: 'hero', wounds: { current: 190, max: 200, base: 200 } } as Partial<Combatant>)],
    });
    runFlow(useGame.getState, useGame.setState, { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'fall', target: 'party', metres: 4 } },
      { kind: 'do', effect: { type: 'ops', on: 'party', ops: [{ op: 'heal', amount: 50 }] } },
    ] } as unknown as Flow);
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 8); // 3×4 + 8 − BE 3 = 17
    useGame.getState().cascadeNext();
    const j = useGame.getState().journal;
    const iChute = j.findIndex((l) => l.includes('17 Blessure(s)'));
    const iSoin = j.findIndex((l) => l.includes('27 Blessure(s)'));
    expect(iChute, `la ligne de chute annonce SA perte (17) — journal : ${JSON.stringify(j)}`).toBeGreaterThanOrEqual(0);
    expect(iSoin, 'le soin a bien été rejoué').toBeGreaterThanOrEqual(0);
    expect(iSoin, 'la cause est dite AVANT la suite qu’elle a fait attendre').toBeGreaterThan(iChute);
  });
});

describe('(v) ORDRE AUTHORÉ : ce qui suit une feuille à dé attend le dé, il ne passe pas devant', () => {
  // Un dé qui part à la porte suspend son LOT : la suite est SA continuation. Sans cela, « il tombe
  // PUIS on le soigne » devenait « on le soigne PUIS il tombe » — les soins étaient écrêtés au plafond
  // avant la chute, et le héros finissait plus bas que ce que l'auteur a écrit.
  const heros = () => useGame.getState().party.find((c) => c.id === 'h1')!;

  beforeEach(() => {
    seedBattleRng(3);
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('h1', { kind: 'hero', wounds: { current: 190, max: 200, base: 200 } } as Partial<Combatant>)],
    });
  });

  it('walker de SCÈNE (`runFlow`) : chute (−17) PUIS soin (+50, plafonné) → 200, jamais 183', () => {
    const flow = { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'fall', target: 'party', metres: 4 } },
      { kind: 'do', effect: { type: 'ops', on: 'party', ops: [{ op: 'heal', amount: 50 }] } },
    ] } as unknown as Flow;
    runFlow(useGame.getState, useGame.setState, flow);
    expect(heros().wounds.current, 'rien du lot ne s’applique avant le dé').toBe(190);
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.kind).toBe('chuteDe');
    useGame.getState().cascadeDieSetForcedRoll(st.id, 8); // 3×4 + 8 − BE 3 = 17
    useGame.getState().cascadeNext();
    // 190 − 17 = 173, puis +50 → plafond 200. Dans l'ORDRE INVERSE : 190 + 50 = 200 (40 perdus au
    // plafond) puis −17 = 183 — c'est ce 183 que l'ordre authoré interdit.
    expect(heros().wounds.current).toBe(200);
  });

  it('walker de COMBAT (`runCombatFlow`) : même invariant sur une pile d’effet déclenché', () => {
    const cible = heros();
    const flow = { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'ops', on: 'target', ops: opsDeChute() } },
      { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'heal', amount: 50 }] } },
    ] } as unknown as Flow;
    useGame.setState({ party: [{ ...cible, shipStation: 'nid-de-pie' } as Combatant, coque()] });
    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: heros(), caster: heros(), label: 'Mât brisé', opsCtx: { hull: coque() } }, flow);
    expect(heros().wounds.current, 'la suite de la pile attend le dé').toBe(190);
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 4); // nid-de-pie : 25 m entiers, dé = Dégâts
    useGame.getState().cascadeNext();
    // 190 − (3×25 + 4 − 3) = 114, puis +50 = 164. Ordre inverse : 190+50 → 200, puis −76 = 124.
    expect(heros().wounds.current).toBe(190 - (3 * 25 + 4 - BE) + 50);
  });

  // Le `seq` PLAT ci-dessus n'exerce qu'une vidange de lot. Les deux nœuds qui BRANCHENT (`if`, `test`)
  // vident le lot PUIS poursuivent la pile : c'est là que le signal meurt. Le nœud courant, que le lot
  // n'a pas consommé, repart donc EN TÊTE de la continuation — il branche sur l'état que la conséquence
  // aura produit, jamais sur celui d'avant le dé.
  it('walker de SCÈNE, nœud `if` : la branche attend le dé — 200, jamais 183', () => {
    const flow = { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'fall', target: 'party', metres: 4 } },
      { kind: 'if', cond: { kind: 'always' }, then: { kind: 'do', effect: { type: 'ops', on: 'party', ops: [{ op: 'heal', amount: 50 }] } } },
    ] } as unknown as Flow;
    runFlow(useGame.getState, useGame.setState, flow);
    expect(heros().wounds.current, 'la branche ne s’évalue même pas avant le dé').toBe(190);
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 8);
    useGame.getState().cascadeNext();
    expect(heros().wounds.current).toBe(200);
  });

  it('walker de SCÈNE, nœud `test` : la modale de jet ne s’ouvre qu’APRÈS le dé de chute', () => {
    const flow = { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'fall', target: 'party', metres: 4 } },
      { kind: 'test', test: { skill: { id: 'escalade' }, difficulty: 'intermediaire' },
        success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } },
    ] } as unknown as Flow;
    useGame.setState({ pendingTest: null } as never);
    runFlow(useGame.getState, useGame.setState, flow);
    expect(useGame.getState().pendingTest, 'une modale de jet ouverte par-dessus un dé en vol').toBeNull();
    expect(heros().wounds.current).toBe(190);
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 8);
    useGame.getState().cascadeNext();
    expect(heros().wounds.current, 'la chute s’est encaissée la première').toBe(190 - 17);
    expect(useGame.getState().pendingTest, 'le nœud `test` a repris sa place en tête de la continuation').not.toBeNull();
  });

  it('walker de COMBAT, nœud `if` : même invariant sur une pile d’effet déclenché', () => {
    const cible = heros();
    useGame.setState({ party: [{ ...cible, shipStation: 'nid-de-pie' } as Combatant, coque()] });
    const flow = { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'ops', on: 'target', ops: opsDeChute() } },
      { kind: 'if', cond: { kind: 'always' }, then: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'heal', amount: 50 }] } } },
    ] } as unknown as Flow;
    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: heros(), caster: heros(), label: 'Mât brisé', opsCtx: { hull: coque() } }, flow);
    expect(heros().wounds.current, 'la branche attend le dé').toBe(190);
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 4);
    useGame.getState().cascadeNext();
    expect(heros().wounds.current).toBe(190 - (3 * 25 + 4 - BE) + 50);
  });
});

describe('(vi) CONTEXTE de la feuille : la reprise applique le MÊME contexte que le chemin direct', () => {
  // Une feuille différée se reprend depuis une étape SÉRIALISÉE : son contexte doit traverser. Le
  // reconstruire « de mémoire » perdait `{woundsDealt}` (Absorption, EDO 11 l.222), qui tombait à 0.
  const ops = () => [...opsDeChute(), { op: 'wounds', amount: { woundsDealt: true }, ignoreTB: true, ignoreAP: true }] as GameOp[];
  const CTX = () => ({ hull: coque(), woundsDealt: 7 });

  it('`{woundsDealt}` (EDO 11 l.222) survit à la porte : même perte des deux côtés', () => {
    const direct = marin('direct', { shipStation: 'nid-de-pie' } as Partial<Combatant>);
    applyOps(direct, ops(), { rng: makeRNG(4), ...CTX(), des: new Map([[cleDeDe(0, 'degats'), 5]]) });

    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('porte', { kind: 'hero', shipStation: 'nid-de-pie' } as Partial<Combatant>), coque()] });
    const parLaPorte = useGame.getState().party[0];
    applyLeafOps(useGame.getState, useGame.setState, parLaPorte, feuille(ops()), CTX());
    const st = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeDieSetForcedRoll(st.id, 5);
    useGame.getState().cascadeNext();
    const apres = useGame.getState().party.find((c) => c.id === 'porte')!;
    expect(200 - apres.wounds.current, '25 m × 3 + dé 5 − BE 3, PUIS les 7 Blessures d’Absorption').toBe(3 * 25 + 5 - BE + 7);
    expect(200 - apres.wounds.current, 'parité avec le chemin direct').toBe(200 - direct.wounds.current);
  });

  it('la PARTITION d’`OpsCtx` est totale et disjointe, et `gelerOpsCtx` n’en perd aucun champ', () => {
    const seaux = [OPS_CTX_GELES, OPS_CTX_PAR_REFERENCE, OPS_CTX_REBATIS, OPS_CTX_HORS_CANAL].flat();
    expect(new Set(seaux).size, 'aucun champ dans deux seaux à la fois').toBe(seaux.length);
    // Un contexte qui porte TOUS les champs gelables : le gel les rend tous. Sortir un champ du seau
    // `OPS_CTX_GELES` le fait disparaître ici — et c'est ce que la reprise perdrait.
    const plein = Object.fromEntries(OPS_CTX_GELES.map((k) => [k, 1])) as unknown as OpsCtx;
    expect(Object.keys(gelerOpsCtx(plein)).sort()).toEqual([...OPS_CTX_GELES].sort());
  });
});

describe('(vii) DETTE DITE : les dés d’une op IMBRIQUÉE ne passent pas encore par la porte', () => {
  // #1508 T2 est de NIVEAU 1. Une op `fall` emballée dans une rangée de `rollTable` tire encore ses
  // deux dés sous `applyOps` (`imbrique` retire `ctx.des`) : c'est une dette COMPTÉE (stock
  // `DES_HORS_PORTE_STOCK`, à l'`applyOps` de l'appelant), pas une classe exemptée. Ce contrat FIXE
  // l'état mesuré pour qu'un futur train le voie rougir en l'adoptant, au lieu de le croire fait.
  const imbriquee = () => [{ op: 'rollTable', die: 'd10', rows: [{ min: 1, max: 10, ops: opsDeChute() }] }] as unknown as GameOp[];

  it('`demandesDeDes` n’annonce RIEN pour la forme imbriquée, et aucune fenêtre ne s’ouvre', () => {
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('gabier', { kind: 'hero', shipStation: 'greement' } as Partial<Combatant>), coque()] });
    const gabier = useGame.getState().party[0];
    expect(demandesDeDes(imbriquee(), gabier, { hull: coque() }), 'niveau 1 : rien à annoncer').toEqual([]);
    applyLeafOps(useGame.getState, useGame.setState, gabier, feuille(imbriquee()), { hull: coque() });
    expect(useGame.getState().pendingCascade, 'aucune étape de dé — la dette est ICI').toBeNull();
    expect(useGame.getState().party[0].wounds.current, 'les deux dés sont tombés sous `applyOps`').toBeLessThan(200);
  });
});

describe('(viii) un contexte que la reprise ne saurait pas rebâtir REFUSE de se différer', () => {
  it('un hook `OPS_CTX_HORS_CANAL` sur une feuille à dé lève, nommément', () => {
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [],
      party: [marin('gabier', { kind: 'hero', shipStation: 'greement' } as Partial<Combatant>), coque()] });
    const gabier = useGame.getState().party[0];
    expect(() => applyLeafOps(useGame.getState, useGame.setState, gabier, feuille(opsDeChute()), {
      hull: coque(), onCondition: () => {},
    })).toThrow(/onCondition/);
  });
});

describe('(ix) FIN DE COMBAT : un dé en vol n’est pas piétiné par le teardown', () => {
  const par = (id: string) => useGame.getState().party.find((c) => c.id === id)!;

  beforeEach(() => {
    useGame.setState({
      battle: null, pendingVictory: null, pendingCascade: null, suspendedCascades: [], journal: [], partyWiped: false,
      party: [marin('h1', { kind: 'hero' } as Partial<Combatant>), marin('h2', { kind: 'hero' } as Partial<Combatant>)],
    });
  });

  it('VICTOIRE : la séquence PARQUÉE attend le dé, puis la couture universelle la reprend', () => {
    // `resumeSuspendedCascade` ne résume QUE sur slot LIBRE : la chute en vol tient le slot, et le
    // teardown de victoire ne l'écrase pas. La reprise vient ensuite, à la clôture de la cascade —
    // c'est la même couture (state/cascade.ts), jamais un checkpoint parallèle.
    ouvrirChute(useGame.setState, par('h2'), 4);
    suspendActiveCascade(useGame.getState, useGame.setState); // ex. une journée de voyage parquée par l'abordage
    ouvrirChute(useGame.setState, par('h1'), 4);
    useGame.getState().dismissVictory();
    const enVol = useGame.getState().pendingCascade!;
    expect(enVol.participants[0].actorId, 'le teardown n’a pas piétiné le dé en vol').toBe('h1');
    expect(useGame.getState().suspendedCascades, 'la parquée est restée parquée').toHaveLength(1);
    useGame.getState().cascadeDieSetForcedRoll(enVol.participants[0].id, 8);
    useGame.getState().cascadeNext();
    expect(200 - par('h1').wounds.current, 'la chute s’est bien encaissée').toBe(3 * 4 + 8 - BE);
    expect(useGame.getState().pendingCascade?.participants[0].actorId, 'la parquée reprend le slot libéré').toBe('h2');
    expect(useGame.getState().suspendedCascades).toHaveLength(0);
  });

  it('DÉFAITE (groupe anéanti) : la continuation part avec les flux — il n’y a plus personne à qui l’appliquer', () => {
    ouvrirChute(useGame.setState, par('h1'), 4);
    expect(useGame.getState().pendingCascade).not.toBeNull();
    useGame.setState({ party: useGame.getState().party.map((c) => ({ ...c, dead: true })) });
    expect(checkPartyWiped(useGame.getState, useGame.setState)).toBe(true);
    expect(useGame.getState().pendingCascade, 'plus de dé en vol : la partie est finie').toBeNull();
    expect(useGame.getState().suspendedCascades).toEqual([]);
  });
});

describe('(x) CLÔTURE DU VERBE : ce que le site allait faire APRÈS son Flow attend le dé', () => {
  // Le défaut a reculé d'un anneau à chaque passe : la suite du LOT, puis la suite de la PILE du
  // walker, puis la suite du VERBE APPELANT. La continuation ne portait qu'un `Flow` ; ce que le site
  // enchaînait ensuite (l'horloge d'une fouille, l'avancée d'un dialogue, un seam de Test raté) n'en
  // était pas un et passait devant. Une `Cloture` est un VERBE SÉRIALISABLE que l'étape porte comme
  // son Flow — le socle en avait déjà un, `PendingTest.dialogueNext`, ici généralisé.
  const marinBlesse = (id: string): Combatant =>
    marin(id, { kind: 'hero', wounds: { current: 190, max: 200, base: 200 } } as Partial<Combatant>);
  const CHUTE: Flow = { kind: 'do', effect: { type: 'fall', target: 'party', metres: 4 } } as unknown as Flow;
  const DIT = (desc: string): Flow => ({ kind: 'do', effect: { type: 'journal', desc } } as unknown as Flow);
  const dialogueDUnSaut = (): Dialogue => ({
    id: 'd-saut', start: 'n1',
    nodes: [
      { id: 'n1', desc: '.', choices: [{ label: 'Sauter', next: 'n2', flow: CHUTE }] },
      { id: 'n2', desc: 'De l’autre côté.', choices: [{ label: 'Continuer' }] },
    ],
  } as unknown as Dialogue);

  /** Pose le dé de l'étape SOUS LE CURSEUR (une grappe en compte plusieurs) et valide. */
  const dialogueDeDeuxSauts = (): Dialogue => ({
    id: 'd-deux', start: 'n1',
    nodes: [
      { id: 'n1', desc: '.', choices: [{ label: 'Sauter deux fois', next: 'n2', flow: { kind: 'seq', steps: [CHUTE, CHUTE] } }] },
      { id: 'n2', desc: 'Enfin.', choices: [{ label: 'Continuer' }] },
    ],
  } as unknown as Dialogue);

  const poseLeDe = (v: number): void => {
    const p = useGame.getState().pendingCascade!;
    const st = p.participants[p.cursor];
    useGame.getState().cascadeDieSetForcedRoll(st.id, v);
    useGame.getState().cascadeNext();
  };

  it('DIALOGUE : « le dialogue n’avance jamais sous une modale de jet » vaut aussi d’un DÉ', () => {
    // L'invariant était écrit au présent dans le store et ne regardait que `pendingTest` : une branche
    // de Test qui ouvre un dé laisse `pendingTest` nul, et le nœud suivant s'affichait par-dessus.
    seedBattleRng(3);
    const d = dialogueDUnSaut();
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      scene: { ...emptyScene(), dialogues: [d] } as never, gameTime: 1000, party: [marinBlesse('h1')],
      dialogue: { dialogue: d, nodeId: 'n1' } as never,
    });
    useGame.getState().chooseDialogue(0);
    expect(useGame.getState().pendingCascade, 'le saut a ouvert son dé de chute').not.toBeNull();
    expect(useGame.getState().dialogue?.nodeId, 'le nœud suivant n’est pas encore là').toBe('n1');
    poseLeDe(8);
    expect(useGame.getState().party[0].wounds.current, '190 − (3×4 + 8 − BE 3)').toBe(190 - 17);
    expect(useGame.getState().dialogue?.nodeId, 'la clôture a joué APRÈS la conséquence').toBe('n2');
  });

  it('HORLOGE de la clôture : l’événement PROGRAMMÉ se joue sur des Blessures ENCAISSÉES', () => {
    // `advanceTime` tire `fireScheduledEffects` et les ticks (Hémorragique, Poison, agonie). Jouée
    // devant le dé, l'horloge les tire sur des Blessures que la chute n'a pas ôtées : le tick lit un
    // état que la conséquence en vol va contredire.
    // Ici la clôture est la FERMETURE du dialogue (choix sans `next`), qui horodate la conversation.
    seedBattleRng(3);
    const d = {
      id: 'd-clot', start: 'n1',
      nodes: [{ id: 'n1', desc: '.', choices: [{ label: 'Sauter', flow: CHUTE }] }],
    } as unknown as Dialogue;
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      scene: { ...emptyScene(), dialogues: [d] } as never, gameTime: 1000, party: [marinBlesse('h1')],
      scheduledEffects: [{ executeAt: 1003, flow: DIT('événement programmé') }],
      dialogue: { dialogue: d, nodeId: 'n1' } as never,
    });
    useGame.getState().chooseDialogue(0);
    expect(useGame.getState().gameTime, 'l’horloge attend le dé').toBe(1000);
    expect(useGame.getState().scheduledEffects, 'rien n’est encore dû').toHaveLength(1);
    poseLeDe(8);
    const s = useGame.getState();
    expect(s.gameTime, 'la clôture d’horloge a joué').toBeGreaterThan(1000);
    expect(s.scheduledEffects, 'l’événement programmé a été consommé APRÈS').toHaveLength(0);
    const iChute = s.journal.findIndex((l) => l.includes('17 Blessure(s)'));
    const iEvt = s.journal.findIndex((l) => l.includes('événement programmé'));
    expect(iChute).toBeGreaterThanOrEqual(0);
    expect(iEvt, 'la cause avant la clôture qu’elle a fait attendre').toBeGreaterThan(iChute);
  });

  it('DEUX déclencheurs de zone : le second est la SUITE du premier, pas son concurrent', () => {
    seedBattleRng(3);
    const rect = { x: 0, y: 0, w: 3, h: 3 };
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], flags: {}, scheduledEffects: [],
      scene: { ...emptyScene(), triggers: [
        { id: 't1', rect, once: true, flow: CHUTE },
        { id: 't2', rect, once: true, flow: DIT('second déclencheur') },
      ] } as never,
      partyPos: { x: 1, y: 1, z: 0 } as never, gameTime: 1000, party: [marinBlesse('h1')],
    });
    checkTriggers(useGame.getState, useGame.setState);
    expect(useGame.getState().journal.some((l) => l.includes('second déclencheur')), 'il attend le dé').toBe(false);
    poseLeDe(8);
    const s = useGame.getState();
    expect(s.party[0].wounds.current).toBe(190 - 17);
    expect(s.journal.some((l) => l.includes('second déclencheur')), 'joué APRÈS').toBe(true);
    expect(s.flags['__trigger_t2'], 'son marquage `once` a suivi son Flow').toBe(true);
  });

  it('la clôture repart avec le dé SUIVANT quand la continuation en rouvre un', () => {
    // Deux chutes à la file : la clôture (l'avancée du dialogue) ne doit pas se jouer entre les deux.
    seedBattleRng(3);
    const d = dialogueDeDeuxSauts();
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      scene: { ...emptyScene(), dialogues: [d] } as never, gameTime: 1000, party: [marinBlesse('h1')],
      dialogue: { dialogue: d, nodeId: 'n1' } as never,
    });
    useGame.getState().chooseDialogue(0);
    poseLeDe(8);
    expect(useGame.getState().pendingCascade, 'la 2ᵉ chute a ouvert son dé').not.toBeNull();
    expect(useGame.getState().dialogue?.nodeId, 'la clôture est repartie avec LUI').toBe('n1');
    poseLeDe(8);
    expect(useGame.getState().dialogue?.nodeId, 'elle joue quand la grappe entière est retombée').toBe('n2');
  });

  it('DEUX confidences sur la MÊME étape se COMPOSENT — la première suite n’est pas écrasée', () => {
    // `dismissVictory` confie le reste du butin PUIS la continuation d'`onContinue` : un écrasement
    // perdait le premier lot en silence. Le `seq` est l'opérateur de suite du Flow, ici comme ailleurs.
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [], party: [marinBlesse('h1')] });
    ouvrirChute(useGame.setState, useGame.getState().party[0], 4);
    differerLaSuite(useGame.setState, DIT('LOT-A'), 'scene');
    differerLaSuite(useGame.setState, DIT('LOT-B'), 'scene');
    poseLeDe(8);
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('LOT-A')), 'la 1re suite confiée a joué').toBe(true);
    expect(j.findIndex((l) => l.includes('LOT-B')), 'et la 2e APRÈS elle')
      .toBeGreaterThan(j.findIndex((l) => l.includes('LOT-A')));
  });

  it('SAUVEGARDE entre deux dés : la clôture survit au round-trip JSON, et ne se joue qu’UNE fois', () => {
    // `pendingCascade` est sauvegardé : une clôture qui serait une fermeture JS ne survivrait pas, et
    // une suite laissée sur l'étape DÉJÀ validée se rejouerait au rechargement.
    seedBattleRng(3);
    const d = dialogueDeDeuxSauts();
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      scene: { ...emptyScene(), dialogues: [d] } as never, gameTime: 1000, party: [marinBlesse('h1')],
      dialogue: { dialogue: d, nodeId: 'n1' } as never,
    });
    useGame.getState().chooseDialogue(0);
    poseLeDe(8);
    const clefs = ['pendingCascade', 'dialogue', 'party', 'scene', 'journal', 'gameTime', 'flags', 'scheduledEffects', 'suspendedCascades'] as const;
    const etat = useGame.getState() as unknown as Record<string, unknown>;
    const save = JSON.parse(JSON.stringify(Object.fromEntries(clefs.map((k) => [k, etat[k]]))));
    const clotures = (save.pendingCascade as PendingCascade).participants
      .map((p) => p.meta?.apresClotures as Cloture[] | undefined).filter(Boolean);
    expect(clotures, 'UNE étape porte la clôture — l’étape validée l’a rendue').toHaveLength(1);
    expect(clotures[0]![0]!.verbe).toBe('dialogueSuivant');
    useGame.setState({ pendingCascade: null, dialogue: null, journal: [] } as never); // « nouvelle session »
    useGame.setState(save as never); // rechargement
    expect(useGame.getState().dialogue?.nodeId, 'la clôture attend toujours son dé').toBe('n1');
    poseLeDe(8);
    expect(useGame.getState().dialogue?.nodeId).toBe('n2');
    expect(useGame.getState().party[0].wounds.current, '190 − 17 − 17').toBe(156);
    expect(useGame.getState().pendingCascade, 'la séquence se referme').toBeNull();
  });
});

describe('(xi) SÉQUENCE de cascade : un dé ouvert par un applier s’INSÈRE, il ne va pas en fin', () => {
  // Les périls d'auteur d'une route (`MapRoute.perils`, DONNÉE éditable) sont une séquence d'étapes.
  // Un péril qui ouvre une chute défère ; appendu en FIN, son dé jouait APRÈS le péril suivant — la
  // scène se racontait à l'envers. L'étape poussée pendant une application est la suite IMMÉDIATE de
  // celle qui l'a produite : elle s'insère derrière elle, et la séquence reprend après.
  const marinBlesse = (id: string): Combatant =>
    marin(id, { kind: 'hero', wounds: { current: 190, max: 200, base: 200 } } as Partial<Combatant>);
  const route = (perils: unknown[]): MapRoute => ({ id: 'r1', perils } as unknown as MapRoute);

  const monte = (perils: unknown[], interruptId: string): void => {
    seedBattleRng(3);
    const r = route(perils);
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      party: [marinBlesse('h1')], gameTime: 1000,
      worldMap: { routes: [r] } as never, travelPlan: { routeId: 'r1' } as never,
    });
    openSequence(useGame.getState, useGame.setState, {
      title: 'Périls', purpose: 'sequence', steps: buildAuthorPerilSteps(r, 'Ubersreik', interruptId),
    });
    useGame.getState().seedRng(7);
  };

  it('le péril suivant joue APRÈS le dé de chute du précédent (ordre authoré)', () => {
    monte([
      { label: 'Éboulement', chancePct: 100, effects: [{ type: 'fall', target: 'party', metres: 4 }] },
      { label: 'Trouvaille', chancePct: 100, effects: [{ type: 'journal', desc: 'PERIL-2' }] },
    ], 'terre');
    expect(draineCascade(useGame.getState)).toEqual(['authorPeril', 'chuteDe', 'authorPeril']);
    const j = useGame.getState().journal;
    const iChute = j.findIndex((l) => l.includes('Blessure'));
    const iP2 = j.findIndex((l) => l.includes('PERIL-2'));
    expect(iChute, 'la chute a bien encaissé').toBeGreaterThanOrEqual(0);
    expect(iP2, 'le péril 2 a joué').toBeGreaterThanOrEqual(0);
    expect(iP2, 'et il joue APRÈS la conséquence du péril 1').toBeGreaterThan(iChute);
    expect(useGame.getState().party[0].wounds.current, 'la chute a coûté ses Blessures').toBeLessThan(190);
  });

  it('« TOUT RÉSOUDRE » voit l’insertion : la chute encaisse, et le péril 2 vient après', () => {
    // Ce pilote (`resolveRemainingCascade`) commite sur son tableau LOCAL puis réécrit le slot. Une
    // insertion faite dans le STORE lui passait sous le nez — il écrasait le dé, et la chute n'infligeait
    // rien. L'insertion passe donc par le tableau que `commitStep` REND, seul chemin que les trois
    // pilotes partagent.
    monte([
      { label: 'Éboulement', chancePct: 100, effects: [{ type: 'fall', target: 'party', metres: 4 }] },
      { label: 'Trouvaille', chancePct: 100, effects: [{ type: 'journal', desc: 'PERIL-2' }] },
    ], 'terre');
    useGame.getState().cascadeResolveAll();
    const p = useGame.getState().pendingCascade!;
    expect(p.participants.map((s) => s.kind)).toEqual(['authorPeril', 'chuteDe', 'authorPeril']);
    const j = useGame.getState().journal;
    expect(j.findIndex((l) => l.includes('PERIL-2')))
      .toBeGreaterThan(j.findIndex((l) => l.includes('Blessure')));
    expect(useGame.getState().party[0].wounds.current, 'la chute a encaissé').toBeLessThan(190);
  });

  it('pilote IMMÉDIAT : même ordre, sur un tableau qui n’est PAS dans le slot', () => {
    // `runCascadeImmediate` résout un tableau LOCAL (traversée maritime/fluviale, repos) : le slot est
    // vide. Une insertion écrite dans le store y ouvrait une cascade PARALLÈLE — le péril 2 jouait
    // devant le dé, et le dé restait pendant. La fenêtre reconnaît ce tableau par le `purpose` du pilote.
    seedBattleRng(3);
    const r = route([
      { label: 'Éboulement', chancePct: 100, effects: [{ type: 'fall', target: 'party', metres: 4 }] },
      { label: 'Trouvaille', chancePct: 100, effects: [{ type: 'journal', desc: 'PERIL-2' }] },
    ]);
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      party: [marinBlesse('h1')], gameTime: 1000,
      worldMap: { routes: [r] } as never, travelPlan: { routeId: 'r1' } as never,
    });
    useGame.getState().seedRng(7);
    const joues = runCascadeImmediate(useGame.getState, useGame.setState,
      buildAuthorPerilSteps(r, 'Ubersreik', 'terre') as never, { title: 'Périls', purpose: 'sequence' });
    expect(joues.map((s) => s.kind)).toEqual(['authorPeril', 'chuteDe', 'authorPeril']);
    const j = useGame.getState().journal;
    expect(j.findIndex((l) => l.includes('PERIL-2')))
      .toBeGreaterThan(j.findIndex((l) => l.includes('Blessure')));
    expect(useGame.getState().party[0].wounds.current, 'la chute a encaissé').toBeLessThan(190);
    expect(useGame.getState().pendingCascade, 'aucune cascade parallèle laissée pendante').toBeNull();
  });

  it('PROFONDEUR 2 : les TROIS pilotes rendent le MÊME état sur la MÊME donnée (deux `fall` authorés)', () => {
    // La 1ʳᵉ chute ouvre un dé INSÉRÉ derrière l'étape de péril ; la continuation de son lot ouvre la
    // 2ᵉ chute PENDANT le commit de cette étape INSÉRÉE — une poussée à profondeur 2. Le goulot devinait
    // alors l'ancre (`purpose` inconnu hors du slot) et la poussée repartait au store, que le `set`
    // final de « Tout résoudre » écrase : même donnée, deux verdicts (pv 190 contre 165).
    const deuxChutes = [{ label: 'Éboulement', chancePct: 100, effects: [
      { type: 'fall', target: 'party', metres: 4 },
      { type: 'fall', target: 'party', metres: 6 },
      { type: 'journal', desc: 'FIN-DU-LOT' },
    ] }];
    const etatFinal = (): { pv: number; fin: string | undefined } => ({
      pv: useGame.getState().party[0].wounds.current,
      fin: useGame.getState().journal[useGame.getState().journal.length - 1],
    });

    monte(deuxChutes, 'terre');
    draineCascade(useGame.getState);
    const interactif = etatFinal();

    monte(deuxChutes, 'terre');
    useGame.getState().cascadeResolveAll();
    const toutResoudre = etatFinal();

    seedBattleRng(3);
    const r = route(deuxChutes);
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      party: [marinBlesse('h1')], gameTime: 1000,
      worldMap: { routes: [r] } as never, travelPlan: { routeId: 'r1' } as never,
    });
    useGame.getState().seedRng(7);
    runCascadeImmediate(useGame.getState, useGame.setState,
      buildAuthorPerilSteps(r, 'Ubersreik', 'terre') as never, { title: 'Périls', purpose: 'sequence' });
    const immediat = etatFinal();

    expect(interactif.pv, 'les deux chutes ont encaissé').toBeLessThan(190);
    expect(toutResoudre, '« Tout résoudre » rend ce que rend la fenêtre').toEqual(interactif);
    expect(immediat, 'le pilote immédiat aussi').toEqual(interactif);
    expect(interactif.fin, 'la fin du lot est dite, après les deux dés').toContain('FIN-DU-LOT');
  });

  it('IDENTITÉ après RECUL : les poussées suivantes ne redonnent pas un id déjà porté', () => {
    // Une troncature raccourcit le tableau ; si le compteur s'en déduisait, il reculerait et la poussée
    // suivante re-servirait l'id d'un survivant — deux étapes de même id dans la même cascade, et la
    // couture de continuation lève au visage du joueur.
    monte([
      { label: 'Abordage', chancePct: 100, effects: [
        { type: 'fall', target: 'party', metres: 4 },
        { type: 'transition', scene: 'ailleurs' },
      ] },
      { label: 'Jamais joué', chancePct: 100, effects: [{ type: 'journal', desc: 'PERIL-APRES-ARRET' }] },
    ], SEA_PERIL_INTERRUPT);
    useGame.getState().cascadeResolveAll();
    const apresTroncature = useGame.getState().pendingCascade!;
    const seqApres = apresTroncature.seq!;
    expect(apresTroncature.participants.length, 'le tableau a bien RACCOURCI').toBeLessThan(seqApres);
    // Quatre poussées HORS fenêtre (le cas borné : `ouvrirChute` d'un effondrement, d'une chute de selle).
    for (const h of ['h1', 'h1', 'h1', 'h1']) ouvrirChute(useGame.setState, marinBlesse(h), 4);
    const p = useGame.getState().pendingCascade!;
    const ids = p.participants.map((s) => s.id);
    expect(new Set(ids).size, `ids tous distincts : ${ids.join(', ')}`).toBe(ids.length);
    expect(p.seq!, 'le compteur a avancé de quatre, il n’est jamais redescendu').toBe(seqApres + 4);
  });

  it('IDENTITÉ : le compteur de la séquence ne recule pas, même quand le tableau raccourcit', () => {
    // L'id d'une étape poussée venait de `participants.length` : après une troncature, la longueur
    // RECULE et un id déjà porté était re-servi — deux étapes de même id, et la suite d'un dé accrochée
    // au mauvais porteur. Le compteur (`PendingCascade.seq`) ne descend jamais.
    monte([
      { label: 'Abordage', chancePct: 100, effects: [
        { type: 'fall', target: 'party', metres: 4 },
        { type: 'transition', scene: 'ailleurs' },
      ] },
      { label: 'Jamais joué', chancePct: 100, effects: [{ type: 'journal', desc: 'PERIL-APRES-ARRET' }] },
    ], SEA_PERIL_INTERRUPT);
    const seqOuverture = useGame.getState().pendingCascade!.seq;
    expect(seqOuverture, 'la séquence naît avec son compteur, jamais implicite').toBe(2);
    const vus: string[] = [];
    for (let garde = 0; useGame.getState().pendingCascade && garde < 10; garde++) {
      const p = useGame.getState().pendingCascade!;
      for (const s of p.participants) if (!vus.includes(s.id)) vus.push(s.id);
      expect(p.seq, 'le compteur ne recule pas sous ce qu’il a déjà servi').toBeGreaterThanOrEqual(seqOuverture!);
      const st = p.participants[p.cursor];
      if (!st) break;
      if (st.de && !st.de.result) useGame.getState().cascadeDieSetForcedRoll(st.id, 5);
      useGame.getState().cascadeNext();
    }
    expect(new Set(vus).size, `ids tous distincts : ${vus.join(', ')}`).toBe(vus.length);
  });

  it('protocole MARITIME : un péril INTERRUPTEUR tronque la suite SANS emporter le dé qu’il vient d’ouvrir', () => {
    // `applyPerilEffectsNow` applique les effets sur-le-champ puis `stopSequence` : la troncature ne
    // doit pas couper l'étape que l'application a glissée derrière elle — ce serait un dé en silence.
    monte([
      { label: 'Abordage', chancePct: 100, effects: [
        { type: 'fall', target: 'party', metres: 4 },
        { type: 'transition', scene: 'ailleurs' },
      ] },
      { label: 'Jamais joué', chancePct: 100, effects: [{ type: 'journal', desc: 'PERIL-APRES-ARRET' }] },
    ], SEA_PERIL_INTERRUPT);
    const joues = draineCascade(useGame.getState);
    expect(joues, 'le dé survit à la troncature ; le péril suivant, non').toEqual(['authorPeril', 'chuteDe']);
    expect(useGame.getState().journal.some((l) => l.includes('PERIL-APRES-ARRET')), 'trajet arrêté').toBe(false);
    expect(useGame.getState().party[0].wounds.current, 'la chute a encaissé').toBeLessThan(190);
  });
});

describe('(xii) ROUTE RÉELLE : la chute d’un Test RATÉ passe par la porte, de bout en bout', () => {
  // La recette navigateur a réfuté la livraison : sur les deux routes JOUABLES, la chute s'appliquait en
  // UNE ligne, sans étape de dé, et deux runs au même dé fixé rendaient 17 m puis 9 m — la hauteur se
  // tirait en interne. Les contrats d'alors appelaient `applyLeafOps`/`ouvrirChute` À LA MAIN : ils ne
  // mesuraient pas la route du `crewHit`. Ceux-ci partent du nœud `test` AUTHORÉ.
  const BE = 3; // Endurance 31 → Bonus d'Endurance 3

  const marinPoste = (id: string, station: string, kind: Combatant['kind'] = 'hero'): Combatant =>
    marin(id, { kind, shipStation: station } as Partial<Combatant>);
  /** La coque, en COMBATTANT complet : une cogue (25 m → Taille MOYENNE) qui porte le nid-de-pie.
   *  Forme entière et non littéral mince — elle traverse le bus de triggers comme n'importe quel corps. */
  const coqueMoyenne = (): Combatant => ({
    ...marin('hull'), id: 'hull', label: 'La cogue', kind: 'npc',
    creatureId: 'cogue', upgrades: [{ id: 'nid-de-pie' }],
  } as unknown as Combatant);

  /** Le nœud `test` du coup à l'ÉQUIPAGE, tel que `ship-criticals.json` l'AUTHORE (« Mât brisé »). */
  const noeudCrewHit = () => {
    const crit = rollShipCritical('greement', makeRNG(1), 10, SHIP_CRIT_SET);
    return { test: crit.crewHit!.test as unknown as Extract<Flow, { kind: 'test' }>, label: crit.label };
  };

  /** Monte la bande d'Athlétisme du `crewHit` — le geste EXACT des deux routes du jeu :
   *  combat `combatFlow.applyHullCriticalToTarget` (`pushCombatStep`) et voyage
   *  `seaVoyageFlow.applyVesselCritical:2334` (`pushStep(…, 'travelDay')`). */
  const ouvrirLaBande = (victimes: Combatant[], purpose: 'combat' | 'travelDay'): void => {
    const { test, label } = noeudCrewHit();
    const bande = (index: number) => bandeTriggeredTest(
      useGame.getState, useGame.setState, victimes, test, `crew-hit-${index}`, { label, hull: coqueMoyenne() },
    );
    if (purpose === 'combat') pushCombatStep(useGame.setState, bande);
    else pushStep(useGame.setState, bande, 'travelDay');
  };

  /**
   * Joue le Test de la bande — le geste de la RANGÉE (`cascadeBatchRoll`, celui du kit de fenêtre) —
   * puis valide l'étape. L'Athlétisme est COMPLEXE (−20) sur une Agilité 36 : la cible est 16, et le
   * rng SEEDÉ le rate. L'échec est ASSERTÉ, jamais supposé : c'est la prémisse du contrat.
   */
  const raterLeTest = (): void => {
    const p = useGame.getState().pendingCascade!;
    const bande = p.participants[p.cursor];
    for (const r of bande.participants ?? []) useGame.getState().cascadeBatchRoll(r.id);
    const jouee = useGame.getState().pendingCascade!.participants[useGame.getState().pendingCascade!.cursor];
    for (const r of jouee.participants ?? []) {
      expect(r.result, `la rangée ${r.id} a bien lancé`).not.toBeNull();
      expect(r.result!.success, `prémisse du contrat : ${r.id} RATE son Athlétisme`).toBe(false);
    }
    useGame.getState().cascadeNext();
  };

  const etape = () => {
    const p = useGame.getState().pendingCascade!;
    return p.participants[p.cursor];
  };
  const poser = (v: number): void => {
    useGame.getState().cascadeDieSetForcedRoll(etape().id, v);
    useGame.getState().cascadeNext();
  };

  /** Monte la file de combat. `sieges` = qui le joueur TIENT (le party) : un PNJ enregistré au combat
   *  mais absent du party n'a AUCUN siège — c'est la voie inline, et sa chute doit l'atteindre quand même. */
  const monteLeCombat = (victimes: Combatant[], sieges: Combatant[] = victimes): void => {
    seedBattleRng(3);
    useGame.setState({
      battle: { combatants: [...victimes, coqueMoyenne()], log: [], round: 1, turn: 0, over: false } as never,
      pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null, party: sieges,
    } as never);
  };

  it('(a) COMBAT — le Test raté OUVRE les dés ; aucune Blessure avant qu’ils ne tombent', () => {
    const ott = marinPoste('ott', 'greement');
    monteLeCombat([ott]);
    ouvrirLaBande([ott], 'combat');
    expect(etape().kind, 'la bande d’Athlétisme s’ouvre d’abord').toBe('triggeredBatchTest');
    raterLeTest();
    // LE POINT : la conséquence du Test raté n'est pas une ligne, c'est un DÉ.
    expect(etape().kind).toBe('opsDe');
    expect(etape().de!.spec, 'gréement d’une coque MOYENNE : 2d10 m (MDG 13 l.684)').toEqual({ n: 2, sides: 10 });
    const parId = () => useGame.getState().party.find((c) => c.id === 'ott')!;
    expect(parId().wounds.current, 'RIEN encaissé tant que les dés n’ont pas parlé').toBe(200);
    poser(11); // hauteur
    expect(etape().de!.spec, 'puis les Dégâts').toEqual({ n: 1, sides: 10 });
    expect(parId().wounds.current, 'toujours rien : le second dé n’est pas tombé').toBe(200);
    poser(4);
    expect(200 - parId().wounds.current, '3×11 + 4 − BE').toBe(3 * 11 + 4 - BE);
  });

  it('(a bis) NID-DE-PIE : hauteur ENTIÈRE (25 m) — une seule étape de dé', () => {
    const nissa = marinPoste('nissa', 'nid-de-pie');
    monteLeCombat([nissa]);
    ouvrirLaBande([nissa], 'combat');
    raterLeTest();
    expect(etape().kind).toBe('opsDe');
    expect(etape().de!.spec, 'la hauteur est un entier : seuls les Dégâts se tirent').toEqual({ n: 1, sides: 10 });
    poser(6);
    const apres = useGame.getState().party.find((c) => c.id === 'nissa')!;
    expect(200 - apres.wounds.current, '3×25 + 6 − BE').toBe(3 * 25 + 6 - BE);
  });

  it('(b) VOYAGE jour-par-jour — même route, même porte (`travelDay`)', () => {
    const ott = marinPoste('ott', 'greement');
    seedBattleRng(3);
    useGame.setState({
      battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null,
      party: [ott], travelPlan: { vehicle: coqueMoyenne() } as never,
    } as never);
    ouvrirLaBande([ott], 'travelDay');
    expect(etape().kind).toBe('triggeredBatchTest');
    raterLeTest();
    expect(etape().kind, 'la mer ouvre le MÊME dé que le combat').toBe('opsDe');
    expect(useGame.getState().party[0].wounds.current, 'rien encaissé avant les dés').toBe(200);
    poser(9);
    poser(7);
    expect(200 - useGame.getState().party[0].wounds.current, '3×9 + 7 − BE').toBe(3 * 9 + 7 - BE);
  });

  it('(c) MARIN SANS SIÈGE : le socle tire d’office — et la chute l’ATTEINT', () => {
    const pnj = marinPoste('matelot', 'greement', 'npc');
    monteLeCombat([pnj], []); // enregistré au combat, tenu par PERSONNE
    useGame.getState().seedRng(21);
    ouvrirLaBande([pnj], 'combat');
    // Aucun siège ne tient ce marin : la bande ne s'ouvre pas pour lui, la voie INLINE joue son Test —
    // et la chute qui suit tire ses dés d'office, sans laisser d'étape en attente.
    draineCascade(useGame.getState);
    expect(useGame.getState().pendingCascade, 'la séquence se referme').toBeNull();
    const apres = useGame.getState().battle!.combatants.find((c) => c.id === 'matelot')!;
    expect(200 - apres.wounds.current, 'la chute d’office est ENCAISSÉE').toBeGreaterThan(0);
    expect(apres.conditions?.some((c) => c.id === 'a-terre'), 'À Terre (LDB 15 l.80)').toBe(true);
  });

  it('(G2) la ligne de chute n’HÉRITE pas du « dé fixé » du Test amont', () => {
    // Le d100 d'Athlétisme est POSÉ (99) ; les dés de la chute, eux, sont LANCÉS. La ligne de la chute
    // ne doit donc pas porter la mention — elle la portait, héritée du slot amont : mensonge d'affordance.
    const ott = marinPoste('ott', 'greement');
    monteLeCombat([ott]);
    useGame.getState().seedRng(12);
    ouvrirLaBande([ott], 'combat');
    raterLeTest();
    draineCascade(useGame.getState); // les deux dés de chute sont LANCÉS, jamais posés
    // La chute est jouée EN COMBAT : sa ligne se lit au journal de COMBAT (`combatLog.journaliser`),
    // seule surface ouverte au joueur pendant un combat — pas au journal d'exploration.
    const ligne = useGame.getState().battle!.log.map((e) => e.text).find((l) => l.includes('Blessure'));
    expect(ligne, 'la chute a bien été dite').toBeDefined();
    expect(ligne, 'aucun dé de LA CHUTE n’a été saisi : la mention serait un mensonge').not.toContain('dé fixé');
  });
});

describe('(xiii) IDENTITÉ sous RÉENTRANCE : deux compteurs vivants, aucun id en double', () => {
  // Un applier de la cascade du SLOT lance lui-même un `runCascadeImmediate` de MÊME `purpose` : deux
  // tableaux, deux compteurs, et des étapes FABRIQUÉES dont l'id dérive du compteur. Si les deux
  // niveaux servaient le même nombre, deux étapes homonymes coexisteraient — et la couture de
  // continuation lèverait au visage du joueur.
  const marque: string[] = [];
  beforeEach(() => { marque.length = 0; });

  const fab = (set: Parameters<typeof pushStep>[0], tag: string): void =>
    pushStep(set, (index: number) => ({ id: `DE-${index}`, kind: 'x-note', label: tag } as never), 'combat');

  registerCascadeApplier('x-pere', (get, set) => {
    fab(set, 'avant');
    runCascadeImmediate(get, set, [{ id: 'INT', kind: 'x-imm', label: 'i' }] as never, { title: 'in', purpose: 'combat' });
    fab(set, 'apres');
    return { consequences: [] };
  });
  registerCascadeApplier('x-imm', (_g, set) => { fab(set, 'imm'); return { consequences: [] }; });
  registerCascadeApplier('x-note', (_g, _s, step) => { marque.push(`${step.id}/${step.label}`); return { consequences: [] }; });

  const monte = (): void => {
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [], pendingTest: null } as never);
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [{ id: 'PERE', kind: 'x-pere', label: 'p' } as never] });
  };

  it('« Tout résoudre » : ids tous distincts, et la réentrance a bien joué son étape', () => {
    monte();
    resolveRemainingCascade(useGame.getState, useGame.setState);
    const ids = useGame.getState().pendingCascade!.participants.map((s) => s.id);
    expect(new Set(ids).size, `ids : ${ids.join(', ')}`).toBe(ids.length);
    // `DE-1` est servi DEUX fois — une par tableau : le compteur du tableau LOCAL de la réentrance est
    // le sien, et son étape ne rejoint jamais la séquence du slot. Aucun doublon DANS une séquence.
    expect(marque, 'le niveau IMBRIQUÉ joue, puis les deux étapes du niveau externe')
      .toEqual(['DE-1/imm', 'DE-1/avant', 'DE-2/apres']);
  });

  it('pilote INTERACTIF : même identité, même ordre', () => {
    monte();
    draineCascade(useGame.getState);
    expect(marque.map((m) => m.split('/')[1])).toEqual(['imm', 'avant', 'apres']);
    expect(new Set(marque.map((m) => m.split('/')[0])).size, 'chaque étape a son propre id').toBeGreaterThan(1);
  });
});

describe('(xiv) OP `fall` SANS TABLE : le refus est NOMMÉ, jamais un silence', () => {
  // L'atelier crée l'op avec une table « à choisir » (`id: ''`). Sauvegardée telle quelle, elle ne doit
  // pas s'appliquer à moitié : les DEUX bouts du canal — l'annonce des dés et leur consommation —
  // refusent en nommant la donnée manquante.
  const sansTable = (): GameOp[] => [{ op: 'fall', hauteur: { table: { id: '' } } } as unknown as GameOp];
  const victime = (): Combatant => marin('ott', { shipStation: 'greement' } as Partial<Combatant>);

  it('`demandesDeDes` LÈVE en nommant la table et son fichier', () => {
    expect(() => demandesDeDes(sansTable(), victime(), {})).toThrow(/table de hauteur inconnue/);
    expect(() => demandesDeDes(sansTable(), victime(), {})).toThrow(/ship-criticals\.json/);
  });

  it('`applyOps` LÈVE de la même façon — aucune Blessure posée à moitié', () => {
    const c = victime();
    expect(() => applyOps(c, sansTable(), {})).toThrow(/table de hauteur inconnue/);
    expect(c.wounds.current, 'rien n’a été appliqué avant le refus').toBe(200);
  });
});

describe('(xv) WALKER PUR : une op à DÉ y LÈVE — aucune magnitude tirée en silence', () => {
  // Un `fall` peut être AUTHORÉ hors du canal des Critiques de navire : passif de trait, effet
  // déclenché (`triggeredEffects.ts`). Ces chemins finissent au walker PUR, qui applique par
  // `applyOps` : la hauteur ET les Dégâts y tomberaient sans fenêtre. Même doctrine que le nœud
  // `test` (`combatEffects.ts`, walker pur) : le walker REFUSE en nommant, il ne devine pas.
  const victime = (): Combatant => marin('ott', { shipStation: 'greement' } as Partial<Combatant>);
  const flowFall = (): Flow => ({
    kind: 'do', effect: { type: 'ops', ops: [{ op: 'fall', hauteur: { table: { id: 'tomberDuGreement' } } } as unknown as GameOp], on: 'target' },
  } as unknown as Flow);

  it('`runPureFlowLines` LÈVE en nommant la porte', () => {
    const c = victime();
    expect(() => runPureFlowLines(c, c, flowFall(), { hull: coque() })).toThrow(/op à DÉ|porte/);
    expect(c.wounds.current, 'rien n’a été appliqué avant le refus').toBe(200);
  });

  it('un `fall` ENFOUI dans une `seq` lève aussi — le walker inspecte tout l’arbre', () => {
    const c = victime();
    const seq = { kind: 'seq', steps: [{ kind: 'seq', steps: [flowFall()] }] } as unknown as Flow;
    expect(() => runPureFlowLines(c, c, seq, { hull: coque() })).toThrow(/op à DÉ|porte/);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { type CascadeApplier } from './cascade';
import { spyApplier } from './cascade.testkit';
import { openRoll, openSequence, monoStep, rollTitle, composeRollLabel, resultLine, freeCons, type RollRequest, type Consequence } from './rollSeam';
import { testSkillLabel } from '../data';
import { modalOwnerOf } from './modalArbiter';
import { poserLeSiegeMJ, seatOwns } from './sieges';
import type { Combatant } from '../engine/types';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import { tableTotale } from '../lib/tableTotale';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * SEAM DE JET UNIQUE — Ronde 0 (#275 substrat). Couvre les 3 surfaces (M/V/I) que `openRoll` DÉRIVE
 * des PORTEURS de la requête (#1479 — il n'existe plus de classe de jet : héros, ennemi, monde, Test
 * subi passent par le même calcul). Le bloc pose des appliers DÉDIÉS (kinds uniques, namespacés) et observe : (a) si une
 * modale/cascade s'est ouverte (`pendingCascade`) — surface M/V ; (b) si l'applier a tourné d'office —
 * surface I (`runCascadeImmediate`, `cascade.ts:181`).
 */
describe('rollSeam — openRoll (#275 Ronde 0)', () => {
  /** Le rôle MJ au siège `seat` (`null` : IA), par la pose du noyau. */
  /** Pose le rôle MJ à `seat`, assis à la table (`siegesDeLaTable`) ; `null` : l'IA. */
  const poserLeMJ = (seat: number | null) => {
    const net = banc.getState().net;
    banc.setState({ net: poserLeSiegeMJ(seat === null ? net : { ...net, seatNames: { ...net.seatNames, [seat]: `Siège ${seat}` } }, seat) });
  };
  const applied: { kind: string; success: boolean; sl: number }[] = [];

  beforeEach(() => {
    applied.length = 0;
    banc.setState({ battle: null, party: [], pendingCascade: null, journal: [], travelPlan: null } as never);
    poserLeMJ(null);
    const sonde = spyApplier(applied, (step) => ({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 }),
      (step) => ({ consequences: freeCons([`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`]) }));
    avecLesTables({ appliers: {
      ...tablesDuJeu().appliers,
      ...tableTotale(['seam-hero', 'seam-enemy', 'seam-subi', 'seam-batch'], () => sonde),
      // Le VRAI applier `equipage-progression` (`seaVoyageFlow.ts`) lit `travelPlan.sea`, absent des plans SYNTHÉTIQUES
      // de ce bloc : il isole la POLICY de la porte (surface I), pas la conséquence métier réelle.
      'equipage-progression': spyApplier(applied, (step) => ({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 })),
    } });
  });

  const hero = (over: Partial<Combatant> = {}): Combatant =>
    combattantDeTest({
      id: 'H', label: 'Héros', kind: 'heros',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [{ id: 'resistance', characteristic: 'endurance', advances: 20 }],
      conditions: [], talents: [], fortune: 1, resilience: 1,
      ...over,
    });

  const enemy = (over: Partial<Combatant> = {}): Combatant =>
    combattantDeTest({
      id: 'E', label: 'Ennemi', kind: 'ennemi',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [{ id: 'perception', characteristic: 'initiative', advances: 20 }],
      conditions: [], talents: [], wounds: blessuresDeBase(10),
      ...over,
    });

  /** Un dé de MONDE (`monoStep`, porteur `monde`) ouvert par la porte des séquences. */
  const ouvreDeMonde = () => openSequence(banc.getState, banc.setState, {
    title: 'Désertion', purpose: 'test',
    steps: [monoStep({
      id: 'seam-subi', kind: cleDeFixture('seam-subi'), monde: true, label: composeRollLabel(undefined, 'Désertion', {}), difficulty: 'intermediaire',
      ligne: { valeur: 40 }, stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })!],
  });

  it('héros tenu par son joueur, cadence MANUELLE → M (modale influençable)', () => {
    banc.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Résistance', test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, difficulty: 'intermediaire' };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-hero'));
    expect(banc.getState().pendingCascade).toBeTruthy(); // surfacé, pas résolu d'office
    expect(applied).toHaveLength(0);
  });

  it('porteur ENNEMI — personne ne le tient → I (inline-PV, résolu d’office ; surfacé dès qu’un MJ siège)', () => {
    banc.setState({ party: [enemy()] });
    const req: RollRequest = { side: { actorId: 'E' }, actionLabel: 'Perception', test: { skill: { id: 'perception' }, characteristic: 'initiative' }, difficulty: 'intermediaire' };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-enemy'));
    expect(banc.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-enemy');
    // La porte ne connaît pas le camp (#1426) : c'est le PORTEUR qui décide — un siège MJ tient les
    // ennemis, la même requête se surface alors.
    applied.length = 0;
    banc.setState({ pendingCascade: null });
    poserLeMJ(0);
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-enemy'));
    expect(banc.getState().pendingCascade).toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  /**
   * #1479 — IL N'Y A PAS DE « CLASSE SPÉCIALE » (utilisateur, 2026-08-24 : « À partir du moment où je
   * dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" si je suis a l'initiative, que
   * je le subit, face a un adversaire ou face a ... une maladie »). Un Test SUBI (Scorbut) est un Test :
   * il s'ouvre pour le siège qui tient son porteur, et ne se résout d'office que quand PERSONNE ne le tient.
   */
  it('un Test SUBI par un héros que son joueur TIENT → M : il apparaît, comme tout autre jet', () => {
    banc.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Scorbut', test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, difficulty: 'intermediaire' };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-subi'));
    expect(banc.getState().pendingCascade, 'un jet que je dois faire APPARAÎT').toBeTruthy();
    expect(applied, 'et rien ne s’applique tant qu’il n’est pas joué').toHaveLength(0);
  });

  it('le MÊME Test subi, porteur conduit par l’IA (personne ne le tient) → I, résolu d’office', () => {
    banc.setState({ party: [hero({ aiControlled: true } as Partial<Combatant>)] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Scorbut', test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, difficulty: 'intermediaire' };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-subi'));
    expect(banc.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-subi');
  });

  it('dé du MONDE sous siège MJ → V (le MJ voit/lance)', () => {
    banc.setState({ party: [] });
    poserLeMJ(0);
    ouvreDeMonde();
    expect(banc.getState().pendingCascade).toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  it('porteur MONDE sans acteur, en COOP avec gmSeat ≠ hôte → l’étape est OWNÉE par le MJ (delta 1)', () => {
    banc.setState({ party: [] });
    poserLeMJ(1); // gmSeat ≠ hôte (0)
    ouvreDeMonde();
    const owner = modalOwnerOf(banc.getState());
    expect(seatOwns(banc.getState(), 1, owner ?? undefined)).toBe(true); // le MJ possède l'étape
    expect(seatOwns(banc.getState(), 0, owner ?? undefined)).toBe(false); // l'hôte ne la possède plus
  });

  it('batch, voyage COMMANDÉE + kind de ROUTINE → I (immédiat, `runCascadeImmediate`)', () => {
    const crew: Combatant = combattantDeTest({ id: 'timonier1', label: 'Timonier', kind: 'heros', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, skills: [{ id: 'navigation-fluviale', characteristic: 'intelligence', advances: 30 }], conditions: [], talents: [] });
    banc.setState({ party: [crew], travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'sea', hoursPerDay: 8, km: 0, kmDone: 0, interrupted: false, orders: { cadence: 'commande' } } as never });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', essential: true, base: 30, target: 30, result: null }] },
      actionLabel: 'Progression', test: {}, difficulty: 'intermediaire',
    };
    // `equipage-progression` est doublé par le `beforeEach` du bloc (#275 Décision 4 cran 2).
    openRoll(banc.getState, banc.setState, req, 'equipage-progression');
    // 'equipage-progression' ∈ KINDS_SOUS_ORDRES + cadence COMMANDÉE ⇒ autoV ⇒ I : résolu et appliqué d'office
    // (`cascade.rollBatchParticipants` auto-roule le contributeur, `aggregateBatchStep` agrège au commit).
    expect(banc.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
  });

  it('batch, cadence jour-par-jour, sans MJ → M (multi surfacé, étape À PARTICIPANTS non résolue — #275 Décision 4 cran 2)', () => {
    const crew: Combatant = combattantDeTest({ id: 'timonier1', label: 'Timonier', kind: 'heros', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, skills: [{ id: 'navigation-fluviale', characteristic: 'intelligence', advances: 30 }], conditions: [], talents: [] });
    banc.setState({ party: [crew] });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', essential: true, base: 30, target: 30, result: null }] },
      actionLabel: 'Progression', test: {}, difficulty: 'intermediaire',
    };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-batch'));
    expect(banc.getState().pendingCascade).toBeTruthy();
    const step = banc.getState().pendingCascade!.participants[0];
    expect(step.result).toBeFalsy(); // pas d'agrégat pré-résolu — UNE rangée par contributeur, à lancer
    expect(step.participants).toHaveLength(1);
    expect(step.participants![0].result).toBeNull(); // le contributeur n'a pas encore lancé (flux `cascadeEnBande`)
    expect(applied).toHaveLength(0); // rien appliqué tant que l'étape n'est pas validée
  });

  it('rollTitle : le NOM DE L\'ACTION seul — jamais recomposé avec acteur/compétence/difficulté (#352)', () => {
    banc.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Résistance', test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, difficulty: 'intermediaire' };
    expect(rollTitle(banc.getState, req)).toBe('Résistance');
  });

  it('mono : startCascade pose pending.title = rollTitle(...) = actionLabel — DISTINCT de step.label composé (#352, régression double-rendu)', () => {
    banc.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Recueillir des informations', test: { skill: { id: 'ragot' } }, difficulty: 'intermediaire' };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-hero'));
    const p = banc.getState().pendingCascade!;
    expect(p.title).toBe('Recueillir des informations');
    expect(p.title).toBe(rollTitle(banc.getState, req));
    const step = p.participants[0];
    // step.label (sous-titre) porte le détail COMPOSÉ — ne duplique PAS le titre (#352 : la modale
    // montrait la MÊME ligne « Berta Kaufmann — Recueillir des informations (Ragot Intermédiaire) » deux fois).
    expect(step.label).not.toBe(p.title);
    expect(step.label).toBe('Héros — Recueillir des informations (Ragot)');
    // #1072 : la Difficulté quitte le sous-titre pour la LIGNE du jet — une seule surface l'affiche.
    expect(step.difficulty).toBe('intermediaire');
    expect(step.label).not.toMatch(/Intermédiaire/);
  });

  it('compétence de rangée : DÉRIVÉE du catalogue skills (id→label) — insurchargeable par la spec (#352 extension)', () => {
    banc.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Recueillir des informations', test: { skill: { id: 'ragot' } }, difficulty: 'intermediaire' };
    openRoll(banc.getState, banc.setState, req, cleDeFixture('seam-hero'));
    const step = banc.getState().pendingCascade!.participants[0];
    // La compétence affichée en position de rangée est « Ragot » (catalogue), JAMAIS l'action
    // ("Recueillir des informations") — `testSkillLabel` est la SEULE source, dérivée du skillId.
    expect(step.rollLabel).toBe('Ragot');
    expect(step.rollLabel).toBe(testSkillLabel(req.test));
    expect(step.rollLabel).not.toBe(req.actionLabel);
  });

  it('type : `RollRequest.test` ne porte plus aucun champ texte — impossible d\'y injecter un libellé de compétence (#352 extension)', () => {
    // @ts-expect-error — `test` n'a QUE des ids (skill/characteristic/spec/sense/menace) : `label` n'existe plus sur ce type.
    const bad: RollRequest = { side: { actorId: 'H' }, actionLabel: 'x', test: { skill: 'ragot', label: 'Ragot custom' }, difficulty: 'intermediaire' };
    void bad;
  });

  it('composeRollLabel : compose actor/action/skill — UN seul composeur, jamais réassemblé au call-site', () => {
    banc.setState({ party: [hero()] });
    const h = banc.getState().party[0];
    expect(composeRollLabel(h, 'Rumeur commerciale', { skill: { id: 'ragot' } })).toBe('Héros — Rumeur commerciale (Ragot)');
  });

  it('#1072 — le sous-titre NE PORTE PAS la Difficulté : elle vit sur la LIGNE du jet (`step.difficulty`)', () => {
    banc.setState({ party: [hero()] });
    const h = banc.getState().party[0];
    // La porter ICI ET sur la ligne serait le double rendu de classe #352.
    expect(composeRollLabel(h, 'Rumeur commerciale', { skill: { id: 'ragot' } })).not.toMatch(/Intermédiaire|\(\+0\)/);
  });
});

describe('resultLine — dénouement sans roll/target/sl/won (#295 Lot 0, Décision 1b)', () => {
  it('cons vide ⇒ chaîne vide (le verdict reste porté par la rangée de jet)', () => {
    expect(resultLine([])).toBe('');
  });

  it('{ops} rend le montant RÉEL depuis le GameOp déjà appliqué', () => {
    const cons: Consequence[] = [{ ops: [{ op: 'wounds', amount: 3 }] }];
    expect(resultLine(cons)).toBe('3 Blessure(s) perdue(s).');
  });

  it('{say} résout la clé i18n out.* (sans placeholder de jet)', () => {
    const cons: Consequence[] = [{ say: 'out.consHeal', vars: { n: 2 } }];
    expect(resultLine(cons)).toBe('2 Blessure(s) récupérée(s).');
  });

  it('type : resultLine ne prend PAS roll/target/sl/won — la duplication d\'outcome est INEXPRIMABLE', () => {
    // @ts-expect-error — Consequence ne porte ni roll ni target ni sl ni won (Décision 1b).
    const bad: Consequence = { roll: 12, target: 40, sl: 2, won: true };
    void bad;
  });

  it('type : un applier migré ne peut plus renvoyer un string[] libre en `consequences`', () => {
    // @ts-expect-error — `consequences` est `Consequence[]`, pas `string[]` (le canal typé est le seul canal).
    const applier: CascadeApplier = (_get, _set, step) => {
      void step;
      return { consequences: ['réussi !'] };
    };
    void applier;
  });
});

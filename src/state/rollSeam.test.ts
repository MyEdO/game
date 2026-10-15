import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { type CascadeApplier } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { setGmSeat } from './netFlow';
import { openRoll, openSequence, monoStep, rollTitle, composeRollLabel, testSkillLabel, resultLine, freeCons, type RollRequest, type Consequence } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './netOwnership';
import type { Combatant } from '../engine/types';

/**
 * SEAM DE JET UNIQUE — Ronde 0 (#275 substrat). Couvre les 3 surfaces (M/V/I) que `openRoll` DÉRIVE
 * des PORTEURS de la requête (#1479 — il n'existe plus de classe de jet : héros, ennemi, monde, Test
 * subi passent par le même calcul). Chaque test enregistre un applier DÉDIÉ (kind unique, namespacé) et observe : (a) si une
 * modale/cascade s'est ouverte (`pendingCascade`) — surface M/V ; (b) si l'applier a tourné d'office —
 * surface I (`runCascadeImmediate`, `cascade.ts:194`).
 */
describe('rollSeam — openRoll (#275 Ronde 0)', () => {
  const applied: { kind: string; success: boolean; sl: number }[] = [];

  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, party: [], pendingCascade: null, journal: [], travelPlan: null } as never);
    setGmSeat(useGame.getState, useGame.setState, null);
    for (const kind of ['seam-hero', 'seam-enemy', 'seam-subi', 'seam-batch']) {
      spyApplier(kind, applied, (step) => ({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 }),
        (step) => ({ consequences: freeCons([`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`]) }));
    }
  });

  const hero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'H', label: 'Héros', kind: 'hero',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [{ id: 'resistance', characteristic: 'endurance', advances: 20 }],
      conditions: [], talents: [], fortune: 1, resilience: 1,
      ...over,
    }) as unknown as Combatant;

  const enemy = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'E', label: 'Ennemi', kind: 'enemy',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [{ id: 'perception', characteristic: 'initiative', advances: 20 }],
      conditions: [], talents: [], wounds: { current: 10, max: 10 },
      ...over,
    }) as unknown as Combatant;

  /** Un dé de MONDE (`monoStep`, porteur `monde`) ouvert par la porte des séquences. */
  const ouvreDeMonde = () => openSequence(useGame.getState, useGame.setState, {
    title: 'Désertion', purpose: 'test',
    steps: [monoStep({
      id: 'seam-subi', kind: 'seam-subi', monde: true, label: composeRollLabel(undefined, 'Désertion', {}), difficulty: 'intermediaire',
      ligne: { valeur: 40 }, stake: { key: { dataset: 'combat', kind: 'mutation' } },
    })!],
  });

  it('héros tenu par son joueur, cadence MANUELLE → M (modale influençable)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Résistance', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    expect(useGame.getState().pendingCascade).toBeTruthy(); // surfacé, pas résolu d'office
    expect(applied).toHaveLength(0);
  });

  it('porteur ENNEMI — personne ne le tient → I (inline-PV, résolu d’office ; surfacé dès qu’un MJ siège)', () => {
    useGame.setState({ party: [enemy()] });
    const req: RollRequest = { side: { actorId: 'E' }, actionLabel: 'Perception', test: { skill: 'perception', char: 'initiative' }, difficulty: 'intermediaire' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-enemy');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-enemy');
    // La porte ne connaît pas le camp (#1426) : c'est le PORTEUR qui décide — un siège MJ tient les
    // ennemis, la même requête se surface alors.
    applied.length = 0;
    useGame.setState({ pendingCascade: null });
    setGmSeat(useGame.getState, useGame.setState, 0);
    openRoll(useGame.getState, useGame.setState, req, 'seam-enemy');
    expect(useGame.getState().pendingCascade).toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  /**
   * #1479 — IL N'Y A PAS DE « CLASSE SPÉCIALE » (utilisateur, 2026-08-24 : « À partir du moment où je
   * dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" si je suis a l'initiative, que
   * je le subit, face a un adversaire ou face a ... une maladie »). Un Test SUBI (Scorbut) est un Test :
   * il s'ouvre pour le siège qui tient son porteur, et ne se résout d'office que quand PERSONNE ne le tient.
   */
  it('un Test SUBI par un héros que son joueur TIENT → M : il apparaît, comme tout autre jet', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Scorbut', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    expect(useGame.getState().pendingCascade, 'un jet que je dois faire APPARAÎT').toBeTruthy();
    expect(applied, 'et rien ne s’applique tant qu’il n’est pas joué').toHaveLength(0);
  });

  it('le MÊME Test subi, porteur conduit par l’IA (personne ne le tient) → I, résolu d’office', () => {
    useGame.setState({ party: [hero({ aiControlled: true } as Partial<Combatant>)] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Scorbut', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-subi');
  });

  it('dé du MONDE sous siège MJ → V (le MJ voit/lance)', () => {
    useGame.setState({ party: [] });
    setGmSeat(useGame.getState, useGame.setState, 0);
    ouvreDeMonde();
    expect(useGame.getState().pendingCascade).toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  it('porteur MONDE sans acteur, en COOP avec gmSeat ≠ hôte → l’étape est OWNÉE par le MJ (delta 1)', () => {
    useGame.setState({ party: [] });
    setGmSeat(useGame.getState, useGame.setState, 1); // gmSeat ≠ hôte (0)
    ouvreDeMonde();
    const owner = modalOwnerOf(useGame.getState());
    expect(seatOwns(useGame.getState(), 1, owner ?? undefined)).toBe(true); // le MJ possède l'étape
    expect(seatOwns(useGame.getState(), 0, owner ?? undefined)).toBe(false); // l'hôte ne la possède plus
  });

  it('batch, voyage COMMANDÉE + kind de ROUTINE → I (immédiat, `runCascadeImmediate`)', () => {
    const crew: Combatant = { id: 'timonier1', label: 'Timonier', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, skills: [{ id: 'navigation-fluviale', characteristic: 'intelligence', advances: 30 }], conditions: [], talents: [] } as unknown as Combatant;
    useGame.setState({ party: [crew], travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'sea', hoursPerDay: 8, km: 0, kmDone: 0, interrupted: false, orders: { cadence: 'commande' } } as never });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', essential: true, base: 30, target: 30, result: null }] },
      actionLabel: 'Progression', test: {}, difficulty: 'intermediaire',
    };
    // `cascadeAppliers['progression']` est désormais le VRAI applier de mer (#275 Décision 4 cran 2, `seaVoyageFlow.ts`)
    // — il lit `travelPlan.sea`, absent de ce plan SYNTHÉTIQUE ; ce test isole la POLICY de la porte (surface I),
    // pas la conséquence métier réelle → double localement le kind pour ne pas dépendre de `seaVoyageFlow`.
    spyApplier('progression', applied, (step) => ({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 }));
    openRoll(useGame.getState, useGame.setState, req, 'progression');
    // 'progression' ∈ KINDS_SOUS_ORDRES + cadence COMMANDÉE ⇒ autoV ⇒ I : résolu et appliqué d'office
    // (`cascade.rollBatchParticipants` auto-roule le contributeur, `aggregateBatchStep` agrège au commit).
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
  });

  it('batch, cadence jour-par-jour, sans MJ → M (multi surfacé, étape À PARTICIPANTS non résolue — #275 Décision 4 cran 2)', () => {
    const crew: Combatant = { id: 'timonier1', label: 'Timonier', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, skills: [{ id: 'navigation-fluviale', characteristic: 'intelligence', advances: 30 }], conditions: [], talents: [] } as unknown as Combatant;
    useGame.setState({ party: [crew] });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', essential: true, base: 30, target: 30, result: null }] },
      actionLabel: 'Progression', test: {}, difficulty: 'intermediaire',
    };
    openRoll(useGame.getState, useGame.setState, req, 'seam-batch');
    expect(useGame.getState().pendingCascade).toBeTruthy();
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.result).toBeFalsy(); // pas d'agrégat pré-résolu — UNE rangée par contributeur, à lancer
    expect(step.participants).toHaveLength(1);
    expect(step.participants![0].result).toBeNull(); // le contributeur n'a pas encore lancé (flux `cascadeBatch`)
    expect(applied).toHaveLength(0); // rien appliqué tant que l'étape n'est pas validée
  });

  it('rollTitle : le NOM DE L\'ACTION seul — jamais recomposé avec acteur/compétence/difficulté (#352)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Résistance', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire' };
    expect(rollTitle(useGame.getState, req)).toBe('Résistance');
  });

  it('mono : startCascade pose pending.title = rollTitle(...) = actionLabel — DISTINCT de step.label composé (#352, régression double-rendu)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Recueillir des informations', test: { skill: 'ragot' }, difficulty: 'intermediaire' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    const p = useGame.getState().pendingCascade!;
    expect(p.title).toBe('Recueillir des informations');
    expect(p.title).toBe(rollTitle(useGame.getState, req));
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
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Recueillir des informations', test: { skill: 'ragot' }, difficulty: 'intermediaire' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    const step = useGame.getState().pendingCascade!.participants[0];
    // La compétence affichée en position de rangée est « Ragot » (catalogue), JAMAIS l'action
    // ("Recueillir des informations") — `testSkillLabel` est la SEULE source, dérivée du skillId.
    expect(step.rollLabel).toBe('Ragot');
    expect(step.rollLabel).toBe(testSkillLabel(req.test));
    expect(step.rollLabel).not.toBe(req.actionLabel);
  });

  it('type : `RollRequest.test` ne porte plus aucun champ texte — impossible d\'y injecter un libellé de compétence (#352 extension)', () => {
    // @ts-expect-error — `test` n'a QUE des ids (skill/char/spec/sense/menace) : `label` n'existe plus sur ce type.
    const bad: RollRequest = { side: { actorId: 'H' }, actionLabel: 'x', test: { skill: 'ragot', label: 'Ragot custom' }, difficulty: 'intermediaire' };
    void bad;
  });

  it('composeRollLabel : compose actor/action/skill — UN seul composeur, jamais réassemblé au call-site', () => {
    useGame.setState({ party: [hero()] });
    const h = useGame.getState().party[0];
    expect(composeRollLabel(h, 'Rumeur commerciale', { skill: 'ragot' })).toBe('Héros — Rumeur commerciale (Ragot)');
  });

  it('#1072 — le sous-titre NE PORTE PAS la Difficulté : elle vit sur la LIGNE du jet (`step.difficulty`)', () => {
    useGame.setState({ party: [hero()] });
    const h = useGame.getState().party[0];
    // La porter ICI ET sur la ligne serait le double rendu de classe #352.
    expect(composeRollLabel(h, 'Rumeur commerciale', { skill: 'ragot' })).not.toMatch(/Intermédiaire|\(\+0\)/);
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

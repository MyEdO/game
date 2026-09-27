/**
 * Peur à l'approche (LDB 21 — Psychologie — l.27) : « Si la source de votre Peur se rapproche de vous,
 * vous devez réussir un Test de Calme Intermédiaire (+0) ou gagner un État Brisé. » Test SIMPLE : la
 * source ne jette RIEN. Depuis la VAGUE MULTI (#1117 L2), les craintifs appelés par le MÊME déplacement
 * et affrontant la MÊME entrée de règle (cette source, à cet Indice) forment UNE BANDE
 * (`triggeredBatchTest`, une rangée par testeur) quand ils sont pilotés à la main ; héros AUTO / ennemi
 * → jet inline par le même Flow. La conséquence PURE de l'échec (1 État Brisé) est une op `condition`
 * sur la branche `fail`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import { approachFearTrigger, advanceTurn, finishPlayerAction } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import './combat/triggeredTest'; // effet de bord : applier `triggeredTest` + appliers de cascade
import { seedBattleRng } from './battleRng';
import { stacks, COND } from '../engine/conditions';

import type { Combatant } from '../engine/types';
import { resetCadence, setCadence } from '../engine/cadence';

const hero = (over: Partial<Combatant>): Combatant =>
  ({ id: 'h', kind: 'hero', name: 'H', pos: { x: 5, y: 5 }, conditions: [], characteristics: { 'force-mentale': 50 }, skills: [], wounds: { current: 10, max: 10 },
     psychState: [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 0 }], ...over } as unknown as Combatant);
const mover = (over: Partial<Combatant>): Combatant =>
  ({ id: 'e', kind: 'enemy', name: 'Spectre', pos: { x: 6, y: 5 }, conditions: [], wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant);

/** Pose un combat minimal (héros craintifs + source de Peur), puis appelle le déclencheur. `fromPos` =
 *  la position de la source AVANT son déplacement (l'« approche » se mesure contre elle). */
function run(heroes: Combatant[], m: Combatant, fromPos: { x: number; y: number }) {
  useGame.setState({
    battle: { combatants: [...heroes, m], order: [...heroes.map((h) => h.id), m.id], turn: 0, round: 1, log: [], over: null } as never,
    party: [], pendingCascade: null, pendingLogQueue: [],
  });
  approachFearTrigger(useGame.getState, useGame.setState, m, fromPos);
}

/** La bande d'Approche de la cascade courante. */
const bande = () => useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredBatchTest')!;

beforeEach(() => {
  resetCadence();
  useGame.setState({ battle: null, pendingCascade: null, pendingLogQueue: [] });
});

describe('approachFearTrigger — source de Peur qui s’approche (LDB 21 l.27)', () => {
  it('héros MANUEL craint + s’est rapproché → BANDE de cascade INFLUENÇABLE (non lancée), le jet sur la rangée', () => {
    seedBattleRng(1);
    const h = hero({});
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 }); // de (9,5) à (6,5) : s’est rapproché de (5,5)
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    expect(c.participants).toHaveLength(1);
    const step = bande();
    expect(step.label).toBe('Approche menaçante');
    expect(step.aggregate).toBe('none'); // jets INDÉPENDANTS
    expect(step.target).toBeUndefined(); // aucun jet à l'étape…
    expect(step.participants!.map((p) => p.id)).toEqual([h.id]);
    expect(step.participants![0].label).toBe('Calme'); // …le Test RÉEL est nommé sur la rangée
    expect(step.participants![0].result).toBeNull(); // pas encore lancé → Chance/Résilience possibles
    expect(stacks(h, COND.brise)).toBe(0); // conséquence différée
  });

  it('héros MANUEL : Calme RATÉ (cascadeBatchRoll+Next) → 1 État Brisé', () => {
    seedBattleRng(1);
    const h = hero({ characteristics: { 'force-mentale': 1 } as never }); // Calme de cible 1 : ~imbattable à rater
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    useGame.getState().cascadeBatchRoll(h.id);
    useGame.getState().cascadeNext(); // valide l’échec → branche fail → op condition `brise`
    const got = useGame.getState().battle!.combatants.find((x) => x.id === h.id)!;
    expect(stacks(got, COND.brise)).toBe(1);
  });

  it('héros MANUEL : Calme RÉUSSI → pas de Brisé', () => {
    seedBattleRng(1);
    const h = hero({ characteristics: { 'force-mentale': 100 } as never });
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    useGame.getState().cascadeBatchRoll(h.id);
    useGame.getState().cascadeNext();
    const got = useGame.getState().battle!.combatants.find((x) => x.id === h.id)!;
    expect(stacks(got, COND.brise)).toBe(0);
  });

  it('BANDE : 2 héros craintifs (MÊME source, MÊME Indice) → UNE étape à DEUX rangées, et la source ne tire pas', () => {
    seedBattleRng(1);
    const h1 = hero({ id: 'h1', pos: { x: 5, y: 5 } });
    const h2 = hero({ id: 'h2', pos: { x: 5, y: 7 } });
    run([h1, h2], mover({ pos: { x: 6, y: 6 } }), { x: 9, y: 6 }); // s’approche des deux
    const c = useGame.getState().pendingCascade!;
    expect(c.purpose).toBe('combat');
    expect(c.participants.filter((s) => s.kind === 'triggeredBatchTest')).toHaveLength(1);
    const step = bande();
    expect(step.participants!.map((p) => p.id)).toEqual(['h1', 'h2']);
    // Test SIMPLE (LDB 21 l.27) : aucune opposition FIGÉE — la source ne jette rien, ni une fois ni N fois.
    expect(step.meta?.opposed).toBeUndefined();
    // La bande n'est PRÊTE qu'une fois ses deux rangées jouées.
    useGame.getState().cascadeBatchRoll('h1');
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
    useGame.getState().cascadeBatchRoll('h2');
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('BANDES : deux Indices de Peur DIFFÉRENTS → deux fenêtres (l’Indice fait partie de l’entrée de règle)', () => {
    seedBattleRng(1);
    const h1 = hero({ id: 'h1', pos: { x: 5, y: 5 } });
    const h2 = hero({ id: 'h2', pos: { x: 5, y: 7 }, psychState: [{ type: 'peur', sourceId: 'e', indice: 4, calmeDR: 0 }] as never });
    run([h1, h2], mover({ pos: { x: 6, y: 6 } }), { x: 9, y: 6 });
    const bandes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'triggeredBatchTest');
    expect(bandes).toHaveLength(2);
    expect(bandes.map((s) => s.participants!.map((p) => p.id))).toEqual([['h1'], ['h2']]);
  });

  it('héros AUTO craint + Calme raté → résolu INLINE (1 Brisé, aucune cascade)', () => {
    setCadence('auto');
    try {
      seedBattleRng(1);
      const h = hero({ characteristics: { FM: 1 } as never });
      run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
      expect(useGame.getState().pendingCascade).toBeNull(); // auto → pas d’étape influençable
      const got = useGame.getState().battle!.combatants.find((x) => x.id === h.id)!;
      expect(stacks(got, COND.brise)).toBe(1);
    } finally {
      resetCadence();
    }
  });

  it('ne s’est PAS rapproché (s’éloigne) → aucun Test', () => {
    seedBattleRng(1);
    const h = hero({});
    run([h], mover({ pos: { x: 9, y: 5 } }), { x: 6, y: 5 }); // de (6,5) à (9,5) : s’éloigne
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Peur déjà vaincue (calmeDR ≥ indice) → aucun Test', () => {
    seedBattleRng(1);
    const h = hero({ psychState: [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 2 } as never] });
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

/**
 * UNITÉ DE LA RÈGLE = LE DÉPLACEMENT (LDB 21 l.27, « si la source de votre *Peur* se rapproche de
 * vous ») : la phrase ne connaît ni pas, ni case, ni cadence. Le déclencheur s'évalue donc UNE fois
 * par déplacement COMPLET, sur départ→arrivée, et les cases traversées n'existent pas pour elle.
 * CALL-SITE MESURÉ (`runEnemyAI`, combatFlow.ts : `const fromPos = { ...enemy.pos! }` capturé AVANT
 * `placeCombatant`, un seul `approachFearTrigger` après le mouvement) : le producteur passe bien le
 * déplacement entier. Aucune garde de cadence n'existe plus (`lastApproachKey` supprimé).
 */
describe('approachFearTrigger — l’unité est le DÉPLACEMENT COMPLET, pas le pas', () => {
  it('déplacement DÉCOMPOSÉ en 3 segments approchants → UN SEUL Test (une bande, une rangée)', () => {
    seedBattleRng(1);
    const h = hero({});
    // La source va de (9,5) à (6,5) en passant par (8,5) puis (7,5) : trois pas, UN déplacement.
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.filter((s) => s.kind === 'triggeredBatchTest')).toHaveLength(1);
    expect(bande().participants).toHaveLength(1);
  });

  it('approche PUIS recul net dans le MÊME déplacement → AUCUN Test (lecture plate : la position finale décide)', () => {
    seedBattleRng(1);
    const h = hero({}); // en (5,5)
    // Départ (6,5) — adjacent — la source contourne le héros et finit en (9,5) : elle a fini PLUS LOIN.
    run([h], mover({ pos: { x: 9, y: 5 } }), { x: 6, y: 5 });
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('DEUX déplacements distincts → DEUX Tests, même dans le même Tour (« se rapproche » = un événement par déplacement)', () => {
    seedBattleRng(1);
    const h = hero({});
    run([h], mover({ pos: { x: 8, y: 5 } }), { x: 12, y: 5 }); // 1ᵉʳ déplacement : de 12 à 8
    expect(useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'triggeredBatchTest')).toHaveLength(1);
    // 2ᵉ déplacement (Round et Tour INCHANGÉS) : la source se rapproche encore → un second Test dû.
    const b = useGame.getState().battle!;
    const m = b.combatants.find((x) => x.id === 'e')!;
    m.pos = { x: 6, y: 5 };
    approachFearTrigger(useGame.getState, useGame.setState, m, { x: 8, y: 5 });
    expect(useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'triggeredBatchTest')).toHaveLength(2);
  });
});

/**
 * SYMÉTRIE DES CAMPS (#1117 L2bis) : le déclencheur ne connaît que « la source de votre Peur se
 * rapproche de vous » (LDB 21 l.27) — un HÉROS source de Peur d'un ennemi doit donc l'appeler aussi.
 * Le déplacement d'un combattant PILOTÉ étant révocable (`cancelMove`, charge annulée avant le jet),
 * l'événement est mis EN ATTENTE (`noteApproachMove`) et ne s'évalue qu'à son IRRÉVOCABILITÉ, à la
 * PREMIÈRE des deux portes : une Action prise (`markActed`) ou la fin du tour (`advanceTurn`).
 * Un déplacement annulé n'effraie donc JAMAIS, et l'attaque qui suit le déplacement n'est pas un
 * second événement. La SURFACE du Test (rangée interactive vs inline) reste dérivée de la POSSESSION
 * par le déclencheur lui-même (`humanControlled`), jamais du camp.
 */
describe('Approche du HÉROS vers un ennemi qui le craint (LDB 21 l.27)', () => {
  const NET_SOLO = { mode: 'local' as const, mySeat: 0, gmSeat: undefined, ownership: {} };

  /** Champ de bataille RÉEL (scène + combat + tour du héros) : un ennemi craint le héros, à l'est. */
  function field() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 2 });
    useGame.setState({ party: [h] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    let i = 0;
    for (const e of foes) e.pos = { x: 20 + i++, y: 20 }; // libère le couloir y=10
    const E = foes[0];
    E.pos = { x: 12, y: 10 };
    E.psychState = [{ type: 'peur', sourceId: H.id, indice: 2, calmeDR: 0 }];
    E.characteristics['force-mentale'] = 1; // Calme ~imbattable à rater
    H.pos = { x: 6, y: 10 };
    const turn = b.order.indexOf(H.id);
    expect(turn, 'prémisse : le héros ouvre le round (graine 2)').toBe(0);
    useGame.setState({
      battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false },
      net: { ...useGame.getState().net, ...NET_SOLO },
    });
    seedBattleRng(1);
    return { H, E };
  }
  const brise = (id: string) => stacks(useGame.getState().battle!.combatants.find((c) => c.id === id)!, COND.brise);
  const bandes = () => (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'triggeredBatchTest');

  it('se rapprocher PUIS agir → l’ennemi apeuré teste UNE fois, au scellement de l’Action', () => {
    const { H, E } = field();
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    expect(H.approachMoves).toHaveLength(1); // en attente : rien n'est encore dû
    expect(brise(E.id)).toBe(0);
    useGame.getState().battleDefendTotal(); // une Action : le déplacement devient irrévocable
    expect(H.approachMoves).toBeUndefined();
    expect(brise(E.id)).toBe(1);
  });

  it('se rapprocher puis ANNULER le déplacement (cancelMove) → aucun Test, même en fin de tour', () => {
    const { H, E } = field();
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    useGame.getState().cancelMove();
    expect(H.pos).toEqual({ x: 6, y: 10 });
    expect(H.approachMoves).toBeUndefined();
    advanceTurn(useGame.getState, useGame.setState);
    expect(brise(E.id)).toBe(0);
  });

  it('se rapprocher SANS agir → le Test est dû à la FIN DU TOUR', () => {
    const { E } = field();
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    expect(brise(E.id)).toBe(0);
    advanceTurn(useGame.getState, useGame.setState);
    expect(brise(E.id)).toBe(1);
  });

  it('CHARGE annulée avant le jet → le déplacement est défait : aucun Test', () => {
    const { H, E } = field();
    vi.useFakeTimers();
    try {
      // Charge ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : hors Marche, l'approche se demande.
      useGame.getState().battleClickEntity(E.id, { confirm: true, approche: true });
      vi.runOnlyPendingTimers(); // joue le glissé d'approche → ouvre la frappe
    } finally {
      vi.useRealTimers();
    }
    expect(useGame.getState().pendingAttack?.fromCharge).toBe(true);
    expect(H.approachMoves).toHaveLength(1);
    useGame.getState().attackCancel();
    expect(H.approachMoves).toBeUndefined();
    advanceTurn(useGame.getState, useGame.setState);
    expect(brise(E.id)).toBe(0);
  });

  it('DEUX déplacements puis une Action → DEUX événements, donc DEUX Tests', () => {
    const { H, E } = field();
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: 0 } }); // rangées tenues → les Tests se COMPTENT sans dépendre du dé
    useGame.getState().battleClickTile({ x: 7, y: 10 }, { confirm: true });
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    expect(H.approachMoves).toHaveLength(2);
    useGame.getState().battleDefendTotal();
    expect(H.approachMoves).toBeUndefined();
    expect(bandes()).toHaveLength(2); // un événement = un Test, même source et même Indice
    expect(bandes().map((s) => s.participants!.map((p) => p.id))).toEqual([[E.id], [E.id]]);
  });

  it('RECUL net → événement en attente, mais aucun Test au scellement', () => {
    const { E } = field();
    useGame.getState().battleClickTile({ x: 4, y: 10 }, { confirm: true });
    useGame.getState().battleDefendTotal();
    expect(brise(E.id)).toBe(0);
  });

  it('ennemi qui ne craint PAS le héros → aucun Test', () => {
    const { E } = field();
    E.psychState = [];
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    useGame.getState().battleDefendTotal();
    expect(brise(E.id)).toBe(0);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('siège MJ posé (ennemis pilotés à la main) → RANGÉE INTERACTIVE, pas de jet inline', () => {
    const { E } = field();
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: 0 } }); // « contrôle des ennemis » en solo
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    useGame.getState().battleDefendTotal();
    expect(bandes()).toHaveLength(1);
    expect(bandes()[0].participants!.map((p) => p.id)).toEqual([E.id]);
    expect(bandes()[0].participants![0].result).toBeNull(); // non lancé → influençable
    expect(bandes()[0].participants![0].interactive).toBe(true); // rangée TENUE par le siège MJ, pas un témoin
    expect(brise(E.id)).toBe(0); // conséquence différée à la rangée
  });

  /** « Zéro jet silencieux » : le Test scellé par une Action DOIT laisser sa trace au journal, y compris
   *  sur un site qui COMPOSE son journal (`finishPlayerAction` : `[...battle.log, …]`) — le déclencheur y
   *  pousse ses lignes par mutation, donc le scellement doit précéder la copie. */
  it('scellement par une Action à journal COMPOSÉ → le Test et son issue sont JOURNALISÉS', () => {
    const { E } = field();
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    finishPlayerAction(useGame.getState, useGame.setState, ['LIGNE-ACTION']);
    expect(brise(E.id)).toBe(1);
    const txt = useGame.getState().battle!.log.map((l) => (typeof l === 'string' ? l : l.text)).join('\n');
    expect(txt).toMatch(/LIGNE-ACTION/);
    expect(txt).toMatch(/Calme/);
    expect(txt).toMatch(/Brisé/);
  });

  it('« cumuler l’Avantage » (LDB 09 l.305-308) scelle comme toute Action', () => {
    const { H, E } = field();
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    useGame.getState().battleGainAdvantage('intuition');
    const pt = useGame.getState().pendingTest!;
    useGame.setState({ pendingTest: { ...pt, roll: 99, success: false, sl: -3 } });
    useGame.getState().resolveTest();
    expect(H.approachMoves).toBeUndefined();
    expect(brise(E.id)).toBe(1);
  });

  it('déjà scellé par une Action → la fin du tour ne RE-tire pas le même déplacement', () => {
    const { E } = field();
    useGame.getState().battleClickTile({ x: 8, y: 10 }, { confirm: true });
    useGame.getState().battleDefendTotal();
    expect(brise(E.id)).toBe(1);
    advanceTurn(useGame.getState, useGame.setState);
    expect(brise(E.id)).toBe(1);
  });
});

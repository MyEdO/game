// @vitest-environment jsdom
/**
 * #990 — CALENDRIER de découverte d'un Test opposé à jet FIGÉ, monté pour de VRAI sur les TROIS
 * sites (patron `createRoot`/`act` du repo) : défense réactive, incantation opposée, étape de
 * cascade `meta.opposed`. Contrat POSITIF : masqué (« ? ») avant la réponse de CE siège, valeurs
 * EXACTES dès qu'elle est posée — la phase d'influence voit les deux jets.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { maybeOpenDefense } from '../state/combatFlow';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { fmtD100 } from './Dice';
import { CascadeBody } from './CascadeModal';
import { maskOpposedRow } from './opposedFrozen';
import { RollShell } from './RollShell';
import { buildRollRow, witnessRow } from './rollRowBuild';
import { CastModal } from './CastModal';
import { GrappleModal } from './GrappleModal';
import { DistraireModal } from './DistraireModal';
import { AuContactModal } from './AuContactModal';
import { DisengageModal } from './DisengageModal';
import type { BattleState } from '../state/store';
import type { Combatant, Weapon } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', weapons: Weapon[] = []): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons, advantage: 0, size: 'moyenne', pos: { x: kind === 'hero' ? 0 : 1, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };

function putBattle(combatants: Combatant[], order: string[]) {
  useGame.setState({
    battle: { combatants, order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState,
    mode: 'battle', scene: testScene(), net: SOLO as never,
    pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingCast: null,
    pendingCastOpposition: null, pendingCounterspell: null,
  });
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  seedBattleRng(7);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, pendingDefense: null, pendingCast: null, pendingCastOpposition: null, pendingCounterspell: null,
    pendingGrapple: null, pendingDistraire: null, pendingAuContact: null, pendingDisengage: null, battle: null, party: [] });
});

/** Cellules de la 1ʳᵉ rangée (celle du jet FIGÉ de l'adversaire) telles que les lit un joueur. */
const dice = () => [...host.querySelectorAll('.rm-roll-dice')].map((n) => n.textContent?.trim());
const verdicts = () => [...host.querySelectorAll('.rm-roll-sl')].map((n) => n.textContent?.trim());

describe('#990 site 1 — défense réactive : l’attaque figée est masquée jusqu’à MON jet de défense', () => {
  it('IA attaquante, solo : « ? » avant `defenseRoll`, dé et DR exacts après', () => {
    const enemy = mk('e', 'enemy', [sword]);
    const hero = mk('h', 'hero', [sword]);
    putBattle([enemy, hero], ['e', 'h']);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    const atk = useGame.getState().pendingDefense!.atk;

    act(() => { root.render(<CascadeBody />); });
    expect(dice()[0], 'le jet de l’attaquant IA ne se lit pas avant ma réponse').toBe('?');
    expect(verdicts()[0]).toBe('?');
    expect(host.textContent).not.toContain(`${fmtD100(atk.roll)}`);

    act(() => { useGame.getState().defenseRoll(); });
    act(() => { root.render(<CascadeBody />); });
    expect(dice()[0], 'jet posé → les DEUX jets sont lisibles pour la phase d’influence').toBe(fmtD100(atk.roll));
    expect(verdicts()[0]).toContain('DR');
  });
});

describe('#990 site 2 — incantation opposée : la rangée du lanceur ET son verdict', () => {
  const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' };

  it('lanceur IA + Contre-sort : rangée « ? » et AUCUN « Sort lancé ! » avant le jet du contre-lanceur', () => {
    const A = mk('A', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, E], ['E', 'A']);
    useGame.setState({
      party: [A],
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST } as never,
      pendingCounterspell: { participants: [{ id: 'A', interactive: true, result: null, declared: 'solo' }] } as never,
    });

    act(() => { root.render(<CastModal />); });
    expect(dice()[0]).toBe('?');
    expect(host.textContent, 'le verdict trahirait le jet masqué').not.toContain('Sort lancé !');

    act(() => { useGame.getState().counterspellRoll('A'); });
    act(() => { root.render(<CastModal />); });
    expect(dice()[0]).toBe(fmtD100(ENEMY_CAST.roll));
    expect(host.textContent).toContain('Sort lancé !');
  });

  it('échec du lanceur : « DR n < NI n » ne fuit pas non plus avant la réponse', () => {
    const A = mk('A', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, E], ['E', 'A']);
    useGame.setState({
      party: [A],
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false,
        result: { cast: false, roll: 45, target: 50, sl: 0, isCritical: false, isFumble: false, log: '' } } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie',
        participants: [{ id: 'A', interactive: true, result: null }] } as never,
    });

    act(() => { root.render(<CastModal />); });
    expect(host.textContent).not.toContain('< NI');

    act(() => { useGame.getState().oppositionRoll('A'); });
    act(() => { root.render(<CastModal />); });
    expect(host.textContent).toContain('< NI');
  });

  it('MULTI (2 cibles) : B voit encore « ? » après le jet de A — chacun découvre après le SIEN', () => {
    const A = mk('A', 'hero');
    const B = mk('B', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, B, E], ['E', 'A', 'B']);
    useGame.setState({
      party: [A, B],
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie',
        participants: [{ id: 'A', interactive: true, result: null }, { id: 'B', interactive: true, result: null }] } as never,
    });

    act(() => { root.render(<CastModal />); });
    expect(dice()[0]).toBe('?');

    act(() => { useGame.getState().oppositionRoll('A'); });
    act(() => { root.render(<CastModal />); });
    expect(dice()[0], 'B n’a pas encore lancé : il jouerait à jet découvert').toBe('?');

    act(() => { useGame.getState().oppositionRoll('B'); });
    act(() => { root.render(<CastModal />); });
    expect(dice()[0]).toBe(fmtD100(ENEMY_CAST.roll));
  });

  /** Le contrat qui attrape la FUITE PAR AFFORDANCE : une seule mesure ne dit rien (« Résilience » peut
   *  manquer pour dix raisons) — c'est la COMPARAISON réussite ⇄ échec qui prouve que le bouton ne
   *  parle plus du verdict. Le témoin positif est un lanceur LOCAL (jamais masqué) : sa Résilience reste. */
  const castWith = (cast: boolean) => {
    const A = mk('A', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, E], ['E', 'A']);
    useGame.setState({
      party: [A],
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false,
        result: { cast, roll: cast ? 20 : 45, target: 50, sl: cast ? 3 : 0, isCritical: false, isFumble: false, log: '' } } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie',
        participants: [{ id: 'A', interactive: true, result: null }] } as never,
    });
    act(() => { root.render(<CastModal />); });
    // Portée = la RANGÉE DU LANCEUR (`.prow` [0]) : la rangée du RÉPONDANT porte légitimement SON
    // offre de Résilience pré-jet — mesurer la fenêtre entière confondrait les deux.
    return host.querySelectorAll('.prow')[0]?.textContent ?? '';
  };

  it('rangée masquée : AUCUNE affordance dérivée du résultat — « Résilience » absente que le sort ait RÉUSSI ou RATÉ', () => {
    const reussi = castWith(true);
    expect(reussi, 'sort réussi, jet masqué').not.toContain('Résilience');
    act(() => { root.unmount(); });
    root = createRoot(host);
    const rate = castWith(false);
    expect(rate, 'sort raté : le bouton de Résilience DIRAIT que le jet masqué a échoué').not.toContain('Résilience');
  });

  it('lanceur LOCAL (jet produit ICI) : rien n’est masqué, ni le dé ni ses affordances', () => {
    const H = mk('H', 'hero');
    const T = mk('T', 'enemy');
    putBattle([H, T], ['H', 'T']);
    useGame.setState({
      party: [H],
      pendingCast: { casterId: 'H', targetId: 'T', spellId: 'drain', missile: false, focused: false,
        result: { cast: false, roll: 45, target: 50, sl: 0, isCritical: false, isFumble: false, log: '' } } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie',
        participants: [{ id: 'T', interactive: false, result: null }] } as never,
    });
    act(() => { root.render(<CastModal />); });
    expect(dice()[0]).toBe(fmtD100(45));
    // Le lanceur voit son propre jet : son cycle d'influence reste SERVI (aucun masque).
    // Les verbes attendus sont ceux que la RÈGLE ouvre ici : 45 ≤ 50, le Test est RÉUSSI et seul le NI
    // manque (`LDB 46 l.23-25` : « Succès mais DR < NI → tentative échoue »). Chance (LDB 17 l.23,
    // « conclu par un échec ») et Résilience (LDB 17 l.68) n'ont donc rien à rattraper ; le Sombre
    // Pacte (LDB 19 l.17, sans « raté ») et le « +1 DR » (LDB 17 l.24, après le jet) restent offerts.
    const prow = host.querySelectorAll('.prow')[0]?.textContent ?? '';
    expect(prow, 'le Sombre Pacte du lanceur n’est pas masqué').toContain('Pacte');
    expect(prow, 'le « +1 DR » de Chance n’est pas masqué').toContain('+1 DR');
    expect(prow, 'Test RÉUSSI : la Résilience n’a rien à forcer').not.toContain('Résilience');
  });

  /** Fermeture de FORME : la fuite F1 (« Résilience » sur rangée masquée) n'était pas un oubli isolé
   *  mais une CLASSE — tout champ de rangée dérivé du résultat rouvre le même trou. Assertion
   *  EXHAUSTIVE sur l'objet rendu : les 7 champs dérivés de RANGÉE + la SOUS-LIGNE (`row.note`, canal
   *  unique depuis #1078) neutralisés sous masque, intacts au découvert (aucun rendu nécessaire —
   *  c'est le contrat de la fonction, pas d'un écran). */
  it('rangée masquée : les champs DÉRIVÉS du résultat (rangée + sous-ligne) sont neutralisés, le reste traverse INTACT', () => {
    const A = mk('A', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, E], ['E', 'A']);
    const s = useGame.getState();
    const onRoll = () => {};
    const base = buildRollRow(
      {
        // La sous-ligne (issue en clair) vit DANS la ligne : c'est le canal unique `PanelRowData.note`.
        row: { combatant: E, pending: { label: 'Incantation', base: 45 }, note: 'DR net +2' },
        onRoll, actor: E,
        // FAIT d'issue renseigné : un champ non neutralisé se voit.
        lost: true,
      },
      {
        interactive: true, fortune: 3, resilience: 2,
        reverse: { onReverse: () => {}, preview: { roll: 32, sl: 2, success: true } },
        resist: { menace: 'magie', onResist: () => {} },
        extendedDr: { cum: 3, target: 5 },
        winner: 'win',
      },
    );
    const DERIVES = ['reverse', 'resist', 'extendedDr', 'winner'] as const;

    const masked = maskOpposedRow(s, { ownerId: 'E', responded: false }, base);
    expect(masked.row.pending?.mask).toBe('roll');
    expect(
      DERIVES.filter((k) => masked[k] !== undefined),
      'champ dérivé du résultat encore ARMÉ sur une rangée masquée — il annonce le verdict que le dé cache',
    ).toEqual([]);
    expect(masked.reverse, 'son `preview` porte {roll, sl, success} : le dé fuirait par là').toBeUndefined();
    expect(masked.row.note, 'la sous-ligne dit l’issue en clair sous un dé masqué').toBeUndefined();
    // Ce qui ne dérive PAS du résultat traverse : sans quoi la rangée perdrait son bouton « Lancer ».
    expect(masked.rolled).toBe(false);
    expect(masked.interactive).toBe(true);
    expect(masked.onRoll).toBe(onRoll);
    expect([masked.actor, masked.fortune, masked.resilience]).toEqual([E, 3, 2]);

    // Découvert (jet produit par ce siège) : la rangée traverse SANS copie ni retouche — donc les
    // dérivés y sont TOUS conservés, à l'identique, sous-ligne comprise.
    const revealed = maskOpposedRow(s, { ownerId: 'A', responded: false }, base);
    expect(revealed).toBe(base);
    expect(DERIVES.map((k) => revealed[k])).toEqual(DERIVES.map((k) => base[k]));
    expect(revealed.row.note).toBe('DR net +2');
  });

  /** VERROU DE SOCLE (#990/D5) : `RollShell` DÉRIVE le halo vainqueur d'un `winnerIndex` posé par le
   *  SITE, et son `winner={rest.winner ?? calculé}` avalerait le `winner: undefined` d'une rangée
   *  masquée. MESURÉ sur les 4 modales routées (`pd.result` naît `null` à l'ouverture, `combatFlow`
   *  l.1042/1098/1111 + `combatManeuvers` l.637) : `winnerIndex` est null avant la réponse, donc le
   *  cas n'est pas atteignable AUJOURD'HUI — le verrou empêche qu'il le devienne au prochain site. */
  it('panneau MASQUÉ : ni halo vainqueur/perdant ni badge « DR net », même si le site pose `winnerIndex`', () => {
    const A = mk('A', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, E], ['E', 'A']);
    const masked = { label: 'Force', base: 40, modifier: 0, target: 40, roll: 27, success: true, sl: 1, mask: 'roll' as const };
    const mine = { label: 'Force', base: 45, modifier: 0, target: 45, roll: 30, success: true, sl: 1 };

    act(() => {
      root.render(
        <RollShell
          title="Empoignade"
          rolled
          rows={[witnessRow({ row: { combatant: E, d: masked } }),
                 buildRollRow({ row: { combatant: A, d: mine } })]}
          winnerIndex={0}
          netSL={2}
          actions={[]}
        />,
      );
    });
    expect(host.querySelector('.rr-win'), 'le halo gagnant EST le verdict du jet masqué').toBeNull();
    expect(host.querySelector('.rr-lose')).toBeNull();
    expect(host.textContent, 'le DR net COMPARE les deux jets').not.toContain('DR net');
  });

  it('« Lancer » du lanceur SURVIT au calendrier (le masque ne repose sur aucun ordre d’écriture)', () => {
    const H = mk('H', 'hero');
    const T = mk('T', 'enemy');
    putBattle([H, T], ['H', 'T']);
    useGame.setState({
      party: [H],
      pendingCast: { casterId: 'H', targetId: 'T', spellId: 'drain', missile: false, focused: false, result: null } as never,
    });
    act(() => { root.render(<CastModal />); });
    expect(host.textContent, 'une rangée pré-jet forcée à `rolled:true` perdrait son bouton').toContain('Lancer');
  });

  it('issue par rangée : ni « Dissipé ! » ni « Appliquer (dissipé) » tant que TOUTES les réponses ne sont pas posées', () => {
    const A = mk('A', 'hero');
    const B = mk('B', 'hero');
    const E = mk('E', 'enemy');
    putBattle([A, B, E], ['E', 'A', 'B']);
    useGame.setState({
      party: [A, B],
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST } as never,
      pendingCounterspell: { participants: [{ id: 'A', interactive: true, result: null, declared: 'solo' }, { id: 'B', interactive: true, result: null, declared: 'solo' }] } as never,
    });
    act(() => {
      const g = useGame.getState();
      g.counterspellRoll('A');
      g.counterspellForceSuccess('A');           // « Je ne faillirai pas ! » : A l'emporte…
      g.counterspellSetForcedRoll('A', 11);      // …et choisit son dé (LDB 17 l.68) → Dissipation acquise
    });
    // PRÉCONDITION mesurée : sans elle, l'absence de « Dissipé ! » ne prouverait rien (une issue qui
    // n'existe pas est absente de toute façon).
    const partA = useGame.getState().pendingCounterspell!.participants[0];
    expect(partA.result?.dispelled, 'la fixture DOIT produire une Dissipation à cacher').toBe(true);

    act(() => { root.render(<CastModal />); });
    // A a joué, B non : tout ce qui COMPARE au jet masqué reste tu (issue de rangée ET libellé d'action).
    expect(host.textContent).not.toContain('Dissipé !');
    expect(host.textContent).not.toContain('Appliquer (dissipé)');
    expect(host.textContent).not.toContain('Sort lancé !');
    expect(dice()[0]).toBe('?');
  });
});

describe('#990 site 3 — étape de cascade `meta.opposed` (Assommante, table de taverne)', () => {
  const step = (over: Record<string, unknown>) => ({
    id: 'opp-1', kind: 'triggeredTest', actorId: 'h', rollLabel: 'Résistance', base: 40, target: 40,
    label: 'Assommante', ...over,
  });
  const openCascade = (s: ReturnType<typeof step>) => useGame.setState({
    pendingCascade: { title: 'Assommante', icon: 'nav/dice', purpose: 'combat', cursor: 0, log: [], participants: [s] } as never,
  });

  it('Assommante (adversaire RÉEL) : « ? » avant mon jet, valeurs exactes après', () => {
    const hero = mk('h', 'hero');
    const brute = mk('e', 'enemy', [sword]);
    putBattle([brute, hero], ['e', 'h']);
    openCascade(step({ meta: { opposed: { aT: { roll: 33, target: 45, sl: 1, success: true }, attackerId: 'e', attackerName: 'Brute', attackerLabel: 'Force' } } }));

    act(() => { root.render(<CascadeBody />); });
    expect(dice()[0]).toBe('?');
    expect(verdicts()[0]).toBe('?');

    act(() => { useGame.getState().cascadeRoll('opp-1'); });
    act(() => { root.render(<CascadeBody />); });
    expect(dice()[0]).toBe(fmtD100(33));
    expect(verdicts()[0]).toContain('DR');
  });

  it('adversaire ABSTRAIT (table de taverne, aucun `attackerId`) : masqué aussi, révélé après mon jet', () => {
    const hero = mk('h', 'hero');
    useGame.setState({ battle: null, party: [hero], net: SOLO as never, pendingDefense: null, pendingCast: null });
    openCascade(step({ meta: { opposed: { aT: { roll: 71, target: 50, sl: -2, success: false }, attackerName: 'La maison', attackerLabel: 'Jeu' } } }));

    act(() => { root.render(<CascadeBody />); });
    expect(dice()[0], 'sans Combatant, personne ne l’a roulé ICI → masqué').toBe('?');

    act(() => { useGame.getState().cascadeRoll('opp-1'); });
    act(() => { root.render(<CascadeBody />); });
    expect(dice()[0]).toBe(fmtD100(71));
  });
});

/**
 * #990 site 4 — la CLASSE des Tests opposés binaires à foe figé (`opposedBinaryFlow`, rollFlowSpecs.ts
 * l.295-309) : le jet du foe est tiré À L'OUVERTURE (`combatFlow.startGrapple`/`startAuContact`/
 * `startDistraire`, `disengage`) et la modale s'ouvre AVANT la réponse — même calendrier que les 3
 * premiers sites.
 */
describe('#990 site 4 — Empoignade / Au Contact / Distraire / Désengagement', () => {
  const duo = () => {
    const hero = mk('h', 'hero', [sword]);
    const foe = mk('e', 'enemy', [sword]);
    putBattle([hero, foe], ['h', 'e']);
    return { hero, foe };
  };
  const FOE_TR = { roll: 27, target: 35, sl: 1, success: true, isDouble: false };

  it('Empoignade : la Force figée du foe est « ? » avant `grappleRoll`, exacte après', () => {
    duo();
    useGame.setState({ pendingGrapple: { actorId: 'h', foeId: 'e', phase: 'roll', canBreak: false, atk: FOE_TR, def: null, result: null } as never });
    act(() => { root.render(<GrappleModal />); });
    expect(dice()[0]).toBe('?');
    expect(verdicts()[0]).toBe('?');

    act(() => { useGame.getState().grappleRoll(); });
    act(() => { root.render(<GrappleModal />); });
    expect(dice()[0]).toBe(fmtD100(FOE_TR.roll));
    expect(verdicts()[0]).toContain('DR');
  });

  it('Distraire : le Calme figé de la cible est « ? » avant `distraireRoll`, exact après', () => {
    duo();
    useGame.setState({ pendingDistraire: { moverId: 'h', foeId: 'e', defRoll: { ...FOE_TR, roll: 62, sl: -2, success: false }, atk: null, result: null } as never });
    act(() => { root.render(<DistraireModal />); });
    expect(dice()[0]).toBe('?');

    act(() => { useGame.getState().distraireRoll(); });
    act(() => { root.render(<DistraireModal />); });
    expect(dice()[0]).toBe(fmtD100(62));
  });

  it('Au Contact : le Corps à corps figé du foe est « ? » avant `auContactRoll`, exact après', () => {
    duo();
    useGame.setState({ pendingAuContact: { moverId: 'h', foeId: 'e', phase: 'roll', atk: FOE_TR, def: null, result: null } as never });
    act(() => { root.render(<AuContactModal />); });
    expect(dice()[0]).toBe('?');

    act(() => { useGame.getState().auContactRoll(); });
    act(() => { root.render(<AuContactModal />); });
    expect(dice()[0]).toBe(fmtD100(FOE_TR.roll));
  });

  it('Désengagement : AUCUNE rangée de jet avant la réponse (phase de menu), les deux jets ensuite', () => {
    duo();
    useGame.setState({ pendingDisengage: { moverId: 'h', foeId: 'e', canSacrifice: false, canEsquive: true, phase: 'choice', atk: FOE_TR, def: null, result: null } as never });
    act(() => { root.render(<DisengageModal />); });
    expect(dice(), 'le jet figé du foe n’est pas à l’écran tant que le mover n’a pas choisi/répondu').toEqual([]);

    act(() => { useGame.getState().disengageRoll(); });
    act(() => { root.render(<DisengageModal />); });
    expect(dice()[0]).toBe(fmtD100(FOE_TR.roll));
    expect(verdicts()[0]).toContain('DR');
  });
});

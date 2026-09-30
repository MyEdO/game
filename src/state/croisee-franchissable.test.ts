import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene, type Terrain } from './scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { draineCascade } from './cascadeTestKit';
import { phaseDeChute } from './fallMove';
import { aretesUtilisables } from './aretes';
import { GUEST_INTENTS } from '../net/intents';
import { buildEncounter } from './encounterAuthoring';
import { flowFromEffects } from './flow';
import { finalizeBattle } from './combatFlow';
import { t } from '../i18n';

/**
 * Croisée FRANCHISSABLE (#700) : sauter par une fenêtre d'étage EST la chute volontaire (LDB 15 l.82,
 * EDO 01 l.229) ; l'enjamber de plain-pied est un geste sans Test (LDB 15 l.55, maison
 * `fenetre-hauteur-allege`). L'atterrissage d'exploration est un PAS du groupe (`moveParty`).
 */

/** Déclencheur `once` sur la case (x,y) au rez : son drapeau prouve que `checkTriggers` a joué. */
const piege = (x: number, y: number): Scene['triggers'][number] =>
  ({ id: 'rue', rect: { x, y, w: 1, h: 1 }, once: true, flow: { kind: 'seq', steps: [] } });

/** 4×3 : la chambre (1,1) à la couche 1 (4 m), murée sur trois côtés ; croisée E de (1,1) couche 1
 *  sur la rue (2,1) au rez. */
function etage(crossable = true): Scene {
  const s = emptyScene(4, 3);
  const tiles = new Array(12).fill('vide') as Terrain[];
  tiles[1 * 4 + 1] = s.layers[0].tiles[0];
  const height = new Array(12).fill(0) as number[];
  height[1 * 4 + 1] = 4;
  s.layers.push({ z: 1, tiles, height });
  s.walls = [
    { x: 1, y: 1, side: 'E', z: 1, window: true, ...(crossable ? { crossable: true } : {}) },
    { x: 0, y: 1, side: 'E', z: 1 }, { x: 1, y: 1, side: 'N', z: 1 }, { x: 1, y: 2, side: 'N', z: 1 },
  ];
  s.triggers = [piege(2, 1)];
  return s;
}

/** 4×3 de plain-pied : croisée E de (1,1) sur (2,1). */
function plainPied(crossable = true): Scene {
  const s = emptyScene(4, 3);
  s.walls = [{ x: 1, y: 1, side: 'E', window: true, ...(crossable ? { crossable: true } : {}) }];
  s.triggers = [piege(2, 1)];
  return s;
}

const dedans = { x: 1, y: 1 };
const dehors = { x: 2, y: 1 };

function explorer(scene: Scene, pos: { x: number; y: number; z?: number }) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: pos, scene, pendingFall: null, flags: {} });
}

/** Le refus dit au joueur (`refuserGeste`) : la bannière en combat, le journal hors combat. */
const refusDit = (): string | undefined => {
  const s = useGame.getState();
  return s.battle ? s.refus?.texte : s.journal.slice(-1)[0];
};

describe('capacités d’arête d’une croisée', () => {
  it('franchissable d’étage → `chute` (hauteur réelle au libellé)', () => {
    const a = aretesUtilisables({ scene: etage(), visible: new Set(['1,1,1', '2,1,1']), controleur: { ...dedans, z: 1 }, activeZ: 1 });
    expect(a.map((x) => [x.capacite, x.libelle])).toEqual([['chute', 'Sauter en bas (4 m)']]);
  });

  it('franchissable de plain-pied → `fenetre`', () => {
    const a = aretesUtilisables({ scene: plainPied(), visible: new Set(['1,1,0', '2,1,0']), controleur: { ...dedans, z: 0 }, activeZ: 0 });
    expect(a.map((x) => [x.capacite, x.libelle])).toEqual([['fenetre', 'Enjamber la fenêtre']]);
  });

  it('non franchissable → aucun geste, ni d’étage ni de plain-pied', () => {
    expect(aretesUtilisables({ scene: etage(false), visible: new Set(['1,1,1', '2,1,1']), controleur: { ...dedans, z: 1 }, activeZ: 1 })).toEqual([]);
    expect(aretesUtilisables({ scene: plainPied(false), visible: new Set(['1,1,0', '2,1,0']), controleur: { ...dedans, z: 0 }, activeZ: 0 })).toEqual([]);
  });
});

describe('sauter par la croisée d’étage — exploration', () => {
  beforeEach(() => explorer(etage(), { ...dedans, z: 1 }));

  it('ouvre la modale de chute existante : 4 m, arrivée à la couche basse', () => {
    useGame.getState().fallAcross({ ...dedans, z: 1 }, dehors);
    expect(useGame.getState().pendingFall).toMatchObject({ metres: 4, to: { x: 2, y: 1, z: 0 } });
    expect(phaseDeChute(useGame.getState().pendingFall!)).toBe('choice');
  });

  it('« Sauter » : l’atterrissage passe par `moveParty` — le déclencheur de la rue joue', () => {
    useGame.getState().fallAcross({ ...dedans, z: 1 }, dehors);
    useGame.getState().fallChoose(useGame.getState().party[0].id, false);
    draineCascade(useGame.getState);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 1, z: 0 });
    expect(useGame.getState().flags.__trigger_rue).toBe(true);
  });

  it('chute amortie à 0 m : l’atterrissage passe aussi par `moveParty`', () => {
    useGame.getState().fallAcross({ ...dedans, z: 1 }, dehors);
    const id = useGame.getState().party[0].id;
    useGame.getState().fallChoose(id, true);
    const p = useGame.getState().pendingFall!;
    useGame.setState({ pendingFall: { ...p, participants: p.participants.map((x) => (x.id === id ? { ...x, result: { success: true, roll: 5, target: 90, dr: 6, effectiveMetres: 0 } } : x)) } });
    useGame.getState().fallConfirm();
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 1, z: 0 });
    expect(useGame.getState().flags.__trigger_rue).toBe(true);
  });
});

describe('enjamber la croisée de plain-pied — exploration', () => {
  it('le pas du groupe passe par `moveParty` : position, déclencheur joué', () => {
    explorer(plainPied(), { ...dedans, z: 0 });
    useGame.getState().windowAcross({ ...dedans, z: 0 }, dehors);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 1, z: 0 });
    expect(useGame.getState().flags.__trigger_rue).toBe(true);
  });

  it('croisée non franchissable → rien ne bouge', () => {
    explorer(plainPied(false), { ...dedans, z: 0 });
    useGame.getState().windowAcross({ ...dedans, z: 0 }, dehors);
    expect(useGame.getState().partyPos).toEqual({ ...dedans, z: 0 });
  });

  it('aucun héros debout → refus NOMMÉ, rien ne bouge (`meneurDeboutDuMonde`)', () => {
    explorer(plainPied(), { ...dedans, z: 0 });
    const [h] = useGame.getState().party;
    useGame.setState({ party: [{ ...h, wounds: { ...h.wounds, current: 0 } }] });
    useGame.getState().windowAcross({ ...dedans, z: 0 }, dehors);
    expect(useGame.getState().partyPos).toEqual({ ...dedans, z: 0 });
    expect(refusDit()).toBe(t('geste.refus.personne'));
  });

  it('dialogue ouvert → rien ne bouge (garde de `stepPartyDir`)', () => {
    explorer(plainPied(), { ...dedans, z: 0 });
    useGame.setState({ dialogue: {} as never });
    useGame.getState().windowAcross({ ...dedans, z: 0 }, dehors);
    expect(useGame.getState().partyPos).toEqual({ ...dedans, z: 0 });
    expect(useGame.getState().flags.__trigger_rue).toBeUndefined();
    useGame.setState({ dialogue: null });
  });
});

describe('enjamber la croisée — combat', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup(movementUsed = 0, tour: { acted?: boolean; movedPreAction?: boolean } = {}) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const sc = plainPied();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    foes.forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, dedans);
    useGame.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed, acted: false, movedPreAction: false, ...tour, reachable: new Map(), preview: null } });
    return { H, foe: foes[0] };
  }

  it('Mouvement seul : coût = 1 case + allège de 1 m à ½ vitesse (2 m/case → 1), Action intacte, aucun Test', () => {
    const { H } = setup();
    useGame.getState().windowAcross(dedans, dehors);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.movementUsed).toBe(2);
    expect(b.acted).toBe(false);
    expect(b.movedPreAction).toBe(true);
    expect(useGame.getState().pendingFall).toBeNull();
  });

  it('Mouvement restant insuffisant → refus NOMMÉ, rien ne bouge', () => {
    const { H } = setup(3); // Marche 4 − 3 = 1 < 2
    useGame.getState().windowAcross(dedans, dehors);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 1, y: 1 });
    expect(b.movementUsed).toBe(3);
    expect(refusDit()).toBe(t('fenetre.mouvementInsuffisant', { name: H.label, cout: 2 }));
  });

  it('Mouvement → Action → enjamber : refus NOMMÉ (`canMove`, `gesteDArete`), rien ne bouge', () => {
    const { H } = setup(1, { acted: true, movedPreAction: true }); // Marche 4 − 1 = 3 ≥ 2 : seul l'entrelacement refuse
    useGame.getState().windowAcross(dedans, dehors);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 1, y: 1 });
    expect(b.movementUsed).toBe(1);
    expect(refusDit()).toBe(t('geste.refus.mouvementEntrelace', { name: H.label }));
  });

  it('case d’arrivée occupée → refus NOMMÉ, rien ne bouge', () => {
    const { H, foe } = setup();
    foe.dead = false;
    placeCombatant(foe, useGame.getState().scene, dehors);
    useGame.getState().windowAcross(dedans, dehors);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 1, y: 1 });
    expect(b.movementUsed).toBe(0);
    expect(refusDit()).toBe(t('franchir.caseOccupee', { name: H.label }));
  });
});

describe('sauter par la croisée : la rue lance une rencontre', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('la rencontre s’ouvre AVANT le dé de chute : la perte frappe le combattant, reportée au groupe en fin de combat', () => {
    vi.useFakeTimers();
    const sc = etage();
    const enc = buildEncounter({ id: 'enc-rue', enemies: [{ ref: 'mutant', pos: { x: 3, y: 0 } }] });
    sc.entities = [...sc.entities, ...enc.entities];
    sc.encounters = [enc.encounter];
    sc.triggers = [{ ...piege(2, 1), flow: flowFromEffects([{ type: 'startCombat', encounter: 'enc-rue' }]) }];
    explorer(sc, { ...dedans, z: 1 });
    const hero = useGame.getState().party[0];
    const avant = hero.wounds.current;
    useGame.getState().fallAcross({ ...dedans, z: 1 }, dehors);
    useGame.getState().fallChoose(hero.id, false);
    draineCascade(useGame.getState);
    const s = useGame.getState();
    expect(s.battle).not.toBeNull();
    const enBataille = s.battle!.combatants.find((c) => c.id === hero.id)!.wounds.current;
    expect(enBataille).toBeLessThan(avant); // le dé a frappé le combattant — vérité du combat (`touchActors`)
    expect(s.party.find((h) => h.id === hero.id)!.wounds.current).toBe(avant); // le groupe attend le report
    finalizeBattle(useGame.getState, useGame.setState);
    expect(useGame.getState().party.find((h) => h.id === hero.id)!.wounds.current).toBe(enBataille);
  });

  it('à DEUX tombants : la rencontre s’ouvre AVANT les dés, et CHAQUE combattant subit SA chute', () => {
    vi.useFakeTimers();
    const sc = etage();
    const enc = buildEncounter({ id: 'enc-rue', enemies: [{ ref: 'mutant', pos: { x: 3, y: 0 } }] });
    sc.entities = [...sc.entities, ...enc.entities];
    sc.encounters = [enc.encounter];
    sc.triggers = [{ ...piege(2, 1), flow: flowFromEffects([{ type: 'startCombat', encounter: 'enc-rue' }]) }];
    explorer(sc, { ...dedans, z: 1 });
    const second = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'K', seed: 2 });
    useGame.setState({ party: [...useGame.getState().party, second] });
    const [a, b] = useGame.getState().party;
    useGame.getState().fallAcross({ ...dedans, z: 1 }, dehors);
    useGame.getState().fallChoose(a.id, false);
    useGame.getState().fallChoose(b.id, false);
    draineCascade(useGame.getState);
    const s = useGame.getState();
    expect(s.battle).not.toBeNull();
    for (const h of [a, b]) {
      expect(s.battle!.combatants.find((c) => c.id === h.id)!.wounds.current, h.label).toBeLessThan(h.wounds.current);
      expect(s.party.find((x) => x.id === h.id)!.wounds.current, `${h.label} : le groupe attend le report`).toBe(h.wounds.current);
    }
  });
});

describe('réseau', () => {
  it('`windowAcross` est un intent d’invité (possession de l’actif, patron `climbAcross`)', () => {
    expect(GUEST_INTENTS.has('windowAcross')).toBe(true);
    expect(typeof useGame.getState().windowAcross).toBe('function');
  });
});

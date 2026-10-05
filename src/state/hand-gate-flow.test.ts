/**
 * Main ensanglantée (Aux Armes bras 46-50, l.2569) — flux de jet PAR ACTION câblé aux points de
 * déclaration d'attaque : le point PARTAGÉ `openAttackCascade` interpose le Test de Dextérité (+20)
 * INFLUENÇABLE (`pendingHandGate`) quand l'arme est tenue dans une main gatée ; RÉUSSITE → l'attaque
 * s'ouvre, ÉCHEC → l'objet glisse (`disarm`). Chemin IA = jet inline forcé dans `doAttack`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { initialFields } from './stateFields';
import { openAttackCascade, doAttack, runPreemptShots } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';

const CHARS = (dex: number) => ({ 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: dex, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
const SWORD = (uid: string): Weapon => ({ uid, label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'main', hands: 1 } as unknown as Weapon);
const SWORD_ITEM = (uid: string): ItemInstance => objetDeTest({ uid, trappingId: 'arme-simple', kind: 'melee', qualities: [] });

const mkHero = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', label: 'H', kind: 'hero', pos: { x: 0, y: 0 }, size: 'moyenne',
  characteristics: CHARS(40), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 12, max: 12, current: 12 },
  weapons: [SWORD('m')], items: [SWORD_ITEM('m')],
  loadouts: [{ id: 'lo', main: 'm' }], activeLoadoutId: 'lo',
  armour: ARM(), ...over,
} as unknown as Combatant);

const mkFoe = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id, label: id, kind: 'enemy', pos: { x: 1, y: 0 }, size: 'moyenne',
  characteristics: CHARS(40), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 10, max: 10, current: 10 },
  weapons: [SWORD('e')], items: [SWORD_ITEM('e')],
  loadouts: [{ id: 'loe', main: 'e' }], activeLoadoutId: 'loe',
  armour: ARM(), ...over,
} as unknown as Combatant);

function setup(h: Combatant, f: Combatant) {
  useGame.setState({
    scene: { ...emptyScene(8, 4), weather: 'clair' },
    gameTime: 0,
    battle: { combatants: [h, f], order: ['h', f.id], turn: 0, round: 1, log: [],
      acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as never,
  });
  const b = useGame.getState().battle!;
  return { h: b.combatants.find((c) => c.id === 'h')!, f: b.combatants.find((c) => c.id === f.id)! };
}

const bleeding = (over: Partial<Combatant> = {}): Partial<Combatant> => ({ handGates: ['main'], conditions: [{ id: 'hemorragique', value: 2 }], ...over });

beforeEach(() => { useGame.setState({ ...initialFields(), battle: null, scene: null, gameTime: 0, party: [] }); seedBattleRng(1); });

describe('openAttackCascade — point PARTAGÉ des déclarations d\'attaque (joueur)', () => {
  it('main gatée + arme tenue dans cette main → interpose le Test de Dextérité, PAS l\'attaque directe', () => {
    const { h, f } = setup(mkHero(bleeding()), mkFoe('f'));
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: h.id, targetId: f.id, location: null, result: null, weaponUid: 'm' }, 'Attaque', 'action/attack');
    const s = useGame.getState();
    expect(s.pendingHandGate).toBeTruthy();
    expect(s.pendingHandGate!.hand).toBe('main');
    expect(s.pendingHandGate!.difficulty).toBe('accessible');
    expect(s.pendingAttack).toBeNull(); // l'attaque n'est PAS encore ouverte
    expect(s.pendingCascade).toBeNull();
  });

  it('main NON gatée → ouvre directement la cascade d\'attaque (comportement inchangé)', () => {
    const { h, f } = setup(mkHero(), mkFoe('f'));
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: h.id, targetId: f.id, location: null, result: null, weaponUid: 'm' }, 'Attaque', 'action/attack');
    const s = useGame.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack).toBeTruthy();
    expect(s.pendingCascade?.participants[0].jet).toBe('attack');
  });

  it('handGateRoll pose un jet (délégué influençable généré) puis RÉUSSITE → l\'attaque s\'ouvre', () => {
    const { h, f } = setup(mkHero(bleeding()), mkFoe('f'));
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: h.id, targetId: f.id, location: null, result: null, weaponUid: 'm' }, 'Attaque', 'action/attack');
    (useGame.getState() as unknown as { handGateRoll: () => void }).handGateRoll();
    expect(useGame.getState().pendingHandGate!.roll).not.toBeNull();
    // Force une RÉUSSITE pour tester l'ouverture de l'attaque (le jet lui-même est aléatoire).
    const pg = useGame.getState().pendingHandGate!;
    useGame.setState({ pendingHandGate: { ...pg, roll: pg.target, success: true, sl: 0 } });
    useGame.getState().handGateConfirm();
    const s = useGame.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack).toBeTruthy();
    expect(s.pendingCascade?.participants[0].jet).toBe('attack'); // l'Action figée s'est ouverte
    // Pas de re-gate en boucle : l'attaque est bien ouverte, pas un 2ᵉ pendingHandGate.
  });

  it('ÉCHEC → l\'objet glisse (disarm : loadout vidé), pas d\'attaque, Action non re-consommée', () => {
    const { h, f } = setup(mkHero(bleeding()), mkFoe('f'));
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: h.id, targetId: f.id, location: null, result: null, weaponUid: 'm' }, 'Attaque', 'action/attack');
    const pg = useGame.getState().pendingHandGate!;
    useGame.setState({ pendingHandGate: { ...pg, roll: 99, success: false, sl: -3 } });
    useGame.getState().handGateConfirm();
    const s = useGame.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack).toBeNull(); // l'attaque n'a pas lieu
    const hero = s.battle!.combatants.find((c) => c.id === 'h')!;
    expect(hero.loadouts![0].main).toBeUndefined(); // arme lâchée
    expect(s.battle!.log.some((l) => /lâche/i.test(l.text))).toBe(true);
  });

  it('handGateCancel referme sans coût (avant le jet)', () => {
    const { h, f } = setup(mkHero(bleeding()), mkFoe('f'));
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: h.id, targetId: f.id, location: null, result: null, weaponUid: 'm' }, 'Attaque', 'action/attack');
    useGame.getState().handGateCancel();
    expect(useGame.getState().pendingHandGate).toBeNull();
    expect(useGame.getState().pendingAttack).toBeNull();
  });
});

describe('doAttack — l\'IA gatée joue le MÊME Test inline (résolution forcée non-interactive)', () => {
  it('un ennemi gaté surface le Test de Main ensanglantée (jamais de modale IA)', () => {
    const { h, f } = setup(mkHero(), mkFoe('f', bleeding()));
    // On teste le tour de l'ennemi : il attaque le héros.
    doAttack(useGame.getState, useGame.setState, f, h);
    const s = useGame.getState();
    // Aucune modale ouverte pour l'IA ; le gate a été JOUÉ inline (une des deux lignes de journal).
    expect(s.pendingHandGate).toBeNull();
    expect(s.battle!.log.some((l) => /Main ensanglantée/i.test(l.text))).toBe(true);
  });

  it('sur un ÉCHEC du Test, l\'IA lâche son arme (disarm) et renonce au coup', () => {
    // Dex très basse (1 → cible 21) : on cherche un seed qui rate.
    let disarmed = false;
    for (let seed = 1; seed <= 40 && !disarmed; seed++) {
      useGame.setState({ ...initialFields(), battle: null, scene: null, gameTime: 0, party: [] });
      seedBattleRng(seed);
      const { h, f } = setup(mkHero(), mkFoe('f', bleeding({ characteristics: CHARS(1) as never })));
      const proceeded = doAttack(useGame.getState, useGame.setState, f, h);
      const foe = useGame.getState().battle!.combatants.find((c) => c.id === 'f')!;
      if (!proceeded && foe.loadouts![0].main === undefined) disarmed = true;
    }
    expect(disarmed).toBe(true); // il existe des jets ratés → arme lâchée + coup renoncé
  });

  // Pilonnage IA / pièce servie (AA 07 l.117 ; parité pilonnage joueur) : le gate suit l'arme RÉELLEMENT employée,
  // pas la main directrice — une arme hors de la main gatée (2nde main, ou pièce servie hors loadout) ne gate pas.
  it('l\'arme EMPLOYÉE hors de la main gatée n\'est pas gatée, même la main directrice ensanglantée', () => {
    // Foe gaté sur la MAIN, mais la seule arme tenue est en OFF (uid 'e', non gaté) → firedWeapon la choisit.
    const foe = mkFoe('f', { handGates: ['main'], conditions: [{ id: 'hemorragique', value: 2 }],
      weapons: [SWORD('e')], items: [SWORD_ITEM('e')],
      loadouts: [{ id: 'loe', off: 'e' }] as never, activeLoadoutId: 'loe' } as never);
    const { h, f } = setup(mkHero(), foe);
    doAttack(useGame.getState, useGame.setState, f, h);
    const s = useGame.getState();
    expect(s.battle!.log.some((l) => /Main ensanglantée/i.test(l.text))).toBe(false); // arme employée (off) ≠ main gatée → aucun Test
  });
});

// Le tireur porte un ARC (Recharge 0) : depuis que l'état de charge vit sur l'ARME, `canPreemptRanged`
// (« arme à distance CHARGÉE », LDB 10) répond OUI pour une arme SANS cycle de charge — elle est prête par
// nature (rien à recharger, LDB 62 l.335). Avant, un `Combatant.loaded` absent la disait déchargée : c'est
// ce faux négatif qui disparaît, et la fixture n'a donc plus rien à poser.
describe('runPreemptShots — le Tir rapide de l\'IA joue le MÊME Test de Main ensanglantée (AA 07 l.117)', () => {
  const BOW = (uid: string): Weapon => ({ uid, label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] } as unknown as Weapon);
  const BOW_ITEM = (uid: string): ItemInstance => objetDeTest({ uid, trappingId: 'arc', kind: 'ranged', qualities: [] });
  const shooter = (over: Partial<Combatant> = {}): Combatant => mkFoe('f', {
    pos: { x: 2, y: 0 }, talents: [{ talentId: 'tir-rapide', times: 1 }] as never,
    weapons: [BOW('bow')], items: [BOW_ITEM('bow')], loadouts: [{ id: 'lob', main: 'bow' }] as never, activeLoadoutId: 'lob',
    handGates: ['main'], conditions: [{ id: 'hemorragique', value: 2 }], ...over,
  });

  it('un tireur gaté JOUE le Test avant son tir (jamais de modale IA)', () => {
    setup(mkHero({ pos: { x: 0, y: 0 } }), shooter());
    seedBattleRng(1);
    runPreemptShots(useGame.getState, useGame.setState);
    const s = useGame.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.battle!.log.some((l) => /Main ensanglantée/i.test(l.text))).toBe(true);
  });

  it('sur un ÉCHEC, le tireur lâche son arc (disarm) et RENONCE au Tir rapide (pas de tir)', () => {
    let renounced = false;
    for (let seed = 1; seed <= 40 && !renounced; seed++) {
      useGame.setState({ ...initialFields(), battle: null, scene: null, gameTime: 0, party: [] });
      seedBattleRng(seed);
      setup(mkHero({ pos: { x: 0, y: 0 } }), shooter({ characteristics: CHARS(1) as never }));
      runPreemptShots(useGame.getState, useGame.setState);
      const f = useGame.getState().battle!.combatants.find((c) => c.id === 'f')!;
      // Arc lâché + il n'a PAS consommé son tour normal (renoncé, pas tiré).
      if (f.loadouts![0].main === undefined && !f.loseNextAction) renounced = true;
    }
    expect(renounced).toBe(true);
  });

  // #188 : la cible la plus proche HORS Ligne de Vue ne doit PAS provoquer un 2ᵉ Test de Main ensanglantée.
  // La LdV se tranche AVANT le gate → le gate ne joue qu'UNE fois, sur la cible réellement tirée (une seule
  // ligne de journal « Main ensanglantée » pour cette interruption « tire UNE fois »).
  it('cible la plus proche masquée : le gate ne joue qu\'UNE fois (pas de re-Test par candidat)', () => {
    // Mur opaque en (2,0) : masque la LdV du tireur (0,0) vers l\'ennemi le PLUS proche en (4,0) ; l\'ennemi
    // en (0,6) reste dégagé (colonne libre). Tir attendu sur le second, avec un SEUL Test de Dextérité.
    const tiles = Array(80).fill('sol'); tiles[2] = 'mur'; // index (2,0) = 0*10+2
    const sh = shooter({ pos: { x: 0, y: 0 } });
    const near = mkHero({ id: 'near', pos: { x: 4, y: 0 } });
    const far = mkHero({ id: 'far', pos: { x: 0, y: 6 } });
    useGame.setState({
      scene: { ...emptyScene(10, 8), weather: 'clair', layers: [{ z: 0, tiles }] },
      gameTime: 0,
      battle: { combatants: [sh, near, far], order: ['f', 'near', 'far'], turn: 0, round: 1, log: [],
        acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as never,
    });
    seedBattleRng(6); // seed où le Test PASSE : l'ancien code re-gaterait le 2ᵉ candidat (2 lignes)
    runPreemptShots(useGame.getState, useGame.setState);
    const s = useGame.getState();
    expect(s.battle!.log.filter((l) => /Main ensanglantée/i.test(l.text)).length).toBe(1);
    expect(s.battle!.combatants.find((c) => c.id === 'f')!.loseNextAction).toBe(true); // il a bien tiré (sur la cible dégagée)
  });
});

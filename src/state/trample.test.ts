import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { cibleDEcartDeTaille, aiCreatureFreeAttacks, runEnemyAI, availableAttacks } from './combatFlow';
import { mountMovement } from './mount';
import { ACTION_GATES } from './actionRegistry';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

// ---------------------------------------------------------------------------
// Piétinement — attaque gratuite de mêlée, OPPOSÉE (LDB 85 l.387 ; LDB 13 l.123)
// ---------------------------------------------------------------------------

/** Le combattant PREND son rang d'initiative : `runEnemyAI` refuse un tour qui n'est pas celui de
 *  l'actif (jeton de tour, #1852) — jouer le tour de quelqu'un d'autre n'est pas une situation. */
const auTourDe = (id: string): void => {
  const b = useGame.getState().battle!;
  b.turn = b.order.indexOf(id);
};

const at = (kind: 'hero' | 'enemy', id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Patte', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y }, ...over,
  }) as unknown as Combatant;

describe('cibleDEcartDeTaille — cible au contact plus petite d’au moins N catégories (pur)', () => {
  it('renvoie un adversaire adjacent PLUS PETIT et vivant ; pas un égal/lointain/mort', () => {
    const big = at('enemy', 'TROLL', 5, 5, { size: 'grande' });
    const small = at('hero', 'H1', 5, 6, { size: 'moyenne' }); // adjacent, plus petit
    const equal = at('hero', 'H2', 4, 5, { size: 'grande' }); // adjacent mais même Taille
    const far = at('hero', 'H3', 5, 9, { size: 'petite' }); // plus petit mais loin
    const battle = { combatants: [big, small, equal, far] } as unknown as BattleState;
    expect(cibleDEcartDeTaille(battle, big, 1)?.id).toBe('H1');
    expect(cibleDEcartDeTaille(battle, big, 1, 'H2')).toBeUndefined(); // ciblage explicite d'un égal → rien
    expect(cibleDEcartDeTaille(battle, big, 1, 'H3')).toBeUndefined(); // trop loin
  });
});

describe('Piétinement en combat (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = { current: 30, max: 30, base: 30 } as Combatant['wounds'];
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
    return { H, E };
  }

  /** Le héros joue le Piétinement par l'attaque gratuite CANONIQUE : option armée, clic-cible commis. */
  const pietiner = (cibleId: string): void => {
    useGame.getState().battleSelectAttack('pietinement');
    useGame.getState().battleClickEntity(cibleId, { confirm: true });
  };
  const advDe = (id: string): number => useGame.getState().battle!.combatants.find((c) => c.id === id)!.advantage;

  it('héros plus grand : le Piétinement est un Test OPPOSÉ de Corps à corps, gratuit (LDB 13 l.123 ; LDB 85 l.387)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.advantage = 2;
    pietiner(E.id);
    expect(useGame.getState().pendingAttack!.freeKind).toBe('pietinement');
    useGame.getState().attackRoll();
    const pa = useGame.getState().pendingAttack!;
    expect(pa.weapon!.attackKind, 'l’arme du JET est celle du Piétinement').toBe('pietinement');
    expect(pa.result!.defenderDetail, 'la cible oppose sa défense').toBeDefined();
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.acted, 'action GRATUITE : l’Action reste').toBe(false);
  });

  it('Morsure jouée par un héros : l’arme du JET est la Morsure, jamais l’arme tenue (#1026 ; LDB 85 l.237)', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    H.traits = [{ id: 'morsure', value: 10 }];
    H.advantage = 2;
    useGame.getState().battleSelectAttack('morsure');
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    useGame.getState().attackRoll();
    const pa = useGame.getState().pendingAttack!;
    expect(H.weapons.some((w) => w.attackKind === 'morsure'), 'aucune arme tenue ne porte la Morsure').toBe(false);
    expect(pa.weapon!.attackKind).toBe('morsure');
    expect(pa.result!.defenderDetail, 'Test opposé').toBeDefined();
  });

  // LDB 13 l.123 ; LDB 14 l.219.
  it('Piétinement perdu (CC=1) : l’adversaire gagne +1 Avantage, le piétineur perd tout le sien', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 1;
    E.characteristics['capacite-de-combat'] = 95;
    E.characteristics.agilite = 95;
    H.advantage = 2;
    E.advantage = 0;
    const before = E.wounds.current;
    pietiner(E.id);
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    expect(advDe(H.id)).toBe(0);
    expect(advDe(E.id)).toBe(1);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBe(before);
  });

  it('sans Avantage, ou contre une cible de même Taille : aucune option Piétinement', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.advantage = 0;
    expect(availableAttacks(H, useGame.getState().battle!).some((o) => o.id === 'pietinement')).toBe(false);
    H.advantage = 2;
    H.size = 'moyenne';
    E.size = 'moyenne';
    expect(availableAttacks(H, useGame.getState().battle!).some((o) => o.id === 'pietinement')).toBe(false);
  });

  it('cible de même Taille au contact : le clic ne piétine pas (`freeAttackTargetOk`)', () => {
    const { H, E } = setup();
    const b = useGame.getState().battle!;
    const E2 = b.combatants.find((c) => c.kind === 'enemy' && c.id !== E.id)!;
    E2.dead = false;
    E2.pos = { x: 10, y: 11 };
    H.size = 'grande';
    E.size = 'moyenne';
    E2.size = 'grande';
    H.advantage = 2;
    pietiner(E2.id);
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(advDe(H.id), 'rien n’est débité').toBe(2);
    expect(useGame.getState().refus?.texte, 'le refus se DIT au clic').toContain(E2.label);
  });

  // LDB 85 l.314 ; LDB 85 l.387.
  it('Se cabrer : sans Avantage, l’option existe et coûte l’Action de Mouvement', () => {
    const { H } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 0;
    const piet = availableAttacks(H, useGame.getState().battle!).find((o) => o.id === 'pietinement');
    expect(piet?.cost).toEqual({ action: false, advantage: 0, movement: true });
  });

  it('Se cabrer : la frappe débite l’Action de Mouvement (movementUsed plein), PAS l’Avantage', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 2;
    expect(useGame.getState().battle!.movementUsed).toBe(0);
    pietiner(E.id);
    const st = useGame.getState();
    expect(st.pendingAttack!.freeKind).toBe('pietinement');
    expect(st.battle!.movementUsed).toBe(mountMovement(st.battle!, H));
    expect(advDe(H.id)).toBe(2);
  });

  it('Se cabrer + Mouvement DÉJÀ dépensé, mais de l’Avantage : la voie ORDINAIRE — 1 Avantage DÉBITÉ', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 2;
    const spent = mountMovement(useGame.getState().battle!, H);
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: spent } });
    pietiner(E.id);
    expect(useGame.getState().pendingAttack!.freeKind).toBe('pietinement');
    expect(advDe(H.id)).toBe(1);
    expect(useGame.getState().battle!.movementUsed, 'aucun Mouvement supplémentaire consommé').toBe(spent);
  });

  it('Se cabrer : aucune option si l’Action de Mouvement est dépensée et 0 Avantage', () => {
    const { H } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 0;
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: mountMovement(useGame.getState().battle!, H) } });
    expect(availableAttacks(H, useGame.getState().battle!).some((o) => o.id === 'pietinement')).toBe(false);
  });

  // LDB 85 l.237 ; LDB 85 l.314 ; LDB 85 l.387.
  it.each([
    { cas: 'Morsure (1 Avantage)', attaque: 'morsure', traits: [{ id: 'morsure', value: 10 }], taille: undefined },
    { cas: 'Piétinement (1 Avantage)', attaque: 'pietinement', traits: [], taille: 'grande' },
    { cas: 'Se cabrer (Action de Mouvement)', attaque: 'pietinement', traits: [{ id: 'se-cabrer' }], taille: 'grande' },
  ] as const)('$cas : annulée avant le jet, la gratuite rend ce qu’elle a pris', ({ attaque, traits, taille }) => {
    const { H, E } = setup();
    if (taille) H.size = taille;
    H.traits = [...traits] as unknown as Combatant['traits'];
    H.advantage = 2;
    useGame.getState().battleSelectAttack(attaque);
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    const paye = useGame.getState();
    expect(paye.pendingAttack, 'la déclaration a ouvert le jet').toBeTruthy();
    expect(advDe(H.id) < 2 || paye.battle!.movementUsed > 0, 'la déclaration a PAYÉ').toBe(true);
    useGame.getState().attackCancel();
    const st = useGame.getState();
    expect(st.pendingAttack).toBeNull();
    expect(advDe(H.id), 'Avantage rendu').toBe(2);
    expect(st.battle!.movementUsed, 'Mouvement rendu').toBe(0);
  });

  it('IA : un ennemi plus grand avec de l’Avantage piétine un héros adjacent plus petit (via aiCreatureFreeAttacks, #527)', () => {
    // `aiCreatureFreeAttacks` joue le Piétinement en dernière gratuite de la liste unique (`attaquesNaturelles`).
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.advantage = 2;
    H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ id: 'surpris', value: 1 }]; // ne se défend pas → résolution instantanée (patron l.250)
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    const before = H.wounds.current;
    auTourDe(E.id);
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
  });

  it('IA : Se cabrer piétine même à 0 Avantage SI l’Action de Mouvement est encore entière (coût 0 Avantage, movementUsed → plein M)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    E.advantage = 0;
    H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ id: 'surpris', value: 1 }]; // Surpris → ne se défend pas → résolution instantanée (patron creatureFreeAttacks.test.ts)
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0 } });
    const before = H.wounds.current;
    auTourDe(E.id);
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    // Coût de l'Action de Piétinement = 0 (freeTrample) ; le +1 gagné vient du Test opposé remporté (RAW),
    // pas du coût — sans Se cabrer, `enemy.advantage < 1` aurait sauté l'attaque (0 < 1).
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(1);
    // Preuve du VRAI coût (LDB 85 l.314 : « pour une Action de Mouvement ») : le plein Mouvement est dépensé.
    expect(st.battle!.movementUsed).toBe(mountMovement(st.battle!, E));
  });

  it('IA : Se cabrer NE piétine PAS gratuitement si l’Action de Mouvement est DÉJÀ dépensée (approche → plus de sacrifice possible)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    E.advantage = 0; // aucun Avantage, et l'Action de Mouvement (ci-dessous) est DÉJÀ dépensée
    H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ id: 'surpris', value: 1 }];
    // L'ennemi a déjà bougé ce Tour (approche vers sa cible, `runEnemyAI` case 'move') → plus d'Action de
    // Mouvement à sacrifier pour le Piétinement gratuit de Se cabrer.
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: mountMovement(useGame.getState().battle!, E) } });
    const before = H.wounds.current;
    auTourDe(E.id);
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before); // aucune attaque tentée
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0);
  });

  it('IA : SANS Se cabrer, à 0 Avantage le Piétinement générique (coût 1) est SAUTÉ', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.traits = []; // aucun trait Se cabrer → Piétinement générique reste à coût 1 (LDB 85 l.387)
    E.advantage = 0;
    H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ id: 'surpris', value: 1 }];
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    const before = H.wounds.current;
    auTourDe(E.id);
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before); // aucune attaque tentée
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0);
  });

  it('IA : Se cabrer + Mouvement DÉJÀ dépensé, mais de l’Avantage : piétine à 1 Avantage (LDB 85 l.387)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    E.advantage = 2;
    H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ id: 'surpris', value: 1 }];
    const spent = mountMovement(useGame.getState().battle!, E);
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: spent } });
    const before = H.wounds.current;
    auTourDe(E.id);
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(useGame.getState().battle!.movementUsed, 'aucun Mouvement supplémentaire').toBe(spent);
  });

  // #527 : le chemin ENNEMI RÉEL (`runEnemyAI` case 'move') doit tracer `movementUsed` — sinon la gate
  // ci-dessus (movementUsed === 0) restait toujours vraie en production, laissant passer approche +
  // Piétinement gratuit (Se cabrer) du MÊME tour.
  it('#527 IA Se cabrer : APPROCHER ce tour trace movementUsed (la Marche consommée n’est plus invisible)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    E.advantage = 0; // le Piétinement générique (coût 1) resterait de toute façon hors de portée
    E.pos = { x: 14, y: 10 }; // hors de portée de mêlée (3 cases) → l'IA DOIT approcher avant d'attaquer
    E.movement = 4;
    H.size = 'moyenne';
    H.pos = { x: 10, y: 10 };
    H.conditions = [{ id: 'surpris', value: 1 }]; // ne se défend pas → résolution instantanée
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0 } });
    expect(useGame.getState().battle!.movementUsed).toBe(0);
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    vi.advanceTimersByTime(4000); // laisse jouer le télégraphe + la charge
    const st = useGame.getState();
    // La Marche consommée par l'approche est désormais TRACÉE — la gate de Se cabrer (l.205 ci-dessus,
    // `movementUsed > 0`) la voit donc réellement, au lieu de rester 0 en permanence.
    expect(st.battle!.movementUsed).toBeGreaterThan(0);
  });

  it('#527 IA Se cabrer : DÉJÀ adjacent (aucune approche) → movementUsed reste à 0, le Piétinement gratuit reste possible', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85;
    E.characteristics.force = 45;
    E.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    E.advantage = 0;
    E.pos = { x: 11, y: 10 }; // déjà adjacent à H → aucun Mouvement requis
    H.size = 'moyenne';
    H.pos = { x: 10, y: 10 };
    H.conditions = [{ id: 'surpris', value: 1 }];
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0 } });
    auTourDe(E.id);
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    vi.advanceTimersByTime(4000);
    const st = useGame.getState();
    expect(st.battle!.movementUsed).toBe(0); // aucune approche → l'Action de Mouvement reste entière
  });

  // LDB 85 l.387 ; LDB 85 l.237.
  it('héros : un Piétinement par tour — joué, l’option disparaît, Avantage restant', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.advantage = 3;
    pietiner(E.id);
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    h.advantage = 3;
    expect(h.freeAttacksThisTurn?.pietinement).toBe(1);
    expect(availableAttacks(h, useGame.getState().battle!).some((o) => o.id === 'pietinement')).toBe(false);
  });

  // La case de gate lit l'option, jamais un second prédicat. LDB 85 l.387 ; LDB 85 l.314.
  it('gate « pietinement-gratuit » : fermée une fois le plafond atteint', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.advantage = 3;
    expect(ACTION_GATES['pietinement-gratuit']({ active: H, battle: useGame.getState().battle! }).ok).toBe(true);
    pietiner(E.id);
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    vi.runAllTimers();
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.id === H.id)!;
    expect(h.advantage, 'il reste de l’Avantage').toBeGreaterThan(0);
    expect(ACTION_GATES['pietinement-gratuit']({ active: h, battle: b }).ok).toBe(false);
  });

  it('gate « pietinement-gratuit » : Se cabrer à 0 Avantage, Mouvement intact, la gate est ouverte', () => {
    const { H } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 0;
    expect(ACTION_GATES['pietinement-gratuit']({ active: H, battle: useGame.getState().battle! }).ok).toBe(true);
  });

  /** Le CHEMIN DU JOUEUR au clavier : l'option armée, Tab aimante la cible, Entrée commet. */
  const pietinerAuClavier = (): void => {
    useGame.getState().battleSelectAttack('pietinement');
    useGame.getState().snapCursorToTarget(1);
    useGame.getState().commitCursor();
    vi.runAllTimers();
  };

  // LDB 85 l.387 ; LDB 13 l.123. La cible se tient au bord de l'empreinte Énorme (`sizes.json` footprintSide).
  it('héros Énorme : Tab puis Entrée déclarent le Piétinement — jet opposé, option consommée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme';
    H.advantage = 3;
    E.pos = { x: 13, y: 10 };
    pietinerAuClavier();
    const pa = useGame.getState().pendingAttack;
    expect(pa?.freeKind, 'Entrée ouvre le jet du Piétinement').toBe('pietinement');
    expect(useGame.getState().pendingCascade, 'la modale s’ouvre').toBeTruthy();
    useGame.getState().attackRoll();
    expect(useGame.getState().pendingAttack!.result!.defenderDetail, 'la cible oppose sa défense').toBeDefined();
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.pietinement).toBe(1);
    expect(availableAttacks(h, useGame.getState().battle!).some((o) => o.id === 'pietinement'), 'l’option disparaît').toBe(false);
  });

  it('héros Énorme : Annuler avant le jet rend l’Avantage et l’option', () => {
    const { H, E } = setup();
    H.size = 'enorme';
    H.advantage = 3;
    E.pos = { x: 13, y: 10 };
    pietinerAuClavier();
    expect(advDe(H.id), 'le coût est débité au commit').toBe(2);
    useGame.getState().attackCancel();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.advantage).toBe(3);
    expect(availableAttacks(h, useGame.getState().battle!).some((o) => o.id === 'pietinement')).toBe(true);
  });

  // LDB 85 l.237 ; LDB 85 l.387 ; LDB 85 l.405.
  it.each([
    { cas: 'Morsure', kind: 'morsure', traits: [{ id: 'morsure', value: 6 }], plafond: 1 },
    { cas: 'Piétinement', kind: 'pietinement', traits: [], plafond: 1 },
    { cas: '2 Tentacules', kind: 'tentacules', traits: [{ id: 'tentacules', value: 6, count: 2 }], plafond: 2 },
  ] as const)('IA et héros, même plafond par tour : $cas', ({ kind, traits, plafond }) => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.traits = [...traits] as unknown as Combatant['traits'];
    E.advantage = 5;
    H.size = 'moyenne';
    H.wounds = { current: 200, max: 200, base: 200 } as Combatant['wounds'];
    H.conditions = [{ id: 'surpris', value: 1 }];
    H.aiControlled = true; // porteur non tenu : ses Blessures critiques sans étape (LDB 63 l.30 ; #1858)
    auTourDe(E.id);
    expect(aiCreatureFreeAttacks(useGame.getState, useGame.setState, E)).toBe(false);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.freeAttacksThisTurn?.[kind], 'l’IA joue exactement le plafond').toBe(plafond);
    e.advantage = 5;
    expect(availableAttacks(e, useGame.getState().battle!).some((o) => o.freeKind === kind), 'le héros lit le même plafond').toBe(false);
  });
});

/**
 * Manœuvres JOUEUR (« Manœuvre ▾ ») — un héros qui possède un trait d'attaque de créature
 * (mutation/polymorphie) peut l'activer. Couvre la SOURCE UNIQUE `availableManeuvers` (énumération
 * dédupliquée : traits abordables/légaux + Piétinement + mutation Tentacule) et le câblage store
 * (manœuvre de ZONE résolue directement ; manœuvre de mêlée CIBLÉE → pendingAttack avec freeKind).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { availableAttacks } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

const at = (kind: 'hero' | 'enemy', id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], items: [], movement: 4, pos: { x, y }, ...over,
  }) as unknown as Combatant;

const mkBattle = (combatants: Combatant[], over: Partial<BattleState> = {}): BattleState =>
  ({ combatants, acted: false, ...over }) as unknown as BattleState;

describe('availableAttacks — énumération (pur)', () => {
  it('Arme d’abord (1ʳᵉ) ; Morsure +10 présente avec Avantage ≥ 1, absente à 0', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const heroAdv = at('hero', 'H', 5, 5, { traits: [{ id: 'morsure', value: 10 }], advantage: 1 });
    const m = availableAttacks(heroAdv, mkBattle([heroAdv, enemy]));
    expect(m[0]?.id).toBe('arme'); // Arme d'abord (clic droit = première abordable)
    const morsure = m.find((x) => x.id === 'morsure');
    expect(morsure).toBeTruthy();
    expect(morsure!.targeting).toBe('melee'); // mêlée → approche-puis-frappe
    expect(morsure!.cost.advantage).toBe(1);

    const heroNoAdv = at('hero', 'H', 5, 5, { traits: [{ id: 'morsure', value: 10 }], advantage: 0 });
    expect(availableAttacks(heroNoAdv, mkBattle([heroNoAdv, enemy])).some((x) => x.id === 'morsure')).toBe(false);
  });

  it('Souffle +15 (Feu) : attaque de ZONE présente avec Avantage ≥ 2', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, { traits: [{ id: 'souffle', value: 15, arg: 'Feu' }], advantage: 2 });
    const souffle = availableAttacks(hero, mkBattle([hero, enemy])).find((x) => x.id === 'souffle-feu');
    expect(souffle).toBeTruthy();
    expect(souffle!.targeting).toBe('zone'); // pendingManeuver (clic = point d’impact, LDB 85 « cible visible »)
    expect(souffle!.cost.advantage).toBe(2);

    const heroLow = at('hero', 'H', 5, 5, { traits: [{ id: 'souffle', value: 15, arg: 'Feu' }], advantage: 1 });
    expect(availableAttacks(heroLow, mkBattle([heroLow, enemy])).some((x) => x.id === 'souffle-feu')).toBe(false);
  });

  it('Piétinement : présent si un adversaire adjacent PLUS PETIT existe et Avantage ≥ 1', () => {
    const small = at('enemy', 'E', 5, 6, { size: 'petite' });
    const hero = at('hero', 'H', 5, 5, { size: 'grande', advantage: 1 });
    const piet = availableAttacks(hero, mkBattle([hero, small])).find((x) => x.id === 'pietinement');
    expect(piet).toBeTruthy();
    expect(piet!.targeting).toBe('trample');

    const heroNoAdv = at('hero', 'H', 5, 5, { size: 'grande', advantage: 0 });
    expect(availableAttacks(heroNoAdv, mkBattle([heroNoAdv, small])).some((x) => x.id === 'pietinement')).toBe(false);
  });

  it('mutation Tentacule : présente avec l’arme nat-tentacule + un ennemi + pas encore utilisée', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, {
      weapons: [{ label: 'Tentacule', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], uid: 'nat-tentacule' }] as Combatant['weapons'],
    });
    const t = availableAttacks(hero, mkBattle([hero, enemy])).find((x) => x.id === 'tentacule');
    expect(t).toBeTruthy();
    expect(t!.targeting).toBe('melee');
    expect(t!.cost.advantage).toBe(0);

    const used = at('hero', 'H', 5, 5, {
      weapons: [{ label: 'Tentacule', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], uid: 'nat-tentacule' }] as Combatant['weapons'],
      freeAttacksThisTurn: { tentacules: 1 }, // déjà jouée ce tour → plafond 1/tour atteint
    });
    expect(availableAttacks(used, mkBattle([used, enemy])).some((x) => x.id === 'tentacule')).toBe(false);
  });

  it('inclut l’Arme (1ʳᵉ attaque) mais exclut les manœuvres de Charge (Cornes)', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, { traits: [{ id: 'cornes', value: 8 }], advantage: 5 });
    const m = availableAttacks(hero, mkBattle([hero, enemy]));
    expect(m.some((x) => x.id === 'cornes')).toBe(false); // déclenchement charge (auto) → exclu de la liste
    expect(m.some((x) => x.id === 'arme')).toBe(true); // l'Arme EST une attaque de la liste
  });

  it('Métamorphose (Enfant d’Ulric) : la manœuvre SUR SOI (targeting self) n’apparaît PAS dans les attaques', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, { traits: [{ id: 'metamorphose' }], advantage: 5 });
    const m = availableAttacks(hero, mkBattle([hero, enemy]));
    expect(m.some((x) => x.id === 'forme-hybride-ulric' || x.id === 'forme-humaine-ulric' || x.kind === 'hurlement')).toBe(false);
  });
});

describe('manœuvres en combat (store)', () => {
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
    useGame.getState().startScene(testScene);
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
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('Souffle CIBLÉ : battle.action=maneuver + clic = point d’impact → pendingManeuver{targetId} (jet différé)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'Feu' }];
    H.characteristics['capacite-de-tir'] = 90; // Test opposé CT/Esquive → touche déterministe
    H.advantage = 3;
    // La hotbar arme l'attaque (`battleSelectAttack`) ; le clic-entité désigne le point d’impact (zone : 1er clic).
    useGame.getState().battleSelectAttack('souffle-feu');
    useGame.getState().battleClickEntity(E.id);
    const pm = useGame.getState().pendingManeuver;
    expect(pm).toBeTruthy(); // le Souffle ouvre la modale de jet d’attaquant
    expect(pm!.kind).toBe('souffle');
    expect(pm!.maneuverId).toBe('souffle-feu');
    expect(pm!.targetId).toBe(E.id); // point d’impact = entité cliquée
    expect(pm!.result).toBeNull(); // rien n’est tiré avant Lancer
    expect(pm!.avantageSpent).toBe(2); // coût RAW affiché (dépensé à l’application)
    expect(useGame.getState().battle!.acted).toBe(false); // gratuite : l’Action reste
    // (résolution complète Lancer→Appliquer couverte par maneuver-flow.test.ts)
  });

  it('manœuvre de mêlée ciblée : battle.action=maneuver + clic-cible → pendingAttack freeKind=morsure', () => {
    const { H, E } = setup();
    H.traits = [{ id: 'morsure', value: 10 }];
    H.advantage = 2;
    useGame.getState().battleSelectAttack('morsure');
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // 2e tap (parité attaque de base : 1er = aperçu)
    const pa = useGame.getState().pendingAttack;
    expect(pa).toBeTruthy();
    expect(pa!.freeKind).toBe('morsure');
    expect(pa!.targetId).toBe(E.id);
    expect(pa!.result).toBeNull(); // rien n’est tiré avant Lancer
    // L’Avantage est dépensé à la FRAPPE (coût RAW 1), après tous les portails — chemin d'attaque unifié.
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(1);
  });

  it('mêlée gratuite sur cible DISTANTE : CHARGE puis frappe, même Action dépensée (≠ refus « hors de portée »)', () => {
    const { H, E } = setup();
    H.traits = [{ id: 'morsure', value: 10 }];
    H.advantage = 2;
    E.pos = { x: 14, y: 10 }; // hors d'Allonge
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true, movementUsed: 0 } }); // Action déjà dépensée
    useGame.getState().battleSelectAttack('morsure');
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) → ouvre la frappe
    const pa = useGame.getState().pendingAttack;
    expect(pa!.freeKind).toBe('morsure');
    expect(pa!.fromCharge).toBe(true); // s'est ruée au contact (gratuite = approche permise même Action dépensée)
    expect(useGame.getState().battle!.acted).toBe(true); // la gratuite NE rend PAS l'Action (préservée à la résolution)
  });

  it('Morsure (reach 1, forceMelee) ignore une arme tenue À DISTANCE : approche en mêlée au lieu de tirer', () => {
    const { H, E } = setup();
    H.traits = [{ id: 'morsure', value: 10 }];
    H.advantage = 2;
    H.weapons = [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 0 }, range: 30, qualities: [], uid: 'bow' }] as Combatant['weapons']; // arme tenue = arc
    E.pos = { x: 14, y: 10 };
    useGame.getState().battleSelectAttack('morsure');
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) → ouvre la frappe
    const pa = useGame.getState().pendingAttack;
    expect(pa!.freeKind).toBe('morsure'); // la Morsure reste une attaque de MÊLÉE…
    expect(pa!.fromCharge).toBe(true); // …elle s'approche (charge), elle ne tire pas à distance
  });

  it('manœuvre gratuite = 1/tour (RAW LDB 85 l.237) : Morsure indisponible après une 1ʳᵉ Morsure, même avec de l\'Avantage', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'morsure', value: 10 }];
    H.characteristics['capacite-de-combat'] = 90;
    H.advantage = 3; // assez pour 3 Morsures si elles n'étaient PAS plafonnées
    useGame.getState().battleSelectAttack('morsure');
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // E adjacent → frappe directe
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    const st = useGame.getState();
    const h2 = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h2.freeAttacksThisTurn?.morsure).toBe(1); // comptée
    expect(h2.advantage).toBeGreaterThanOrEqual(1); // il RESTE de l'Avantage (coût −1, ±1 selon l'issue de la touche)…
    expect(availableAttacks(h2, st.battle!).some((o) => o.id === 'morsure')).toBe(false); // …mais le plafond 1/tour est atteint
  });
});

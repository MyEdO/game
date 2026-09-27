import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { cleaveTargets, doAttack, autoCleave } from './combatFlow';
import { occupiesTile, footprintN } from './footprint';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { BattleState } from './store';

// ---------------------------------------------------------------------------
// Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299)
// ---------------------------------------------------------------------------

const at = (kind: 'hero' | 'enemy', id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id,
    name: id,
    kind,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [{ name: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    pos: { x, y },
    ...over,
  }) as unknown as Combatant;

describe('cleaveTargets — cibles de balayage adjacentes (pur)', () => {
  it('renvoie les adversaires vivants adjacents non déjà frappés ; exclut alliés, lointains, morts', () => {
    const attacker = at('enemy', 'OGRE', 5, 5, { size: 'enorme' });
    const adj1 = at('hero', 'H1', 5, 6); // adjacent
    const adj2 = at('hero', 'H2', 4, 4); // adjacent (diagonale)
    const far = at('hero', 'H3', 5, 9); // hors de portée
    const dead = at('hero', 'H4', 6, 5, { dead: true } as Partial<Combatant>); // adjacent mais hors de combat
    const ally = at('enemy', 'E2', 4, 5); // même camp que l'attaquant
    const battle = { combatants: [attacker, adj1, adj2, far, dead, ally] } as unknown as BattleState;

    expect(cleaveTargets(battle, attacker, []).map((c) => c.id).sort()).toEqual(['H1', 'H2']);
    // une cible déjà frappée ce balayage est exclue
    expect(cleaveTargets(battle, attacker, ['H1']).map((c) => c.id)).toEqual(['H2']);
  });
});

describe('Balayage en combat (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingAttack: null, pendingCleave: null, pendingDefense: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Prépare un combat enc-mutants avec `nHeroes` héros, puis renvoie le state. */
  function setupBattle(nHeroes: number) {
    const party = Array.from({ length: nHeroes }, (_, i) =>
      createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }),
    );
    useGame.setState({ party });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers(); // on pilote l'ordre nous-mêmes
    return useGame.getState().battle!;
  }

  it('IA : un Énorme adjacent à deux héros enchaîne (Frappe Mortelle) sur le second', () => {
    useGame.getState().seedRng(2);
    const b = setupBattle(2);
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    // Un seul ennemi actif (Énorme, CC élevée pour des touches fiables) ; les autres écartés.
    enemies.slice(1).forEach((e) => (e.dead = true));
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 80;
    E.characteristics.force = 45;
    E.pos = { x: 10, y: 10 };
    E.weapons = [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }];
    const [H1, H2] = heroes;
    H1.pos = { x: 9, y: 10 };
    H2.pos = { x: 11, y: 10 };
    for (const h of [H1, H2]) {
      h.conditions = [{ id: 'surpris', value: 1 }]; // ne peuvent pas se défendre → résolution instantanée
      h.wounds = { current: 60, max: 60, base: 60 } as Combatant['wounds'];
      h.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    }
    useGame.setState({ battle: { ...b } });

    // L'IA attaque H1 ; la Frappe Mortelle enchaîne sur H2 (adjacent).
    doAttack(useGame.getState, useGame.setState, E, H1);

    const st = useGame.getState().battle!;
    const h1 = st.combatants.find((c) => c.id === H1.id)!;
    const h2 = st.combatants.find((c) => c.id === H2.id)!;
    expect(h1.wounds.current).toBeLessThan(60); // touche primaire
    expect(h2.wounds.current).toBeLessThan(60); // enchaînement (balayage)
  });

  it('Frappe Mortelle (option, hors Taille) : un attaquant de taille NORMALE qui TUE en un coup enchaîne — rien sans la règle', () => {
    useGame.getState().seedRng(2);
    const b = setupBattle(2);
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    E.size = 'moyenne'; // PAS plus grand → balayage de Taille INACTIF (res.cleave = false)
    E.characteristics['capacite-de-combat'] = 90;
    E.characteristics.force = 50;
    E.pos = { x: 10, y: 10 };
    E.weapons = [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }];
    const [primary, h2] = heroes;
    primary.dead = true; // cible primaire TUÉE en un coup (déclencheur Frappe Mortelle)
    primary.pos = { x: 9, y: 10 }; // E se recale ICI après le kill (LDB 14 l.9)
    h2.pos = { x: 8, y: 10 }; // adjacent à la case du MORT (où E se déplace), pas à la case d'origine de E
    h2.conditions = [{ id: 'surpris', value: 1 }]; // pas de défense → enchaînement instantané
    h2.wounds = { current: 60, max: 60, base: 60 } as Combatant['wounds'];
    h2.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    useGame.setState({ battle: { ...b } });

    // Sans la règle : aucun enchaînement (taille normale, res.cleave = false).
    resetRule('combat-frappe-mortelle');
    autoCleave(useGame.getState, useGame.setState, E, primary, { cleave: false } as AttackResult);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current).toBe(60);

    // Avec la règle : la cible primaire tuée → enchaînement sur h2.
    setRule('combat-frappe-mortelle', true);
    autoCleave(useGame.getState, useGame.setState, E, primary, { cleave: false } as AttackResult);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current).toBeLessThan(60);
    resetRule('combat-frappe-mortelle');
  });

  it('Héros plus grand : pendingCleave s’ouvre après la touche, l’enchaînement le ferme', () => {
    useGame.getState().seedRng(2);
    const b = setupBattle(1);
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = enemies;
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.pos = { x: 10, y: 10 };
    E1.pos = { x: 9, y: 10 };
    E2.pos = { x: 11, y: 10 };
    for (const e of [E1, E2]) {
      e.wounds = { current: 40, max: 40, base: 40 } as Combatant['wounds'];
      e.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    }
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, movementUsed: 99, acted: false } });

    // Touche primaire sur E1 → balayage déclenché (héros plus grand).
    useGame.getState().battleClickEntity(E1.id, { confirm: true });
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    const pc = useGame.getState().pendingCleave;
    expect(pc).toBeTruthy();
    expect(pc!.hitIds).toEqual([E1.id]);
    expect(pc!.count).toBe(0);

    // Enchaînement sur E2 → résout puis ferme le balayage (plus de cible adjacente).
    const e2Before = useGame.getState().battle!.combatants.find((c) => c.id === E2.id)!.wounds.current;
    useGame.getState().cleaveAttack(E2.id);
    expect(useGame.getState().pendingAttack!.cleave).toBe(true);
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    expect(useGame.getState().pendingCleave).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E2.id)!.wounds.current).toBeLessThan(e2Before);
  });

  it('borne BCC : cleaveAttack refusé une fois le quota d’enchaînements atteint ; cleaveEnd ferme', () => {
    const b = setupBattle(1);
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E1 = b.combatants.find((c) => c.kind === 'enemy')!;
    // Le héros peut avoir des talents charMod (+5 CC via guerrier-né…) : vider les talents pour
    // isoler ce test du quota et rendre BCC=2 déterministe (CC=25 brut, effectiveChar=25, BCC=2).
    H.talents = [];
    H.characteristics['capacite-de-combat'] = 25; // BCC = 2 (bonus(25) = 2, sans passif talent)
    H.pos = { x: 10, y: 10 };
    E1.pos = { x: 11, y: 10 };
    useGame.setState({
      battle: { ...b },
      pendingAttack: null,
      pendingCleave: { attackerId: H.id, hitIds: ['x', 'y'], count: 2 }, // quota BCC déjà atteint
    });
    useGame.getState().cleaveAttack(E1.id);
    expect(useGame.getState().pendingAttack).toBeNull(); // refusé : count >= BCC

    useGame.getState().cleaveEnd();
    expect(useGame.getState().pendingCleave).toBeNull();
  });

  it('en se recalant sur la case d’un mort, un Énorme dégage les plus petits sous son empreinte (LDB 85 l.373-374)', () => {
    useGame.getState().seedRng(7);
    const b = setupBattle(2);
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // un seul ennemi actif
    E.size = 'enorme'; // empreinte 3×3
    E.characteristics['capacite-de-combat'] = 40; // BCC = 4
    E.pos = { x: 0, y: 0 };
    const [deadPrimary, small] = heroes;
    deadPrimary.dead = true; // cible primaire DÉJÀ hors de combat → l’Énorme se recale sur sa case
    deadPrimary.pos = { x: 10, y: 10 };
    small.size = 'moyenne';
    small.pos = { x: 11, y: 11 }; // SOUS l’empreinte 3×3 ancrée en (10,10) → (10..12, 10..12)
    small.wounds = { current: 200, max: 200, base: 200 } as Combatant['wounds'];
    small.conditions = [{ id: 'surpris', value: 1 }]; // pas de défense → enchaînement instantané, survit
    small.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    useGame.setState({ battle: { ...b } });

    expect(occupiesTile({ x: 10, y: 10 }, 3, 11, 11)).toBe(true); // sanity (3 = énorme) : small était bien sous l’empreinte

    autoCleave(useGame.getState, useGame.setState, E, deadPrimary, { cleave: true } as AttackResult);

    const st = useGame.getState().battle!;
    const e = st.combatants.find((c) => c.id === E.id)!;
    const s = st.combatants.find((c) => c.id === small.id)!;
    expect(e.pos).toEqual({ x: 10, y: 10 }); // recalé sur la case du mort (l.10)
    expect(occupiesTile(e.pos!, footprintN(e), s.pos!.x, s.pos!.y)).toBe(false); // small dégagé HORS de l’empreinte
  });
});

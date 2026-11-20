import { findTrappingById } from '../data';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { attackWeaponOf, cleaveTargets, doAttack, autoCleave } from './combatFlow';
import { occupiesTile, footprintN } from './monde/footprint';
import { createHero } from '../engine/character';
import { itemFromTrappingById, recomputeLoadout, weaponFromItem } from '../engine/items';
import { setRule, resetRule } from '../engine/policy';
import { resetDesFixes, setDesFixes } from '../engine/fixedDie';
import { isOutOfAction } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { BattleState } from './etat';
import { draineCascade } from './cascade.testkit';
import { reluDans } from './combatDeTest.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';
import { currentTargetingMode } from './targetingModes';
import { spawnEnemy } from './monde/spawn';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => {
  resetRule('combat-frappe-mortelle');
  resetDesFixes();
});

// ---------------------------------------------------------------------------
// Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299)
// ---------------------------------------------------------------------------

const at = (kind: 'heros' | 'ennemi', id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id,
    name: id,
    kind,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    advantage: 0,
    conditions: [],
    weapons: [{ name: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    pos: { x, y },
    ...over,
  })) as unknown as Combatant;

describe('cleaveTargets — cibles de balayage adjacentes (pur)', () => {
  it('renvoie les adversaires vivants adjacents non déjà frappés ; exclut alliés, lointains, morts', () => {
    const attacker = at('ennemi', 'OGRE', 5, 5, { size: 'enorme' });
    const adj1 = at('heros', 'H1', 5, 6); // adjacent
    const adj2 = at('heros', 'H2', 4, 4); // adjacent (diagonale)
    const far = at('heros', 'H3', 5, 9); // hors de portée
    const dead = at('heros', 'H4', 6, 5, { dead: true } as Partial<Combatant>); // adjacent mais hors de combat
    const ally = at('ennemi', 'E2', 4, 5); // même camp que l'attaquant
    const battle = { combatants: [attacker, adj1, adj2, far, dead, ally] } as unknown as BattleState;

    expect(cleaveTargets(findTrappingById, banc.getState().scene, battle, attacker, []).map((c) => c.id).sort()).toEqual(['H1', 'H2']);
    // une cible déjà frappée ce balayage est exclue
    expect(cleaveTargets(findTrappingById, banc.getState().scene, battle, attacker, ['H1']).map((c) => c.id)).toEqual(['H2']);
  });
});

describe('Balayage en combat (store)', () => {
  /** Prépare un combat enc-mutants avec `nHeroes` héros, puis renvoie le state. */
  function setupBattle(nHeroes: number) {
    const party = Array.from({ length: nHeroes }, (_, i) =>
      createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }),
    );
    banc.setState({ party });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner(); // on pilote l'ordre nous-mêmes
    return banc.getState().battle!;
  }

  it.each([
    { arme: 'arme-simple', distance: 1, aPortee: true, monte: false },
    { arme: 'arme-simple', distance: 2, aPortee: false, monte: false },
    { arme: 'lance', distance: 2, aPortee: true, monte: false },
    { arme: 'lance', distance: 2, aPortee: true, monte: true },
  ])('Frappe Mortelle, $arme à $distance case(s) de la case libérée, monté : $monte (LDB 14 l.9 ; 62 l.163)', ({ arme, distance, aPortee, monte }) => {
    const get = banc.getState;
    const battle = setupBattle(1);
    const [hero, primaire, suivante, horsAllonge] = [
      battle.combatants.find((c) => c.kind === 'heros')!,
      ...battle.combatants.filter((c) => c.kind === 'ennemi'),
    ];
    setRule('combat-frappe-mortelle', true);
    setDesFixes(true);
    hero.pos = { x: 10, y: 10 };
    hero.size = 'moyenne';
    const monture = monte ? spawnEnemy({ ref: 'cheval-de-monte' }, 'monture', hero.pos) : undefined;
    if (monture) {
      monture.kind = 'heros';
      hero.mountId = monture.id;
      monture.riderId = hero.id;
      battle.combatants.push(monture);
    }
    hero.characteristics['capacite-de-combat'] = 85;
    hero.items = [{ ...itemFromTrappingById(arme, idsDeTest)!, equipped: true }];
    hero.loadouts = [];
    recomputeLoadout(hero);
    primaire.pos = { x: 9, y: 10 };
    suivante.pos = { x: 9 - distance, y: 10 };
    horsAllonge.pos = { x: monte ? 13 : 12, y: 10 };
    const reserve = aPortee ? spawnEnemy({ ref: 'mutant' }, 'reserve', { x: 9, y: 9 }) : undefined;
    if (reserve) {
      battle.combatants.push(reserve);
      battle.order.push(reserve.id);
      battle.baseOrder?.push(reserve.id);
    }
    for (const c of [primaire, suivante, horsAllonge]) {
      c.size = 'moyenne';
      c.conditions = [{ id: 'surpris', value: 1 }];
      c.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    }
    primaire.important = false;
    primaire.wounds = blessuresDeBase(12, 1, primaire);
    suivante.wounds = blessuresDeBase(60, 60, suivante);
    banc.setState({ battle: { ...battle, turn: battle.order.indexOf(hero.id), action: null, movementUsed: 99, acted: false } });

    cliquerSurLeCombattant(get, primaire.id, { confirm: true });
    expect(get().pendingAttack?.targetId).toBe(primaire.id);
    get().jetLancer('attaque');
    get().jetImposerLeResultat('attaque', 21);
    get().jetValider('attaque');
    draineCascade(get);
    expect(isOutOfAction(reluDans(get, primaire)), 'Mort subite (LDB 18 l.46)').toBe(true);
    expect(reluDans(get, hero).pos).toEqual(primaire.pos);
    if (monture) expect(reluDans(get, monture).pos).toEqual(primaire.pos);

    const mode = currentTargetingMode(get);
    if (!aPortee) {
      expect(get().pendingCleave).toBeNull();
      return;
    }
    expect(get().pendingCleave).toMatchObject({ count: 0, hitIds: [primaire.id], fm: true });
    expect(mode.id).toBe('frappeMortelle');
    expect(mode.candidates!(get, hero).map((c) => c.id)).toEqual([suivante.id, reserve!.id]);
    expect(mode.affordance!(get, hero, suivante).kind).toBe('ok');
    expect(mode.affordance!(get, hero, horsAllonge).kind).toBe('none');
    cliquerSurLeCombattant(get, horsAllonge.id, { confirm: true });
    expect(get().pendingAttack).toBeNull();
    cliquerSurLeCombattant(get, suivante.id, { confirm: true });
    const pa = get().pendingAttack!;
    expect(pa).toMatchObject({ targetId: suivante.id, cleave: true });
    expect(attackWeaponOf(findTrappingById, get().scene, get().battle!, reluDans(get, hero), reluDans(get, suivante), pa).trappingId).toBe(arme);
    get().jetLancer('attaque');
    get().jetImposerLeResultat('attaque', 21);
    get().jetValider('attaque');
    draineCascade(get);
    expect(reluDans(get, suivante).wounds.current).toBeLessThan(60);
    expect(reluDans(get, suivante).wounds.current).toBeGreaterThan(0);
    expect(isOutOfAction(reluDans(get, reserve!))).toBe(false);
    expect(cleaveTargets(findTrappingById, get().scene, get().battle!, reluDans(get, hero), [primaire.id, suivante.id]).map((c) => c.id)).toEqual([reserve!.id]);
    expect(get().pendingCleave).toBeNull();
  });

  it('le maillon du cavalier IA donne sa défense au héros atteint par l’empreinte du cheval (LDB 14 l.9 ; 62 l.163)', () => {
    const get = banc.getState;
    const battle = setupBattle(2);
    const [primaire, suivante] = battle.combatants.filter((c) => c.kind === 'heros');
    const [cavalier, ...autres] = battle.combatants.filter((c) => c.kind === 'ennemi');
    for (const c of autres) c.dead = true;
    setRule('combat-frappe-mortelle', true);
    cavalier.pos = { x: 10, y: 10 };
    cavalier.size = 'moyenne';
    cavalier.characteristics['capacite-de-combat'] = 95;
    cavalier.characteristics.force = 85;
    cavalier.weapons = [weaponFromItem(itemFromTrappingById('lance', idsDeTest)!)];
    const monture = spawnEnemy({ ref: 'cheval-de-monte' }, 'monture', cavalier.pos);
    monture.riderId = cavalier.id;
    cavalier.mountId = monture.id;
    battle.combatants.push(monture);
    primaire.pos = { x: 9, y: 10 };
    primaire.kind = 'pnj';
    primaire.aiControlled = true;
    primaire.important = false;
    primaire.conditions = [{ id: 'surpris', value: 1 }];
    primaire.wounds = blessuresDeBase(12, 1, primaire);
    suivante.pos = { x: 12, y: 10 };
    suivante.conditions = [];
    suivante.wounds = blessuresDeBase(100, 100, suivante);
    banc.setState({ battle: { ...battle, turn: battle.order.indexOf(cavalier.id), action: null, movementUsed: 0, acted: false } });
    get().ensemencerLeTirage(2);

    doAttack(get, banc.setState, reluDans(get, cavalier), reluDans(get, primaire));

    expect(isOutOfAction(reluDans(get, primaire))).toBe(true);
    expect(reluDans(get, monture).pos).toEqual(primaire.pos);
    expect(get().pendingDefense?.defenderId).toBe(suivante.id);
    expect(reluDans(get, suivante).wounds.current).toBe(100);
  });

  it('une Mort subite causée par un tir ne déclenche ni déplacement ni Frappe Mortelle (LDB 14 l.9)', () => {
    const get = banc.getState;
    const battle = setupBattle(1);
    const hero = battle.combatants.find((c) => c.kind === 'heros')!;
    const [primaire, voisine, autre] = battle.combatants.filter((c) => c.kind === 'ennemi');
    setRule('combat-frappe-mortelle', true);
    setDesFixes(true);
    const depart = { x: 10, y: 10 };
    hero.pos = depart;
    hero.characteristics['capacite-de-tir'] = 85;
    const hache = itemFromTrappingById('hache-de-lancer', idsDeTest)!;
    const dague = itemFromTrappingById('dague', idsDeTest)!;
    hero.items = [hache, dague];
    hero.loadouts = [{ id: 'armes-en-main', main: hache.uid, secondaire: dague.uid }];
    hero.activeLoadoutId = 'armes-en-main';
    recomputeLoadout(hero);
    primaire.pos = { x: 8, y: 10 };
    primaire.important = false;
    primaire.wounds = blessuresDeBase(12, 1, primaire);
    primaire.conditions = [{ id: 'surpris', value: 1 }];
    primaire.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    voisine.pos = { x: 7, y: 10 };
    autre.pos = { x: 14, y: 10 };
    banc.setState({ battle: { ...battle, turn: battle.order.indexOf(hero.id), action: null, movementUsed: 99, acted: false } });

    cliquerSurLeCombattant(get, primaire.id, { confirm: true });
    const pa = get().pendingAttack!;
    expect(pa?.targetId).toBe(primaire.id);
    expect(attackWeaponOf(findTrappingById, get().scene, get().battle!, hero, primaire, pa).type).toBe('distance');
    get().jetLancer('attaque');
    get().jetImposerLeResultat('attaque', 21);
    get().jetValider('attaque');
    draineCascade(get);
    expect(isOutOfAction(reluDans(get, primaire)), 'Mort subite (LDB 18 l.46)').toBe(true);
    expect(reluDans(get, hero).pos).toEqual(depart);
    expect(get().pendingCleave).toBeNull();
  });

  it('IA : un Énorme adjacent à deux héros enchaîne (Frappe Mortelle) sur le second', () => {
    banc.getState().ensemencerLeTirage(2);
    const b = setupBattle(2);
    const heroes = b.combatants.filter((c) => c.kind === 'heros');
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
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
      h.wounds = blessuresDeBase(60, 60, h);
      h.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    }
    banc.setState({ battle: { ...b } });

    // L'IA attaque H1 ; la Frappe Mortelle enchaîne sur H2 (adjacent).
    doAttack(banc.getState, banc.setState, reluDans(banc.getState, E), reluDans(banc.getState, H1));
    // Porteurs tenus : chaque Blessure critique ouvre son étape, l'enchaînement attend sa fermeture (LDB 63 l.30).
    draineCascade(banc.getState);

    const st = banc.getState().battle!;
    const h1 = st.combatants.find((c) => c.id === H1.id)!;
    const h2 = st.combatants.find((c) => c.id === H2.id)!;
    expect(h1.wounds.current).toBeLessThan(60); // touche primaire
    expect(h2.wounds.current).toBeLessThan(60); // enchaînement (balayage)
  });

  it('Frappe Mortelle (option, hors Taille) : un attaquant de taille NORMALE qui TUE en un coup enchaîne — rien sans la règle', () => {
    banc.getState().ensemencerLeTirage(2);
    const b = setupBattle(2);
    const heroes = b.combatants.filter((c) => c.kind === 'heros');
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
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
    h2.wounds = blessuresDeBase(60, 60, h2);
    h2.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    banc.setState({ battle: { ...b } });

    // Sans la règle : aucun enchaînement (taille normale, res.cleave = false).
    resetRule('combat-frappe-mortelle');
    autoCleave(banc.getState, banc.setState, E, primary, { cleave: false } as AttackResult);
    expect(banc.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current).toBe(60);

    // Avec la règle : la cible primaire tuée → enchaînement sur h2.
    setRule('combat-frappe-mortelle', true);
    autoCleave(banc.getState, banc.setState, E, primary, { cleave: false } as AttackResult);
    expect(banc.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current).toBeLessThan(60);
  });

  it('Héros plus grand : pendingCleave s’ouvre après la touche, l’enchaînement le ferme', () => {
    banc.getState().ensemencerLeTirage(2);
    const b = setupBattle(1);
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const [E1, E2] = enemies;
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.pos = { x: 10, y: 10 };
    E1.pos = { x: 9, y: 10 };
    E2.pos = { x: 11, y: 10 };
    for (const e of [E1, E2]) {
      e.wounds = blessuresDeBase(40, 40, e);
      e.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    }
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, action: null, movementUsed: 99, acted: false } });

    // Touche primaire sur E1 → balayage déclenché (héros plus grand).
    cliquerSurLeCombattant(banc.getState, E1.id, { confirm: true });
    banc.getState().jetLancer('attaque');
    banc.getState().jetValider('attaque');
    const pc = banc.getState().pendingCleave;
    expect(pc).toBeTruthy();
    expect(pc!.hitIds).toEqual([E1.id]);
    expect(pc!.count).toBe(0);

    // Enchaînement sur E2 → résout puis ferme le balayage (plus de cible adjacente).
    const e2Before = banc.getState().battle!.combatants.find((c) => c.id === E2.id)!.wounds.current;
    banc.getState().frapperEnBalayage(E2.id);
    expect(banc.getState().pendingAttack!.cleave).toBe(true);
    banc.getState().jetLancer('attaque');
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingCleave).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === E2.id)!.wounds.current).toBeLessThan(e2Before);
  });

  it('Héros plus grand, manœuvre gratuite (Morsure) : pendingCleave s’ouvre après la touche, comme pour une attaque (LDB 14 l.9, LDB 85 l.362)', () => {
    banc.getState().ensemencerLeTirage(2);
    const b = setupBattle(1);
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const [E1, E2] = enemies;
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.size = 'grande';
    H.traits = [{ id: 'morsure', value: 10 }];
    H.advantage = 2;
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.pos = { x: 10, y: 10 };
    E1.pos = { x: 9, y: 10 };
    E2.pos = { x: 11, y: 10 };
    for (const e of [E1, E2]) {
      e.wounds = blessuresDeBase(40, 40, e);
      e.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    }
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, action: null, movementUsed: 99, acted: false } });

    banc.getState().armerLAttaque('morsure');
    cliquerSurLeCombattant(banc.getState, E1.id, { confirm: true });
    expect(banc.getState().pendingAttack!.freeKind).toBe('morsure');
    banc.getState().jetLancer('attaque');
    expect(banc.getState().pendingAttack!.result!.hit).toBe(true);
    banc.getState().jetValider('attaque');
    const pc = banc.getState().pendingCleave;
    expect(pc).toBeTruthy();
    expect(pc!.hitIds).toEqual([E1.id]);
  });

  it('borne BCC : frapperEnBalayage refusé une fois le quota d’enchaînements atteint ; sa sortie ferme', () => {
    const b = setupBattle(1);
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E1 = b.combatants.find((c) => c.kind === 'ennemi')!;
    // Le héros peut avoir des talents charMod (+5 CC via guerrier-né…) : vider les talents pour
    // isoler ce test du quota et rendre BCC=2 déterministe (CC=25 brut, effectiveChar=25, BCC=2).
    H.talents = [];
    H.characteristics['capacite-de-combat'] = 25; // BCC = 2 (bonus(25) = 2, sans passif talent)
    H.pos = { x: 10, y: 10 };
    E1.pos = { x: 11, y: 10 };
    banc.setState({
      battle: { ...b },
      pendingAttack: null,
      pendingCleave: { attackerId: H.id, hitIds: ['x', 'y'], count: 2 }, // quota BCC déjà atteint
    });
    const mode = currentTargetingMode(banc.getState);
    expect(mode.candidates!(banc.getState, H)).toEqual([]);
    expect(mode.affordance!(banc.getState, H, E1).kind).toBe('none');
    banc.getState().frapperEnBalayage(E1.id);
    expect(banc.getState().pendingAttack).toBeNull(); // refusé : count >= BCC

    banc.getState().fenetreFermer('frappeMortelle');
    expect(banc.getState().pendingCleave).toBeNull();
  });

  it('en se recalant sur la case d’un mort, un Énorme dégage les plus petits sous son empreinte (LDB 85 l.373-374)', () => {
    banc.getState().ensemencerLeTirage(7);
    const b = setupBattle(2);
    const heroes = b.combatants.filter((c) => c.kind === 'heros');
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
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
    small.wounds = blessuresDeBase(200, 200, small);
    small.conditions = [{ id: 'surpris', value: 1 }]; // pas de défense → enchaînement instantané, survit
    small.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    banc.setState({ battle: { ...b } });

    expect(occupiesTile({ x: 10, y: 10 }, 3, 11, 11)).toBe(true); // sanity (3 = énorme) : small était bien sous l’empreinte

    autoCleave(banc.getState, banc.setState, reluDans(banc.getState, E), reluDans(banc.getState, deadPrimary), { cleave: true } as AttackResult);

    const st = banc.getState().battle!;
    const e = st.combatants.find((c) => c.id === E.id)!;
    const s = st.combatants.find((c) => c.id === small.id)!;
    expect(e.pos).toEqual({ x: 10, y: 10 }); // recalé sur la case du mort (l.10)
    expect(occupiesTile(e.pos!, footprintN(e), s.pos!.x, s.pos!.y)).toBe(false); // small dégagé HORS de l’empreinte
  });
});

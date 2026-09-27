import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { trampleTarget, aiCreatureFreeAttacks, runEnemyAI } from './combatFlow';
import { mountMovement } from './mount';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

// ---------------------------------------------------------------------------
// Piétinement — action gratuite à 1 Avantage (LDB 85 - Traits de creature.md l.320-321)
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

describe('trampleTarget — cible de Piétinement (pur)', () => {
  it('renvoie un adversaire adjacent PLUS PETIT et vivant ; pas un égal/lointain/mort', () => {
    const big = at('enemy', 'TROLL', 5, 5, { size: 'grande' });
    const small = at('hero', 'H1', 5, 6, { size: 'moyenne' }); // adjacent, plus petit
    const equal = at('hero', 'H2', 4, 5, { size: 'grande' }); // adjacent mais même Taille
    const far = at('hero', 'H3', 5, 9, { size: 'petite' }); // plus petit mais loin
    const battle = { combatants: [big, small, equal, far] } as unknown as BattleState;
    expect(trampleTarget(battle, big)?.id).toBe('H1');
    expect(trampleTarget(battle, big, 'H2')).toBeUndefined(); // ciblage explicite d'un égal → rien
    expect(trampleTarget(battle, big, 'H3')).toBeUndefined(); // trop loin
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
    // Le Piétinement est une attaque GRATUITE déclenchée par `battleTrample` (pas un mode `action`) :
    // `action: null` = aucun mode actif (le modèle unifié n'arme jamais `action: 'trample'`).
    useGame.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('héros plus grand piétine un adversaire adjacent plus petit (touche, action gratuite)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.advantage = 2;
    const before = E.wounds.current;
    // Modale : battleTrample ouvre SANS tirer ; trampleRoll tire ; trampleConfirm applique (gratuit).
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeTruthy();
    expect(useGame.getState().pendingTrample!.result).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBe(before); // dégâts toujours en attente de résolution
    useGame.getState().trampleRoll();
    expect(useGame.getState().pendingTrample!.result).toBeTruthy();
    useGame.getState().trampleConfirm();
    const st = useGame.getState();
    expect(st.pendingTrample).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before); // touché
    expect(st.battle!.acted).toBe(false); // action GRATUITE : n'a pas consommé l'Action
  });

  it('Coup Critique : le Critique se FOLD dans la cascade du Piétinement (plus de 2ᵉ fenêtre « Conséquences »)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.advantage = 2;
    H.resilience = 2;
    E.wounds = { current: 200, max: 200, base: 200 } as Combatant['wounds']; // survit au Critique (pas de victoire parasite)
    // Le Piétinement OUVRE une cascade de COMBAT dont l'étape 0 est le jet `jet:'trample'` (comme l'attaque).
    useGame.getState().battleTrample(E.id);
    const casc = useGame.getState().pendingCascade!;
    expect(casc.purpose).toBe('combat');
    expect(casc.participants[casc.cursor].jet).toBe('trample');
    // Force un Coup Critique (dé 11 = double, LDB 17 l.68) — déterministe.
    useGame.getState().trampleRoll();
    useGame.getState().trampleForceSuccess();
    useGame.getState().trampleSetForcedRoll(11);
    expect(useGame.getState().pendingTrample!.result!.critical).toBe(true);
    useGame.getState().trampleConfirm();
    const st = useGame.getState();
    expect(st.pendingTrample).toBeNull();
    expect(st.pendingCascade).toBeTruthy(); // la MÊME cascade reste ouverte…
    expect(st.pendingCascade!.purpose).toBe('combat');
    const cur = st.pendingCascade!.participants[st.pendingCascade!.cursor];
    expect(cur.kind).toBe('critical'); // …son curseur est sur l'étape de Coup Critique (affichage inline)
    expect(cur.jet).toBeUndefined(); // étape de conséquence, pas un nouveau jet
  });

  it('coût : un Piétinement raté dépense bien 1 Avantage (CC=1 → échec déterministe)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 1; // rate quasiment à coup sûr
    H.advantage = 2;
    const before = E.wounds.current;
    useGame.getState().battleTrample(E.id);
    useGame.getState().trampleRoll();
    useGame.getState().trampleConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.advantage).toBe(1); // 2 − 1 (coût), pas de +1 (raté)
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBe(before);
  });

  it('refusé sans Avantage : la modale ne s’ouvre pas', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.advantage = 0;
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeNull();
  });

  it('refusé contre une cible de même Taille : la modale ne s’ouvre pas', () => {
    const { H, E } = setup();
    H.size = 'moyenne';
    E.size = 'moyenne';
    H.advantage = 2;
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeNull();
  });

  it('IA : un ennemi plus grand avec de l’Avantage piétine un héros adjacent plus petit (via aiCreatureFreeAttacks, #527)', () => {
    // `aiCreatureFreeAttacks` est le SEUL point de production du Piétinement opportuniste IA — il empile
    // TOUJOURS 'pietinement' en dernière attaque gratuite (combatFlow.ts:3026), Taille/Avantage permettant.
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
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
  });

  // Se cabrer (LDB 85 l.314) : « Pour une Action de Mouvement, la créature peut effectuer une Attaque
  // de Piétinement si elle est plus grande que son adversaire » — SANS le coût d'1 Avantage du
  // Piétinement générique (l.387). Condition de Taille inchangée (`trampleTarget`).
  it('Se cabrer : sans Avantage, la modale s’ouvre quand même (coût payé par l’Action de Mouvement)', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 0;
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeTruthy();
  });

  it('Se cabrer : le Piétinement coûte l’Action de Mouvement (movementUsed plein), PAS l’Avantage', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 2;
    expect(useGame.getState().battle!.movementUsed).toBe(0); // Action de Mouvement encore entière
    useGame.getState().battleTrample(E.id);
    useGame.getState().trampleRoll();
    useGame.getState().trampleConfirm();
    const st = useGame.getState();
    // Le +1 d'une touche réussie (RAW, victoire au Test) COMPENSAIT jusqu'ici la dépense masquée d'1
    // Avantage codée en dur côté trampleConfirm — l'Avantage inchangé ne prouvait PAS l'absence de coût.
    // La preuve réelle du coût « Action de Mouvement » (LDB 85 l.314) est movementUsed porté au plein M.
    expect(st.battle!.movementUsed).toBe(mountMovement(st.battle!, H));
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(3); // 2 − 0 (coût) + 1 (victoire)
  });

  it('Se cabrer + Mouvement DÉJÀ dépensé, mais de l’Avantage : la voie ORDINAIRE s’applique — 1 Avantage DÉBITÉ', () => {
    // #1078 LOT B2 : la fenêtre annonçait « coûte 1 Avantage » et le paiement, qui ne testait que le
    // trait, n'en débitait aucun. Le prédicat PARTAGÉ (`trampleFreeMove`) ferme la voie gratuite dès que
    // l'Action de Mouvement n'est plus entière (trait « Se cabrer », LDB 85 l.314 : « Pour une Action de
    // Mouvement… ») : le coût redevient 1 Avantage (l.320-321), et c'est CE coût qui part.
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 85;
    H.characteristics.force = 45;
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 2;
    const spent = mountMovement(useGame.getState().battle!, H);
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: spent } });
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample, 'la porte s’ouvre : il reste la voie à 1 Avantage').not.toBeNull();
    useGame.getState().trampleRoll();
    useGame.getState().trampleConfirm();
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage, '2 − 1 (coût) + 1 (victoire)').toBe(2);
    expect(st.battle!.movementUsed, 'aucun Mouvement supplémentaire consommé').toBe(spent);
  });

  it('Se cabrer : refusé si l’Action de Mouvement est DÉJÀ dépensée ce Tour (movementUsed > 0, 0 Avantage)', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 0;
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: mountMovement(useGame.getState().battle!, H) } });
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeNull(); // ni Avantage, ni Action de Mouvement disponible
  });

  it('Se cabrer : refusé contre une cible de même Taille — la condition RAW (plus grand) reste posée', () => {
    const { H, E } = setup();
    H.size = 'moyenne';
    E.size = 'moyenne';
    H.traits = [{ id: 'se-cabrer' }] as unknown as Combatant['traits'];
    H.advantage = 0;
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeNull();
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
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before); // aucune attaque tentée
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0);
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
});

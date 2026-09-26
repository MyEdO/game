import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { aiCreatureFreeAttacks, applyGaze, applyChillGrasp, applyWail, resolveRoundBoundary } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

import { areGrappling, setGrapple } from '../engine/grapple';
import type { Combatant } from '../engine/types';
import { resetCadence, setCadence } from '../engine/cadence';

// Attaques GRATUITES de créature (Taille & traits) : Morsure / Attaque caudale / Piétinement,
// chacune 1 Avantage, OPPOSÉE (cible Surprise ici → résolution instantanée), gratuite (LDB 85).
describe('aiCreatureFreeAttacks — attaques gratuites de créature (RAW)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
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
    H.pos = { x: 10, y: 10 }; H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ id: 'surpris', value: 1 }]; // Surpris → ne se défend pas → résolution instantanée
    E.pos = { x: 11, y: 10 }; E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 85; E.characteristics.force = 45;
    useGame.setState({ battle: { ...b, acted: false } });
    return { H, E };
  }

  it('Morsure : touche, dégâts infligés, Action NON consommée (gratuite)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'morsure', value: 14 }]; E.advantage = 1;
    const before = H.wounds.current;
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false); // cible Surprise → instantané, pas de modale
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.acted).toBe(false); // attaque GRATUITE : l'Action n'est pas consommée
    // (sur une touche, le coût −1 Avantage est compensé par le +1 du vainqueur du Test opposé — RAW)
  });

  it('coût : une attaque gratuite RATÉE dépense bien 1 Avantage (CC=1 → échec)', () => {
    useGame.getState().seedRng(2);
    const { E } = setup();
    E.traits = [{ id: 'morsure', value: 14 }]; E.advantage = 2; E.characteristics['capacite-de-combat'] = 1; // rate → pas de +1 du vainqueur
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBeLessThan(2);
  });

  it('Attaque caudale : cible de Taille INFÉRIEURE qui perd des PB → À Terre (LDB 85 l.47)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'attaque-caudale', value: 14 }]; E.advantage = 1;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.id === 'a-terre')).toBe(true);
  });

  it('file priorisée : Morsure (trait) PUIS Piétinement (Taille) résolus, file vidée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'morsure', value: 14 }]; E.advantage = 5;
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.pendingFreeAttacks).toBeUndefined(); // file épuisée
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before); // ≥ 1 attaque a touché
  });

  it('sans Avantage : aucune attaque gratuite, file vidée', () => {
    const { H, E } = setup();
    E.traits = [{ id: 'morsure', value: 14 }]; E.advantage = 0;
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before);
  });

  it('Cornes : Attaque gratuite gagnée en CHARGEANT, sans coût d’Avantage (LDB 85)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'cornes', value: 14 }]; E.advantage = 0; E.chargedThisTurn = true; // a chargé avec 0 Avantage
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
  });

  it('Cornes : sans Charge, aucune Attaque de Cornes (0 Avantage → rien)', () => {
    const { H, E } = setup();
    E.traits = [{ id: 'cornes', value: 14 }]; E.advantage = 0; E.chargedThisTurn = false;
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before);
  });

  it('Souffle (Feu) : zone, Test opposé CT/Esquive → dégâts ignorant les PA + En flammes', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'souffle', value: 14, arg: 'Feu' }]; E.advantage = 2; E.characteristics['capacite-de-tir'] = 85;
    H.characteristics.agilite = 1; H.skills = H.skills.filter((s) => s.id !== 'esquive');
    H.armour = { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 }; // PA ignorés par le Feu
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // 2 − 2 (le Souffle ne gagne pas d'Avantage)
  });

  it('Vomissement : zone (3 Av), dégâts BE+4 + Sonné + corrosion (cuir porté)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'vomissement', value: 0 }]; E.advantage = 3; E.characteristics['capacite-de-tir'] = 85; E.characteristics.endurance = 40; // BE 4 → BE+4 Dégâts
    H.characteristics.agilite = 1; H.skills = H.skills.filter((s) => s.id !== 'esquive');
    // Corrosion = op `damageArmour {material:'cuir'}` (GameOp authoré) : endommage une pièce de CUIR portée
    // (RAW « toute matière » non modélisée → cuir seul). On en équipe une pour l'observer : la pièce
    // PORTÉE encaisse, jamais un décrément direct du champ plat `armour.corps`.
    H.items = [{ uid: 'jaque', name: 'Jaque de cuir', subType: 'cuir-bouilli', kind: 'armor', equipped: true, locs: ['corps'], pa: 2, damageTaken: 0, enc: 1, qualities: [] } as never];
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.wounds.current).toBeLessThan(before); // BE+4 Dégâts infligés
    expect(h.conditions.some((c) => c.id === 'sonne')).toBe(true);
    expect(h.items!.find((i) => i.uid === 'jaque')!.damageTaken).toBe(1); // corrosion : 1 Dégât au cuir
  });

  it('Souffle (Fumée) : la zone s’enfume — Lignes de vue bloquées pendant BE Rounds (RAW)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'souffle', value: 0, arg: 'Fumée' }]; E.advantage = 2; E.characteristics['capacite-de-tir'] = 85; E.characteristics.endurance = 40; // BE 4
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const smoke = (useGame.getState().battle!.zones ?? []).find((z) => z.blocksLoS)!;
    expect(smoke).toBeTruthy();
    expect(smoke.tiles.length).toBeGreaterThan(0);
    expect(smoke.rounds).toBe(4); // durée = Bonus d'Endurance (40 → 4)
    expect(smoke.tiles.some((s) => s.x === H.pos!.x && s.y === H.pos!.y)).toBe(true); // la cible est dans la fumée
  });

  it('Fumée : −1 Round par frontière de Round, dissipation à 0', () => {
    setup();
    const b0 = useGame.getState().battle!;
    useGame.setState({ battle: { ...b0, zones: [{ label: 'Fumée', tiles: [{ x: 5, y: 5 }], rounds: 2, blocksLoS: true }] } });
    resolveRoundBoundary(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.zones).toEqual([{ label: 'Fumée', tiles: [{ x: 5, y: 5 }], rounds: 1, blocksLoS: true }]);
    resolveRoundBoundary(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.zones ?? []).toEqual([]); // épuisée → dissipée
  });

  it('Regard pétrifiant : dépense tout l’Avantage, marge ≥ 6 DR → cible Pétrifiée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'regard-petrifiant' }]; E.advantage = 6; E.characteristics['capacite-de-tir'] = 90; // +6 DR d'Avantage + CT élevée
    H.characteristics.initiative = 1; H.skills = H.skills.filter((s) => s.id !== 'initiative');
    const acted = applyGaze(useGame.getState, useGame.setState, E);
    expect(acted).toBe(true);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.id === 'Pétrifié') || h.wounds.current === 0).toBe(true);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // tout dépensé
  });

  it('Étreinte glaciale : 2 Avantages, succès → 1d10+DR Blessures ignorant BE et PA', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'etreinte-glaciale' }]; E.advantage = 2; E.characteristics['capacite-de-combat'] = 90;
    H.armour = { tete: 6, brasG: 6, brasD: 6, corps: 6, jambeG: 6, jambeD: 6 }; // PA ignorés
    const before = H.wounds.current;
    const acted = applyChillGrasp(useGame.getState, useGame.setState, E);
    expect(acted).toBe(true);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // 2 − 2
  });

  it('« 8 Tentacules +9 » : 8 Attaques gratuites à coût 0, Empêtré sur Dégâts, Avantage non consommé (LDB 85 l.405)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'tentacules', count: 8, value: 9 }]; E.advantage = 0; E.characteristics['capacite-de-combat'] = 95; // coût 0 : pas besoin d'Avantage
    const before = H.wounds.current;
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false); // cible Surprise → résolution instantanée
    const st = useGame.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(before - h.wounds.current).toBeGreaterThan(20); // ≥ plusieurs touches à +9 : bien 8 attaques, pas 1
    expect(h.conditions.some((c) => c.id === 'empetre')).toBe(true); // « Si elle cause des Dégâts … Empêtré »
    expect(st.battle!.acted).toBe(false); // gratuites : l'Action n'est pas consommée
  });

  it('Constricteur : toute touche → Empêtré + PRISE d’Empoignade établie ; Vampirique : la Morsure soigne', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'morsure', value: 14 }, { id: 'constricteur' }, { id: 'vampirique' }]; E.advantage = 1;
    E.wounds = { current: 10, max: 40, base: 40 } as Combatant['wounds']; // blessé → peut se soigner
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    const hLive = st.battle!.combatants.find((c) => c.id === H.id)!;
    const eLive = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(hLive.conditions.some((c) => c.id === 'empetre')).toBe(true);
    expect(areGrappling(eLive, hLive)).toBe(true); // `grapple:true` : la touche établit la PRISE (LDB 14 l.159 — l'IA la travaille ensuite, LOT B)
    expect(eLive.wounds.current).toBeGreaterThan(10); // drainé (Vampirique)
  });

  it('Hurlement fantomatique : zone vivante, 1d10 ignore BE+PA + 3 Assourdi, dépense tous les Av', () => {
    setCadence('auto'); // le Test de Résistance enfoui (Lot 4a) du héros passif se résout INLINE comme un monstre (pas de cascade joueur)
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'hurlement-fantomatique' }]; E.advantage = 4; E.characteristics.initiative = 40;
    H.armour = { tete: 6, brasG: 6, brasD: 6, corps: 6, jambeG: 6, jambeD: 6 }; // PA ignorés
    const before = H.wounds.current;
    const acted = applyWail(useGame.getState, useGame.setState, E);
    expect(acted).toBe(true);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.conditions.filter((c) => c.id === 'assourdi').length >= 1).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // tous les Avantages dépensés
  });

  it('Venin : Morsure venimeuse sur PB → Test de Résistance raté → Empoisonné (LDB 85 l.326)', () => {
    setCadence('auto'); // le Test de Résistance enfoui (Lot 4a) du héros passif se résout INLINE comme un monstre (pas de cascade joueur)
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'morsure', value: 14 }, { id: 'venin', arg: 'Intermédiaire' }]; E.advantage = 1;
    H.characteristics.endurance = 1; // Endurance minime → Résistance ratée quasi à coup sûr
    H.skills = H.skills.filter((s) => s.id !== 'resistance');
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.id === 'empoisonne')).toBe(true);
  });

  // ── Tentacules / Langue préhensile : entame & résolution d'Empoignade (LDB 85 l.405/213) ──
  it('Tentacules : une touche établit la PRISE d’Empoignade (grapple:true, « entame une Empoignade avec ce tentacule »)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'tentacules', count: 1, value: 9 }]; E.advantage = 0; E.characteristics['capacite-de-combat'] = 95; // coût 0
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    const hLive = st.battle!.combatants.find((c) => c.id === H.id)!;
    const eLive = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(hLive.conditions.some((c) => c.id === 'empetre')).toBe(true);
    expect(areGrappling(eLive, hLive)).toBe(true); // la touche entame l'Empoignade
  });

  it('Langue préhensile : touche une proie plus PETITE → Empêtré, PRISE établie, proie ENTRAÎNÉE vers la créature', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'langue-prehensile', value: 9 }]; E.advantage = 2; E.characteristics['capacite-de-tir'] = 95; // 1 Av, touche
    E.pos = { x: 10, y: 10 }; E.size = 'grande';
    H.pos = { x: 14, y: 10 }; H.size = 'moyenne';
    H.characteristics.agilite = 1; H.skills = H.skills.filter((s) => s.id !== 'esquive'); // ne peut esquiver
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    const hLive = st.battle!.combatants.find((c) => c.id === H.id)!;
    const eLive = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(hLive.conditions.some((c) => c.id === 'empetre')).toBe(true);
    expect(areGrappling(eLive, hLive)).toBe(true); // « conserver la cible enroulée … démarrage d'une Empoignade »
    expect(hLive.pos!.x).toBeLessThan(14); // « il est entraîné vers la créature » (Taille inférieure)
  });

  it('Empoignade tenue par un Tentacule : résolue en Attaque GRATUITE (Test opposé de Force), Action NON consommée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = [{ id: 'tentacules', count: 1, value: 9 }]; E.advantage = 0;
    E.characteristics['capacite-de-combat'] = 1; E.characteristics.force = 90; // le tentacule RATE (CC 1) → seuls les Dégâts d'Empoignade comptent ; Force écrasante
    H.characteristics.force = 1; // la proie perd le Test opposé de Force
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    setGrapple(E, H); // prise déjà établie (tour précédent)
    const before = H.wounds.current;
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false);
    const st = useGame.getState();
    expect(st.battle!.acted).toBe(false); // résolution GRATUITE : la créature CONSERVE son Action (PAS verrouillée)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before); // Dégâts d'Empoignade (BF+DR, PA ignorés)
    expect(st.battle!.log.some((l) => l.text.includes('écrase'))).toBe(true); // ligne du Test opposé GAGNÉ
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { firedWeapon, availableAttacks } from './combatFlow';
import { setContact, areInContact } from '../engine/engagement';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';

// Au Contact (Issue #42.5, LDB 62 l.176, Option « Longueur d'arme », règle `combat-weapon-reach`).

const longWeapon: Weapon = { label: 'Pertuisane', type: 'melee', reach: 'Longue', damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'empaleuse' }] };
const dagger: Weapon = { label: 'Dague', type: 'melee', reach: 'Courte', damage: { plusBF: true, flat: 1 }, qualities: [] };
const simpleWeapon: Weapon = { label: 'Arme simple', type: 'melee', reach: 'Moyenne', damage: { plusBF: true, flat: 4 }, qualities: [] };

describe('Au Contact — store + funnel (LDB 62 l.176)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingAuContact: null, battle: null });
    setRule('combat-weapon-reach', true);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    resetRule('combat-weapon-reach');
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
    return { H, enemies };
  }

  /** Engage H avec `foes`, lui donne une arme Longue, place le tour sur H, Action libre. */
  function engageAndActivate(H: Combatant, foes: Combatant[]) {
    H.engagedWith = foes.map((f) => f.id);
    H.weapons = [longWeapon];
    for (const f of foes) f.engagedWith = [H.id];
    const b = useGame.getState().battle!;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
  }

  const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

  it('availableAttacks expose « Au contact » (règle ON, foe Engagé, allonge pertinente)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);
    const opts = availableAttacks(live(H.id), useGame.getState().battle!);
    expect(opts.some((o) => o.id === 'aucontact' && o.targeting === 'aucontact')).toBe(true);
  });

  it('règle OFF → pas d’option « Au contact »', () => {
    resetRule('combat-weapon-reach');
    const { H, enemies } = setup();
    engageAndActivate(H, [enemies[0]]);
    const opts = availableAttacks(live(H.id), useGame.getState().battle!);
    expect(opts.some((o) => o.id === 'aucontact')).toBe(false);
  });

  it('battleAuContact ouvre le pending ; le vainqueur HÉROS choisit « au contact » → état posé + Action consommée', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);

    useGame.getState().battleAuContact(E.id);
    let pd = useGame.getState().pendingAuContact;
    expect(pd?.phase).toBe('roll');
    expect(pd?.atk).not.toBeNull(); // jet du foe FIGÉ d'avance

    useGame.getState().auContactRoll();
    pd = useGame.getState().pendingAuContact!;
    expect(pd.def).not.toBeNull();
    expect(pd.result).not.toBeNull();

    // Force l'issue « le mover l'emporte » (déterminisme), puis le héros tranche.
    useGame.setState({ pendingAuContact: { ...pd, result: 'success' } });
    useGame.getState().auContactConfirm();
    expect(useGame.getState().pendingAuContact?.phase).toBe('choice');
    useGame.getState().auContactChoose('contact');

    const st = useGame.getState();
    expect(st.pendingAuContact).toBeNull();
    expect(areInContact(live(H.id), live(E.id))).toBe(true);
    expect(st.battle!.acted).toBe(true); // le Test opposé EST l'Action
  });

  it('le héros vainqueur choisit « combat normal » → le contact est retiré (statu quo) + Action consommée', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);
    setContact(live(H.id), live(E.id)); // déjà au contact

    useGame.getState().battleAuContact(E.id);
    const pd = useGame.getState().pendingAuContact!;
    useGame.setState({ pendingAuContact: { ...pd, def: pd.atk, result: 'success' } });
    useGame.getState().auContactConfirm();
    useGame.getState().auContactChoose('normal');

    expect(areInContact(live(H.id), live(E.id))).toBe(false);
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('foe (IA) vainqueur tranche par heuristique : son arme plus COURTE → au contact', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]); // H a une arme Longue
    live(E.id).weapons = [dagger]; // foe : arme Courte → il gagne à passer au contact

    useGame.getState().battleAuContact(E.id);
    const pd = useGame.getState().pendingAuContact!;
    useGame.setState({ pendingAuContact: { ...pd, def: pd.atk, result: 'failure' } }); // le foe l'emporte
    useGame.getState().auContactConfirm(); // pas de phase de choix montrée — l'IA tranche

    expect(useGame.getState().pendingAuContact).toBeNull();
    expect(areInContact(live(H.id), live(E.id))).toBe(true);
  });

  // Sans arme de mêlée, on frappe à Mains nues : Allonge « Personnelle » (LDB 62 l.28 et l.158), la plus
  // COURTE de l'échelle (l.156). Le foe désarmé a donc tout à gagner à entrer dans l'allonge adverse.
  it('foe (IA) vainqueur SANS arme de mêlée (Mains nues, Personnelle) face à une arme Moyenne → au contact', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);
    live(H.id).weapons = [simpleWeapon]; // H : Allonge Moyenne
    live(E.id).weapons = []; // foe : aucune arme de mêlée → Mains nues, Personnelle

    useGame.getState().battleAuContact(E.id);
    const pd = useGame.getState().pendingAuContact!;
    useGame.setState({ pendingAuContact: { ...pd, def: pd.atk, result: 'failure' } }); // le foe l'emporte
    useGame.getState().auContactConfirm();

    expect(areInContact(live(H.id), live(E.id))).toBe(true);
  });

  it('deux combattants au contact : firedWeapon d’une arme Longue tombe au profil improvisé (via le funnel)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    engageAndActivate(H, [E]);
    const h = live(H.id), e = live(E.id);
    h.pos = { x: 5, y: 5 };
    e.pos = { x: 6, y: 5 }; // adjacents (mêlée)

    // Sans contact : l'arme Longue garde son profil.
    expect(firedWeapon(h, e).damage).toEqual(longWeapon.damage);

    setContact(h, e);
    const fired = firedWeapon(h, e);
    expect(fired.damage).toEqual({ plusBF: true, flat: 1 }); // improvisée
    expect(fired.qualities).toEqual([{ id: 'inoffensive' }]);
  });
});

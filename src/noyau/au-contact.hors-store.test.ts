import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { firedWeapon } from './combatFlow';
import { availableAttacks } from './combatManeuvers';
import { setContact, areInContact } from '../engine/engagement';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Au Contact (Issue #42.5, LDB 62 l.176, Option « Longueur d'arme », règle `combat-longueur-arme`).

const longWeapon: Weapon = { label: 'Pertuisane', type: 'melee', reach: 'Longue', damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'empaleuse' }] };
const dagger: Weapon = { label: 'Dague', type: 'melee', reach: 'Courte', damage: { plusBF: true, flat: 1 }, qualities: [] };
const simpleWeapon: Weapon = { label: 'Arme simple', type: 'melee', reach: 'Moyenne', damage: { plusBF: true, flat: 4 }, qualities: [] };

describe('Au Contact — store + funnel (LDB 62 l.176)', () => {
  beforeEach(() => {
    setRule('combat-longueur-arme', true);
  });

  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    return { H, enemies };
  }

  /** Engage H avec `foes`, lui donne une arme Longue, place le tour sur H, Action libre. */
  function engageAndActivate(H: Combatant, foes: Combatant[]) {
    H.engagedWith = foes.map((f) => f.id);
    H.weapons = [longWeapon];
    for (const f of foes) f.engagedWith = [H.id];
    const b = banc.getState().battle!;
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
  }

  const live = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

  it('availableAttacks expose « Au contact » (règle ON, foe Engagé, allonge pertinente)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);
    const opts = availableAttacks(live(H.id), banc.getState().battle!);
    expect(opts.some((o) => o.id === 'aucontact' && o.targeting === 'aucontact')).toBe(true);
  });

  it('règle OFF → pas d’option « Au contact »', () => {
    resetRule('combat-longueur-arme');
    const { H, enemies } = setup();
    engageAndActivate(H, [enemies[0]]);
    const opts = availableAttacks(live(H.id), banc.getState().battle!);
    expect(opts.some((o) => o.id === 'aucontact')).toBe(false);
  });

  it('ouvrirLAuContact ouvre le pending ; le vainqueur HÉROS choisit « au contact » → état posé + Action consommée', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);

    banc.getState().ouvrirLAuContact(E.id);
    let pd = banc.getState().pendingAuContact;
    expect(pd?.phase).toBe('jet');
    expect(pd?.atk).not.toBeNull(); // jet du foe FIGÉ d'avance

    banc.getState().jetLancer('auContact');
    pd = banc.getState().pendingAuContact!;
    expect(pd.def).not.toBeNull();
    expect(pd.result).not.toBeNull();

    // Force l'issue « le mover l'emporte » (déterminisme), puis le héros tranche.
    banc.setState({ pendingAuContact: { ...pd, result: 'reussite' } });
    banc.getState().jetValider('auContact');
    expect(banc.getState().pendingAuContact?.phase).toBe('choix');
    banc.getState().jetRegler('auContact', 'issue', 'contact');

    const st = banc.getState();
    expect(st.pendingAuContact).toBeNull();
    expect(areInContact(live(H.id), live(E.id))).toBe(true);
    expect(st.battle!.acted).toBe(true); // le Test opposé EST l'Action
  });

  /** LDB 62 l.176 : le Test opposé EST l'Action — avant le jet on y renonce sans coût, après il se joue. */
  it('renoncer avant le jet ferme la fenêtre sans rien consommer ; après le jet, le refus est dit et rien ne bouge', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);
    banc.getState().ouvrirLAuContact(E.id);
    banc.getState().jetAnnuler('auContact');
    expect(banc.getState().pendingAuContact).toBeNull();
    expect(banc.getState().battle!.acted).toBe(false);

    banc.getState().ouvrirLAuContact(E.id);
    banc.getState().jetLancer('auContact');
    const lance = banc.getState().pendingAuContact;
    expect(lance?.result).toBeTruthy();
    banc.getState().jetAnnuler('auContact');
    expect(banc.getState().pendingAuContact).toBe(lance);
    expect(banc.getState().refus?.texte).toBe(`Renoncement refusé : ${H.label} a déjà engagé son action, elle se joue jusqu’au bout.`);
  });

  it('le héros vainqueur choisit « combat normal » → le contact est retiré (statu quo) + Action consommée', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]);
    setContact(live(H.id), live(E.id)); // déjà au contact

    banc.getState().ouvrirLAuContact(E.id);
    const pd = banc.getState().pendingAuContact!;
    banc.setState({ pendingAuContact: { ...pd, def: pd.atk, result: 'reussite' } });
    banc.getState().jetValider('auContact');
    banc.getState().jetRegler('auContact', 'issue', 'normal');

    expect(areInContact(live(H.id), live(E.id))).toBe(false);
    expect(banc.getState().battle!.acted).toBe(true);
  });

  it('foe (IA) vainqueur tranche par heuristique : son arme plus COURTE → au contact', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    engageAndActivate(H, [E]); // H a une arme Longue
    live(E.id).weapons = [dagger]; // foe : arme Courte → il gagne à passer au contact

    banc.getState().ouvrirLAuContact(E.id);
    const pd = banc.getState().pendingAuContact!;
    banc.setState({ pendingAuContact: { ...pd, def: pd.atk, result: 'echec' } }); // le foe l'emporte
    banc.getState().jetValider('auContact'); // pas de phase de choix montrée — l'IA tranche

    expect(banc.getState().pendingAuContact).toBeNull();
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

    banc.getState().ouvrirLAuContact(E.id);
    const pd = banc.getState().pendingAuContact!;
    banc.setState({ pendingAuContact: { ...pd, def: pd.atk, result: 'echec' } }); // le foe l'emporte
    banc.getState().jetValider('auContact');

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

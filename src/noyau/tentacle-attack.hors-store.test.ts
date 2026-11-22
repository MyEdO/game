import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { availableAttacks } from './combatManeuvers';
import { createHero } from '../engine/character';
import { recomputeLoadout, damageString } from '../engine/items';
import { attachMutation } from '../engine/corruption';
import { rollMutation } from '../data/mutations';
import { hasCondition } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import { deFixe, desDuTest } from '../engine/dice.testkit';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';
import { armeDeLaGratuite, attackWeaponOf } from './combatFlow';
import { spawnEnemy, statblockToCombatant } from './monde/spawn';
import { findTrappingById } from '../data/index';
import { forceDuPorteur } from '../engine/characteristics';
import { effectiveWeaponDamage } from '../engine/weaponDamage';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// ---------------------------------------------------------------------------
// Tentacule épais (LDB 19) → trait Tentacules (LDB 85 l.405) : arme naturelle +
// Attaque GRATUITE 1/tour (Empêtré sur Dégâts). Cornes asymétriques → Arme de
// Créature (Dégâts = Bonus de Force, LDB 85 l.35).
// ---------------------------------------------------------------------------

const mutTentacule = () => rollMutation('physique', deFixe(38)); // Tentacule épais
const mutCornes = () => rollMutation('physique', deFixe(83)); // Cornes asymétriques

describe('armes naturelles de mutation (recomputeLoadout)', () => {
  it('trait Tentacules → arme Tentacule (+BF) ; Cornes asymétriques → arme Cornes (+BF)', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    attachMutation(hero, mutTentacule(), desDuTest);
    attachMutation(hero, mutCornes(), desDuTest);
    recomputeLoadout(hero);
    const t = hero.weapons.find((w) => w.source?.kind === 'trait' && w.source.id === 'tentacules');
    expect(t?.label).toBe('Tentacule');
    expect(damageString(t!.damage)).toBe('+BF');
    expect(t?.attackKind).toBe('tentacules'); // routage pose/anim (maniementDe) — porté par l'op grantNaturalWeapon
    expect(t?.subType).toBe('base');
    const c = hero.weapons.find((w) => w.label === 'Cornes'); // arme dérivée de mutation (derivedWeapon)
    expect(c?.label).toBe('Cornes');
    expect(damageString(c!.damage)).toBe('+BF');
  });

  it('sans mutation : aucune arme naturelle dérivée', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    recomputeLoadout(hero);
    expect(hero.weapons.some((w) => w.natural)).toBe(false);
  });
});

describe('Attaque gratuite de Tentacule (store)', () => {
  function setup(withTentacle = true) {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = blessuresDeBase(30, 30, E);
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    if (withTentacle) {
      attachMutation(H, mutTentacule(), desDuTest);
      recomputeLoadout(H);
    }
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('frappe gratuite : modale standard, Action préservée, 1/tour, Empêtré sur Dégâts', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.characteristics['capacite-de-combat'] = 95;
    H.characteristics.force = 45;
    const before = E.wounds.current;
    expect(availableAttacks(banc.getState().scene, H, banc.getState().battle!)
      .filter((o) => o.kind === 'tentacules').map((o) => o.id)).toEqual(['tentacule']);
    const armeImplicite = armeDeLaGratuite(H, 'tentacules')!;
    expect(effectiveWeaponDamage(armeImplicite, forceDuPorteur(H))).toBe(4);
    H.characteristics.force = 55;
    expect(effectiveWeaponDamage(armeImplicite, forceDuPorteur(H))).toBe(5);
    H.characteristics.force = 45;
    // Chemin d'attaque UNIFIÉ : on arme l'attaque Tentacule puis on clique l'ennemi (adjacent → frappe directe).
    banc.getState().armerLAttaque('tentacule');
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
    const pa = banc.getState().pendingAttack;
    expect(pa?.freeKind).toBe('tentacules');
    expect(pa?.weaponUid).toBe(H.weapons.find((w) => w.attackKind === 'tentacules')?.uid);
    expect(pa?.result).toBeNull(); // rien n'est tiré avant Lancer
    banc.getState().jetLancer('attaque');
    expect(banc.getState().pendingAttack?.result).toBeTruthy();
    banc.getState().jetValider('attaque');
    const st = banc.getState();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    const h2 = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.acted).toBe(false); // GRATUITE : l'Action reste disponible
    expect(h2.freeAttacksThisTurn?.tentacules).toBe(1); // consommée pour ce tour (compteur 1/tour)
    expect(e2.wounds.current).toBeLessThan(before); // CC 95 vs Mutant : touche déterministe (seed 2)
    expect(hasCondition(e2, 'empetre')).toBe(true); // LDB 85 l.405 : Dégâts → Empêtré (État keyé par id stable)
    // 2ᵉ tentative le même tour : la mutation Tentacule n'est PLUS dans la liste d'attaques (1/tour).
    expect(availableAttacks(banc.getState().scene, h2, st.battle!).filter((o) => o.kind === 'tentacules')).toEqual([]);
  });

  it.each([false, true])('Pieuvre des tourbières, un seul accès à ses huit attaques à +9 (objet équipé %s)', (avecObjet) => {
    const { H } = setup(false);
    const { scene, battle } = banc.getState();
    const pieuvre = spawnEnemy(
      { ref: 'pieuvre-des-tourbieres' }, 'pieuvre', { x: 11, y: 10 },
      avecObjet ? { inventaire: { dague: true } } : undefined,
    );
    expect(pieuvre.items?.map((i) => i.trappingId) ?? []).toEqual(avecObjet ? ['dague'] : []);
    const rencontre = { ...battle!, combatants: [H, pieuvre] };
    const options = () => availableAttacks(scene, pieuvre, rencontre).filter((o) => o.kind === 'tentacules');
    const offres = options();
    expect(offres).toMatchObject([{ id: 'tentacules', freeKind: 'tentacules', cost: { action: false, advantage: 0 } }]);
    const [offre] = offres;
    expect(armeDeLaGratuite(pieuvre, offre.freeKind!, offre.weaponUid)).toBeNull();
    const arme = attackWeaponOf(findTrappingById, scene, rencontre, pieuvre, H, {
      attackerId: pieuvre.id, targetId: H.id, location: null, result: null, freeKind: offre.freeKind, weaponUid: offre.weaponUid,
    });
    expect(arme.damage).toEqual({ flat: 9, plusBF: false, bfInclus: true });

    pieuvre.freeAttacksThisTurn = { tentacules: 7 };
    expect(options().map((o) => o.id)).toEqual(['tentacules']);
    pieuvre.freeAttacksThisTurn = { tentacules: 8 };
    expect(options()).toEqual([]);
  });

  it('après une gratuite, le second Trait garde son Indice si son compte permet encore une attaque', () => {
    const { H } = setup(false);
    const { scene, battle } = banc.getState();
    const double = statblockToCombatant({
      type: 'statblock', label: 'Deux Traits Tentacules', char: {},
      traits: [{ id: 'tentacules', count: 1, value: 6 }, { id: 'tentacules', count: 8, value: 9 }],
    }, 'tentacules-doubles', { x: 11, y: 10 });
    const rencontre = { ...battle!, combatants: [H, double] };
    double.freeAttacksThisTurn = { tentacules: 1 };
    const offres = availableAttacks(scene, double, rencontre).filter((o) => o.kind === 'tentacules');
    expect(offres.map((o) => o.id)).toEqual(['tentacules~2']);
    const [offre] = offres;
    const arme = attackWeaponOf(findTrappingById, scene, rencontre, double, H, {
      attackerId: double.id, targetId: H.id, location: null, result: null, freeKind: offre.freeKind, weaponUid: offre.weaponUid,
    });
    expect(arme.uid).toBe(double.traits?.[1].uid);
    expect(arme.damage).toEqual({ flat: 9, plusBF: false, bfInclus: true });
  });

  it('absente de la liste d\'attaques sans le trait Tentacules', () => {
    const { H } = setup(false);
    expect(availableAttacks(banc.getState().scene, H, banc.getState().battle!).some((o) => o.id === 'tentacule')).toBe(false);
  });

  it('cible distante : la mutation Tentacule CHARGE puis frappe (approche-puis-frappe)', () => {
    const { E } = setup();
    E.pos = { x: 14, y: 10 }; // hors d'Allonge → l'attaque de mêlée s'approche (charge) au lieu de refuser
    banc.getState().armerLAttaque('tentacule');
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
    banc.reprendreLesEnAttente(); // joue le glissé d'approche (charge) → ouvre la frappe
    const pa = banc.getState().pendingAttack;
    expect(pa?.freeKind).toBe('tentacules');
    expect(pa?.fromCharge).toBe(true); // s'est ruée au contact
  });
});

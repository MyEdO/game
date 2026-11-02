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
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    attachMutation(hero, mutTentacule(), desDuTest);
    attachMutation(hero, mutCornes(), desDuTest);
    recomputeLoadout(hero);
    const t = hero.weapons.find((w) => w.uid === 'nat-tentacule');
    expect(t?.label).toBe('Tentacule');
    expect(damageString(t!.damage)).toBe('+BF');
    expect(t?.attackKind).toBe('tentacules'); // routage pose/anim (maniementDe) — porté par l'op grantNaturalWeapon
    expect(t?.subType).toBe('base');
    const c = hero.weapons.find((w) => w.label === 'Cornes'); // arme dérivée de mutation (derivedWeapon)
    expect(c?.label).toBe('Cornes');
    expect(damageString(c!.damage)).toBe('+BF');
  });

  it('sans mutation : aucune arme naturelle dérivée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    recomputeLoadout(hero);
    expect(hero.weapons.some((w) => w.uid === 'nat-tentacule' || w.label === 'Cornes')).toBe(false);
  });
});

describe('Attaque gratuite de Tentacule (store)', () => {
  function setup(withTentacle = true) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
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
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.characteristics['capacite-de-combat'] = 95;
    H.characteristics.force = 45;
    const before = E.wounds.current;
    // Chemin d'attaque UNIFIÉ : on arme l'attaque Tentacule puis on clique l'ennemi (adjacent → frappe directe).
    banc.getState().battleSelectAttack('tentacule');
    banc.getState().battleClickEntity(E.id, { confirm: true });
    const pa = banc.getState().pendingAttack;
    expect(pa?.freeKind).toBe('tentacules');
    expect(pa?.weaponUid).toBe('nat-tentacule');
    expect(pa?.result).toBeNull(); // rien n'est tiré avant Lancer
    banc.getState().attackRoll();
    expect(banc.getState().pendingAttack?.result).toBeTruthy();
    banc.getState().attackConfirm();
    const st = banc.getState();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    const h2 = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.acted).toBe(false); // GRATUITE : l'Action reste disponible
    expect(h2.freeAttacksThisTurn?.tentacules).toBe(1); // consommée pour ce tour (compteur 1/tour)
    expect(e2.wounds.current).toBeLessThan(before); // CC 95 vs Mutant : touche déterministe (seed 2)
    expect(hasCondition(e2, 'empetre')).toBe(true); // LDB 85 l.405 : Dégâts → Empêtré (État keyé par id stable)
    // 2ᵉ tentative le même tour : la mutation Tentacule n'est PLUS dans la liste d'attaques (1/tour).
    expect(availableAttacks(h2, st.battle!).some((o) => o.id === 'tentacule')).toBe(false);
  });

  it('absente de la liste d\'attaques sans le trait Tentacules', () => {
    const { H } = setup(false);
    expect(availableAttacks(H, banc.getState().battle!).some((o) => o.id === 'tentacule')).toBe(false);
  });

  it('cible distante : la mutation Tentacule CHARGE puis frappe (approche-puis-frappe)', () => {
    const { E } = setup();
    E.pos = { x: 14, y: 10 }; // hors d'Allonge → l'attaque de mêlée s'approche (charge) au lieu de refuser
    banc.getState().battleSelectAttack('tentacule');
    banc.getState().battleClickEntity(E.id, { confirm: true });
    banc.reprendreLesEnAttente(); // joue le glissé d'approche (charge) → ouvre la frappe
    const pa = banc.getState().pendingAttack;
    expect(pa?.freeKind).toBe('tentacules');
    expect(pa?.fromCharge).toBe(true); // s'est ruée au contact
  });
});

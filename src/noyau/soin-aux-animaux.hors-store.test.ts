/**
 * Soin aux animaux (#4804, lot C3) : le Test qui soigne un animal (Groupe `animaux`). LDB 09 l.521-528 ; LDB 09 l.535
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { createHero } from '../engine/character';
import { projeterLaBete } from './monde/spawn';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { garanti } from '../lib/garanti';
import { estUnAnimal, refusDuTestDeSoin, soinDOuverture, stopBleedOutcome } from '../engine/healing';
import type { Combatant } from '../engine/types';

const soigneur = (skills: string[]): Combatant => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'S', seed: 2 });
  h.skills = [...h.skills.filter((s) => s.id !== 'guerison' && s.id !== 'soin-aux-animaux'), ...skills.map((id) => ({ id, characteristic: 'intelligence' as const, advances: 10 }))];
  return h;
};
const bete = (id: string) => projeterLaBete({ uid: `pos-${id}`, nature: 'bete', ownerId: 'h', location: { kind: 'avec-le-groupe' }, items: [], ref: { id } }, undefined);
const homme = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'P', seed: 4 });

describe('Soin aux animaux (LDB 09 l.521-528)', () => {
  it('le chien, la mule et le cheval sont des animaux ; un humain n’en est pas un (Groupe `animaux`, LDB 09 l.535)', () => {
    expect([bete('chien'), bete('mule'), bete('cheval'), homme()].map(estUnAnimal)).toEqual([true, true, true, false]);
  });

  it('un soigneur à Soin aux animaux sans Guérison ouvre le soin d’un animal par Soin aux animaux, Blessures comme Hémorragie', () => {
    const s = soigneur(['soin-aux-animaux']);
    expect(soinDOuverture(s, 'blessures', bete('chien'))?.test).toBe('soin-aux-animaux');
    expect(soinDOuverture(s, 'hemorragie', bete('chien'))?.test).toBe('soin-aux-animaux');
  });

  it('Soin aux animaux est refusé sur un humain, hors des deux actes, et sans la Compétence', () => {
    const chien = bete('chien');
    expect(refusDuTestDeSoin(soigneur(['soin-aux-animaux']), 'blessures', { test: 'soin-aux-animaux', bandages: false }, homme())).not.toBeNull();
    expect(refusDuTestDeSoin(soigneur(['soin-aux-animaux']), 'munition', { test: 'soin-aux-animaux', bandages: false }, chien)).not.toBeNull();
    expect(refusDuTestDeSoin(soigneur([]), 'blessures', { test: 'soin-aux-animaux', bandages: false }, chien)).not.toBeNull();
    expect(refusDuTestDeSoin(null, 'blessures', { test: 'soin-aux-animaux', bandages: false }, chien)).not.toBeNull();
  });

  it('il stoppe UN État Hémorragique, quel que soit le DR (l.528) ; la Guérison en retire un par DR (l.261)', () => {
    expect(stopBleedOutcome(3, 4, true, { test: 'soin-aux-animaux', bandages: false })).toBe(1);
    expect(stopBleedOutcome(3, 4, true, { test: 'guerison', bandages: false })).toBe(4);
  });
});

describe('Soin aux animaux au noyau : le chien compagnon soigné en combat', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });
  const doc = (): Combatant => ({ ...soigneur(['soin-aux-animaux']), id: 'doc', pos: { x: 1, y: 1 } });
  const chien = (blessures: number): Combatant => {
    const c = projeterLaBete({ uid: 'pos-chien', nature: 'bete', ownerId: 'doc', location: { kind: 'avec-le-groupe' }, items: [], ref: { id: 'chien' } }, { x: 2, y: 1 });
    c.wounds.current = blessures;
    return c;
  };
  function combat(allies: Combatant[]) {
    const gob = { ...homme(), id: 'gob', kind: 'ennemi', pos: { x: 9, y: 9 } } as Combatant;
    const combatants = [...allies, gob];
    const order = combatants.map((c) => c.id);
    banc.setState({ mode: 'battle', pendingHeal: null, battle: { combatants, order, baseOrder: order, turn: 0, round: 1, action: 'soins', selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false, log: [], over: null } as never });
  }
  const enCombat = (id: string) => garanti(banc.getState().battle?.combatants.find((c) => c.id === id), id, 'combattant');
  function soigne(patientId: string, success: boolean, sl: number) {
    banc.getState().ouvrirLaGuerison(patientId);
    banc.getState().jetLancer('soins');
    const ph = garanti(banc.getState().pendingHeal, patientId, 'soin');
    banc.setState({ pendingHeal: { ...ph, roll: success ? 10 : 99, success, sl } });
    const intBonus = garanti(banc.getState().pendingHeal, patientId, 'soin').intBonus;
    banc.getState().jetValider('soins');
    return { test: ph.test, intBonus };
  }

  it('l’ouverture choisit Soin aux animaux, le succès rend BI+DR et consomme le soin de la rencontre (l.527)', () => {
    combat([doc(), chien(1)]);
    const { test, intBonus } = soigne('pos-chien', true, 1);
    expect(test).toBe('soin-aux-animaux');
    const c = enCombat('pos-chien');
    expect(c.wounds.current).toBe(Math.min(c.wounds.max, 1 + intBonus + 1));
    expect(c.soinRencontreUtilise).toBe(true);
  });

  it('un Échec Stupéfiant ne blesse pas l’animal et ne l’infecte pas : ces effets sont ceux de la Guérison (l.262)', () => {
    combat([doc(), chien(1)]);
    soigne('pos-chien', false, -7);
    const c = enCombat('pos-chien');
    expect([c.wounds.current, (c.diseases ?? []).length]).toEqual([1, 0]);
  });

  it('un soigneur qui n’a que Soin aux animaux n’ouvre aucun soin sur un humain', () => {
    const al = { ...homme(), id: 'al', pos: { x: 2, y: 1 } } as Combatant;
    al.wounds.current = 2;
    combat([doc(), al]);
    banc.getState().ouvrirLaGuerison('al');
    expect(banc.getState().pendingHeal).toBeNull();
  });
});

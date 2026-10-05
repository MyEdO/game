import { describe, it, expect } from 'vitest';
import { isShieldItem, isShieldTrapping, itemFromTrappingById, weaponFromItem } from '../../../engine/items';
import { shieldAdvantageLevel } from '../../../engine/combatFeatures/dispatch';
import { conjureFormOptions } from '../../../engine/conjuredWeapons';
import type { Combatant } from '../../../engine/types';
import { trappings } from '../../../data';
import { armePrincipale, equipDe, formeResolue } from './equipment';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { rigDefenseDef } from '../anim/actorAnimSelect';

// LDB 62 l.33-35 ; AA 08 l.156 ; ZI 13 l.911
const BOUCLIERS = ['bouclier', 'bouclier-grand', 'bouclier-targe', 'pavois', 'vision-de-vie'];
// AA 08 l.290 ; ADE II 02 l.613, l.693-695
const PROTECTRICES_NON_BOUCLIERS = ['filet-leste', 'poing-de-fer'];
const w = (id: string) => weaponFromItem(itemFromTrappingById(id)!);
const porteur = { talents: [{ talentId: 'porte-bouclier', times: 2 }] } as unknown as Combatant;

describe('bouclier = identité du livre, pas l’Atout Protectrice', () => {
  for (const id of BOUCLIERS) it(id + ' est un bouclier', () => {
    expect(isShieldItem(w(id))).toBe(true);
    expect(equipDe([w(id)], []).shield).toBeDefined();
  });
  for (const id of PROTECTRICES_NON_BOUCLIERS) it(id + ' n’est pas un bouclier', () => {
    expect(w(id).qualities.some((q) => q.id === 'protectrice'), 'PRÉMISSE : porte Protectrice').toBe(true);
    expect(isShieldItem(w(id)), 'isShieldItem').toBe(false);
    expect(equipDe([w(id)], []).shield, 'rig : os bouclier').toBeUndefined();
    expect(armePrincipale(equipDe([w(id)], [])), 'rig : arme principale').toBeDefined();
    expect(shieldAdvantageLevel(porteur, w(id)), 'Porte-bouclier LDB 10 l.972').toBe(0);
  });
  it('parade : le geste suit l’identité de l’arme qui pare, jamais l’Atout', () => {
    const parade = (id: string) => rigDefenseDef({ kind: 'weapon', defense: 'parade', parryWeapon: w(id) }, {})?.key ?? '';
    for (const id of BOUCLIERS) expect(parade(id), id).toMatch(/:bouclier$/);
    for (const id of PROTECTRICES_NON_BOUCLIERS) expect(parade(id), id).toMatch(/:nu$/);
  });
  it('poing-de-fer est une forme d’Arme aethyrique (Base)', () => {
    const lanceur = { skills: [{ id: 'corps-a-corps', spec: 'base', advances: 10 }] } as unknown as Combatant;
    expect(conjureFormOptions(lanceur).map((f) => f.weapon)).toContain('poing-de-fer');
  });
});

describe('complétude : toute entrée marquée bouclier se dessine en une silhouette de SHIELD_DEFS, jamais en repli', () => {
  const slugs = new Set(SHIELD_DEFS.map((d) => d.slug));
  const marquees = trappings.filter((t) => isShieldTrapping(t.id));
  it('PRÉMISSE : le catalogue porte des boucliers', () => {
    expect(marquees.map((t) => t.id)).toContain('bouclier');
  });
  for (const t of marquees) it(t.id, () => {
    expect(slugs.has(formeResolue(itemFromTrappingById(t.id)!) ?? ''), `forme « ${t.shape} »`).toBe(true);
  });
});

describe('sens inverse : la forme d’une entrée suit sa marque', () => {
  const boucliers = new Set(SHIELD_DEFS.map((d) => d.slug));
  const armes = new Set(WEAPON_DEFS.map((d) => d.slug));
  const formes = (t: (typeof trappings)[number]) => [t.shape, ...(t.formChoices ?? [])].filter((s): s is string => !!s);
  it('PRÉMISSE : des entrées non marquées portent une forme d’arme', () => {
    expect(trappings.some((t) => !isShieldTrapping(t.id) && formes(t).some((s) => armes.has(s)))).toBe(true);
  });
  it('une entrée NON marquée ne porte jamais un slug de SHIELD_DEFS', () => {
    expect(trappings.filter((t) => !isShieldTrapping(t.id) && formes(t).some((s) => boucliers.has(s))).map((t) => t.id)).toEqual([]);
  });
  it('une entrée marquée ne porte jamais un slug de WEAPON_DEFS', () => {
    expect(trappings.filter((t) => isShieldTrapping(t.id) && formes(t).some((s) => armes.has(s))).map((t) => t.id)).toEqual([]);
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { isShieldItem, isShieldTrapping, itemFromGive, itemFromTrappingById, recomputeLoadout, weaponFromItem } from '../../../engine/items';
import { shieldAdvantageLevel, shieldReactionCost } from '../../../engine/combatFeatures/dispatch';
import { conjureFormOptions } from '../../../engine/conjuredWeapons';
import { compareEquip } from '../../../engine/equipCompare';
import { weaponFromTrait } from '../../../engine/creatureEquip';
import type { Combatant, ItemInstance } from '../../../engine/types';
import { findTrappingById, trappings } from '../../../data';
import { ItemIcon } from '../../../ui/ItemIcon';
import { contexteDeGeste } from '../../fx/animTracks';
import { armePrincipale, equipDe, equipPorte, formeResolue } from './equipment';
import { resolveParts } from './resolve';
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

const heros = (ids: string[]): Combatant => {
  const items = ids.map((id) => ({ ...itemFromGive({ trappingId: id }), equipped: true } as ItemInstance));
  const c = { id: 'h', label: 'h', kind: 'hero', items, weapons: [], traits: [], activeEffects: [], mutations: [],
    talents: [{ talentId: 'porte-bouclier', times: 2 }], skills: [], characteristics: {} } as unknown as Combatant;
  recomputeLoadout(c);
  return c;
};
const geom = (id: string) => {
  const html = renderToStaticMarkup(React.createElement(ItemIcon, { item: itemFromTrappingById(id)!, size: 64 }));
  return /item-icon-shield/.test(html) ? 'shield' : /item-icon-weapon/.test(html) ? 'weapon' : 'autre';
};
const parade = (c: Combatant, id: string) => {
  const eq = equipPorte(c);
  return rigDefenseDef({ kind: 'weapon', defense: 'parade', parryWeapon: c.weapons.find((x) => x.trappingId === id)! }, contexteDeGeste(eq))!.key;
};

describe('non-boucliers porteurs de Protectrice, par un vrai inventaire', () => {
  const cas: [string[], string][] = [[['poing-de-fer'], 'poing-de-fer'], [['filet-leste'], 'filet-leste'], [['arme-simple', 'poing-de-fer'], 'poing-de-fer']];
  for (const [ids, id] of cas) it(ids.join(' + '), () => {
    const c = heros(ids);
    const arme = c.weapons.find((x) => x.trappingId === id)!;
    const eq = equipPorte(c);
    const mainFaible = eq.weapons.find((x) => x.hand === 'off')?.forme ?? null;
    expect(c.weapons.length, 'PRÉMISSE : les objets donnés sont tenus').toBe(ids.length);
    expect(arme.qualities.some((q) => q.id === 'protectrice'), 'PRÉMISSE : porte Protectrice').toBe(true);
    expect(isShieldItem(arme)).toBe(false);
    expect(shieldAdvantageLevel(c, arme), 'Porte-bouclier LDB 10 l.972').toBe(0);
    expect(shieldReactionCost(c, arme), 'réaction AA').toBe(0);
    expect(eq.shield, 'rig : os bouclier').toBeUndefined();
    expect(!!resolveParts('humain', 'M', 'soldat', eq, {}, 1).bouclier?.svg, 'os de main faible dessiné seulement si une arme y est tenue').toBe(mainFaible !== null);
    expect(parade(c, id)).toMatch(/:nu$/);
    expect(compareEquip(itemFromTrappingById(id)!, c).slot).toBe('melee');
    expect(geom(id), 'icône').toBe('weapon');
  });
  it('témoin : arme-simple + bouclier', () => {
    const c = heros(['arme-simple', 'bouclier']);
    const b = c.weapons.find((x) => x.trappingId === 'bouclier')!;
    const eq = equipPorte(c);
    expect(c.weapons.map((x) => `${x.trappingId}/${x.hand}`)).toEqual(expect.arrayContaining(['arme-simple/main', 'bouclier/off']));
    expect(isShieldItem(b)).toBe(true);
    expect(shieldAdvantageLevel(c, b)).toBe(2);
    expect(eq.shield).toBeDefined();
    expect(resolveParts('humain', 'M', 'soldat', eq, {}, 1).bouclier?.svg).toBeTruthy();
    expect(armePrincipale(eq), 'arme principale dessinée').toBeDefined();
    expect(parade(c, 'bouclier')).toMatch(/:bouclier$/);
    expect(geom('bouclier')).toBe('shield');
  });
});

describe('les boucliers du livre, par un vrai inventaire', () => {
  const slugs = new Set(SHIELD_DEFS.map((d) => d.slug));
  for (const id of BOUCLIERS) it(id, () => {
    const c = heros([id]);
    const b = c.weapons.find((x) => x.trappingId === id)!;
    expect(findTrappingById(id)?.shield, 'marque').toBe(true);
    expect(isShieldItem(b)).toBe(true);
    expect(equipPorte(c).shield, 'rig : os bouclier').toBeDefined();
    expect(slugs.has(formeResolue(b) ?? ''), 'forme de SHIELD_DEFS').toBe(true);
    expect(shieldAdvantageLevel(c, b), 'Porte-bouclier LDB 10 l.972').toBe(2);
    expect(geom(id), 'icône').toBe('shield');
  });
  it('créature : le Trait Arme d’argument bouclier est un bouclier', () => {
    expect(isShieldItem(weaponFromTrait({ id: 'arme', value: 9, arg: 'bouclier' } as never)!)).toBe(true);
  });
});

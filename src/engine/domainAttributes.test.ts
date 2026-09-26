/**
 * Attributs de Domaine (LDB 48, intros des 8 Couleurs — L14). Citations dans domainAttributes.ts.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, ItemInstance } from './types';
import type { RNG } from './dice';
import { hasArcaneTalent, metalAPAt, domainMissileMods, domainOnHitEffects, domainCasterOps, isLiving, domainSeaFocalisationDR, domainSeaFocalisationDoubled, domainSeaFocusCritMiscastMajeure, domainSeaIncantationDR, domainSeaWidensCritFumble, domainWindDR } from './domainAttributes';
import { resolveFocus, resolveCasting, castLandProbability } from './magic';
import { findDomainById } from '../data';
import { groupsFor } from './groups';
import { evaluateMissile } from './magic';
import { hasCondition, stacks, addCondition } from './conditions';
import { runPureFlowLines } from '../state/combatEffects';
import { applyTriggeredEffects } from '../state/triggeredEffects';
import type { Get } from '../state/flowTypes';

/** Applique les riders onHit AUTHORÉS d'un Domaine à `target` (gating par les Conditions Flow, contre
 *  les vues d'acteur du lanceur/cible). `caster` adverse = camp ≠ (hero vs enemy). `domainId` = id STABLE. */
const applyDomain = (caster: Combatant, target: Combatant, domainId: string, rng: RNG = seq([])): string[] => {
  const lines: string[] = [];
  for (const eff of domainOnHitEffects({ domainId })) lines.push(...runPureFlowLines(target, caster, eff.flow, { rng, caster }));
  return lines;
};

function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 5 } as RNG;
}

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Cobaye', kind: 'enemy', size: 'moyenne', advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 12, max: 12 },
    ...over,
  } as unknown as Combatant;
}

const mail = (pa: number): ItemInstance => ({
  uid: 'm1', name: 'Chemise de mailles', subType: 'mailles', kind: 'armor', pa, locs: ['corps'], equipped: true, qualities: [],
} as unknown as ItemInstance);
const leather = (pa: number): ItemInstance => ({
  uid: 'l1', name: 'Armure de cuir souple', subType: 'cuir-souple', kind: 'armor', pa, locs: ['corps'], equipped: true, qualities: [],
} as unknown as ItemInstance);

describe('hasArcaneTalent', () => {
  it('talent Magie des Arcanes (X) détecté', () => {
    const c = mk({ talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }] as Combatant['talents'] });
    expect(hasArcaneTalent(c, 'feu')).toBe(true);
    expect(hasArcaneTalent(c, 'cieux')).toBe(false);
  });
});

describe('Métal / Cieux / Ombres — mitigation des Projectiles (LDB 48 l.399/106/588)', () => {
  it('Métal : ignore les PA métalliques ET les ajoute en Dégâts', () => {
    const t = mk({ items: [mail(3), leather(1)], armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    expect(metalAPAt(t, 'corps')).toBe(3);
    const mods = domainMissileMods(t, { domainId: 'metal' }, 'corps', 4);
    expect(mods).toEqual({ apIgnored: 3, bonusDamage: 3 });
  });
  it('Cieux : ignore les PA métalliques, sans bonus', () => {
    const t = mk({ items: [mail(3)], armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    expect(domainMissileMods(t, { domainId: 'cieux' }, 'corps', 3)).toEqual({ apIgnored: 3, bonusDamage: 0 });
  });
  it('Ombres : ignore tous les PA non magiques — seuls les PA d’un effet actif (apAll) tiennent', () => {
    const t = mk({
      items: [mail(2)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      activeEffects: [{ label: 'Armure Aethyrique', bonus: 0, duration: { scale: 'rounds', left: 5 }, apAll: 1 }],
    });
    expect(domainMissileMods(t, { domainId: 'ombres' }, 'corps', 3)).toEqual({ apIgnored: 2, bonusDamage: 0 });
  });
  it('evaluateMissile intègre l’attribut (Métal : +PA métal en Dégâts, PA métal ignorées)', () => {
    const caster = mk({ id: 'w', label: 'Doré' }); // BFM 4
    const t = mk({ id: 't', items: [mail(3)], armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } as Combatant['armour'] });
    const spell = { label: 'Test Métal', ecole: 'Magie des Arcanes', subType: 'Métal', domainId: 'metal', missile: true, damage: 4, cn: 0, range: null, target: 1, duration: null, desc: 'Il s’agit d’un Projectile magique avec Dégâts +4.' };
    const cr = { cast: true, roll: 54, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' }; // jet inversé 45 → corps
    const r = evaluateMissile(caster, t, spell as never, cr as never);
    // Dégâts = 4 (sort) + 2 (DR) + 4 (BFM) + 3 (PA métal) = 13 ; mitigation = BE 3 + (PA 3 − 3 ignorées) = 3.
    expect(r.damage).toBe(13);
    expect(r.woundsLost).toBe(10);
  });
});

describe('Riders « à la touche » data-driven (Feu / Lumière / Mort / Vie) — gating par Conditions Flow', () => {
  it('Feu : +1 En flammes à la cible adverse, sauf Talent (Feu) ; pas sur un allié', () => {
    const w = mk({ id: 'w', kind: 'hero' });
    const t = mk({ id: 't', kind: 'enemy' });
    applyDomain(w, t, 'feu');
    expect(hasCondition(t, 'en-flammes')).toBe(true);
    const immune = mk({ id: 'i', kind: 'enemy', talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }] as Combatant['talents'] });
    applyDomain(w, immune, 'feu');
    expect(hasCondition(immune, 'en-flammes')).toBe(false);
    const ally = mk({ id: 'a', kind: 'hero' }); // même camp que le lanceur → pas adversaire
    applyDomain(w, ally, 'feu');
    expect(hasCondition(ally, 'en-flammes')).toBe(false);
  });
  it('Lumière : Aveuglé + frappe BInt ignorant BE/PA sur un Mort-vivant', () => {
    const w = mk({ id: 'w', kind: 'hero' }); // BInt 4
    const z = mk({ id: 'z', kind: 'enemy', traits: [{ id: 'mort-vivant' }], wounds: { current: 10, max: 10 } as Combatant['wounds'] });
    applyDomain(w, z, 'lumiere');
    expect(hasCondition(z, 'aveugle')).toBe(true);
    expect(z.wounds.current).toBe(6); // 4 = BInt, ignore BE+PA
  });
  it('Mort : +1 Exténué aux vivants adverses, UNE seule fois (pas déjà Exténué)', () => {
    const w = mk({ id: 'w', kind: 'hero' });
    const t = mk({ id: 't', kind: 'enemy' });
    applyDomain(w, t, 'mort');
    applyDomain(w, t, 'mort');
    expect(stacks(t, 'extenue')).toBe(1);
    // `groups` = ce que le spawn dérive du seul Trait (`capabilities.grantGroups`, engine/groups.ts) —
    // `isUndead`/`isLiving` lisent PUREMENT `c.groups` (jamais un repli hasTraitKey).
    const z = mk({ id: 'z', kind: 'enemy', traits: [{ id: 'mort-vivant' }], groups: groupsFor({ traits: [{ id: 'mort-vivant' }] }) });
    expect(isLiving(z)).toBe(false);
    applyDomain(w, z, 'mort');
    expect(stacks(z, 'extenue')).toBe(0); // « cible vivante » seulement
  });
  it('Vie : purge Exténué/Hémorragique des vivants ; +BFM ignore BE/PA aux Morts-vivants', () => {
    const w = mk({ id: 'w', kind: 'hero' }); // BFM 4
    const ally = mk({ id: 'a', kind: 'hero' });
    addCondition(ally, 'extenue', 2);
    addCondition(ally, 'hemorragique', 3);
    applyDomain(w, ally, 'vie');
    expect(stacks(ally, 'extenue')).toBe(0);
    expect(stacks(ally, 'hemorragique')).toBe(0);
    const z = mk({ id: 'z', kind: 'enemy', traits: [{ id: 'mort-vivant' }], wounds: { current: 10, max: 10 } as Combatant['wounds'] });
    applyDomain(w, z, 'vie');
    expect(z.wounds.current).toBe(6);
  });
});

describe('Cieux — arc d’Azyr (LDB 48 l.106) : géométrie on:{near} + bypass métal', () => {
  // « se dirigent vers toutes les autres cibles dans les 2 mètres, à l’exception de ceux possédant le
  //   Talent Magie des Arcanes (Cieux), infligeant un nombre de Dégâts égal à votre BFM ». L’effet est
  //   une GÉOMÉTRIE (`on:{near:'victim',radiusMeters:2}`) résolue par `applyTriggeredEffects` (≠ runPureFlowLines
  //   direct des autres riders) : il faut un `battle` (positions) pour exercer le ciblage de zone + le bypass.
  const at = (over: Partial<Combatant>, x: number, y: number): Combatant =>
    mk({ ...over, pos: { x, y } } as Partial<Combatant>);

  it('arc vers les voisins (≤2 m) en perçant le métal ; épargne le Talent (Cieux), la victime, les lointains', () => {
    const caster = mk({ id: 'w', kind: 'hero', pos: { x: 0, y: 0 } } as Partial<Combatant>); // BFM 4
    const victim = at({ id: 'v', kind: 'enemy' }, 5, 5);
    // voisin en mailles (métal) : l’arc perce les PA métalliques → BFM(4) − BE(2) − 0 = 2 Blessures.
    const nearMail = at({ id: 'n', kind: 'enemy', items: [mail(4)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      characteristics: { ...mk().characteristics, endurance: 20 } as Combatant['characteristics'] }, 6, 5);
    // voisin en cuir (non-métal) : rien n’est percé → BFM(4) − BE(2) − PA(4) = 0, l’armure tient.
    const nearLeather = at({ id: 'l', kind: 'enemy', items: [leather(4)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      characteristics: { ...mk().characteristics, endurance: 20 } as Combatant['characteristics'] }, 5, 6);
    // voisin avec le Talent (Cieux) : exempté par la Condition Flow `has talent`.
    const nearTalent = at({ id: 't', kind: 'enemy',
      talents: [{ talentId: 'magie-des-arcanes', spec: 'cieux', times: 1 }] as Combatant['talents'] }, 4, 5);
    const farFoe = at({ id: 'f', kind: 'enemy' }, 9, 5); // >2 m → hors arc

    const all = [caster, victim, nearMail, nearLeather, nearTalent, farFoe];
    const get = (() => ({ battle: { combatants: all } })) as unknown as Get;
    applyTriggeredEffects(get, caster, domainOnHitEffects({ domainId: 'cieux' }), 'onHit', { victim });

    expect(nearMail.wounds.current).toBe(10);   // 12 − 2 : métal percé
    expect(nearLeather.wounds.current).toBe(12); // armure non-métal intacte
    expect(nearTalent.wounds.current).toBe(12);  // Talent (Cieux) → exempté
    expect(victim.wounds.current).toBe(12);      // l’arc vise « les AUTRES cibles », pas la victime
    expect(farFoe.wounds.current).toBe(12);      // hors des 2 m
  });
});

describe('Magie des mers (MDG 02 l.178-186) — 4 Domaines, seaModifier (DomainData)', () => {
  const feuSpell = { label: 'Test Feu', ecole: 'Magie des Arcanes', subType: 'Feu', domainId: 'feu', cn: 0, range: null, target: 1, duration: null, desc: '' };
  const vieSpell = { label: 'Test Vie', ecole: 'Magie des Arcanes', subType: 'Vie', domainId: 'vie', cn: 0, range: null, target: 1, duration: null, desc: '' };
  const cieuxSpell = { label: 'Test Cieux', ecole: 'Magie des Arcanes', subType: 'Cieux', domainId: 'cieux', cn: 0, range: null, target: 1, duration: null, desc: '' };
  const beteSpell = { label: 'Test Bête', ecole: 'Magie des Arcanes', subType: 'Bête', domainId: 'bete', cn: 0, range: null, target: 1, duration: null, desc: '' };
  const otherSpell = { label: 'Autre', ecole: 'Magie des Arcanes', subType: 'Métal', domainId: 'metal', cn: 0, range: null, target: 1, duration: null, desc: '' };

  const caster = (domainSpec: string): Combatant => mk({
    id: 'w', kind: 'hero',
    skills: [
      { id: 'focalisation', spec: domainSpec, advances: 10 },
      { id: 'langue', spec: 'magick', advances: 10 },
    ] as Combatant['skills'],
  });

  it('domainSea* : atSea=false → aucun modificateur, quel que soit le Domaine', () => {
    expect(domainSeaFocalisationDR(feuSpell, false)).toBe(0);
    expect(domainSeaFocalisationDoubled(vieSpell, false)).toBe(false);
    expect(domainSeaFocusCritMiscastMajeure(vieSpell, false)).toBe(false);
    expect(domainSeaIncantationDR(cieuxSpell, false, 'violente-tempete')).toBe(0);
    expect(domainSeaWidensCritFumble(beteSpell, false)).toBe(false);
  });

  it('domainSea* : Domaine sans seaModifier → 0/false même en mer', () => {
    expect(domainSeaFocalisationDR(otherSpell, true)).toBe(0);
    expect(domainSeaWidensCritFumble(otherSpell, true)).toBe(false);
  });

  it('Feu (Aqshy, l.182) : « Les Tests de Focalisation pour ce Domaine subissent -1 DR »', () => {
    expect(domainSeaFocalisationDR(feuSpell, true)).toBe(-1);
    const w = caster('feu');
    const off = resolveFocus(w, feuSpell, seq([21]), 'intermediaire', false); // 21 : succès non-double, DR 2
    const sea = resolveFocus(w, feuSpell, seq([21]), 'intermediaire', true);
    expect(sea.dr).toBe(Math.max(0, off.dr - 1));
  });

  it("Vie (Ghyran, l.186) : « Les DR des Tests de Focalisation sont doublés sur les mers »", () => {
    expect(domainSeaFocalisationDoubled(vieSpell, true)).toBe(true);
    const w = caster('vie');
    const off = resolveFocus(w, vieSpell, seq([21]), 'intermediaire', false);
    const sea = resolveFocus(w, vieSpell, seq([21]), 'intermediaire', true);
    expect(sea.dr).toBe(off.dr * 2);
  });

  it("Vie (Ghyran, l.186) : « une Focalisation Critique donne une Incantation Imparfaite Majeure au lieu de Mineure »", () => {
    expect(domainSeaFocusCritMiscastMajeure(vieSpell, true)).toBe(true);
    expect(domainSeaFocusCritMiscastMajeure(feuSpell, true)).toBe(false); // seul Vie porte ce marqueur
  });

  it("Cieux (Azyr, l.184) : « +1 DR » en Violente tempête, « -1 DR » en Calme plat sur l'Incantation", () => {
    expect(domainSeaIncantationDR(cieuxSpell, true, 'violente-tempete')).toBe(1);
    expect(domainSeaIncantationDR(cieuxSpell, true, 'calme-plat')).toBe(-1);
    expect(domainSeaIncantationDR(cieuxSpell, true, 'legere-brise')).toBe(0); // vent neutre : silence RAW
    const w = caster('cieux');
    const off = resolveCasting(w, cieuxSpell, seq([21]), 'intermediaire', false, 0, {});
    const storm = resolveCasting(w, cieuxSpell, seq([21]), 'intermediaire', false, 0, { atSea: true, wind: 'violente-tempete' });
    expect(storm.sl).toBe(off.sl + 1);
    const calm = resolveCasting(w, cieuxSpell, seq([21]), 'intermediaire', false, 0, { atSea: true, wind: 'calme-plat' });
    expect(calm.sl).toBe(off.sl - 1);
  });

  it("Bête (Ghur, l.180) : Critique/Maladresse d'Incantation déclenchés aussi sur un résultat finissant par 0, en mer", () => {
    expect(domainSeaWidensCritFumble(beteSpell, true)).toBe(true);
    const w = caster('bete');
    // 40 (succès, pas un double) : Critique seulement si widen (Bête + mer).
    const off = resolveCasting(w, beteSpell, seq([40]), 'intermediaire', false, 0, {});
    expect(off.isCritical).toBe(false);
    const sea = resolveCasting(w, beteSpell, seq([40]), 'intermediaire', false, 0, { atSea: true });
    expect(sea.isCritical).toBe(true);
  });
});

describe('Bete — Peur 1 pour 1d10 Rounds apres un Sort de la Bete reussi (LDB 48 l.9)', () => {
  it('pose le Trait peur (value 1) + activeEffect (scale rounds, left = de tire) via applyOps', () => {
    const w = mk({ id: 'w', traits: [] });
    const lines = domainCasterOps(w, { domainId: 'bete' }, seq([7]));
    expect(w.traits).toContainEqual({ id: 'peur', value: 1 });
    expect(w.activeEffects?.[0]).toMatchObject({
      grantedTrait: { id: 'peur', value: 1 },
      duration: { scale: 'rounds', left: 7 },
    });
    expect(lines.length).toBeGreaterThan(0);
  });
  it('aucun effet pour un Domaine sans casterOps', () => {
    const w = mk({ id: 'w' });
    expect(domainCasterOps(w, { domainId: 'feu' }, seq([7]))).toEqual([]);
  });
});

describe('Rubrique de VENT du Domaine (VDM 04 l.48-56, folio 55) — windModifiers (DomainData)', () => {
  const hyshSpell = { label: 'Test Lumière', ecole: 'Magie des Arcanes', subType: 'Lumière', domainId: 'lumiere', cn: 0, range: null, target: 1, duration: null, desc: '' };
  const metalSpell = { label: 'Test Métal', ecole: 'Magie des Arcanes', subType: 'Métal', domainId: 'metal', cn: 0, range: null, target: 1, duration: null, desc: '' };

  const wizard = (domainSpec: string): Combatant => mk({
    id: 'w', kind: 'hero',
    skills: [
      { id: 'focalisation', spec: domainSpec, advances: 10 },
      { id: 'langue', spec: 'magick', advances: 10 },
    ] as Combatant['skills'],
  });

  it("« Les Tests d'Incantation et de Focalisation qui se servent du Domaine de la Lumière subissent un malus de −1 DR »", () => {
    expect(domainWindDR(hyshSpell, 'incantation')).toBe(-1);
    expect(domainWindDR(hyshSpell, 'focalisation')).toBe(-1);
  });

  it('« Les Tests effectués pour percevoir Hysh avec le Talent Seconde vue […] subissent un malus de −2 DR »', () => {
    expect(domainWindDR(hyshSpell, 'seconde-vue')).toBe(-2);
  });

  it('un Domaine sans rubrique de Vent ne subit rien (Métal)', () => {
    expect(domainWindDR(metalSpell, 'incantation')).toBe(0);
    expect(domainWindDR(metalSpell, 'focalisation')).toBe(0);
  });

  it("l'assistant qui chante annule les DEUX pénalités (l.52) — circonstance signalée par l'appelant", () => {
    const chante = { circumstances: ['assistance-chantee'] };
    expect(domainWindDR(hyshSpell, 'incantation', chante)).toBe(0);
    expect(domainWindDR(hyshSpell, 'focalisation', chante)).toBe(0);
    expect(domainWindDR(hyshSpell, 'seconde-vue', chante)).toBe(0);
  });

  it("une circonstance ÉTRANGÈRE n'annule rien", () => {
    expect(domainWindDR(hyshSpell, 'incantation', { circumstances: ['brouillard'] })).toBe(-1);
  });

  it("CÂBLAGE — resolveCasting : le lanceur de Hysh perd 1 DR par rapport au MÊME jet d'un autre Domaine, et le récupère quand l'assistant chante", () => {
    const w = wizard('lumiere');
    const temoin = resolveCasting(w, metalSpell, seq([21]), 'intermediaire', false, 0, {});
    const hysh = resolveCasting(w, hyshSpell, seq([21]), 'intermediaire', false, 0, {});
    expect(hysh.sl).toBe(temoin.sl - 1);
    const assiste = resolveCasting(w, hyshSpell, seq([21]), 'intermediaire', false, 0, {}, { circumstances: ['assistance-chantee'] });
    expect(assiste.sl).toBe(temoin.sl);
  });

  it("CÂBLAGE — resolveFocus : même morsure sur le DR de Focalisation", () => {
    const hyshW = wizard('lumiere');
    const metalW = wizard('metal');
    const temoin = resolveFocus(metalW, metalSpell, seq([21]), 'intermediaire', false);
    const hysh = resolveFocus(hyshW, hyshSpell, seq([21]), 'intermediaire', false);
    expect(temoin.dr).toBeGreaterThan(0);
    expect(hysh.dr).toBe(temoin.dr - 1);
    const assiste = resolveFocus(hyshW, hyshSpell, seq([21]), 'intermediaire', false, 0, { circumstances: ['assistance-chantee'] });
    expect(assiste.dr).toBe(temoin.dr);
  });

  it("CÂBLAGE — castLandProbability suit le même DR (un Sort de NI 2 ne passe plus au jet qui le passait)", () => {
    const w = wizard('lumiere');
    const ni2 = { ...hyshSpell, cn: 2 };
    const temoin = castLandProbability(w, { ...metalSpell, cn: 2 });
    const hysh = castLandProbability(w, ni2);
    expect(hysh).toBeLessThan(temoin);
    expect(castLandProbability(w, ni2, false, { circumstances: ['assistance-chantee'] })).toBe(temoin);
  });

  it("l'annulation est de la DONNÉE : la rubrique déclare la Compétence exigée et le Test de l'assistant", () => {
    const mods = findDomainById('lumiere')?.windModifiers ?? [];
    expect(mods).toHaveLength(2);
    for (const m of mods) {
      expect(m.cancelledBy).toMatchObject({
        circumstance: 'assistance-chantee',
        requiresSkill: { id: 'focalisation', spec: 'lumiere' },
        test: { skill: { id: 'langue', spec: 'magick' }, difficulty: 'facile' },
        sustained: true,
      });
      expect(m.source).toEqual({ book: 'vents-de-la-magie', page: 55 });
    }
  });
});

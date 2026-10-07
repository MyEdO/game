/**
 * Grimoire — apprentissage/mémorisation (LDB 46 l.16-20, 47 l.33-34, Talents LDB 10) :
 * coûts par bandes (BFM ×50 / BInt ×100 / 100×connus), éligibilité par Talent,
 * Bénédictions par culte (six incluses), lecture au grimoire (NI ×2).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import {
  casterTalents, spellCost, learnableSpells, canCastFromGrimoire, knownCount,
} from './grimoire';
import { blessingsOf, spells, findSpell } from '../data';

const sp = (label: string) => findSpell(label)!;

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 42, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], spells: [], xp: 1000,
    ...p,
  } as Combatant;
}

describe('casterTalents — extraction des specs', () => {
  it('« Invocation (Sigmar) » → invocation/sigmar ; « (Au choix) » → joker', () => {
    const c = hero({ talents: [
      { talentId: 'invocation', spec: 'sigmar', times: 1 },
      { talentId: 'magie-des-arcanes', spec: 'feu', times: 1 },
      { talentId: 'beni', spec: 'Au choix', times: 1 },
      { talentId: 'magie-mineure', times: 1 },
    ] });
    expect(casterTalents(c)).toEqual([
      { kind: 'invocation', spec: 'sigmar' },
      { kind: 'arcane', spec: 'feu' },
      { kind: 'beni', spec: undefined },
      { kind: 'mineure', spec: undefined },
    ]);
  });
});

describe('coûts de mémorisation (Talents LDB 10)', () => {
  it('Magie mineure : BFM sorts INCLUS au Talent (0 PX, l.587), puis bandes inclusives ×50', () => {
    const c = hero({ talents: [{ talentId: 'magie-mineure', times: 1 }] }); // FM 35 → BFM 3
    expect(spellCost(c, sp('Fléchette'))).toBe(0); // « vous mémorisez… BFM Sorts » au Talent
    c.spells = ['alerte', 'bruits']; // 2 connus < BFM → toujours inclus (ids de sort runtime)
    expect(spellCost(c, sp('Fléchette'))).toBe(0);
    c.spells = ['alerte', 'bruits', 'choc']; // BFM atteint → payant : « Jusqu'à BFM ×1 » = 50
    expect(knownCount(c, 'mineure')).toBe(3);
    expect(spellCost(c, sp('Fléchette'))).toBe(50);
    c.spells = [...c.spells, 'flechette']; // 4 connus → « Jusqu'à BFM ×2 » = 100
    expect(spellCost(c, sp('Drain'))).toBe(100);
  });

  it('Magie des Arcanes : bandes de BInt ×100 PX ; Domaine exigé pour les sorts de Domaine', () => {
    const c = hero({ talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }] });
    expect(spellCost(c, sp('Arme aethyrique'))).toBe(100); // Arcane commun : OK
    const feu = spells.find((s) => s.ecole === 'Magie des Arcanes' && s.subType === 'Feu')!;
    expect(spellCost(c, feu)).toBe(100);
    const ombres = spells.find((s) => s.ecole === 'Magie des Arcanes' && s.subType === 'Ombres')!;
    expect(spellCost(c, ombres)).toBeNull(); // pas le Domaine
  });

  it('Arcanes — bande INCLUSIVE : à exactement BInt connus, le suivant reste à 100 PX', () => {
    const c = hero({ talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }] }); // Int 42 → BInt 4
    const arcanes = spells.filter((s) => s.ecole === 'Magie des Arcanes' && (s.subType === 'Feu' || s.subType == null));
    c.spells = arcanes.slice(0, 4).map((s) => s.id); // « Jusqu'à BInt ×1 » plein
    expect(spellCost(c, arcanes[4])).toBe(100);
    c.spells = arcanes.slice(0, 5).map((s) => s.id); // 5 connus → « Jusqu'à BInt ×2 » = 200
    expect(spellCost(c, arcanes[5])).toBe(200);
  });

  it('Invocation : 1er Miracle inclus (0 PX), puis 100 × connus ; culte exigé', () => {
    const c = hero({ talents: [{ talentId: 'invocation', spec: 'sigmar', times: 1 }] });
    const sigmar = spells.filter((s) => s.ecole === 'Invocation' && s.subType === 'Sigmar'); // subType = libellé d'affichage
    expect(spellCost(c, sigmar[0])).toBe(0);
    c.spells = [sigmar[0].id];
    expect(spellCost(c, sigmar[1])).toBe(100);
    c.spells = [sigmar[0].id, sigmar[1].id, sigmar[2].id];
    expect(spellCost(c, sigmar[3])).toBe(300); // « 3 Miracles connus → 300 PX »
    const ulric = spells.find((s) => s.ecole === 'Invocation' && s.subType === 'Ulric')!;
    expect(spellCost(c, ulric)).toBeNull(); // autre culte
  });

  it('Magie du Chaos (Tzeentch) : Sorts du Dieu Sombre choisi à 100 PX ; autre dieu refusé (par id, jamais le libellé)', () => {
    const c = hero({ talents: [{ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 1 }] });
    const tzeentch = spells.filter((s) => s.family === 'chaos' && s.subType === 'Tzeentch');
    expect(tzeentch.length).toBeGreaterThan(0);
    expect(spellCost(c, tzeentch[0])).toBe(100); // « chaque sort = 100 PX (+1 Corruption) »
    const nurgle = spells.find((s) => s.family === 'chaos' && s.subType === 'Nurgle')!;
    expect(spellCost(c, nurgle)).toBeNull(); // Domaine du Chaos d'un AUTRE dieu → inéligible
    const wild = hero({ talents: [{ talentId: 'magie-du-chaos', times: 1 }] }); // joker (non spécialisé)
    expect(spellCost(wild, nurgle)).toBe(100); // tout Sort du Chaos
  });

  it('Béni (Culte) : les SIX Bénédictions du culte à 0 PX, les autres refusées', () => {
    const c = hero({ talents: [{ talentId: 'beni', spec: 'shallya', times: 1 }] });
    expect(blessingsOf('shallya')).toContain('benediction-de-guerison'); // ids de sort
    expect(spellCost(c, sp('Bénédiction de Guérison'))).toBe(0);
    expect(spellCost(c, sp('Bénédiction de Bataille'))).toBeNull(); // pas chez Shallya (LDB 41)
    const learn = learnableSpells(c);
    expect(learn.filter((l) => l.spell.ecole === 'Béni')).toHaveLength(6);
  });

  it('déjà connu / aucun Talent → null', () => {
    expect(spellCost(hero(), sp('Fléchette'))).toBeNull();
    const c = hero({ talents: [{ talentId: 'magie-mineure', times: 1 }], spells: ['flechette'] });
    expect(spellCost(c, sp('Fléchette'))).toBeNull();
  });
});

describe('lecture au grimoire (LDB 47 l.21)', () => {
  it('sort de son Domaine NON mémorisé + grimoire porté → lançable (NI ×2 côté flux)', () => {
    const c = hero({
      talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }],
      items: [{ uid: 'g1', name: 'Grimoire', trappingId: 'grimoire', kind: 'misc', enc: 1, qualities: [] } as never],
    });
    expect(canCastFromGrimoire(c, sp('Arme aethyrique'))).toBe(true);
    // mémorisé → inutile ; sans grimoire → impossible ; Prière → jamais.
    expect(canCastFromGrimoire({ ...c, spells: ['arme-aethyrique'] } as Combatant, sp('Arme aethyrique'))).toBe(false);
    expect(canCastFromGrimoire({ ...c, items: [] } as Combatant, sp('Arme aethyrique'))).toBe(false);
    expect(canCastFromGrimoire(c, sp('Bénédiction de Guérison'))).toBe(false);
  });
});

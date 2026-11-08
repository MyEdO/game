/**
 * Les sorts d'un PNJ (#3715) : LDB 10 l.625, l.704-714 ; EDOC 13 l.262 ; LDB 85 l.207, l.233 ; arbitrage du 2026-11-08
 * au ticket #3715 (Magie des Arcanes : aucun sort d'office). Un profil de 30 partout (Bonus de Force Mentale 3).
 */
import { describe, it, expect } from 'vitest';
import { refusDesSortsChoisis, sortsDuPnj } from './sortsDuPnj';
import { combattantDeTest } from './combattantDeTest.testkit';
import { blessingsOf, findCreatureById, findSpellById, miraclesOf, chaosSpellsOf } from '../data';
import type { Combatant, TalentInstance } from './types';
import type { TraitInstance } from './statEntry';

const pnj = (talents: TalentInstance[], traits: TraitInstance[] = [], id = 'pnj'): Combatant =>
  combattantDeTest({ id, talents, traits, porteurDeFiche: { ref: 'humain' } });
const famille = (id: string) => findSpellById(id)!.family;
const MINEURE: TalentInstance = { talentId: 'magie-mineure', times: 1 };

describe('les quotas que le livre chiffre se remplissent, tirés à la graine du PNJ', () => {
  it('Magie mineure : un nombre de Sorts mineurs égal au Bonus de Force Mentale (LDB 10 l.714)', () => {
    const sorts = sortsDuPnj(pnj([MINEURE]), []);
    expect(sorts).toHaveLength(3);
    expect(new Set(sorts).size).toBe(3);
    expect(sorts.map(famille)).toEqual(['mineure', 'mineure', 'mineure']);
  });

  it('le tirage est stable pour un même id', () => {
    expect(sortsDuPnj(pnj([MINEURE]), [])).toEqual(sortsDuPnj(pnj([MINEURE]), []));
  });

  it('un Sort mineur choisi compte dans le quota : deux seulement sont tirés', () => {
    const sorts = sortsDuPnj(pnj([MINEURE]), ['choc']);
    expect(sorts[0]).toBe('choc');
    expect(sorts).toHaveLength(3);
  });

  it('Invocation (Sigmar) : un Miracle du culte (LDB 10 l.625)', () => {
    const sorts = sortsDuPnj(pnj([{ talentId: 'invocation', spec: 'sigmar', times: 1 }]), []);
    expect(sorts).toHaveLength(1);
    expect(miraclesOf('sigmar')).toContain(sorts[0]);
    expect(sortsDuPnj(pnj([{ talentId: 'invocation', spec: 'sigmar', times: 1 }]), ['feu-de-l-ame'])).toEqual(['feu-de-l-ame']);
  });

  it('Magie du Chaos (Tzeentch) prise deux fois : deux Sorts des Arcanes, des Arcanes du Chaos ou de Tzeentch (EDOC 13 l.262)', () => {
    const sorts = sortsDuPnj(pnj([{ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 2 }]), []);
    expect(sorts).toHaveLength(2);
    const autresDieux = [...chaosSpellsOf('nurgle'), ...chaosSpellsOf('slaanesh')];
    for (const id of sorts) {
      const sp = findSpellById(id)!;
      const sortDArcane = sp.family === 'arcane' && sp.domainId === undefined && !sp.ritual;
      expect(sortDArcane || (sp.family === 'chaos' && !autresDieux.includes(id))).toBe(true);
    }
  });

  it('Béni : les Bénédictions déjà reçues restent, rien de plus n’est tiré', () => {
    const c = pnj([{ talentId: 'beni', spec: 'ulric', times: 1 }]);
    c.spells = blessingsOf('ulric');
    expect(sortsDuPnj(c, [])).toEqual(blessingsOf('ulric'));
  });
});

describe('Magie des Arcanes et Traits de lanceur : rien d’office, l’auteur choisit (arbitrage du 2026-11-08)', () => {
  const pyromancien = () => pnj([{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }]);
  it('sans choix, aucun sort', () => {
    expect(sortsDuPnj(pyromancien(), [])).toEqual([]);
    expect(sortsDuPnj(pnj([], [{ id: 'lanceur-de-sorts', arg: 'feu' }]), [])).toEqual([]);
    expect(sortsDuPnj(pnj([], [{ id: 'miracles', arg: 'taal' }]), [])).toEqual([]);
  });

  it('les sorts du Domaine choisis, sans plafond', () => {
    const choisis = ['cauteriser', 'coeurs-ardents', 'couronne-de-flammes', 'arme-aethyrique'];
    expect(refusDesSortsChoisis(pyromancien(), choisis)).toBeUndefined();
    expect(sortsDuPnj(pyromancien(), choisis)).toEqual(choisis);
  });

  it('Lanceur de Sorts ouvre les Sorts ; Miracles (Taal), les Miracles de Taal', () => {
    expect(refusDesSortsChoisis(pnj([], [{ id: 'lanceur-de-sorts', arg: 'chaos' }]), ['flechette', 'cauteriser', 'aspect-sublime'])).toBeUndefined();
    expect(refusDesSortsChoisis(pnj([], [{ id: 'miracles', arg: 'taal' }]), ['bondissant-comme-un-cerf'])).toBeUndefined();
  });
});

describe('le choix de l’auteur est borné', () => {
  it('un sort d’aucune liste ouverte est refusé, et n’est pas porté', () => {
    const c = pnj([{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }]);
    expect(refusDesSortsChoisis(c, ['destrier-d-ombre'])).toMatch(/aucune liste/);
    expect(sortsDuPnj(c, ['destrier-d-ombre'])).toEqual([]);
    expect(refusDesSortsChoisis(pnj([], [{ id: 'miracles', arg: 'taal' }]), ['feu-de-l-ame'])).toMatch(/aucune liste/);
    expect(refusDesSortsChoisis(pnj([], [{ id: 'lanceur-de-sorts' }]), ['feu-de-l-ame'])).toMatch(/aucune liste/);
  });

  it('au-delà d’un quota chiffré, refusé : un quatrième Sort mineur, un second Miracle', () => {
    expect(refusDesSortsChoisis(pnj([MINEURE]), ['alerte', 'bruits', 'choc'])).toBeUndefined();
    expect(refusDesSortsChoisis(pnj([MINEURE]), ['alerte', 'bruits', 'choc', 'conservation'])).toMatch(/Magie mineure : 3/);
    expect(refusDesSortsChoisis(pnj([{ talentId: 'invocation', spec: 'sigmar', times: 1 }]), ['comete-a-deux-queues', 'feu-de-l-ame'])).toMatch(/: 1\./);
  });

  it('un sort qu’ouvrent deux listes va d’abord à celle sans quota', () => {
    const c = pnj([{ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 1 }, { talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }]);
    expect(refusDesSortsChoisis(c, ['arme-aethyrique', 'aspect-sublime'])).toBeUndefined();
  });
});

describe('une liste imprimée au profil fait foi', () => {
  const eusapia = () => combattantDeTest({ id: 'eusapia', talents: [{ talentId: 'magie-mineure', times: 1 }], spells: [...findCreatureById('eusapia-balacanon')!.spells], porteurDeFiche: { ref: 'eusapia-balacanon' } });
  it('jamais complétée', () => {
    expect(sortsDuPnj(eusapia(), [])).toEqual(findCreatureById('eusapia-balacanon')!.spells);
  });
  it('aucun choix d’auteur admis', () => {
    expect(refusDesSortsChoisis(eusapia(), ['choc'])).toMatch(/imprime/);
    expect(sortsDuPnj(eusapia(), ['choc'])).not.toContain('choc');
  });
});

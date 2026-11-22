/**
 * Les sorts d'un PNJ (#3715) : LDB 10 l.625, l.704-714 ; EDOC 13 l.262 ; LDB 85 l.207, l.233 ; arbitrage du 2026-11-08
 * au ticket #3715 (Magie des Arcanes : aucun sort d'office). Un profil de 30 partout (Bonus de Force Mentale 3).
 */
import { describe, it, expect, vi } from 'vitest';
import { listesDeSorts, refusDesSortsChoisis, sortsDisponibles, sortsDuPnj } from './sortsDuPnj';
import { gameOpSchema, passifsDe } from '../data/schemas/grammaire/mecanique';
import { rangee } from '../data/schemas/defs/tables';
import { applyOps } from './ops';
import { choixDuTrait, resoudreLeChoixDuTrait } from './traitOctroye';
import { makeRNG } from './dice';
import { endOfRound } from './conditions';
import { groupesDe } from './groups';
import { idsDeTest } from './idsDeTest.testkit';
import { combattantDeTest } from './combattantDeTest.testkit';
import { blessingsOf, findCreatureById, findEffectTableById, findSpellById, miraclesOf, chaosSpellsOf } from '../data';
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

  it('un Trait natif spécialisé conserve les choix d’auteur de sa fiche', () => {
    const c = pnj([], [{ id: 'lanceur-de-sorts', arg: 'sorcellerie' }]);
    const choisis = ['alerte', 'arme-aethyrique', 'aspect-sublime'];
    expect(refusDesSortsChoisis(c, choisis)).toBeUndefined();
    expect(sortsDuPnj(c, choisis)).toEqual(choisis);
    expect(sortsDisponibles(c)).toEqual([]);
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

describe('le choix du Domaine d’un Trait octroyé', () => {
  const choix = { op: 'grantTrait', trait: { id: 'lanceur-de-sorts' }, choix: true } as const;

  it('la grammaire réserve le choix au seul octroi direct d’une rangée', () => {
    const tzeentch = findEffectTableById('allure-demoniaque-tzeentch').entries.find((r) => r.min === 10)!;
    expect(rangee.safeParse(tzeentch).success).toBe(true);
    expect(tzeentch.ops).toEqual([choix]);
    expect(gameOpSchema.safeParse(choix).success).toBe(false);
    expect(passifsDe().safeParse([choix]).success).toBe(false);

    const candidatsRefuses = [
      [{ ...choix, trait: { ...choix.trait, arg: 'feu' } }],
      [{ ...choix, trait: { id: 'peur', value: 3 } }],
      [choix, { op: 'removeTrait', trait: { id: 'lanceur-de-sorts' } }],
      [{ op: 'rollTable', die: { n: 1, sides: 10 }, entries: [{ min: 1, max: 10, ops: [choix] }] }],
    ];
    for (const ops of candidatsRefuses) expect(rangee.safeParse({ ...tzeentch, ops }).success).toBe(false);
  });

  it('le registre propose des identifiants de Domaines et réserve la Gueule aux Ogres', () => {
    const clefs = choixDuTrait(choix.trait.id, pnj([])).map((o) => o.key);
    expect(clefs).toHaveLength(16);
    expect(new Set(clefs).size).toBe(16);
    expect(clefs).toEqual(expect.arrayContaining(['feu', 'demonologie', 'tzeentch', 'nurgle', 'slaanesh']));
    expect(clefs).not.toEqual(expect.arrayContaining(['gueule']));
    expect(clefs).not.toContain('khorne');
    expect(clefs).not.toContain('arcane');
    expect(clefs).not.toContain('mineure');
    expect(choixDuTrait(choix.trait.id, combattantDeTest({ groups: ['ogre'] }))).toContainEqual({ key: 'gueule', label: 'Gueule' });
  });

  it('le moteur seul choisit de façon stable sans consommer de dé', () => {
    const a = pnj([]);
    const b = pnj([]);
    const rng = makeRNG(73);
    const tirer = vi.spyOn(rng, 'int');
    applyOps(a, [choix], { rng, idNeuf: idsDeTest, defaultDurationRounds: 2 });
    applyOps(b, [choix], { rng, idNeuf: idsDeTest, defaultDurationRounds: 2 });
    expect(a.traits).toEqual([{ id: 'lanceur-de-sorts', arg: choixDuTrait(choix.trait.id, a)[0].key }]);
    expect(b.traits).toEqual(a.traits);
    expect(tirer).not.toHaveBeenCalled();
  });

  it('les sorts ouverts sont temporaires, cumulés avec les sorts connus, et bornés au Domaine désigné', () => {
    const c = pnj([]);
    c.spells = ['choc', 'cauteriser'];
    const ctx = { rng: makeRNG(73), idNeuf: idsDeTest, defaultDurationRounds: 1 };
    applyOps(c, [resoudreLeChoixDuTrait(choix, 'feu')], ctx);
    expect(sortsDisponibles(c)).toEqual(expect.arrayContaining(['choc', 'cauteriser', 'couronne-de-flammes']));
    expect(sortsDisponibles(c).filter((id) => id === 'cauteriser')).toHaveLength(1);
    expect(sortsDisponibles(c)).not.toContain('arme-aethyrique');
    expect(sortsDisponibles(c)).not.toContain('feu-bleu-de-tzeentch');
    expect(sortsDisponibles(c)).not.toContain('destrier-d-ombre');
    expect(c.spells).toEqual(['choc', 'cauteriser']);
    endOfRound(c, ctx.rng, ctx.idNeuf);
    expect(c.traits).toEqual([]);
    expect(sortsDisponibles(c)).toEqual(c.spells);
  });

  it('le Domaine du Trait octroyé survit à une sérialisation auprès d’un Trait natif', () => {
    const c = pnj([], [{ id: 'lanceur-de-sorts', arg: 'feu' }]);
    const ctx = {
      rng: makeRNG(73), idNeuf: idsDeTest, defaultDurationRounds: 1,
      source: { kind: 'sort', id: 'allure-demoniaque' },
    } as const;
    applyOps(c, [resoudreLeChoixDuTrait(choix, 'feu')], ctx);
    const relu = JSON.parse(JSON.stringify(c)) as Combatant;

    const listes = listesDeSorts(relu);
    expect(listes).toHaveLength(2);
    expect(listes.map((liste) => liste.admet(findSpellById('alerte')!))).toEqual([true, false]);
    expect(listes.map((liste) => liste.admet(findSpellById('couronne-de-flammes')!))).toEqual([true, true]);
    expect(sortsDisponibles(relu)).toContain('couronne-de-flammes');
    expect(sortsDisponibles(relu)).not.toContain('destrier-d-ombre');

    endOfRound(relu, ctx.rng, ctx.idNeuf);
    expect(relu.traits).toEqual(c.traits?.slice(0, 1));
    expect(listesDeSorts(relu)[0].admet(findSpellById('alerte')!)).toBe(true);
    expect(sortsDisponibles(relu)).toEqual([]);
  });

  it('un Domaine du Chaos désigne ses sorts et son libellé sans ajouter une allégeance', () => {
    const c = pnj([{ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 1 }]);
    const ctx = { rng: makeRNG(73), idNeuf: idsDeTest, defaultDurationRounds: 1 };
    applyOps(c, [resoudreLeChoixDuTrait(choix, 'slaanesh')], ctx);
    expect(sortsDisponibles(c)).toEqual(chaosSpellsOf('slaanesh').filter((id) => !findSpellById(id)?.ritual));
    expect(sortsDisponibles(c)).toEqual(expect.arrayContaining(['consentement', 'cacophonie-scabreuse', 'langue-aceree']));
    expect(sortsDisponibles(c)).not.toContain('aspect-sublime');
    expect(listesDeSorts(c).find((liste) => liste.cle === 'lanceur-de-sorts:slaanesh')?.libelle).toBe('Lanceur de Sorts (Slaanesh)');
    expect(groupesDe(c)).toContain('tzeentch');
    expect(groupesDe(c)).not.toContain('slaanesh');
    expect(chaosSpellsOf('tzeentch')).toContain('tremblement');
  });
});

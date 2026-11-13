/**
 * PNJ de carrière (#773) : EDO 11 l.17-21, arbitrages R1-R4 du 2026-11-08. Un profil de 30 partout, porté à son
 * parcours sur les carrières réelles du Livre de base.
 */
import { describe, it, expect } from 'vitest';
import {
  argentDuPnj,
  carriereActuelle,
  designationsDeCarriere,
  parcoursRetouche,
  porterAuParcours,
  refusDuParcours,
  talentsDuParcours,
  type ParcoursDeCarriere,
} from './pnjDeCarriere';
import { combattantDeTest } from './combattantDeTest.testkit';
import { tableTotale } from '../lib/tableTotale';
import { actorStatus } from './social';
import { adresseDeCreation } from './adresseDeCreation';
import { fabricationAtouts, findTrappingById, groupeDeLArme, levelsForCareer } from '../data';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../data/dotations.fixture';
import { availableChars, skillSlots, talentSlots } from './careerSlots';
import { isCareerLevelComplete } from './advancement';
import { augmenterLaCompetence } from './character';
import type { Combatant } from './types';
import { bourseOf, bourseInstanceOf, setBourseBrass } from './bourse';
import { toBrass } from './money';

const porte = (p: ParcoursDeCarriere, id = 'pnj'): Combatant => {
  const c = combattantDeTest({ id });
  porterAuParcours(c, p);
  return c;
};
const avances = (c: Combatant, id: string, spec?: string) => c.skills.find((s) => s.id === id && s.spec === spec)?.advances;
const talentsDuNiveau = (carriere: string, niveau: number) => levelsForCareer(carriere).find((l) => l.level === niveau)!.talents.flatMap((t) => ('id' in t ? [t.id] : []));

describe('porterAuParcours — +5 par Niveau atteint à ce qui est disponible (EDO 11 l.19, R1)', () => {
  const doktor = porte({ carrieres: { medecin: 3 } });
  it('une Caractéristique apparue au Niveau k reçoit 5 × (N − k + 1)', () => {
    expect(doktor.characteristics).toMatchObject({
      dexterite: 45, intelligence: 45, 'force-mentale': 45, // Niveau 1
      sociabilite: 40, // Niveau 2
      initiative: 35, // Niveau 3
      'capacite-de-combat': 30, agilite: 30,
    });
  });
  it('une Compétence apparue au Niveau k reçoit 5 × (N − k + 1) Augmentations', () => {
    expect([avances(doktor, 'calme'), avances(doktor, 'charme'), avances(doktor, 'commandement'), avances(doktor, 'savoir', 'anatomie')]).toEqual([15, 10, 5, 10]);
  });
  it('les Blessures suivent le profil porté : BF 3 + 2 × BE 3 + BFM 4', () => {
    expect(doktor.wounds).toMatchObject({ max: 13, current: 13 });
  });
});

describe('plusieurs carrières : la somme sur tous les Niveaux traversés (R2)', () => {
  it('Force Mentale du Soldat 1 et du Médecin 1 à 3 : +5 + 15', () => {
    const c = porte({ carrieres: { soldat: 1, medecin: 3 } });
    expect(c.characteristics['force-mentale']).toBe(50);
    expect(avances(c, 'calme')).toBe(5 + 15);
  });
  it('la dernière carrière est l’actuelle : carrière, Niveau et carrières portées', () => {
    const c = porte({ carrieres: { soldat: 1, medecin: 3 } });
    expect([c.career, c.careerLevel, c.careerHistory]).toEqual(['medecin', 3, ['soldat', 'medecin']]);
    expect(carriereActuelle({ carrieres: { soldat: 1, medecin: 3 } })).toEqual({ id: 'medecin', niveau: 3 });
  });
});

describe('au moins un Talent par Niveau atteint (EDO 11 l.19)', () => {
  it('le Talent choisi compte pour son Niveau ; chaque autre Niveau en tire un des siens', () => {
    const c = porte({ carrieres: { medecin: 3 }, talentsDeCarriere: { medecin: [{ id: 'chirurgie' }] } });
    const ids = c.talents.map((t) => t.talentId);
    expect(ids).toHaveLength(3);
    expect(ids).toContain('chirurgie');
    expect(ids.filter((id) => talentsDuNiveau('medecin', 1).includes(id))).toHaveLength(1);
    expect(ids.filter((id) => talentsDuNiveau('medecin', 3).includes(id))).toHaveLength(1);
  });
  it('le tirage suit la graine : le même porteur tire les mêmes Talents', () => {
    expect(porte({ carrieres: { medecin: 3 } }, 'a').talents).toEqual(porte({ carrieres: { medecin: 3 } }, 'a').talents);
  });
});

describe('ce qu’un Talent ajoute aux carrières est de carrière dès le Niveau où il est pris (LDB 10 l.70, l.467, l.745, l.891 ; arbitrage du 2026-11-08, #773)', () => {
  const voyageur = (carrieres: ParcoursDeCarriere['carrieres']) => porte({ carrieres, talentsDeCarriere: { flagellant: [{ id: 'voyageur-aguerri' }] } });
  it('Voyageur aguerri pris au Niveau 3 du Flagellant : Savoir (Région) reçoit +5 aux Niveaux 3 et 4, puis à chaque Niveau des carrières suivantes', () => {
    expect(avances(voyageur({ flagellant: 3 }), 'savoir', 'region')).toBe(5);
    expect(avances(voyageur({ flagellant: 4 }), 'savoir', 'region')).toBe(10);
    expect(avances(voyageur({ flagellant: 4, soldat: 2 }), 'savoir', 'region')).toBe(20);
    expect(avances(porte({ carrieres: { flagellant: 2, soldat: 2 } }), 'savoir', 'region')).toBeUndefined();
  });
  it('un Talent tenu avant le parcours ajoute dès le Niveau 1 ; une Compétence « au choix » ajoutée reçoit une spécialisation', () => {
    const tenu = (talentId: string) => {
      const c = combattantDeTest({ id: 'pnj', talents: [{ talentId, times: 1 }] });
      porterAuParcours(c, { carrieres: { medecin: 2 } });
      return c;
    };
    expect(avances(tenu('voyageur-aguerri'), 'savoir', 'region')).toBe(10);
    expect(tenu('artiste').skills.filter((s) => s.id === 'art').map((s) => [typeof s.spec, s.advances])).toEqual([['string', 10]]);
  });
  const flagellant: ParcoursDeCarriere = { carrieres: { flagellant: 2, soldat: 2 }, talentsDeCarriere: { flagellant: [{ id: 'lire-ecrire' }, { id: 'flagellant' }], soldat: [{ id: 'frenesie' }] } };
  it('Frénésie, ajoutée par Flagellant, est un Talent offert des Niveaux suivants : l’auteur la choisit au Soldat', () => {
    expect(refusDuParcours(flagellant)).toBeUndefined();
    expect(talentsDuParcours(flagellant).niveaux.soldat.map((n) => n.offerts.includes('frenesie'))).toEqual([true, true]);
    expect(refusDuParcours({ carrieres: { soldat: 2 }, talentsDeCarriere: { soldat: [{ id: 'frenesie' }] } })).toMatch(/frenesie/);
    expect(parcoursRetouche({ ...flagellant, talentsDeCarriere: { soldat: [{ id: 'frenesie' }] } }).talentsDeCarriere).toBeUndefined();
    expect(porte(flagellant).talents.map((t) => t.talentId)).toContain('frenesie');
  });
  it('sans choix de l’auteur, Frénésie compte parmi les Talents tirés aux Niveaux du Soldat qui suivent Flagellant', () => {
    const tirent = (talents: ParcoursDeCarriere['talentsDeCarriere']) => Array.from({ length: 30 }, (_, i) => porte({ carrieres: { flagellant: 2, soldat: 2 }, talentsDeCarriere: talents }, `pnj-${i}`))
      .filter((c) => c.talents.some((t) => t.talentId === 'frenesie')).length;
    expect(tirent({ flagellant: [{ id: 'lire-ecrire' }, { id: 'flagellant' }] })).toBeGreaterThan(0);
    expect(tirent({ flagellant: [{ id: 'lire-ecrire' }, { id: 'endurci' }] })).toBe(0);
  });
});

describe('Compétences « Au choix » : désignées par l’auteur, sinon tirées', () => {
  it('la Compétence désignée prend l’emplacement, l’emplacement libre reçoit une spécialisation', () => {
    const c = porte({ carrieres: { erudit: 1 }, competencesDeCarriere: { erudit: [{ id: 'savoir', spec: 'histoire' }] } });
    expect(avances(c, 'savoir', 'histoire')).toBe(5);
    const autre = porte({ carrieres: { erudit: 1 } });
    expect(autre.skills.filter((s) => s.id === 'savoir').map((s) => s.spec)).toEqual([expect.any(String)]);
  });
});

describe('designationsDeCarriere — une Compétence d’une entrée sans choix ne prend aucun emplacement « (Au choix) » (LDB 07 l.124)', () => {
  const levels = levelsForCareer('conseiller');
  it('Conseiller Niveau 3 : Savoir (Politique), imprimé au Niveau 1, laisse le joker Savoir à Savoir (Théologie)', () => {
    expect(designationsDeCarriere('conseiller', 3, [{ id: 'savoir', spec: 'politique' }, { id: 'savoir', spec: 'theologie' }]))
      .toEqual({ designations: { '3:skill:3:savoir*': 'savoir|theologie' }, refusees: [] });
  });
  it('Conseiller Niveau 3 : six Compétences imprimées ne complètent pas le Niveau, huit le complètent', () => {
    const complet = (cles: string[]) => {
      const refs = cles.map((k) => { const [id, spec] = k.split('|'); return spec ? { id, spec } : { id }; });
      const { designations } = designationsDeCarriere('conseiller', 3, refs);
      const hero = combattantDeTest({ charAdvances: tableTotale(availableChars(levels, 3), () => 15), talents: [{ talentId: 'ergoteur', times: 1 }] });
      for (const r of refs) augmenterLaCompetence(hero.skills, r, 15);
      return isCareerLevelComplete(hero, 3, { skillSlots: skillSlots(levels, 3), talentSlots: talentSlots(levels, 3), careerChars: availableChars(levels, 3), designations });
    };
    const six = ['langue|classique', 'marchandage', 'perception', 'ragot', 'resistance', 'savoir|politique'];
    expect(complet(six)).toBe(false);
    expect(complet([...six, 'calme', 'charme'])).toBe(true);
  });
});

describe('dotations de la carrière actuelle et de ses Niveaux inférieurs, sans celles de la Classe (R3, R4)', () => {
  it('le Doktor porte les dotations des Niveaux 1 à 3 du Médecin, aucune des Lettrés', () => {
    const ids = porte({ carrieres: { medecin: 3 } }).items!.map((i) => i.trappingId);
    expect(ids).toEqual(expect.arrayContaining(['bandages', 'potion-de-guerison', 'livre-medecine', 'licence-de-guilde', 'outils-professionnels-medecin', 'atelier']));
    expect(ids).not.toContain('bourse');
  });
  it('la carrière d’avant ne dote pas', () => {
    expect(porte({ carrieres: { soldat: 2, medecin: 1 } }).items!.map((i) => i.trappingId)).toEqual(['bandages', 'potion-de-guerison']);
  });
  it('la branche choisie par l’auteur dote ; sans choix, une branche est tirée', () => {
    const plume = porte({ carrieres: { artiste: 1 }, dotationsDeCarriere: { [adresseDeCreation.dotation([0])]: 2 } });
    expect(plume.items!.map((i) => i.trappingId)).toEqual(['plume-d-oie']);
    expect(porte({ carrieres: { artiste: 1 } }).items!.map((i) => i.trappingId)).toEqual([expect.stringMatching(/^(pinceau|ciseau|plume-d-oie)$/)]);
  });
  it('le Statut est celui du Niveau atteint de la carrière actuelle : le Doktor de l’exemple est Argent 5 (EDO 11 l.27)', () => {
    expect(actorStatus(porte({ carrieres: { medecin: 3 } }))).toEqual({ tier: 'argent', standing: 5 });
  });
});

describe('armes au choix du PNJ : joker d’un Groupe d’armes, joker à Atout (fixture)', () => {
  const dot = adresseDeCreation.dotation;
  const avecFixture = <T>(fn: () => T): T => avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, fn);
  it('sans choix, le joker de Groupe tire une arme de son Groupe, le joker à Atout son arme et un Atout de Fabrication', () => {
    avecFixture(() => {
      const items = porte({ carrieres: { artiste: 1 }, dotationsDeCarriere: { [dot([0])]: 'fouet', [dot([2])]: 0, [dot([2, 0])]: 0, [dot([4])]: 0, [dot([6])]: 'rapiere' } }).items!;
      expect(items.filter((i) => groupeDeLArme(findTrappingById(i.trappingId!)!)?.id === 'deux-mains')).toHaveLength(1);
      expect(items.find((i) => i.trappingId === 'rapiere')!.qualities.filter((q) => fabricationAtouts().includes(q.id))).toHaveLength(1);
    });
  });
  it('refuse une arme hors du Groupe du joker, admet une arme du Groupe et un Atout de Fabrication', () => {
    avecFixture(() => {
      expect(refusDuParcours({ carrieres: { artiste: 1 }, dotationsDeCarriere: { [dot([5])]: 'rapiere' } })).toMatch(/valeur/);
      expect(refusDuParcours({ carrieres: { artiste: 1 }, dotationsDeCarriere: { [dot([5])]: 'grande-hache', [dot([6])]: 'rapiere', [dot([6, 0])]: 'solide' } })).toBeUndefined();
    });
  });
});

describe('refusDuParcours et parcoursRetouche', () => {
  it('refuse un Niveau absent, un Talent qu’aucun Niveau atteint n’offre, une Compétence sans emplacement, une dotation hors emplacement', () => {
    expect(refusDuParcours({ carrieres: { medecin: 3 } })).toBeUndefined();
    expect(refusDuParcours({ carrieres: { medecin: 5 } })).toMatch(/Niveau 5/);
    expect(refusDuParcours({ carrieres: { medecin: 1 }, talentsDeCarriere: { medecin: [{ id: 'chirurgie' }] } })).toMatch(/chirurgie/);
    expect(refusDuParcours({ carrieres: { medecin: 1 }, competencesDeCarriere: { medecin: [{ id: 'savoir', spec: 'histoire' }] } })).toMatch(/savoir/);
    expect(refusDuParcours({ carrieres: { artiste: 1 }, dotationsDeCarriere: { [adresseDeCreation.dotation([0])]: 3 } })).toMatch(/valeur/);
    expect(refusDuParcours({ carrieres: { medecin: 1 }, dotationsDeCarriere: { [adresseDeCreation.dotation([0])]: 0 } })).toMatch(/emplacement/);
  });
  it('retouché, le parcours perd ce que ses Niveaux n’offrent plus', () => {
    const p: ParcoursDeCarriere = { carrieres: { medecin: 1 }, talentsDeCarriere: { medecin: [{ id: 'chirurgie' }, { id: 'lire-ecrire' }], soldat: [{ id: 'guerrier-ne' }] } };
    expect(parcoursRetouche(p)).toEqual({ carrieres: { medecin: 1 }, talentsDeCarriere: { medecin: [{ id: 'lire-ecrire' }] }, competencesDeCarriere: undefined, dotationsDeCarriere: undefined });
  });
});

describe('argentDuPnj — l’argent du PNJ qui n’en porte pas, dans sa Bourse (EDO 11 l.42-46)', () => {
  const tire = (id: string) => {
    const c = porte({ carrieres: { medecin: 3 } }, id);
    argentDuPnj(c);
    return bourseInstanceOf(c);
  };
  it('le Doktor (Argent 5) porte 5d10 pistoles d’argent, sans Test (EDO 11 l.46), à la graine de son id', () => {
    const pistoles = ['langstrasse', 'a', 'b', 'c', 'd', 'e'].map((id) => toBrass(tire(id)!.money!) / 12);
    expect(pistoles.every((p) => Number.isInteger(p) && p >= 5 && p <= 50), pistoles.join(', ')).toBe(true);
    expect(tire('langstrasse')).toEqual(tire('langstrasse'));
  });
  it('le PNJ qui porte déjà de l’argent ne tire rien', () => {
    const c = porte({ carrieres: { medecin: 3 } }, 'langstrasse');
    setBourseBrass(c, 7, () => 'langstrasse-bourse');
    argentDuPnj(c);
    expect([toBrass(bourseOf(c)), c.items!.filter((i) => i.trappingId === 'bourse').length]).toEqual([7, 1]);
  });
});

describe('porterAuParcours — l’argent et les mentions imprimés aux Niveaux atteints (EDO 11 l.19, l.44)', () => {
  it('le Marchand de Niveau 2 porte les 3d10 pistoles du Niveau 1 et les 20 couronnes du Niveau 2, sans revenu de Statut', () => {
    for (const id of ['a', 'b', 'c']) {
      const c = porte({ carrieres: { marchand: 2 } }, id);
      const avant = toBrass(bourseOf(c));
      argentDuPnj(c);
      const pistoles = (avant - 20 * 240) / 12;
      expect([Number.isInteger(pistoles) && pistoles >= 3 && pistoles <= 30, toBrass(bourseOf(c))], String(pistoles)).toEqual([true, avant]);
    }
  });
  it('le Tueur de Niveau 1 porte sa mention « Honte »', () => {
    expect(porte({ carrieres: { tueur: 1 } }).mentions).toEqual([{ nature: 'intangible', label: 'Honte', nombre: 1 }]);
  });
});

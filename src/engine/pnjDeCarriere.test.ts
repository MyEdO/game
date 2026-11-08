/**
 * PNJ de carrière (#773) : EDO 11 l.17-21, arbitrages R1-R4 du 2026-11-08. Un profil de 30 partout, porté à son
 * parcours sur les carrières réelles du Livre de base.
 */
import { describe, it, expect } from 'vitest';
import { carriereActuelle, parcoursRetouche, porterAuParcours, refusDuParcours, type ParcoursDeCarriere } from './pnjDeCarriere';
import { combattantDeTest } from './combattantDeTest.testkit';
import { actorStatus } from './social';
import { adresseDeCreation } from './adresseDeCreation';
import { levelsForCareer } from '../data';
import type { Combatant } from './types';

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

describe('Compétences « Au choix » : désignées par l’auteur, sinon tirées', () => {
  it('la Compétence désignée prend l’emplacement, l’emplacement libre reçoit une spécialisation', () => {
    const c = porte({ carrieres: { erudit: 1 }, competencesDeCarriere: { erudit: [{ id: 'savoir', spec: 'histoire' }] } });
    expect(avances(c, 'savoir', 'histoire')).toBe(5);
    const autre = porte({ carrieres: { erudit: 1 } });
    expect(autre.skills.filter((s) => s.id === 'savoir').map((s) => s.spec)).toEqual([expect.any(String)]);
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

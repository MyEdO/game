/**
 * PHOBIE DU NOIR (ADE II 09 l.9-11 ; #3045) : au cumul des États Brisé des Terreurs subies, la Phobie offre la
 * cause la plus récente ou la plus fréquente ; par défaut, le premier Groupe de la plus récente.
 */
import { describe, it, expect } from 'vitest';
import { ciblesDePhobieDuNoir } from './psychology';
import { ciblePsy } from './psych/ciblage';
import { bonus } from './characteristics';
import type { Combatant, TerreurSubie } from './types';

const FM = 35;
const porteur = { characteristics: { 'force-mentale': FM }, conditions: [], talents: [], traits: [], skills: [] } as unknown as Combatant;
const seuil = bonus(FM);
const groupes = (...ids: string[]) => ids.map((id) => ciblePsy.groupe(id));

describe('ciblesDePhobieDuNoir — le seuil (ADE II 09 l.9)', () => {
  it('sous le Bonus de Force Mentale, aucune Phobie ; atteint, une Phobie', () => {
    expect(ciblesDePhobieDuNoir(porteur, [{ brise: seuil - 1, groupes: ['skaven'] }])).toBeUndefined();
    expect(ciblesDePhobieDuNoir(porteur, [{ brise: seuil - 1, groupes: ['skaven'] }, { brise: 1, groupes: ['skaven'] }])?.candidats).toEqual(groupes('skaven'));
  });

  it('sans Groupe de cause, aucune Phobie', () => {
    expect(ciblesDePhobieDuNoir(porteur, [{ brise: seuil, groupes: [] }])).toBeUndefined();
  });
});

describe('ciblesDePhobieDuNoir — « la cause de la Terreur qu’il a subi le plus récemment ou le plus souvent » (ADE II 09 l.9)', () => {
  it('la cause la plus récente, puis la plus fréquente ; par défaut, le premier Groupe de la plus récente', () => {
    const terreurs: TerreurSubie[] = [
      { brise: 1, groupes: ['skaven'] },
      { brise: 1, groupes: ['skaven'] },
      { brise: seuil, groupes: ['mort-vivant', 'demon'] },
    ];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)).toEqual({ candidats: groupes('mort-vivant', 'demon', 'skaven'), parDefaut: ciblePsy.groupe('mort-vivant') });
  });

  it('les candidats suivent l’ordre de `groups.json` ; par défaut, le premier Groupe de la plus récente dans cet ordre', () => {
    const terreurs: TerreurSubie[] = [
      { brise: 1, groupes: ['humain'] },
      { brise: 1, groupes: ['humain'] },
      { brise: seuil, groupes: ['skaven'] },
    ];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)).toEqual({ candidats: groupes('humain', 'skaven'), parDefaut: ciblePsy.groupe('skaven') });
    expect(ciblesDePhobieDuNoir(porteur, [{ brise: seuil, groupes: ['demon', 'mort-vivant'] }])).toEqual({ candidats: groupes('mort-vivant', 'demon'), parDefaut: ciblePsy.groupe('mort-vivant') });
  });

  it('une cause ni la plus récente ni la plus fréquente n’est pas offerte', () => {
    const terreurs: TerreurSubie[] = [
      { brise: 1, groupes: ['skaven'] },
      { brise: 1, groupes: ['skaven'] },
      { brise: 1, groupes: ['nain'] },
      { brise: seuil, groupes: ['mort-vivant'] },
    ];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)).toEqual({ candidats: groupes('mort-vivant', 'skaven'), parDefaut: ciblePsy.groupe('mort-vivant') });
  });

  it('à fréquence égale, toutes les causes ex æquo sont les plus fréquentes (#3045)', () => {
    const terreurs: TerreurSubie[] = [
      { brise: 1, groupes: ['skaven'] },
      { brise: 1, groupes: ['nain'] },
      { brise: seuil - 2, groupes: ['mort-vivant'] },
    ];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)?.candidats).toEqual(expect.arrayContaining(groupes('skaven', 'nain', 'mort-vivant')));
    expect(ciblesDePhobieDuNoir(porteur, terreurs)?.candidats).toHaveLength(3);
  });

  it('la plus récente est aussi la plus fréquente : offerte une fois', () => {
    const terreurs: TerreurSubie[] = [{ brise: 1, groupes: ['skaven'] }, { brise: seuil, groupes: ['skaven'] }];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)).toEqual({ candidats: groupes('skaven'), parDefaut: ciblePsy.groupe('skaven') });
  });

  it('un id hors de `groups.json` ne compte pas', () => {
    const terreurs: TerreurSubie[] = [{ brise: 1, groupes: ['groupe-perime'] }, { brise: 1, groupes: ['groupe-perime'] }, { brise: 1, groupes: ['skaven'] }, { brise: seuil, groupes: [] }];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)).toEqual({ candidats: groupes('skaven'), parDefaut: ciblePsy.groupe('skaven') });
    expect(ciblesDePhobieDuNoir(porteur, [{ brise: seuil, groupes: ['groupe-perime'] }])).toBeUndefined();
  });

  it('la plus récente sans Groupe : la plus fréquente, par défaut', () => {
    const terreurs: TerreurSubie[] = [{ brise: 1, groupes: ['skaven'] }, { brise: seuil, groupes: [] }];
    expect(ciblesDePhobieDuNoir(porteur, terreurs)).toEqual({ candidats: groupes('skaven'), parDefaut: ciblePsy.groupe('skaven') });
  });
});

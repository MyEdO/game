/**
 * #3908 L2 — les carrières qu'un tirage au Tableau des Classes et Carrières aléatoires permet de prendre à la place
 * de la carrière tirée (`careers[].aLaPlaceDe`), bornées à leurs espèces (`especesALaPlaceDe`), à la race de la
 * carrière (`races`) et à sa règle optionnelle (`gatedByRule`) : Middenheim 09 l.57 ; AA 05 l.135-140 ; VDM 03 l.11,
 * l.27 ; ADE I 07 l.9-11 ; LDB 08 l.1676, l.2292, l.2357.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { findSpeciesById, offreDuJet, substitutionsDe, varianteDe } from '.';
import { resetRule, setRule } from '../engine/policy';
import { schema } from './schemas/defs/careers';
import careersJson from './careers.json';

const CHEVAUCHEUR = 'creation-chevaucheur-de-blaireau';
const espece = (id: string) => findSpeciesById(id)!;
const COLLEGES = ['hierophante', 'alchimiste', 'druide', 'astromancien', 'spirite', 'pyromancien', 'chamane', 'umbramancien'];

afterEach(() => resetRule(CHEVAUCHEUR));

describe('substitutions du tirage de carrière, par espèce', () => {
  it('un Tiléen qui tire Flagellant peut prendre Nonne ou Prêtre (AA 05 l.137) ; un Reiklander, rien', () => {
    expect(substitutionsDe('flagellant', espece('humains-tileens'))).toEqual(['nonne', 'pretre']);
    expect(substitutionsDe('flagellant', espece('humains-reiklander'))).toEqual([]);
  });

  it('un Middenheimer qui tire Frère Loup peut prendre Flagellant (Middenheim 09 l.57)', () => {
    expect(substitutionsDe('frere-loup', espece('humains-middenheim'))).toEqual(['flagellant']);
  });

  it('Chevaucheur de blaireau à la place de Soldat : l’espèce `halflings` seule, sa règle active (ADE I 07 l.9-11)', () => {
    expect(substitutionsDe('soldat', espece('halflings')), 'règle inactive par défaut').toEqual([]);
    setRule(CHEVAUCHEUR, true);
    expect(substitutionsDe('soldat', espece('halflings'))).toEqual(['chevaucheur-de-blaireau']);
    expect(substitutionsDe('soldat', espece('halflings-cendreplaine')), 'un clan du Reikland (ADE I 02 l.11)').toEqual([]);
  });

  it('un Tiléen qui tire Soldat peut prendre Piquier (AA 05 l.139), et les variantes d’AA de sa colonne au second lancer ; un Reiklander, aucune substitution', () => {
    expect(substitutionsDe('soldat', espece('humains-tileens'))).toEqual(['piquier']);
    expect(offreDuJet(espece('humains-tileens'), { id: 'soldat' })).toEqual(['soldat', 'piquier']);
    expect(varianteDe('soldat', espece('humains-tileens'))?.id).toBe('variantes-soldat');
    expect(substitutionsDe('soldat', espece('humains-reiklander'))).toEqual([]);
  });

  it('Cavalier léger et Prêtre de Myrmidia pour le Tiléen (AA 05 l.138, l.140)', () => {
    expect(substitutionsDe('cavalier', espece('humains-tileens'))).toEqual(['cavalier-leger']);
    expect(substitutionsDe('pretre-guerrier', espece('humains-tileens'))).toEqual(['pretre-de-myrmidia']);
  });

  it('qui tire Sorcier peut prendre l’une des 8 carrières de Collège admises à sa race (VDM 03 l.11, l.27)', () => {
    expect(substitutionsDe('sorcier', espece('humains-reiklander'))).toEqual(COLLEGES);
    expect(substitutionsDe('sorcier', espece('hauts-elfes'))).toEqual([]);
  });
});

describe('schéma de `aLaPlaceDe` et `especesALaPlaceDe`', () => {
  const RANG = careersJson.findIndex((c) => c.id === 'piquier');
  const avec = (champs: Record<string, unknown>) => careersJson.map((c, i) => (i === RANG ? { ...c, ...champs } : c));
  const sans = (cle: string) => careersJson.map((c, i) => (i === RANG ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== cle)) : c));

  it('le document réel parse', () => {
    expect(schema.safeParse(careersJson).success).toBe(true);
  });

  it('refuse une carrière écrite en id nu, et une espèce inconnue', () => {
    expect(schema.safeParse(avec({ aLaPlaceDe: 'soldat' })).success).toBe(false);
    expect(schema.safeParse(avec({ especesALaPlaceDe: ['tileens'] })).success).toBe(false);
  });

  it('refuse `especesALaPlaceDe` sans `aLaPlaceDe`, et nomme le champ manquant', () => {
    const r = schema.safeParse(sans('aLaPlaceDe'));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContainEqual(expect.stringContaining('« piquier » porte `especesALaPlaceDe` sans `aLaPlaceDe`'));
  });
});

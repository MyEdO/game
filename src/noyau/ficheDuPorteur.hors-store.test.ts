/**
 * L'EN-TÊTE DE LA FICHE (#3975) : `enTeteDuPorteur` a le domaine de `ficheDuPorteur` (le porteur par `porteurParId`,
 * `null` sans lui ou pour une coque) et en rend les mêmes champs. LA FICHE EN DONNÉES (#4574) : bourse et argent en
 * `Money`, contenant et localisation par id, Compétence par id et Spécialisation, possessions comptées ensemble
 * seulement quand leurs instances sont égales.
 */
import { describe, it, expect } from 'vitest';
import { enTeteDuPorteur, ficheDuCombattant, ficheDuPorteur, type Jeu } from './index';
import { nouvelEntete, ouvrirLaPartie } from '../hote/partieDeTest';
import { itemFromTrappingById } from '../engine/items';
import { catalogueDeLaPartie } from '../hote/contenu';

const CATALOGUE = catalogueDeLaPartie([]);

/** L'état du scénario `id` à son lancement. */
function auLancement<T>(id: string, faire: (etat: Jeu) => T): T {
  const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, id, { graine: 7 }), () => {});
  try {
    return faire(partie.etat());
  } finally {
    partie.fermer();
  }
}

/** Pour chaque porteur de `etat` (la bataille, le groupe, et un id sans porteur), l'en-tête et les mêmes champs de la fiche. */
const comparaisons = (etat: Jeu) =>
  [...new Set([...(etat.battle?.combatants ?? []), ...etat.party].map((c) => c.id)), 'sans-porteur'].map((id) => {
    const f = ficheDuPorteur(etat, id);
    return { id, enTete: enTeteDuPorteur(etat, id), fiche: f && { id: f.id, nom: f.nom, carriere: f.carriere, blessures: f.blessures, etats: f.etats } };
  });

describe('l’en-tête de la fiche est celui de la fiche (#3975)', () => {
  it.each([
    ['dome', 'combat : héros et créatures'],
    ['duel-naval', 'combat naval : coques comprises'],
    ['a-bord-de-la-caraque', 'hors combat : le groupe'],
  ])('%s (%s) : mêmes champs, et `null` où la fiche l’est', (scenario) => {
    const lus = auLancement(scenario, comparaisons);
    expect(lus.map(({ id, enTete }) => ({ id, enTete }))).toEqual(lus.map(({ id, fiche }) => ({ id, enTete: fiche })));
    expect(lus.some((l) => l.fiche !== null), `${scenario} : aucun porteur à fiche`).toBe(true);
  });

  it('une coque n’a ni fiche ni en-tête', () => {
    const coques = auLancement('duel-naval', (etat) => (etat.battle?.combatants ?? []).filter((c) => ficheDuPorteur(etat, c.id) === null).map((c) => enTeteDuPorteur(etat, c.id)));
    expect(coques.length, 'duel-naval : aucune coque en bataille').toBeGreaterThan(0);
    expect(coques.every((e) => e === null)).toBe(true);
  });
});

describe('la fiche en données (#4574)', () => {
  let n = 0;
  const fab = () => `fiche-${++n}`;
  /** Un objet du catalogue `id`, garanti. */
  const objet = (id: string) => {
    const it = itemFromTrappingById(id, fab);
    if (!it) throw new Error(`objet ${id} absent du catalogue`);
    return it;
  };

  it('bourse et argent en Money, contenant par son uid, possessions comptées ensemble seulement à instances égales', () => {
    auLancement('dome', (etat) => {
      const h = structuredClone(etat.party[0]);
      const bourse = { ...objet('bourse'), money: { gold: 1, silver: 2, brass: 3 } };
      const [s1, s2] = [objet('besace'), objet('besace')];
      const rangee = { ...objet('dague'), inside: s2.uid };
      const [a, c] = [objet('dague'), objet('dague')];
      const nonIdentifiee = { ...objet('dague'), identified: false };
      const sansCatalogue = { ...objet('dague'), trappingId: undefined };
      h.items = [bourse, s1, s2, rangee, a, nonIdentifiee, sansCatalogue, c];
      const f = ficheDuCombattant(h, () => undefined)!;
      expect(f.bourse, 'la bourse en Money').toEqual({ gold: 1, silver: 2, brass: 3 });
      const par = new Map(f.possessions.map((p) => [p.uid, p]));
      expect(par.get(bourse.uid)?.argent, 'l’argent d’une possession en Money').toEqual({ gold: 1, silver: 2, brass: 3 });
      expect([...par.keys()], 'deux Besaces, une dague non identifiée, une sans catalogue : chacune sa ligne ; deux dagues égales une seule')
        .toEqual([bourse.uid, s1.uid, s2.uid, rangee.uid, a.uid, nonIdentifiee.uid, sansCatalogue.uid]);
      expect(par.get(a.uid)?.nombre, 'deux dagues identiques').toBe(2);
      expect([par.get(nonIdentifiee.uid)?.nombre, par.get(sansCatalogue.uid)?.nombre]).toEqual([1, 1]);
      expect(par.get(rangee.uid)?.contenant, 'le contenant par son uid et son nom').toEqual({ uid: s2.uid, nom: par.get(s2.uid)?.libelle });
      expect(par.has(s2.uid), 'le contenant est une possession publiée').toBe(true);
      expect(par.get(a.uid)?.contenant).toBeNull();
    });
  });

  it('une Compétence par son id et sa Spécialisation : deux Langue se distinguent', () => {
    auLancement('dome', (etat) => {
      const f = ficheDuCombattant(etat.party[0], () => undefined)!;
      const langues = f.competences.filter((c) => c.id === 'langue').map((c) => [c.id, c.spec, c.libelle]);
      expect(langues, 'Langue (Magick) et Langue (Bretonnien)').toEqual(expect.arrayContaining([['langue', 'magick', 'Langue (Magick)'], ['langue', 'bretonnien', 'Langue (Bretonnien)']]));
    });
  });

  it('l’armure par localisation : son id et son nom', () => {
    auLancement('dome', (etat) => {
      expect(ficheDuPorteur(etat, 'enemy-enc-dome-1')?.armure[0]).toEqual({ localisation: { id: 'tete', nom: 'Tête' }, pa: 3 });
    });
  });
});

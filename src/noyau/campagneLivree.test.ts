/**
 * Une campagne livrée (`campagneLivree.ts`) : à l'import, son identité, son paquet NON PARSÉ gardé privé (`campagneDuPaquet`) ;
 * au geste, le paquet passe la porte (`paquetDuJeu`) et se lance par la projection unique (`campagneDuJeu`,
 * `campagneDuDocument`) ; le Compendium le lit en forme disque (`paquetDisqueDuJeu`). #211 #1692 #4936 Paquet LITTÉRAL.
 */
import { describe, it, expect } from 'vitest';
import { campagneDuJeu, campagneDuPaquet, paquetDisqueDuJeu, paquetDuJeu } from './campagneLivree';
import { documentDeProjet, parseProject, ProjetRefuse } from './worldMap';
import { emptyScene } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
import { allAxes } from '../data';

const fichier = 'banc-projet.json';
const paquetLitteral = JSON.parse(JSON.stringify(documentDeProjet(
  { type: 'projet', id: 'banc', label: 'Campagne du banc', icon: 'scenario/arene', versionContenu: 2, maison: 'fixture de test' },
  [{ ...emptyScene('banc-entree', 4, 4), label: 'Entrée du banc' }, { ...emptyScene('banc-suite', 4, 4), label: 'Suite du banc' }],
  { narratif: emptyNarratif() },
))) as Record<string, unknown> & { scenes: Record<string, unknown>[] };

function refusDuProjet(paquet: unknown): ProjetRefuse {
  try {
    parseProject(paquet);
  } catch (erreur) {
    if (erreur instanceof ProjetRefuse) return erreur;
    throw erreur;
  }
  throw new Error('Le projet devait être refusé.');
}

describe('campagneDuPaquet — l’identité à l’import, le paquet gardé privé', () => {
  it('l’identité est lue à la racine du paquet ; le paquet ne se lit qu’en copie, en forme disque', () => {
    const campagne = campagneDuPaquet(paquetLitteral, fichier);
    expect(campagne).toEqual({
      type: 'projet', id: 'banc', label: 'Campagne du banc', icon: 'scenario/arene', versionContenu: 2, maison: 'fixture de test', fichier,
    });
    const disque = paquetDisqueDuJeu(campagne);
    expect(disque).toEqual(paquetLitteral);
    expect(disque).not.toBe(paquetLitteral);
    expect(disque.scenes[0]).not.toBe(paquetLitteral.scenes[0]);
  });

  it('une copie de la campagne n’est pas une campagne livrée : aucun paquet ne la suit', () => {
    const campagne = campagneDuPaquet(paquetLitteral, fichier);
    expect(() => paquetDuJeu({ ...campagne })).toThrow(/aucun paquet livré/);
    expect(() => paquetDisqueDuJeu({ ...campagne })).toThrow(/aucun paquet livré/);
  });

  const { label: _label, ...sansLabel } = paquetLitteral;
  const { maison: _maison, ...sansProvenance } = paquetLitteral;
  const { icon: _icon, ...sansIcone } = paquetLitteral;

  it.each([
    ['label', sansLabel],
    ['type', { ...paquetLitteral, type: 'scene' }],
    ['icon', { ...paquetLitteral, icon: 'hors-registre-des-icones' }],
    ['source', sansProvenance],
  ] as const)('partage le refus du projet sur le champ %s, en nommant le fichier', (champ, paquet) => {
    const { cause, fautes } = refusDuProjet(paquet);
    expect(fautes.map((faute) => faute.chemin)).toEqual([[champ]]);
    expect(() => campagneDuPaquet(paquet, fichier)).toThrow(expect.objectContaining({
      name: 'ProjetRefuse',
      cause,
      fautes,
      message: expect.stringContaining(fichier),
    }));
  });

  it('exige une icône, que l’enveloppe du projet pose optionnelle', () => {
    expect(parseProject(sansIcone).icon).toBeUndefined();
    expect(() => campagneDuPaquet(sansIcone, fichier)).toThrow(expect.objectContaining({
      name: 'ProjetRefuse',
      fautes: [expect.objectContaining({ chemin: ['icon'] })],
    }));
  });

  it('lit l’auteur sans accéder aux scènes', () => {
    const paquet = {
      ...paquetLitteral,
      auteur: 'A',
      get scenes(): never {
        throw new Error('Le lecteur d’identité a lu les scènes.');
      },
    };
    const campagne = campagneDuPaquet(paquet, fichier);
    expect(campagne.auteur).toBe('A');
    expect(campagne).not.toHaveProperty('scenes');
    expect(campagne).not.toHaveProperty('paquet');
  });

  it('contrôle la cohérence de l’adresse de description, sans la garder', () => {
    const descRef = { book: 'ennemi-dans-l-ombre', ch: '01', parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }] };
    const paquet = { ...paquetLitteral, desc: 'Description de test.', descRef };
    const campagne = campagneDuPaquet(paquet, fichier);
    expect(campagne.desc).toBe(parseProject(paquet).desc);
    expect(campagne).not.toHaveProperty('descRef');

    const autreLivre = { ...paquet, source: { book: 'aux-armes', page: 1 } };
    const { cause, fautes } = refusDuProjet(autreLivre);
    expect(fautes.map((faute) => faute.chemin)).toEqual([['descRef', 'book']]);
    expect(() => campagneDuPaquet(autreLivre, fichier)).toThrow(expect.objectContaining({ cause, fautes }));
  });
});

describe('paquetDuJeu et campagneDuJeu — le paquet passé par la porte au geste', () => {
  const campagne = campagneDuPaquet(paquetLitteral, fichier);

  it('`campagneDuJeu` lance la campagne sous son id, à la première scène du paquet, sous l’identité du document', () => {
    const lancee = campagneDuJeu(campagne);
    expect(lancee).toMatchObject({ id: 'banc', label: 'Campagne du banc', startSceneId: 'banc-entree', worldMap: null, projet: { id: 'banc' } });
    expect(lancee.scenes.map((s) => s.id)).toEqual(['banc-entree', 'banc-suite']);
  });

  it('chaque passage rend une copie : le paquet commité n’est jamais touché', () => {
    const a = paquetDuJeu(campagne);
    expect(a).toEqual(paquetDuJeu(campagne));
    expect(a.scenes[0]).not.toBe(paquetDuJeu(campagne).scenes[0]);
    expect(a.scenes[0]).not.toBe(paquetLitteral.scenes[0]);
  });

  it('un paquet que la porte refuse : `paquetDuJeu` et `campagneDuJeu` lèvent `ProjetRefuse`', () => {
    const [premiere, ...autres] = paquetLitteral.scenes;
    const refusee = campagneDuPaquet(
      { ...paquetLitteral, scenes: [{ ...premiere, entities: [{ id: 'x', kind: 'prop', decor: { id: 'decor-inconnu' }, pos: { x: 0, y: 0 } }] }, ...autres] },
      fichier,
    );
    expect(() => paquetDuJeu(refusee)).toThrow(ProjetRefuse);
    expect(() => campagneDuJeu(refusee)).toThrow(ProjetRefuse);
  });
});

/** `activeAxes` (#409) suit la campagne livrée comme une entrée de bibliothèque : présent seulement s'il est déclaré. */
describe('activeAxes — porté du paquet à la campagne lancée', () => {
  const axes = allAxes.filter((a) => !a.core).map((a) => a.id);
  const sansAxes = campagneDuPaquet(paquetLitteral, fichier);
  const paquetAvecAxes = { ...paquetLitteral, activeAxes: axes };
  const avecAxes = campagneDuPaquet(paquetAvecAxes, fichier);

  it('le registre porte des axes hors socle', () => {
    expect(axes.length).toBeGreaterThan(0);
  });

  it('un paquet qui n’en déclare pas : aucune clé `activeAxes`', () => {
    expect('activeAxes' in campagneDuJeu(sansAxes)).toBe(false);
  });

  it('un paquet qui en déclare : la campagne lancée les porte', () => {
    expect(campagneDuJeu(avecAxes).activeAxes).toEqual(axes);
  });
});

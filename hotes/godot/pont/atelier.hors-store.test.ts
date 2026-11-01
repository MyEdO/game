/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : `modelesDeLAtelier` rend chaque base avec
 * ses points d'accroche, emplacements puis prises, à chaque point les éléments rigides de cette base dont un mesh pend à
 * l'os du point (`osDesRigides`), ses lignes de pièce tirées de la garde-robe (#3086, D3), où vont ses éléments liés au
 * squelette ou en surface, le fichier GLB de chaque base et de chaque élément servi, et pour ces seuls éléments les noms de
 * leurs surfaces `blason`, et la marche de chaque base (l'unique clip de ses appuis et sa vitesse au sol, au gabarit
 * neutre) ; les emblèmes sont la sous-liste `embleme` de la garde-robe ; un rigide sans os n'est servi nulle part, les
 * refus de l'index sont rendus, une base à marche ambiguë est refusée seule, un manifeste schéma 2 est ignoré.
 */
import { describe, expect, it } from 'vitest';
import { baseDeTest, elementSchema3, glbDElement } from '../asset/modeles.testkit.ts';
import { empreinte } from '../asset/empreinte.ts';
import { gardeRobe } from '../../../src/noyau/index';
import { modelesDeLAtelier } from './atelier';

const dos = { os: 'spine', position: [0, 0.1, 0], rotation: [0, 0, 0] };
const humanoide = { ...baseDeTest('humanoide'), emplacements: { dos }, appuis: { ...baseDeTest('humanoide').appuis, pieds: ['root'], vitessesAuSol: { Walk_Loop: 1.25 } } };
const epee = elementSchema3('humanoide');
const chemise = {
  schema: 3, base: 'humanoide', categorie: 'vetement', cle: { piece: 'chemise' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse'],
  emplacements: { epaule_d: { os: 'root', position: [0.2, 0.3, 0], rotation: [0, 0, 0] } },
  surfaces: [{ nom: 'tissu', palette: 'tissu' }, { nom: 'ecusson', palette: 'tissu', blason: true }], glb: empreinte(glbDElement('root', ['tissu', 'ecusson'])),
};
const teteNaine = {
  schema: 3, base: 'humanoide', categorie: 'tete', cle: { tete: 'nain' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['tete'],
  surfaces: [{ nom: 'peau', palette: 'peau' }], glb: empreinte(glbDElement('root', ['peau'])),
};
const broche = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'baudrier' }, liaison: { mode: 'surface' }, couvre: [] };
const bouclier = {
  ...elementSchema3('humanoide'), cle: { apparence: 'bouclier_blason' },
  surfaces: [{ nom: 'metal', teinte: true }, { nom: 'champ', teinte: true, blason: true }], glb: empreinte(glbDElement('spine', ['metal', 'champ'])),
};
const lanterne = { ...elementSchema3('humanoide'), cle: { apparence: 'targe' }, surfaces: [{ nom: 'verre', teinte: true, blason: true }], glb: empreinte(glbDElement(null, ['verre'])) };
const orpheline = { ...elementSchema3('nain'), cle: { apparence: 'hache' } };
const schema2 = { schema_version: 2, model: 'Lame.glb' };

describe('modelesDeLAtelier', () => {
  const modeles = modelesDeLAtelier(
    { humanoide, epee, bouclier, lanterne, chemise, teteNaine, broche, orpheline, schema2 },
    { humanoide: [], epee: ['root'], bouclier: ['spine', 'handslot.l'], lanterne: [], chemise: ['root'], teteNaine: ['root'], broche: ['root'] },
  );
  const lignes = modeles.bases[0].lignes;

  it('une base donne ses points, emplacements puis prises, et son empreinte', () => {
    expect(modeles.bases.map(({ id, empreinte }) => ({ id, empreinte }))).toEqual([{ id: 'humanoide', empreinte: humanoide.glb.sha256 }]);
    expect(modeles.bases[0].points.map(({ id, genre, attache }) => ({ id, genre, attache }))).toEqual([
      { id: 'dos', genre: 'emplacement', attache: dos },
      { id: 'main', genre: 'prise', attache: humanoide.prises.main },
      { id: 'off', genre: 'prise', attache: humanoide.prises.off },
    ]);
  });

  it('une base publie sa marche : l’unique clip de `appuis.vitessesAuSol` et sa vitesse au sol, au gabarit neutre', () => {
    expect(modeles.bases[0].marche).toEqual({ clip: 'Walk_Loop', vitesse: 1.25 });
  });

  it('chaque point porte exactement les éléments rigides de la base dont un mesh pend à son os, ni le squelette ni la surface', () => {
    expect(Object.fromEntries(modeles.bases[0].points.map(({ id, elements }) => [id, elements]))).toEqual({ dos: ['bouclier'], main: ['epee'], off: ['epee'] });
  });

  it('les lignes de pièce sont, dans l’ordre de la garde-robe, le sélecteur `tete`, le sélecteur `coiffure`, une bascule `piece` par pièce de vêtement ou d’armure, puis une liste `emplacement` par emplacement d’une pièce d’accessoire', () => {
    const emplacementsDAccessoire = new Set<string>(gardeRobe.flatMap((g) => (g.kind === 'piece' && g.emplacement ? [g.emplacement.id] : [])));
    expect(lignes.map((l) => ('id' in l ? `${l.sorte}:${l.id}` : l.sorte))).toEqual([
      'tete', 'coiffure',
      ...gardeRobe.flatMap((g) => (g.kind === 'piece' && g.categorie !== 'accessoire' ? [`piece:${g.id}`] : [])),
      ...gardeRobe.flatMap((g) => (g.kind === 'emplacement' && emplacementsDAccessoire.has(g.id) ? [`emplacement:${g.id}`] : [])),
    ]);
  });

  it('un sélecteur d’axe offre chaque id de sa sous-liste avec les éléments de la base dont la clé le vaut : une tête sans élément a une liste vide', () => {
    const choixDe = (kind: 'tete' | 'coiffure') => gardeRobe.flatMap((g) => (g.kind === kind ? [{ id: g.id, label: g.label, elements: g.id === 'nain' ? ['teteNaine'] : [] }] : []));
    expect(lignes.find((l) => l.sorte === 'tete')).toEqual({ sorte: 'tete', choix: choixDe('tete') });
    expect(lignes.find((l) => l.sorte === 'coiffure')).toEqual({ sorte: 'coiffure', choix: choixDe('coiffure') });
    const tete = lignes.find((l) => l.sorte === 'tete');
    expect(tete && 'choix' in tete ? tete.choix.find(({ id }) => id === 'humain') : undefined).toEqual({ id: 'humain', label: gardeRobe.find(({ id }) => id === 'humain')?.label, elements: [] });
  });

  it('un vêtement lié au squelette est servi sur la ligne de sa pièce, et nulle autre', () => {
    expect(lignes.filter((l) => 'id' in l && l.elements.length > 0)).toEqual([
      { sorte: 'piece', id: 'chemise', label: gardeRobe.find(({ id }) => id === 'chemise')?.label, elements: ['chemise'] },
      { sorte: 'emplacement', id: 'epaule_d', label: gardeRobe.find(({ id }) => id === 'epaule_d')?.label, elements: ['broche'] },
    ]);
  });

  it('le GLB de chaque base et de chaque élément servi, à un point ou à une ligne, est nommé, et d’eux seuls', () => {
    expect(modeles.glb).toEqual({
      humanoide: 'humanoide.glb', bouclier: 'bouclier.glb', epee: 'epee.glb', chemise: 'chemise.glb', teteNaine: 'teteNaine.glb', broche: 'broche.glb',
    });
  });

  it('chaque élément servi, quelle que soit sa liaison, et lui seul, donne les noms de ses surfaces `blason`, liste vide sans surface `blason`', () => {
    expect(modeles.blasons).toEqual({ bouclier: ['champ'], epee: [], chemise: ['ecusson'], teteNaine: [], broche: [] });
  });

  it('les emblèmes sont la sous-liste `embleme` de la garde-robe, chacun réduit à son id, son libellé et son dessin', () => {
    expect(modeles.emblemes.map(({ id }) => id)).toEqual(['taureau-rouge', 'tete-de-mort-rouge']);
    for (const embleme of modeles.emblemes) {
      const entree = gardeRobe.find(({ id }) => id === embleme.id);
      expect(entree?.kind, embleme.id).toBe('embleme');
      if (entree?.kind === 'embleme') expect(embleme, embleme.id).toStrictEqual({ id: entree.id, label: entree.label, svg: entree.svg });
    }
  });

  it('les refus de l’index sont rendus', () => {
    expect(modeles.refus).toEqual(['[base-absente] orpheline : nain']);
  });

  it('une base à marche ambiguë est refusée seule, sans son GLB ni ceux de ses éléments ; les autres bases restent servies', () => {
    const elfe = { ...baseDeTest('elfe'), appuis: { ...baseDeTest('humanoide').appuis, pieds: ['root'], vitessesAuSol: { Walk_Loop: 1.25, Run_Loop: 3 } } };
    const dague = elementSchema3('elfe');
    const avecElfe = modelesDeLAtelier({ humanoide, epee, elfe, dague }, { humanoide: [], epee: ['root'], elfe: [], dague: ['root'] });
    expect(avecElfe.bases.map(({ id }) => id)).toEqual(['humanoide']);
    expect(avecElfe.refus).toEqual(['[marche-ambigue] elfe : 2 clip(s) dans appuis.vitessesAuSol (Walk_Loop, Run_Loop), un seul attendu']);
    expect(avecElfe.glb).toEqual({ humanoide: 'humanoide.glb', epee: 'epee.glb' });
  });

  it('un accessoire dont aucune pièce de la base n’offre l’emplacement est rapporté, sans refus, et n’est servi à aucun point', () => {
    const plumet = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'plumet' }, couche: 'tenue' };
    const casque = { ...chemise, categorie: 'armure', cle: { piece: 'casque' }, couche: 'armure', emplacements: { cimier: dos } };
    const sansCimier = modelesDeLAtelier({ humanoide, plumet }, { humanoide: [], plumet: ['root'] });
    expect(sansCimier.rapport).toEqual(['[emplacement-non-offert] plumet : plumet se pose sur cimier, que ni la base `humanoide` ni aucune de ses pièces n’offre']);
    expect(sansCimier.refus).toEqual([]);
    expect(sansCimier.bases[0].points.flatMap(({ elements }) => elements)).toEqual([]);
    expect(sansCimier.glb).toEqual({ humanoide: 'humanoide.glb' });
    const avecCimier = modelesDeLAtelier({ humanoide, casque, plumet }, { humanoide: [], casque: [], plumet: ['root'] });
    expect(avecCimier.rapport).toEqual([]);
    expect(avecCimier.bases[0].points.flatMap(({ elements }) => elements)).toEqual(['plumet', 'plumet']);
  });

  it('un manifeste schéma 2 est ignoré', () => {
    expect(modelesDeLAtelier({ schema2 }, {})).toEqual({ bases: [], glb: {}, refus: [], rapport: [], blasons: {}, emblemes: modeles.emblemes });
  });
});

/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : `modelesDeLAtelier` rend chaque base avec
 * ses points d'accroche, emplacements puis prises, et à chaque point les éléments rigides de cette base ; un élément
 * skinné n'a aucun point, un élément sans base présente n'est pas listé et son refus est rendu, un manifeste schéma 2
 * est ignoré.
 */
import { describe, expect, it } from 'vitest';
import { baseSchema3, elementSchema3 } from '../asset/schema3.testkit.ts';
import { modelesDeLAtelier } from './atelier';

const dos = { os: 'root', position: [0, 0.1, 0], rotation: [0, 0, 0] };
const humanoide = { ...baseSchema3('humanoide'), emplacements: { dos } };
const epee = elementSchema3('humanoide');
const chemise = {
  schema: 3, base: 'humanoide', categorie: 'vetement', cle: { piece: 'chemise' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse'],
  surfaces: [{ nom: 'tissu', palette: 'tissu' }], glb: epee.glb,
};
const orpheline = { ...elementSchema3('nain'), cle: { apparence: 'hache' } };
const schema2 = { schema_version: 2, model: 'Lame.glb' };

describe('modelesDeLAtelier', () => {
  const modeles = modelesDeLAtelier({ humanoide, epee, chemise, orpheline, schema2 });

  it('une base donne ses points, emplacements puis prises, et son empreinte', () => {
    expect(modeles.bases.map(({ id, base, empreinte }) => ({ id, base, empreinte }))).toEqual([{ id: 'humanoide', base: 'humanoide', empreinte: humanoide.glb.sha256 }]);
    expect(modeles.bases[0].points.map(({ id, genre, attache }) => ({ id, genre, attache }))).toEqual([
      { id: 'dos', genre: 'emplacement', attache: dos },
      { id: 'main', genre: 'prise', attache: humanoide.prises.main },
      { id: 'off', genre: 'prise', attache: humanoide.prises.off },
    ]);
  });

  it('un élément rigide de la base est listé à chaque point', () => {
    for (const point of modeles.bases[0].points) expect(point.elements, point.id).toEqual(['epee']);
  });

  it('un élément skinné est listé dans `elements`, à aucun point', () => {
    expect(modeles.elements).toEqual([
      { id: 'epee', base: 'humanoide', categorie: 'rigide', empreinte: epee.glb.sha256 },
      { id: 'chemise', base: 'humanoide', categorie: 'vetement', empreinte: epee.glb.sha256 },
    ]);
    expect(modeles.bases[0].points.flatMap((p) => p.elements), 'les points ne portent que l’élément rigide').toEqual(['epee', 'epee', 'epee']);
  });

  it('un élément sans base présente n’est pas listé, son refus `[base-absente]` est rendu', () => {
    expect(modeles.elements.map((e) => e.id), 'les éléments listés : ceux de la base présente').toEqual(['epee', 'chemise']);
    expect(modeles.refus).toEqual(['[base-absente] orpheline : nain']);
  });

  it('un manifeste schéma 2 est ignoré', () => {
    expect(modelesDeLAtelier({ schema2 })).toEqual({ bases: [], elements: [], refus: [] });
  });
});

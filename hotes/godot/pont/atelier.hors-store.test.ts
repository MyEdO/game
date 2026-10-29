/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : `modelesDeLAtelier` rend chaque base avec
 * ses points d'accroche, emplacements puis prises, à chaque point les éléments rigides de cette base dont un mesh pend à
 * l'os du point (`osDesRigides`), le fichier GLB de chaque base et de chaque élément d'un point, et pour ces seuls éléments
 * les noms de leurs surfaces `blason` ; les emblèmes sont la sous-liste `embleme` de la garde-robe ; un rigide sans os,
 * un élément lié au squelette ou en surface n'a aucun point, les refus de l'index sont rendus, un manifeste schéma 2 est
 * ignoré.
 */
import { describe, expect, it } from 'vitest';
import { sha256 } from '../asset/empreinte.ts';
import { baseSchema3, elementSchema3, glbDElement } from '../asset/schema3.testkit.ts';
import { gardeRobe } from '../../../src/noyau/index';
import { modelesDeLAtelier } from './atelier';

const glb = (octets: Uint8Array) => ({ sha256: sha256(octets), octets: octets.byteLength });

const dos = { os: 'spine', position: [0, 0.1, 0], rotation: [0, 0, 0] };
const humanoide = { ...baseSchema3('humanoide'), emplacements: { dos } };
const epee = elementSchema3('humanoide');
const chemise = {
  schema: 3, base: 'humanoide', categorie: 'vetement', cle: { piece: 'chemise' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse'],
  surfaces: [{ nom: 'tissu', palette: 'tissu' }], glb: glb(glbDElement('root', ['tissu'])),
};
const broche = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'baudrier' }, liaison: { mode: 'surface' }, couvre: [] };
const bouclier = {
  ...elementSchema3('humanoide'), cle: { apparence: 'bouclier_blason' },
  surfaces: [{ nom: 'metal', teinte: true }, { nom: 'champ', teinte: true, blason: true }], glb: glb(glbDElement('spine', ['metal', 'champ'])),
};
const lanterne = { ...elementSchema3('humanoide'), cle: { apparence: 'targe' }, surfaces: [{ nom: 'verre', teinte: true, blason: true }], glb: glb(glbDElement(null, ['verre'])) };
const orpheline = { ...elementSchema3('nain'), cle: { apparence: 'hache' } };
const schema2 = { schema_version: 2, model: 'Lame.glb' };

describe('modelesDeLAtelier', () => {
  const modeles = modelesDeLAtelier(
    { humanoide, epee, bouclier, lanterne, chemise, broche, orpheline, schema2 },
    { humanoide: [], epee: ['root'], bouclier: ['spine', 'handslot.l'], lanterne: [], chemise: ['root'], broche: ['root'] },
  );

  it('une base donne ses points, emplacements puis prises, et son empreinte', () => {
    expect(modeles.bases.map(({ id, empreinte }) => ({ id, empreinte }))).toEqual([{ id: 'humanoide', empreinte: humanoide.glb.sha256 }]);
    expect(modeles.bases[0].points.map(({ id, genre, attache }) => ({ id, genre, attache }))).toEqual([
      { id: 'dos', genre: 'emplacement', attache: dos },
      { id: 'main', genre: 'prise', attache: humanoide.prises.main },
      { id: 'off', genre: 'prise', attache: humanoide.prises.off },
    ]);
  });

  it('chaque point porte exactement les éléments rigides de la base dont un mesh pend à son os, ni le squelette ni la surface', () => {
    expect(Object.fromEntries(modeles.bases[0].points.map(({ id, elements }) => [id, elements]))).toEqual({ dos: ['bouclier'], main: ['epee'], off: ['epee'] });
  });

  it('le GLB de chaque base et de chaque élément montable est nommé, et d’eux seuls', () => {
    expect(modeles.glb).toEqual({ humanoide: 'humanoide.glb', bouclier: 'bouclier.glb', epee: 'epee.glb' });
  });

  it('chaque élément d’un point, et lui seul, donne les noms de ses surfaces à blason, liste vide sans blason', () => {
    expect(modeles.blasons).toEqual({ bouclier: ['champ'], epee: [] });
  });

  it('les emblèmes sont la sous-liste `embleme` de la garde-robe, chacun réduit à son id, son libellé et son dessin', () => {
    const attendus = gardeRobe.flatMap((e) => (e.kind === 'embleme' ? [{ id: e.id, label: e.label, svg: e.svg }] : []));
    expect(attendus.length, 'la garde-robe porte des emblèmes').toBeGreaterThan(0);
    expect(modeles.emblemes).toEqual(attendus);
  });

  it('les refus de l’index sont rendus', () => {
    expect(modeles.refus).toEqual(['[base-absente] orpheline : nain']);
  });

  it('un manifeste schéma 2 est ignoré', () => {
    expect(modelesDeLAtelier({ schema2 }, {})).toEqual({ bases: [], glb: {}, refus: [], blasons: {}, emblemes: modeles.emblemes });
  });
});

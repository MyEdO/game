/** #1882 sur les paquets livrés : une entité ENRÔLÉE porte un NOM, jamais une légende (`src/scenes/legendeEnrolee.testkit.ts`).
 *  Exemptés au SITE (`scène|entité`) : un nom propre plus long, avec sa raison. */
import { describe, expect, it } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { enroles, legendesPourNom } from '../../../src/scenes/legendeEnrolee.testkit';

const EXEMPTES = new Map<string, string>([
  ['ls-abordage-cogue|chef-cogue', 'nom propre : le chef de l’équipage de la Dent de Manann'],
]);

describe('legende-enrolee — paquets livrés (#1882)', () => {
  const vus = enroles(listerProjetsLivres().map((rel) => parseProject(lireProjetLivre(rel))));

  it('aucune entité enrôlée ne porte une légende pour nom', () => {
    expect(legendesPourNom(vus, EXEMPTES), 'donner un NOM au label (la légende va en commentaire), ou exempter le SITE d’un nom propre').toEqual([]);
  });

  it('PEUPLEMENT : le scan lit des entités enrôlées nommées, et chaque exemption est VUE', () => {
    expect(vus.length).toBeGreaterThan(0);
    const sites = new Set(vus.map((v) => v.site));
    expect([...EXEMPTES.keys()].filter((e) => !sites.has(e))).toEqual([]);
  });
});

/**
 * Les volets de `src/data/refs-migrated.test.ts` joués sur les paquets livrés : les observations nommées des
 * fiches embarquées (#1457 B1, #1342 L2-a, #1621) et les nœuds `GameOp` atteints par le parse (#847, #1473).
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { opsDuParse } from '../../../scripts/docs/lib/slots-registre.mjs';
import { listerDocuments, scanDuCorpus } from '../../../scripts/docs/lib/structures-scan.mjs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { COMPETENCES_NUES, TALENTS_SENTINELLES, TALENTS_TEXTES } from '../../../scripts/guards/lib/integriteStock.mjs';
import { collecteSpecs, duCorpus, ecartIntegrite, partiellesDeCreatures } from '../../../src/data/specsNommees.testkit';
import { horsDuParse, noeudsDOp } from '../../../src/data/noeudsDOp.testkit';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const PAQUETS = cheminsDesProjetsLivres(RACINE);
const { defs, scan } = scanDuCorpus(RACINE, PAQUETS);
/** Les paquets livrés, nom → chemin : les stocks nommés n'y jugent que les entrées de ces fichiers (`duCorpus`). */
const fichiersDeSpecs = new Map(listerDocuments(RACINE, PAQUETS).filter((d) => PAQUETS.includes(d.chemin)).map((d) => [d.nom, d.chemin]));
const LISTES = partiellesDeCreatures(scan.entreesPartielles).filter(([hote]) => fichiersDeSpecs.has(hote));

describe('observations nommées des fiches embarquées aux paquets livrés', () => {
  it('les paquets livrés embarquent des fiches partielles (sans quoi ce volet ne mesure rien)', () => {
    expect(LISTES.length).toBeGreaterThan(0);
  });

  it('les compétences nues restent des observations nommées', () => {
    ecartIntegrite(collecteSpecs('skills', LISTES, fichiersDeSpecs).nues.map((n) => n.site), duCorpus(COMPETENCES_NUES, fichiersDeSpecs), true);
  });

  // LDB 10 l.315
  it('les textes de Talent sans catalogue restent des observations nommées', () => {
    const { textes } = collecteSpecs('talents', LISTES, fichiersDeSpecs);
    expect(textes.length, 'aucune entrée partielle de texte de Talent').toBeGreaterThan(0);
    ecartIntegrite(textes.map((h) => h.site), duCorpus(TALENTS_TEXTES, fichiersDeSpecs), true);
  });

  // #1621
  it('les sentinelles de Talent sont nommées et soldées', () => {
    ecartIntegrite(collecteSpecs('talents', LISTES, fichiersDeSpecs).sentinelles, duCorpus(TALENTS_SENTINELLES, fichiersDeSpecs));
  });
});

describe('GameOp des paquets livrés — jugés au parse (#847, #1473)', () => {
  it('chaque nœud GameOp des paquets livrés atteint son schéma de porteur', () => {
    const brutParNom = new Map([...scan.brutParNom].filter(([nom]) => fichiersDeSpecs.has(nom)));
    const noeuds = [...brutParNom].flatMap(([nom, doc]) => [...noeudsDOp(doc, nom)]);
    expect(noeuds.length).toBeGreaterThan(0);
    const atteintes = opsDuParse({ brutParNom }, defs);
    const lignes = horsDuParse(noeuds, atteintes);
    expect(lignes, `nœuds d’op hors du parse :\n${lignes.join('\n')}`).toEqual([]);
    expect(atteintes.size).toBe(noeuds.length);
  });
});

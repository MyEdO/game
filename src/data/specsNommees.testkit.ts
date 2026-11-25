/**
 * OBSERVATIONS NOMMÉES des `skills[]`/`talents[]` de statbloc, de Carrière et d'espèce, mesurées sur un corpus
 * (`scanDuCorpus`) : le commun (`src/data/refs-migrated.test.ts`) et chaque projet les jouent sur le leur, et
 * chacun juge les entrées de stock des fichiers qu'il mesure (`duCorpus`).
 */
import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { ecartsDeStock, cleDeSite, sitesEnEntrees, type EntreeDeSite, type Site } from '../../scripts/guards/lib/stock.mjs';
import { isSentinel, walkSkillRefs } from '../../scripts/data/lib/skillSpecWalk.mjs';
import { catalogueSpecs, refusDeSpec } from './schemas/grammaire/ref';

/** Les entrées de `stock` dont le fichier est un document du corpus (`fichiersDeSpecs`). */
export const duCorpus = <E extends EntreeDeSite>(stock: readonly E[], fichiersDeSpecs: ReadonlyMap<string, string>): E[] => {
  const fichiers = new Set(fichiersDeSpecs.values());
  return stock.filter((e) => fichiers.has(e.fichier));
};

export type SiteDIntegrite = Site & { famille: string };
/** Un texte d'instance de Talent (`nonSpecialisable`, #1621), nommé par sa clé stable `fichier|porteur|refId|spec`. */
export type TexteDInstance = { key: string; site: SiteDIntegrite };

const empreinteIntegrite = (texte: string): string => createHash('sha256').update(texte).digest('hex');
export const siteIntegrite = (famille: string, fichier: string, owner: string, champ: string, id = '', texte = ''): SiteDIntegrite => ({ famille, fichier, ref: JSON.stringify([owner, champ, id, texte ? empreinteIntegrite(texte) : '']) });
export function ecartIntegrite(observe: readonly SiteDIntegrite[], stock: readonly EntreeDeSite[], observation = false): void {
  const normalise = sitesEnEntrees(observe);
  const ecart = ecartsDeStock({ observe: normalise, stock, cle: cleDeSite, remede: {
    neuve: (cle, entree) => entree.famille === 'dotation-texte'
      ? `${cle} — migrer la dotation en référence typée (#622).`
      : entree.famille === 'talent-sentinelle'
        ? `${cle} — poser la spécialisation ou le choix imprimé ; régime de choix à #1621.`
        : `${cle} — corriger la donnée vers sa forme cible : scripts/guards/lib/integriteStock.mjs ne fait que décroître.`,
  } });
  expect(ecart.taille, 'Stock dupliqué : retirer les identités répétées').toBe(stock.length);
  expect(ecart.neuves, `Entrées neuves :\n${ecart.neuves.join('\n')}`).toEqual([]);
  if (observation) {
    if (ecart.perimees.length) console.info(`Observations disparues : retirer de scripts/guards/lib/integriteStock.mjs :\n${ecart.perimees.join('\n')}`);
  } else expect(ecart.perimees, `Entrées soldées : retirer de scripts/guards/lib/integriteStock.mjs :\n${ecart.perimees.join('\n')}`).toEqual([]);
}

export type EntreeDeSpecs = { id?: string; label?: string; source?: { book?: string } };

/** Les ENTRÉES PARTIELLES de `creatures.json` embarquées ailleurs (`entreesPartiellesEmbarquees`,
 *  `scripts/docs/lib/structures-scan.mts`), groupées par document hôte : porteur et provenance = ceux
 *  de leur fiche (plus proche ancêtre portant `id`, resp. `source`). */
export const partiellesDeCreatures = (
  entreesPartielles: ReadonlyMap<object, { readonly document: string; readonly hote: string; readonly id?: string; readonly source?: Readonly<Record<string, unknown>> }>,
): [string, EntreeDeSpecs[]][] => {
  const parHote = new Map<string, EntreeDeSpecs[]>();
  for (const [objet, fiche] of entreesPartielles) {
    if (fiche.document !== 'creatures.json') continue;
    if (typeof fiche.id !== 'string') throw new Error(`${fiche.hote} : entrée partielle creatures sans id de propriétaire`);
    const entree = { ...(objet as object), id: fiche.id, source: fiche.source as EntreeDeSpecs['source'] };
    parHote.set(fiche.hote, [...(parHote.get(fiche.hote) ?? []), entree]);
  }
  return [...parHote];
};

/**
 * MARCHE PARTAGÉE des observations — Compétences (#1342 L2-a) et Talents (#1457 B1) : même périmètre
 * (les `listes` de l'appelant : `creatures`/`careerLevels`/`species` et les entrées partielles de `creatures`
 * embarquées dans les documents qu'il mesure, nommés par `fichiersDeSpecs`),
 * MÊME walker (`walkSkillRefs`, paramétré par son tableau porteur) et MÊME prédicat (`refusDeSpec`).
 */
export function collecteSpecs(
  arrName: 'skills' | 'talents',
  listes: readonly (readonly [string, readonly EntreeDeSpecs[]])[],
  fichiersDeSpecs: ReadonlyMap<string, string>,
): { textes: TexteDInstance[]; nues: { where: string; book: string; refId: string; site: SiteDIntegrite }[]; sentinelles: SiteDIntegrite[] } {
  const textes: TexteDInstance[] = [];
  const nues: { where: string; book: string; refId: string; site: SiteDIntegrite }[] = [];
  const sentinelles: SiteDIntegrite[] = [];
  for (const [file, list] of listes) {
    for (const entry of list) {
      const book = entry.source?.book ?? '(sans source)';
      if (typeof entry.id !== 'string') throw new Error(`${file} : propriétaire sans id`);
      const owner = entry.id;
      const fichier = fichiersDeSpecs.get(file.endsWith('.json') ? file : `${file}.json`);
      if (!fichier) throw new Error(`${file} : document absent du corpus`);
      const site = (famille: string, node: { id: string; spec?: string }) => siteIntegrite(famille, fichier, owner, arrName, node.id, node.spec ?? '');
      walkSkillRefs(entry, (node) => {
        const type = arrName === 'skills' ? 'skill' : 'talent';
        const catalogue = catalogueSpecs(type, node.id).length > 0;
        // Un nœud à `choix` PORTE un régime de spécialisation (borne ou libre) : ce n'est pas une réf NUE.
        if (node.choix != null) return;
        if (node.spec == null) { if (catalogue) nues.push({ where: `${file}(${owner})`, book, refId: node.id, site: site('competence-nue', node) }); return; }
        if (isSentinel(node.spec)) { sentinelles.push(site('talent-sentinelle', node)); return; }
        if (refusDeSpec(type, node.id, node.spec) !== 'nonSpecialisable') return;
        textes.push({ key: `${file}|${owner}|${node.id}|${node.spec}`, site: site('talent-texte', node) });
      }, arrName);
    }
  }
  return { textes, nues, sentinelles };
}

/**
 * ID NU → `ref(type)` (#2968) — le geste commun des lots qui font désigner une entrée de catalogue par
 * `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : chaque porteur déclare son document, la liste de ses
 * entrées (la racine, ou la collection au bout d'un chemin de champs, `worldMap.places`) et ses clés, chacune
 * avec le type de sa cible. La clé garde son rang, les autres clés le leur.
 * IDEMPOTENT : un porteur déjà `{ id }`, absent ou `null` n'a aucun geste ; sans geste, rien ne s'écrit et
 * la sortie est 0.
 * FAIL-FAST — sortie 1 avant toute écriture : document hors de son formatage, entrées hors d'une liste,
 * valeur ni chaîne ni `{ id }` seul, id absent de son catalogue, compte de gestes ≠ `cardinal` ou ≠
 * `parPorteur`.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`) ; un projet de campagne (`src/scenes/`), la forme
 * dépôt de `texteDuDepot` (`src/noyau/worldMap.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { serializeDataset } from '../../../src/data/serialize.ts';
import { estObjet } from '../../../src/lib/objet.mjs';

/**
 * @typedef {{ collection?: string, cles: Record<string, string> }} Porteur
 * Les entrées d'un document (sa racine, ou sa `collection`, chemin de champs pointé) et leurs clés porteuses,
 * avec le type de leur cible.
 */

/** Le texte du document `rel` : un projet de campagne à la forme dépôt, un dataset à la sienne. */
const serialiser = (rel, doc) => (rel.startsWith('src/scenes/') ? `${JSON.stringify(doc, null, 1)}\n` : serializeDataset(doc));

/** `doc` où la valeur au bout de `chemin` est remplacée par `valeur`, chaque clé à son rang. */
const remplacer = (doc, chemin, valeur) => (chemin.length === 0 ? valeur : { ...doc, [chemin[0]]: remplacer(doc[chemin[0]], chemin.slice(1), valeur) });

/**
 * Les ids des entrées du document `rel` de `racine` : sa racine, ou sa `collection`.
 * @param {string} racine
 * @param {string} rel
 * @param {string} [collection]
 * @returns {ReadonlySet<string>}
 */
export function idsDe(racine, rel, collection) {
  const doc = JSON.parse(fs.readFileSync(path.join(racine, rel), 'utf8'));
  return new Set((collection === undefined ? doc : doc[collection]).map((e) => e.id));
}

/**
 * Joue le geste sur les `porteurs` de `racine`, puis sort : 1 sur toute faute (rien n'est écrit), 0 sinon.
 * @param {{ racine: string, lot: string, porteurs: Record<string, Porteur>, catalogues: Record<string, ReadonlySet<string>>, parPorteur: Record<string, number>, cardinal: number }} migration
 */
export function migrerLesIdsNus({ racine, lot, porteurs, catalogues, parPorteur, cardinal }) {
  const fautes = [];
  const aEcrire = [];
  /** Porteur → gestes faits ; un porteur sans geste est absent. */
  const gestesPar = {};

  for (const [rel, { collection, cles }] of Object.entries(porteurs)) {
    const fichier = path.join(racine, rel);
    const texte = fs.readFileSync(fichier, 'utf8');
    const doc = JSON.parse(texte);
    if (serialiser(rel, doc) !== texte) {
      fautes.push(`${rel} : formatage non canonique`);
      continue;
    }
    const chemin = collection === undefined ? [] : collection.split('.');
    const entrees = chemin.reduce((v, champ) => (estObjet(v) ? v[champ] : undefined), doc);
    const prefixe = collection === undefined ? '' : `${collection}[].`;
    if (!Array.isArray(entrees)) {
      fautes.push(`${rel} › ${prefixe || '(racine)'} : les entrées ne sont pas une liste`);
      continue;
    }
    let ici = 0;
    const suite = entrees.map((entree) => {
      const sortie = { ...entree };
      for (const [cle, type] of Object.entries(cles)) {
        const ou = `${rel} › ${entree.id} › ${cle}`;
        const v = entree[cle];
        if (v === undefined || v === null) continue;
        if (estObjet(v) && Object.keys(v).length === 1 && typeof v.id === 'string') continue;
        if (typeof v !== 'string') {
          fautes.push(`${ou} : ni chaîne ni \`{ id }\` (${JSON.stringify(v)})`);
          continue;
        }
        if (!catalogues[type].has(v)) {
          fautes.push(`${ou} : « ${v} » absent du catalogue \`${type}\``);
          continue;
        }
        sortie[cle] = { id: v };
        const porteur = `${path.basename(rel)} › ${prefixe}${cle}`;
        gestesPar[porteur] = (gestesPar[porteur] ?? 0) + 1;
        ici += 1;
      }
      return sortie;
    });
    if (ici) aEcrire.push([fichier, serialiser(rel, remplacer(doc, chemin, suite))]);
  }

  const gestes = Object.values(gestesPar).reduce((a, n) => a + n, 0);
  if (gestes) {
    if (gestes !== cardinal) fautes.push(`${gestes} geste(s), ${cardinal} attendus — périmètre déplacé`);
    for (const [porteur, attendu] of Object.entries(parPorteur)) {
      const faits = gestesPar[porteur] ?? 0;
      if (faits !== attendu) fautes.push(`${porteur} : ${faits} geste(s), ${attendu} attendus`);
    }
  }
  if (fautes.length) {
    console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
    process.exit(1);
  }
  for (const [fichier, sortie] of aEcrire) fs.writeFileSync(fichier, sortie);
  console.log(aEcrire.length === 0
    ? `RIEN À FAIRE — les ${cardinal} porteurs désignent déjà leur cible par \`{ id }\`.`
    : `migration ${lot} : ${gestes} porteur(s) migré(s) dans ${aEcrire.length} fichier(s) ${JSON.stringify(gestesPar)}.`);
}

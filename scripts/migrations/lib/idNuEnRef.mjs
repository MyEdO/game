/**
 * ID NU → `ref(type)` (#2968) — le geste commun des lots qui font désigner une entrée de catalogue par
 * `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, à la CLÉ du CHEMIN EXACT (jamais par mot) : chaque porteur déclare son document, ses entrées (la
 * racine liste, la collection au bout d'un chemin de champs, `worldMap.places`, ou le document `objet` qui EST
 * son entrée unique, famille `config`) et ses clés, chacune avec le type de sa cible ; une clé pointée
 * (`derivedWeapon.subType`) suit les objets de l'entrée, un segment `[]` (`passive[].terrain`) chaque élément
 * de sa liste. La clé garde son rang, les autres clés le leur.
 * IDEMPOTENT : un porteur déjà `{ id }`, absent ou `null` n'a aucun geste ; sans geste, rien ne s'écrit et
 * la sortie est 0.
 * FAIL-FAST — sortie 1 avant toute écriture : document hors de son formatage, entrées hors d'une liste (d'un objet
 * pour `objet`), valeur ni chaîne ni `{ id }` seul, id absent de son catalogue, compte de gestes ≠ `cardinal` ou ≠
 * `parPorteur`.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`) ; un projet de campagne (`src/scenes/`), la forme
 * dépôt de `texteDuDepot` (`src/noyau/worldMap.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { serializeDataset } from '../../../src/data/serialize.ts';
import { estObjet } from '../../../src/lib/objet.mjs';

/**
 * @typedef {{ collection?: string, objet?: true, cles: Record<string, string> }} Porteur
 * Les entrées d'un document (sa racine, sa `collection`, chemin de champs pointé, ou le document `objet`
 * lui-même) et leurs clés porteuses (chemin de champs pointé dans l'entrée, `[]` pour chaque élément d'une
 * liste), avec le type de leur cible.
 */

/** Le texte du document `rel` : un projet de campagne à la forme dépôt, un dataset à la sienne. */
const serialiser = (rel, doc) => (rel.startsWith('src/scenes/') ? `${JSON.stringify(doc, null, 1)}\n` : serializeDataset(doc));

/** `doc` où la valeur au bout de `chemin` (champs et rangs de liste) est remplacée par `valeur`, chaque clé à son rang. */
const remplacer = (doc, chemin, valeur) => {
  if (chemin.length === 0) return valeur;
  const [tete, ...reste] = chemin;
  return Array.isArray(doc) ? doc.map((x, i) => (i === tete ? remplacer(x, reste, valeur) : x)) : { ...doc, [tete]: remplacer(doc[tete], reste, valeur) };
};

/** Les chemins concrets de `x` que désignent les `segments` d'une clé : un segment `champ[]` vaut chaque rang
 *  de la liste `champ` ; un champ absent n'en rend aucun. */
const cheminsDe = (x, segments) => {
  if (segments.length === 0) return [[]];
  const [tete, ...reste] = segments;
  const champ = tete.endsWith('[]') ? tete.slice(0, -2) : tete;
  if (!estObjet(x) || x[champ] === undefined) return [];
  if (champ === tete) return cheminsDe(x[champ], reste).map((c) => [champ, ...c]);
  return Array.isArray(x[champ]) ? x[champ].flatMap((el, i) => cheminsDe(el, reste).map((c) => [champ, i, ...c])) : [];
};

/** La valeur de `x` au bout du chemin concret `chemin`. */
const valeurAu = (x, chemin) => chemin.reduce((v, pas) => v[pas], x);

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

  for (const [rel, { collection, objet, cles }] of Object.entries(porteurs)) {
    const fichier = path.join(racine, rel);
    const texte = fs.readFileSync(fichier, 'utf8');
    const doc = JSON.parse(texte);
    if (serialiser(rel, doc) !== texte) {
      fautes.push(`${rel} : formatage non canonique`);
      continue;
    }
    const chemin = collection === undefined ? [] : collection.split('.');
    const entrees = objet ? (estObjet(doc) ? [doc] : undefined) : chemin.reduce((v, champ) => (estObjet(v) ? v[champ] : undefined), doc);
    const prefixe = collection === undefined ? '' : `${collection}[].`;
    if (!Array.isArray(entrees)) {
      fautes.push(`${rel} › ${prefixe || '(racine)'} : les entrées ne sont pas ${objet ? 'un objet' : 'une liste'}`);
      continue;
    }
    let ici = 0;
    const suite = entrees.map((entree) => {
      let sortie = entree;
      for (const [cle, type] of Object.entries(cles)) {
        for (const cheminDeCle of cheminsDe(entree, cle.split('.'))) {
          const ou = `${rel} › ${entree.id} › ${cheminDeCle.join('.')}`;
          const v = valeurAu(entree, cheminDeCle);
          if (v === null) continue;
          if (estObjet(v) && Object.keys(v).length === 1 && typeof v.id === 'string') continue;
          if (typeof v !== 'string') {
            fautes.push(`${ou} : ni chaîne ni \`{ id }\` (${JSON.stringify(v)})`);
            continue;
          }
          if (!catalogues[type].has(v)) {
            fautes.push(`${ou} : « ${v} » absent du catalogue \`${type}\``);
            continue;
          }
          sortie = remplacer(sortie, cheminDeCle, { id: v });
          const porteur = `${path.basename(rel)} › ${prefixe}${cle}`;
          gestesPar[porteur] = (gestesPar[porteur] ?? 0) + 1;
          ici += 1;
        }
      }
      return sortie;
    });
    if (ici) aEcrire.push([fichier, serialiser(rel, objet ? suite[0] : remplacer(doc, chemin, suite))]);
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

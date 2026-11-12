/**
 * ID NU → `{ id }` sur les ops d'un document (#3606 M2a, M2a2 ; L1c #1468) — le geste commun des lots qui emboîtent
 * les références d'une op typée dans `OP_DEFS` : à chaque op dont `op` a ses règles, où qu'elle soit dans le
 * document, la valeur de chaque clé réglée passe de `"x"` à `{ "id": "x" }`, à la même clé.
 *
 * IDEMPOTENT : une clé absente ou déjà `{ id }` n'a aucun geste ; un document sans geste ne s'écrit pas.
 * FAIL-FAST — sortie 1 avant toute écriture : valeur ni chaîne ni `{ id }` seul, id hors du catalogue de sa règle,
 * document hors de sa forme canonique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {{ ids: Set<string>, catalogue: string }} Regle  les ids admis et le nom de leur catalogue, pour l'arrêt.
 * @typedef {{ rel: string, canonique: (doc: unknown) => string }} Document  un document du dépôt et son formatage.
 */

/**
 * Emboîte, dans chaque document de `documents` (relatif à `racine`), les clés de `regles[op]` de toute op ; imprime
 * le compte sous `titre`.
 * @param {string} racine
 * @param {Document[]} documents
 * @param {Record<string, Record<string, Regle>>} regles  par `op`, par clé, sa règle.
 * @param {string} titre
 */
export function emboiterLesRefsDOps(racine, documents, regles, titre) {
  const arrets = [];
  const ecritures = [];
  let gestes = 0;
  for (const { rel, canonique } of documents) {
    const brut = readFileSync(join(racine, rel), 'utf8');
    const doc = JSON.parse(brut);
    let ici = 0;
    const visiter = (n, chemin) => {
      if (Array.isArray(n)) return n.forEach((x, i) => visiter(x, `${chemin}[${i}]`));
      if (n === null || typeof n !== 'object') return;
      for (const [cle, regle] of Object.entries(typeof n.op === 'string' && Object.hasOwn(regles, n.op) ? regles[n.op] : {})) {
        const v = n[cle];
        if (v === undefined) continue;
        const id = typeof v === 'string' ? v : v !== null && typeof v === 'object' && Object.keys(v).length === 1 && typeof v.id === 'string' ? v.id : undefined;
        if (id === undefined) arrets.push(`${rel} ${chemin}.${cle} : ni chaîne ni { id }`);
        else if (!regle.ids.has(id)) arrets.push(`${rel} ${chemin}.${cle} : « ${id} » absent de ${regle.catalogue}`);
        else if (typeof v === 'string') { n[cle] = { id }; ici++; }
      }
      for (const [k, x] of Object.entries(n)) visiter(x, `${chemin}.${k}`);
    };
    visiter(doc, '');
    if (ici === 0) continue;
    if (brut !== canonique(JSON.parse(brut))) arrets.push(`${rel} : forme non canonique`);
    ecritures.push([rel, canonique(doc)]);
    gestes += ici;
  }
  if (arrets.length) {
    console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
    for (const a of arrets) console.error(`  ${a}`);
    process.exit(1);
  }
  for (const [rel, texte] of ecritures) writeFileSync(join(racine, rel), texte, 'utf8');
  console.log(`${titre} : ${gestes} référence(s), ${ecritures.length} fichier(s).`);
}

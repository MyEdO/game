/**
 * ID NU → `{ id }` sur les ops d'un document (#3606 M2a, M2a2, M2d ; L1c #1468) — le geste commun des lots qui
 * emboîtent les références d'une op typée dans `OP_DEFS`, ou d'un effet : à chaque objet dont le discriminant
 * (`op`, ou `type` d'un effet) a ses règles, où qu'il soit dans le document, la valeur de chaque clé réglée passe de
 * `"x"` à `{ "id": "x" }`. La clé (`vers` pour la renommer) conserve sa place dans l’objet. Une règle
 * locale lit ses ids dans la collection de l’objet ancêtre le plus proche qui ouvre sa portée (`ouvre`).
 *
 * IDEMPOTENT : une clé absente ou une destination déjà au format `{ id }` ne change pas.
 * FAIL-FAST — sortie 1 avant toute écriture : valeur ni chaîne ni `{ id }` seul, id hors du catalogue de sa règle,
 * règle locale hors de tout objet qui ouvre sa portée, conflit de clés, document hors de sa forme canonique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { estObjet } from '../../../src/lib/objet.mjs';

/**
 * @typedef {({ ids: Set<string> } | { collection: string }) & { catalogue: string, vers?: string }} Regle
 *   Les ids admis ou la collection de l’ouvreur, le nom du catalogue et la clé de destination.
 * @typedef {{ rel: string, canonique: (doc: unknown) => string }} Document  un document du dépôt et son formatage.
 */

/**
 * Emboîte, dans chaque document de `documents` (relatif à `racine`), les clés de `regles[d]` de tout objet de
 * discriminant `discriminant` valant `d` ; imprime le compte sous `titre`.
 * @param {string} racine
 * @param {Document[]} documents
 * @param {Record<string, Record<string, Regle>>} regles  par valeur du discriminant, par clé, sa règle.
 * @param {string} titre
 * @param {{ discriminant?: string, ouvre?: (n: Record<string, unknown>) => boolean }} [options]  le discriminant (`op`
 *   par défaut) et l'objet qui ouvre la portée d'une règle locale.
 */
export function emboiterLesRefsDOps(racine, documents, regles, titre, { discriminant = 'op', ouvre = () => false } = {}) {
  const arrets = [];
  const ecritures = [];
  let gestes = 0;
  for (const { rel, canonique } of documents) {
    const brut = readFileSync(join(racine, rel), 'utf8');
    let ici = 0;
    const visiter = (n, chemin, ouvreur) => {
      if (Array.isArray(n)) return n.map((x, i) => visiter(x, `${chemin}[${i}]`, ouvreur));
      if (!estObjet(n)) return n;
      const ouvrant = ouvre(n) ? n : ouvreur;
      const d = n[discriminant];
      let sortie = n;
      for (const [cle, regle] of Object.entries(typeof d === 'string' && Object.hasOwn(regles, d) ? regles[d] : {})) {
        const vers = regle.vers ?? cle;
        const cleRendue = cle !== vers && Object.hasOwn(sortie, vers);
        if (cleRendue && Object.hasOwn(sortie, cle)) {
          arrets.push(`${rel} ${chemin}.${cle} : la clé de destination « ${vers} » est déjà posée`);
          continue;
        }
        const cleLue = cleRendue ? vers : cle;
        const v = sortie[cleLue];
        if (v === undefined) continue;
        const reference = estObjet(v) && Object.keys(v).length === 1 && typeof v.id === 'string';
        const id = reference ? v.id : !cleRendue && typeof v === 'string' ? v : undefined;
        const ids = 'ids' in regle ? regle.ids : ouvrant && new Set((ouvrant[regle.collection] ?? []).map((e) => e.id));
        if (id === undefined) arrets.push(`${rel} ${chemin}.${cleLue} : ${cleRendue ? 'forme { id } attendue' : 'ni chaîne ni { id }'}`);
        else if (!ids) arrets.push(`${rel} ${chemin}.${cleLue} : « ${id} » hors de tout objet qui ouvre la portée des ${regle.catalogue}`);
        else if (!ids.has(id)) arrets.push(`${rel} ${chemin}.${cleLue} : « ${id} » absent de ${regle.catalogue}`);
        else if (!cleRendue && (cle !== vers || typeof v === 'string')) {
          sortie = Object.fromEntries(Object.entries(sortie).map(([k, x]) => k === cle ? [vers, { id }] : [k, x]));
          ici++;
        }
      }
      for (const [k, x] of Object.entries(sortie)) sortie[k] = visiter(x, `${chemin}.${k}`, ouvrant);
      return sortie;
    };
    const doc = visiter(JSON.parse(brut), '', undefined);
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

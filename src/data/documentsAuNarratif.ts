import { slugId } from './slug.ts';

/**
 * SOULÈVEMENT des documents EN LIGNE au registre narratif (#679, projet 17 → 18) : chaque Effect
 * `{ type: 'document', title, desc }` du document de projet, à toute profondeur hors du bloc narratif
 * (scènes, `worldMap`), devient `{ type: 'document', documentId }`, et son texte une entrée
 * `{ id, titre: title, prose: desc }` de `narratif.documents` — ordre du parcours, clés du document.
 *
 * RÈGLE D'ID, UNIQUE (`idDeDocumentSouleve`) : `document-<slugId(titre)>` (`document` pour un titre sans
 * lettre), puis `-2`, `-3`… tant que l'id est PRIS — par un id narratif déjà présent (toute liste d'entrées
 * à `id` du narratif), par un document soulevé avant lui, ou par la règle globale (`estGlobal`, fourni
 * par l'appelant : `collisionneAvecLeGlobal` au chargement, les ids de `creatures.json`/`trappings.json`
 * au script de dépôt). Deux titres identiques reçoivent donc deux ids.
 *
 * Primitive PARTAGÉE, chargée par Node nu (son seul import est `slug.ts`, sans import) :
 * `PROJECT_MIGRATIONS[17]` (`src/data/migrationsDeProjet.ts`) et le script de dépôt
 * `scripts/migrations/2026-09-29-679-documents-au-narratif.mjs`.
 *
 * Un document SANS bloc narratif lisible (une scène seule, `migreSceneDeProjet`) qui porterait un
 * Effect à soulever LÈVE, en nommant ses chemins : le texte n'aurait pas de registre où aller.
 */

type Chemin = readonly (string | number)[];

interface EffetEnLigne {
  type: 'document';
  title: unknown;
  desc: unknown;
}

/** Effect `document` à la forme EN LIGNE (antérieure au schéma 18). */
function estEnLigne(v: unknown): v is EffetEnLigne {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.type === 'document' && !('documentId' in o) && ('title' in o || 'desc' in o);
}

/** L'id d'un document soulevé de titre `titre`, libre au sens de `estPris`. */
export function idDeDocumentSouleve(titre: string, estPris: (id: string) => boolean): string {
  const slug = slugId(titre);
  const base = slug ? `document-${slug}` : 'document';
  let id = base;
  for (let n = 2; estPris(id); n++) id = `${base}-${n}`;
  return id;
}

/** Les ids des entrées de TOUTES les listes du narratif (quelle qu'en soit la clé). */
function idsDuNarratif(narratif: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const liste of Object.values(narratif))
    if (Array.isArray(liste))
      for (const e of liste) {
        const id = e && typeof e === 'object' ? (e as { id?: unknown }).id : undefined;
        if (typeof id === 'string') ids.add(id);
      }
  return ids;
}

const lisible = (chemin: Chemin): string => chemin.map(String).join('.');

/** Les chemins des Effects `document` en ligne de `v`, hors du bloc narratif, dans l'ordre du parcours. */
function documentsEnLigne(v: unknown, chemin: Chemin = []): Chemin[] {
  if (estEnLigne(v)) return [chemin];
  if (Array.isArray(v)) return v.flatMap((x, i) => documentsEnLigne(x, [...chemin, i]));
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v).flatMap(([k, x]) => (chemin.length === 0 && k === 'narratif' ? [] : documentsEnLigne(x, [...chemin, k])));
}

/** Le document de projet `doc`, ses documents en ligne soulevés au registre (cf. en-tête). Arbre NEUF. */
export function souleveLesDocuments(doc: Record<string, unknown>, estGlobal: (id: string) => boolean): Record<string, unknown> {
  const aSoulever = documentsEnLigne(doc);
  const narratif = doc.narratif;
  const narratifLisible = !!narratif && typeof narratif === 'object' && !Array.isArray(narratif);
  if (!narratifLisible) {
    if (!aSoulever.length) return doc;
    throw new Error(
      `${aSoulever.length} Effect(s) « document » en ligne à soulever au registre narratif (${aSoulever.map(lisible).join(', ')}), et ce document n'a pas de bloc narratif : il se remonte avec son projet.`,
    );
  }
  const nb = narratif as Record<string, unknown>;
  const pris = idsDuNarratif(nb);
  const souleves: { id: string; titre: string; prose: string }[] = [];
  const souleve = (e: EffetEnLigne, chemin: Chemin): Record<string, unknown> => {
    if (typeof e.title !== 'string' || typeof e.desc !== 'string')
      throw new Error(`Effect « document » en ligne à ${lisible(chemin)} : \`title\` et \`desc\` doivent être des chaînes.`);
    const id = idDeDocumentSouleve(e.title, (x) => pris.has(x) || estGlobal(x));
    pris.add(id);
    souleves.push({ id, titre: e.title, prose: e.desc });
    return { type: 'document', documentId: id };
  };
  const marche = (v: unknown, chemin: Chemin): unknown => {
    if (estEnLigne(v)) return souleve(v, chemin);
    if (Array.isArray(v)) return v.map((x, i) => marche(x, [...chemin, i]));
    if (!v || typeof v !== 'object') return v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, chemin.length === 0 && k === 'narratif' ? x : marche(x, [...chemin, k])]));
  };
  const monte = marche(doc, []) as Record<string, unknown>;
  const existants = Array.isArray(nb.documents) ? nb.documents : [];
  return { ...monte, narratif: avecDocuments(nb, [...existants, ...souleves]) };
}

/** Le narratif `nb` portant `documents`, à sa place (celle qu'il a, sinon après `objets`, sinon en queue). */
function avecDocuments(nb: Record<string, unknown>, documents: unknown[]): Record<string, unknown> {
  if ('documents' in nb) return { ...nb, documents };
  const entrees = Object.entries(nb);
  const rang = entrees.findIndex(([k]) => k === 'objets');
  const coupe = rang < 0 ? entrees.length : rang + 1;
  return Object.fromEntries([...entrees.slice(0, coupe), ['documents', documents], ...entrees.slice(coupe)]);
}

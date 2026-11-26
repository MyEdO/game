/**
 * Migration #1467 L1b V-P2 — projets de scène : la prose `description` devient `desc`.
 *
 * MOTIF MESURÉ : `description` est une GRAPHIE DIVERGENTE du rôle prose du lexique
 * (`scripts/docs/lib/structures-lexique.mts` : `prose: { cible: 'desc', divergentes: [… 'description'
 * …] }`) ; l'enveloppe de document déclare `desc` (`src/data/schemas/grammaire/document.ts`). Deux
 * porteurs, même rôle : `scenes[].description` (la prose d'une Scène) et `meta.description` (la
 * prose de campagne de la bibliothèque). Le TEXTE ne change pas. La poche `meta` a depuis été
 * APLATIE à la racine du document (#1467 L1b V-formeProjet) : ce script vise la forme d'ALORS,
 * c'est le sujet de sa mesure et il ne se « modernise » pas.
 *
 * ENTRÉES : les projets livrés `<x>-projet.json` sous `projets/` (`cheminsDesProjetsLivres`).
 *
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'` (indentation 1, précédent mesuré et déclaré par
 * `scripts/migrations/2026-08-24-give-trapping-label-vers-id.mjs`), et NON l'indentation 2 de
 * `src/data`. La forme est vérifiée AVANT toute écriture : non canonique = sortie 1, jamais un
 * reflow silencieux du document.
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une scène portant déjà `desc` (et plus de `description`)
 * est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0. Un projet
 * sans `meta`, ou un `meta` sans prose, est LÉGITIME.
 * PROSE ABSENTE : une scène sans ni `description` ni `desc` est LÉGITIME — le schéma de Scène pose
 * `desc: z.string().min(1).optional()` (`defs-scenes/scene.ts`), la prose absente étant une clé
 * absente. Elle est comptée à part, jamais fabriquée.
 * FAIL-FAST : porteur ayant les DEUX clés, `description` non-chaîne → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheminsDesProjetsLivres } from '../guards/lib/projetsLivres.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Forme canonique d'un document de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Renomme `description` → `desc` EN PLACE (position de clé préservée, valeur inchangée). */
const renomme = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k === 'description' ? 'desc' : k, v]));

const cibles = cheminsDesProjetsLivres(ROOT);

const echecs = [];
const rapports = [];

for (const rel of cibles) {
  const abs = path.join(ROOT, rel);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) {
    echecs.push(`${rel} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 1) + '\\n'\`)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) {
    echecs.push(`${rel} : \`scenes\` absent ou non-tableau`);
    continue;
  }

  let migres = 0;
  let deja = 0;
  let sansProse = 0;
  const scenes = doc.scenes.map((s, i) => {
    const aDescription = s?.description !== undefined;
    const aDesc = s?.desc !== undefined;
    if (aDescription && aDesc) { echecs.push(`${rel} › scenes[${i}] (${s.id}) : porte À LA FOIS \`description\` et \`desc\``); return s; }
    if (aDesc) { deja++; return s; }
    if (!aDescription) { sansProse++; return s; }
    if (typeof s.description !== 'string') { echecs.push(`${rel} › scenes[${i}] (${s.id}) : \`description\` de forme inattendue ${JSON.stringify(s.description)}`); return s; }
    migres++;
    return renomme(s);
  });

  let meta = doc.meta;
  let metaMigre = 0;
  if (meta && typeof meta === 'object') {
    if (meta.description !== undefined && meta.desc !== undefined) echecs.push(`${rel} › meta : porte À LA FOIS \`description\` et \`desc\``);
    else if (meta.description !== undefined) {
      if (typeof meta.description !== 'string') echecs.push(`${rel} › meta.description de forme inattendue ${JSON.stringify(meta.description)}`);
      else { meta = renomme(meta); metaMigre = 1; }
    }
  }

  const avant = doc.scenes.map((s) => s.description ?? s.desc);
  rapports.push({ rel, abs, brut, doc, scenes, meta, migres, deja, sansProse, metaMigre, avant });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  // Reconstruction à l'IDENTIQUE de l'ordre des clés de racine (`meta` remplacé en place s'il existe).
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : k === 'meta' ? [k, r.meta] : [k, v])),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : plus aucune `description` de scène, prose CONSERVÉE dans l'ordre.
  const apres = JSON.parse(out);
  const residus = apres.scenes.filter((s) => s.description !== undefined).length;
  const apresVals = apres.scenes.map((s) => s.desc);
  const identique = residus === 0 && r.avant.length === apresVals.length && r.avant.every((v, i) => v === apresVals[i]);
  if (!identique) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : ${residus} \`description\` résiduelle(s) ; prose ALTÉRÉE`);
    process.exit(1);
  }
  console.log(`${r.rel} — scenes[].description → desc : ${r.migres} (déjà migrées : ${r.deja}, sans prose : ${r.sansProse}, scènes : ${apres.scenes.length}) ; meta : ${r.metaMigre} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

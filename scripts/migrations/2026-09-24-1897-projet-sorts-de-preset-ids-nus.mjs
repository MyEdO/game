/**
 * Migration #1897 — la référence de SORT d'un preset de PNJ se DÉNUDE, volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 15` au moins : dans `narratif.presetsPnj[].profil.spells`, tout
 * élément `{ id }` devient l'id NU. `profil` reprend le def créature (`creatureEntreePartielle`,
 * `src/data/schemas/defs-scenes/narratif.ts`), dont `spells` adopte `refs('spell')` au même lot
 * (`2026-09-23-1897-sorts-de-creature-ids-nus.mjs`, volet `src/data`). Les ids eux-mêmes ne bougent
 * pas : seule l'ENVELOPPE `{ id }` tombe.
 *
 * Pendant de DÉPÔT du migrateur de chargement `PROJECT_MIGRATIONS[14]` (`src/state/worldMap.ts`), qui
 * rattrape les `.json` de bibliothèque utilisateur : ce que le chargement dénude, ce script le dénude ;
 * ce que le chargement laisse à `parseProject` pour qu'il le refuse, ce script le refuse. Parité
 * mesurée par `src/state/projet-migration-14-vers-15.test.ts`, qui joue la MÊME fixture par les deux.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture — non
 * canonique = sortie 1, jamais un reflow silencieux. La référence dénudée garde sa POSITION.
 * PORTE DE FORME : chaque élément de `profil.spells` est la forme SOURCE (objet de clé unique `id`,
 * chaîne non vide) ou la forme CIBLE (chaîne non vide) ; sinon rien n'est écrit, sortie 1, preset nommé.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE OUVERTE (`schema` ∈ {14, ≥ 15}) : la DERNIÈRE migration de la chaîne dans l'ordre
 * lexical est la seule à nommer un `schema` futur (`DERNIERE`, dérivée par
 * `src/scenes/migrations-format-projet.test.ts`). Le document sort donc d'ici en `schema` =
 * max(le sien, 15) : une migration amont ne RABAISSE jamais une forme.
 * FAIL-FAST : `schema` absent, non entier ou < 14, `scenes` non-tableau, `narratif.presetsPnj`
 * non-tableau, périmètre vide → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-24-1897-projet-sorts-de-preset-ids-nus';
const RACINE = path.join(ROOT, 'src/scenes');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est OUVERTE (cf. en-tête). */
const SCHEMA_AVANT = 14;
const SCHEMA_APRES = 15;

const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const estSource = (s) => !!s && typeof s === 'object' && !Array.isArray(s)
  && Object.keys(s).length === 1 && typeof s.id === 'string' && s.id.length > 0;
const estCible = (s) => typeof s === 'string' && s.length > 0;

const echecs = [];
const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

const rapports = [];
let presetsVus = 0;
let denudesVus = 0;

for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (typeof doc.schema !== 'number' || !Number.isInteger(doc.schema) || doc.schema < SCHEMA_AVANT) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou plus récent attendu)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }
  if (!Array.isArray(doc.narratif?.presetsPnj)) { echecs.push(`${rel} : \`narratif.presetsPnj\` absent ou non-tableau`); continue; }

  let denudes = 0;
  const presetsPnj = doc.narratif.presetsPnj.map((p) => {
    presetsVus++;
    const sorts = p?.profil?.spells;
    if (sorts === undefined) return p;
    if (!Array.isArray(sorts)) { echecs.push(`${rel} preset « ${p.id} » : \`profil.spells\` non-tableau`); return p; }
    const nus = sorts.map((s, i) => {
      if (estCible(s)) return s;
      if (!estSource(s)) { echecs.push(`${rel} preset « ${p.id} » profil.spells[${i}] : ${JSON.stringify(s)} — ni \`{ id }\` ni id nu`); return s; }
      denudes++;
      return s.id;
    });
    return { ...p, profil: { ...p.profil, spells: nus } };
  });

  denudesVus += denudes;
  rapports.push({ rel, abs, brut, doc, presetsPnj, denudes });
}

if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (
      k === 'narratif' ? [k, { ...v, presetsPnj: r.presetsPnj }] : k === 'schema' ? [k, Math.max(v, SCHEMA_APRES)] : [k, v]
    )),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : plus AUCUN `{ id }` de sort de preset, et le document s'annonce au format d'après.
  const apres = JSON.parse(out);
  const restes = apres.narratif.presetsPnj
    .filter((p) => (p?.profil?.spells ?? []).some((s) => !estCible(s)))
    .map((p) => p.id);
  if (restes.length || !(apres.schema >= SCHEMA_APRES)) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${restes.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, références de sort de preset dénudées : ${r.denudes} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${denudesVus} référence(s) dénudée(s) ; population : ${presetsVus} preset(s) de PNJ`);

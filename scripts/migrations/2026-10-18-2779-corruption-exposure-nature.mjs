/**
 * Migration #2779 — `corruptionExposure` (op `GameOp` et effet de scène) : le champ `skill: { id }`
 * devient `nature`, la clé du Test de la fiche `influences-corruptrices` qu'il désignait (LDB 19 l.29).
 * `resistance` → `physique`, `calme` → `spirituelle` (`NATURES_D_INFLUENCE`,
 * `src/data/schemas/grammaire/valeurs.ts`).
 *
 * POSITION PRÉSERVÉE : `nature` prend la place exacte qu'occupait `skill` dans l'objet.
 *
 * ENTRÉES (lues et écrites, rien d'autre) :
 *   - `src/data/activities.json`, `src/data/trappings.json` (ops, `JSON.stringify(doc, null, 2)`) ;
 *   - `src/scenes/arene/arene-projet.json` (effet de scène, `JSON.stringify(doc, null, 1)` + saut de
 *     ligne final ; sa source d'authoring `scripts/arene/zones8-13.mjs` porte déjà `nature`).
 *
 * IDEMPOTENT : un `corruptionExposure` sans `skill` est migré ou n'a rien à migrer ; rejouée sur
 * l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : `skill` ET `nature` sur le même objet, `skill` hors `{ id: 'resistance' | 'calme' }`,
 * forme de fichier non canonique → rien n'est écrit, sortie 1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Fichier → sa forme canonique (indentation, saut de ligne final). */
export const FICHIERS = Object.freeze({
  'src/data/activities.json': { indent: 2, fin: '' },
  'src/data/trappings.json': { indent: 2, fin: '' },
  'src/scenes/arene/arene-projet.json': { indent: 1, fin: '\n' },
});

/** Compétence désignée → nature de l'Influence (LDB 19 l.29). */
export const NATURE_DE = Object.freeze({ resistance: 'physique', calme: 'spirituelle' });

const estExposition = (o) => o.op === 'corruptionExposure' || o.type === 'corruptionExposure';

/**
 * Migre un document parsé ; rend le document neuf, le nombre de gestes et les anomalies.
 * @param {unknown} doc
 */
export function migrerDocument(doc) {
  let gestes = 0;
  const echecs = [];
  const visite = (n, chemin) => {
    if (Array.isArray(n)) return n.map((x, i) => visite(x, `${chemin}[${i}]`));
    if (n === null || typeof n !== 'object') return n;
    const o = /** @type {Record<string, unknown>} */ (n);
    const migre = estExposition(o) && 'skill' in o;
    if (migre && 'nature' in o) echecs.push(`${chemin} : porte À LA FOIS \`skill\` et \`nature\``);
    const id = migre ? /** @type {{ id?: unknown } | undefined} */ (o.skill)?.id : undefined;
    const nature = typeof id === 'string' ? NATURE_DE[/** @type {keyof typeof NATURE_DE} */ (id)] : undefined;
    if (migre && !nature) echecs.push(`${chemin} : \`skill\` ${JSON.stringify(o.skill)} hors { id: resistance | calme }`);
    if (migre && nature) gestes++;
    return Object.fromEntries(Object.entries(o).map(([k, v]) => (migre && nature && k === 'skill' ? ['nature', nature] : [k, visite(v, `${chemin}.${k}`)])));
  };
  return { doc: visite(doc, '$'), gestes, echecs };
}

if (import.meta.main) {
  const sorties = [];
  const echecs = [];
  for (const [rel, forme] of Object.entries(FICHIERS)) {
    const cible = path.join(ROOT, rel);
    const brut = readFileSync(cible, 'utf8');
    const data = JSON.parse(brut);
    if (JSON.stringify(data, null, forme.indent) + forme.fin !== brut) {
      echecs.push(`${rel} : forme non canonique (indentation ${forme.indent})`);
      continue;
    }
    const r = migrerDocument(data);
    echecs.push(...r.echecs.map((e) => `${rel} ${e}`));
    sorties.push({ rel, cible, brut, texte: JSON.stringify(r.doc, null, forme.indent) + forme.fin, gestes: r.gestes });
  }
  if (echecs.length) {
    console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  for (const s of sorties) {
    if (s.texte !== s.brut) writeFileSync(s.cible, s.texte, 'utf8');
    console.log(`${s.rel} — ${s.gestes} \`skill\` → \`nature\`${s.texte !== s.brut ? '' : ' (INCHANGÉ)'}`);
  }
}

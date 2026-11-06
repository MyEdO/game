/**
 * Migration #1467 L1b V-P2 — trois tables d'ISSUE : le champ `effect` devient `outcome`.
 *
 * MOTIF MESURÉ : dans les trois cas la valeur est un LITTÉRAL D'ENUM qui nomme l'ISSUE tirée, pas
 * un effet exécutable — `driving-mishap` (`harness|jolt|wheel|crash`), `drunkenness`
 * (`bravoure|ami|staggering|belligerent|blackout`, dont la MÉCANIQUE est le champ VOISIN `ops`) et
 * `sea-navigation.orientation.changementDeCap` (`aucun|retard|quart-de-tour|demi-tour`). La graphie
 * `outcome` est celle du dépôt pour ce concept : le voisin immédiat
 * `sea-navigation.orientation.reperes` la porte déjà (`src/data/schemas/defs/sea-navigation.ts`),
 * comme `travelTableEntry.mount.outcome` (`grammaire/mecanique.ts`) et `cargo`/`seaNavigation`.
 * Sous le nom `effect`, le détecteur de structures les classait en PROSE (rôle `prose` → `desc`).
 *
 * ENTRÉES :
 *   - `src/data/driving-mishap.json`   (chemin `table[]`)
 *   - `src/data/drunkenness.json`      (chemin `table[]`)
 *   - `src/data/sea-navigation.json`   (chemin `orientation.changementDeCap[]`)
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une rangée portant déjà `outcome` (et plus d'`effect`)
 * est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : rangée portant `effect` ET `outcome`, rangée sans ni l'un ni l'autre, `effect`
 * non-chaîne, ou chemin absent du document → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * @type {{ rel: string; chemins: readonly (readonly string[])[] }[]} — chaque chemin mène au TABLEAU
 * de rangées ; le PREMIER qui résout est retenu. Deux graphies pour la charge des deux tables LDB :
 * `table` était son nom à l'écriture de cette migration, `entries` est celui que
 * `2026-08-28-l1b-8b-table-vers-entries.mjs` pose — une migration ANTÉRIEURE dans l'ordre lexical
 * doit reconnaître la forme qu'une POSTÉRIEURE produit, sinon le rejeu la trouve introuvable. De même
 * pour `orientation.changementDeCap.entries`, que `2026-11-06-1667-tables-tirees-nichees.mjs` pose.
 */
const CIBLES = [
  { rel: 'src/data/driving-mishap.json', chemins: [['entries'], ['table']] },
  { rel: 'src/data/drunkenness.json', chemins: [['entries'], ['table']] },
  { rel: 'src/data/sea-navigation.json', chemins: [['orientation', 'changementDeCap', 'entries'], ['orientation', 'changementDeCap']] },
];

const echecs = [];
const rapports = [];

for (const { rel, chemins } of CIBLES) {
  const abs = path.join(ROOT, rel);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (JSON.stringify(doc, null, 2) !== brut) {
    echecs.push(`${rel} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }

  const resoudre = (c) => c.reduce((n, k) => n?.[k], doc);
  const chemin = chemins.find((c) => Array.isArray(resoudre(c)));
  if (!chemin) {
    echecs.push(`${rel} : aucun des chemins ${chemins.map((c) => `\`${c.join('.')}\``).join(' / ')} n'est un tableau`);
    continue;
  }
  const noeud = resoudre(chemin);

  let migres = 0;
  let deja = 0;
  const rangees = noeud.map((r, i) => {
    const aEffect = r?.effect !== undefined;
    const aOutcome = r?.outcome !== undefined;
    if (aEffect && aOutcome) { echecs.push(`${rel} › ${chemin.join('.')}[${i}] : porte À LA FOIS \`effect\` et \`outcome\``); return r; }
    if (aOutcome) { deja++; return r; }
    if (!aEffect) { echecs.push(`${rel} › ${chemin.join('.')}[${i}] : ni \`effect\` ni \`outcome\` — issue PERDUE`); return r; }
    if (typeof r.effect !== 'string' || !r.effect) { echecs.push(`${rel} › ${chemin.join('.')}[${i}] : \`effect\` de forme inattendue ${JSON.stringify(r.effect)}`); return r; }
    migres++;
    // Renommage EN PLACE : `outcome` occupe la position exacte d'`effect`, la valeur est inchangée.
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k === 'effect' ? 'outcome' : k, v]));
  });

  rapports.push({ rel, chemin, abs, brut, doc, rangees, migres, deja, avant: noeud.map((r) => r.effect ?? r.outcome) });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  let parent = r.doc;
  for (const k of r.chemin.slice(0, -1)) parent = parent[k];
  parent[r.chemin[r.chemin.length - 1]] = r.rangees;

  const out = JSON.stringify(r.doc, null, 2);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : plus aucun `effect` sur le chemin, valeurs d'issue CONSERVÉES dans l'ordre.
  let apres = JSON.parse(out);
  for (const k of r.chemin) apres = apres[k];
  const residus = apres.filter((x) => x.effect !== undefined).length;
  const apresVals = apres.map((x) => x.outcome).join(',');
  if (residus || r.avant.join(',') !== apresVals) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : ${residus} \`effect\` résiduel(s) ; issues ${r.avant.join(',') === apresVals ? 'conservées' : `ALTÉRÉES (${r.avant.join(',')} → ${apresVals})`}`);
    process.exit(1);
  }
  console.log(`${r.rel} › ${r.chemin.join('.')} — \`effect\` → \`outcome\` : ${r.migres} (déjà migrées : ${r.deja}, rangées : ${apres.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
  console.log(`   issues : ${apresVals}`);
}

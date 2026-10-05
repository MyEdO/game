/**
 * Migration #1988 B4a — l'op `grantWeapon` perd `label` dans les catalogues : le libellé de l'arme invoquée
 * se DÉRIVE de l'Effet qui la produit (`itemLabel`, `src/engine/items.ts`), et le schéma d'op
 * (`src/data/schemas/grammaire/mecanique.ts`, `z.strictObject`) ne l'admet plus.
 *
 * ENTRÉES : les `src/data/*.json` (catalogues). Les documents de projet passent par la primitive
 * `objetsEnFKDeep` (`src/data/donsDObjet.ts`) et leur propre migration de dépôt.
 *
 * GESTE : la ligne `"label": …` qui suit IMMÉDIATEMENT `"op": "grantWeapon",` est retirée — réécriture
 * TEXTUELLE ancrée, formatage préservé. Le compte textuel est confronté au compte STRUCTUREL (ops
 * `grantWeapon` porteuses de `label` sur le document parsé) : divergence = sortie 1, rien n'est écrit.
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve aucune op à `label` et n'écrit rien.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-10-05-1988-grantweapon-libelle-derive';
const RACINE = path.join(ROOT, 'src/data');

/** Ops `grantWeapon` porteuses de `label`, sur le document parsé. */
function porteuses(v) {
  if (Array.isArray(v)) return v.reduce((n, x) => n + porteuses(x), 0);
  if (!v || typeof v !== 'object') return 0;
  return (v.op === 'grantWeapon' && 'label' in v ? 1 : 0) + Object.values(v).reduce((n, x) => n + porteuses(x), 0);
}

const ANCRE = /("op": "grantWeapon",\r?\n)[ \t]*"label": "(?:[^"\\]|\\.)*",\r?\n/g;

const echecs = [];
const ecritures = [];
for (const nom of fs.readdirSync(RACINE).filter((f) => f.endsWith('.json')).sort()) {
  const abs = path.join(RACINE, nom);
  const brut = fs.readFileSync(abs, 'utf8');
  if (!brut.includes('"grantWeapon"')) continue;
  const attendu = porteuses(JSON.parse(brut));
  const textuel = (brut.match(ANCRE) ?? []).length;
  if (textuel !== attendu) { echecs.push(`src/data/${nom} : ${attendu} op(s) \`grantWeapon\` à \`label\`, ${textuel} ancrée(s) dans le texte`); continue; }
  if (attendu) ecritures.push({ abs, nom, out: brut.replace(ANCRE, '$1'), n: attendu });
}

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const e of ecritures) {
  fs.writeFileSync(e.abs, e.out, 'utf8');
  if (porteuses(JSON.parse(e.out)) !== 0) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — src/data/${e.nom} : op \`grantWeapon\` à \`label\` restante`);
    process.exit(1);
  }
  console.log(`[${NOM}] src/data/${e.nom} — ${e.n} \`grantWeapon.label\` retiré(s)`);
}
console.log(`[${NOM}] TOTAL — ${ecritures.length} fichier(s) réécrit(s)`);

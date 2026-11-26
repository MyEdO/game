/**
 * Migration one-shot : convertit en MARKDOWN tout champ de PROSE des datasets app-owned
 * (`src/data/*.json`) qui contient encore du HTML (legacy : `<br><br>`, `<b>`, `<i>`, `<ul><li>`…).
 *
 * Règle 5 du projet : une description est un copié/collé VERBATIM de la source (Markdown), JAMAIS du
 * HTML ni une paraphrase. Ce script bascule l'EXISTANT (formaté en HTML il y a ~5 ans) vers Markdown,
 * sans toucher au texte. Les chaînes sans tag HTML sont déjà du Markdown trivial → laissées telles quelles.
 *
 *   node scripts/data/html-to-md.mjs            # DRY-RUN : échantillon + compteurs, n'écrit rien
 *   node scripts/data/html-to-md.mjs --apply    # écrit les fichiers (format canonique JSON.stringify ,2)
 *
 * Écriture FIDÈLE au format sur disque (cf. src/data/schemas/serialize.ts) : `JSON.stringify(v, null, 2)`,
 * sans newline final → le garde-fou round-trip `serialize.test.ts` reste vert.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
// Le prédicat de la règle 5 vient de sa DÉFINITION UNIQUE (module feuille en syntaxe effaçable,
// chargé tel quel par Node nu — même convention que `scripts/raw/_lib.mjs`). Ce qui décide qu'une
// chaîne EST du HTML doit être le même ici, dans `src/data/no-html-in-prose.test.ts` et dans le
// volet E de `src/data/prose-resolution.test.ts` : trois copies auraient dérivé balise par balise.
import { HTML_TAG } from '../../src/data/schemas/source/normalize.ts';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'data');
const APPLY = process.argv.includes('--apply');

const hasHtml = (s) => HTML_TAG.test(s);

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  codeBlockStyle: 'fenced',
});
td.use(gfm);
// `<br>` legacy = séparateur de paragraphe (turndown collapse les `\n` adjacents → un `<br>` simple
// rendu `\n` se perdrait). On émet `\n\n` : `<br><br>` comme `<br>` isolé → un vrai saut de paragraphe.
td.addRule('lineBreak', { filter: ['br'], replacement: () => '\n\n' });
// Italique/gras exprimés en STYLE inline (cruft blog : `<span style="font-style:italic">`,
// `font-weight:bold|700`) que turndown ignore — on les restitue en Markdown (sans avaler les espaces
// de bordure, interdits autour des délimiteurs d'emphase).
td.addRule('styledSpan', {
  filter: (node) => node.nodeName === 'SPAN' && /font-(style:\s*italic|weight:\s*(bold|[6-9]00))/i.test(node.getAttribute('style') || ''),
  replacement: (content, node) => {
    const trimmed = content.trim();
    if (!trimmed) return content;
    const lead = content.slice(0, content.length - content.trimStart().length);
    const trail = content.slice(content.trimEnd().length);
    const style = node.getAttribute('style') || '';
    let out = trimmed;
    if (/font-style:\s*italic/i.test(style)) out = `*${out}*`;
    if (/font-weight:\s*(bold|[6-9]00)/i.test(style)) out = `**${out}**`;
    return lead + out + trail;
  },
});

// turndown-plugin-gfm refuse les tables SANS ligne d'en-tête (`<th>`) et les garde en HTML brut.
// On promeut la 1re ligne (`<td>`→`<th>`) de chaque table headerless pour qu'elle soit convertie.
function promoteTableHeaders(html) {
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tbl) => {
    if (/<th\b/i.test(tbl)) return tbl;
    return tbl.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i, (row, inner) =>
      row.replace(inner, inner.replace(/<td(\b[^>]*)?>/gi, '<th$1>').replace(/<\/td>/gi, '</th>')),
    );
  });
}

const toMd = (html) => td.turndown(promoteTableHeaders(html)).trim();

let totalFiles = 0;
let totalFields = 0;
const samples = [];

/** Convertit récursivement toute string de prose (contenant du HTML) d'une valeur JSON. */
function convert(value, path) {
  if (typeof value === 'string') {
    if (hasHtml(value)) {
      const md = toMd(value);
      totalFields++;
      if (samples.length < 12) samples.push({ path, before: value, after: md });
      return md;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => convert(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = convert(v, path ? `${path}.${k}` : k);
    return out;
  }
  return value;
}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
for (const f of files) {
  const raw = readFileSync(join(DATA_DIR, f), 'utf8');
  const before = totalFields;
  const converted = convert(JSON.parse(raw), '');
  const fileFields = totalFields - before;
  if (fileFields === 0) continue;
  totalFiles++;
  console.log(`${f.padEnd(24)} ${fileFields} champ(s) HTML → MD`);
  if (APPLY) writeFileSync(join(DATA_DIR, f), JSON.stringify(converted, null, 2), 'utf8');
}

console.log(`\n${totalFields} champs convertis dans ${totalFiles} fichiers — ${APPLY ? 'ÉCRIT' : 'DRY-RUN (rien écrit)'}`);
console.log('\n── Échantillons (before → after) ──');
for (const s of samples) {
  console.log(`\n• ${s.path}`);
  console.log(`  HTML: ${JSON.stringify(s.before.slice(0, 200))}`);
  console.log(`  MD  : ${JSON.stringify(s.after.slice(0, 200))}`);
}

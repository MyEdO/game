/**
 * Met en jetons les 9 ARCHÉTYPES de classe (tenues/defs/) pour qu'ils marchent comme les tenues de
 * CARRIÈRE : couleurs → jetons (torse/tête→@vet1, jambes→@vet2, dégradé métal→@metal) +
 * `palette` (couleurs EXACTES → sans perte). Préserve les commentaires (édite le texte).
 * Nu est déjà en @peau → ignoré. Usage : npx tsx scripts/_tokenize-tenue-archetypes.mts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'src/gameIso/rig/parts/tenues/defs';
const FILES = ['Citadins', 'Courtisans', 'Guerriers', 'Itinerants', 'Lettres', 'Riverains', 'Roublards', 'Ruraux'];
const GRADIENT_MID: Record<string, string> = { 'url(#g_steel)': '#9aa6b8', 'url(#g_robe)': '#282c58', 'url(#g_coat)': '#222229' };
const isMetalGrad = (c: string) => /g_steel|g_axe|g_steelD/.test(c);

let done = 0;
for (const f of FILES) {
  const path = `${DIR}/${f}.ts`;
  if (!existsSync(path)) { console.log(`absent: ${path}`); continue; }
  let src = readFileSync(path, 'utf8');
  if (/palette:/.test(src)) { console.log(`${f}: déjà tokenisé — ignoré`); continue; }
  const palette: Record<string, string> = {};

  // Remplace le fill DANS chaque slot (torse/tete/bras → vet1|metal ; jambes → vet2).
  src = src.replace(/(torse|jambes|bras|tete): (`[^`]*`)/g, (_m, slot: string, body: string) => {
    const newBody = body.replace(/fill="(url\(#[\w]+\)|#[0-9a-fA-F]{6})"/g, (_mm, color: string) => {
      const token = isMetalGrad(color) ? 'metal' : slot === 'jambes' ? 'vet2' : 'vet1';
      palette[token] = color.startsWith('url(') ? (GRADIENT_MID[color] ?? '#888888') : color.toLowerCase();
      return `fill="@${token}"`;
    });
    return `${slot}: ${newBody}`;
  });

  // Insère `palette: {...}` juste après la fermeture de `set`.
  const palStr = `{ ${Object.entries(palette).map(([k, v]) => `${k}: '${v}'`).join(', ')} }`;
  src = src.replace(/(\n {2}},)\n};/, `$1\n  palette: ${palStr},\n};`);

  writeFileSync(path, src);
  console.log(`${f}: palette=${palStr}`);
  done++;
}
console.log(`\nOK — ${done} archétypes tokenisés.`);

/**
 * Galerie TOISE — l'échelle FINALE en jeu de chaque créature (art speciesScale × Taille
 * sizeTokenScale), pieds au sol, avec un HUMAIN de référence en filigrane dans chaque cellule.
 * C'est le juge du calibrage des échelles : un cheval (Grande) ne doit pas faire 3 humains.
 * Les cellules sont rendues au pixel de l'échelle finale (cellules grandes = créatures grandes),
 * groupées par catégorie de Taille (LDB 85), triées par échelle croissante.
 * Lancer : npx tsx scripts/gen-toise-gallery.mts → public/toise-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { resolveRig, type ResolvedBone } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { defsGlobaux } from '../src/gameIso/sprites';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { planById, resolveById, resolveSpecies, planOptsForRecord, type BodyPlanId, type RenderResolution } from '../src/gameIso/rig/bodyPlan';
import { sizeTokenScale } from '../src/gameIso/sizeScale';
import { SIZE_LABEL, SIZE_ORDER, type SizeCategory } from '../src/engine/size';
import { creatures, tailleDuProfil } from '../src/data/index';

/** Os STATIQUES (repos) — bipède de face (rig), gabarit en profil. Résolution EXPLICITE :
 *  `r` (espèce/plan déjà résolus), `rigId` = id de record OU espèce pour le profil bipède,
 *  `rigSpecies` force l'espèce du rig (espèces jouables sans record). */
function restBones(r: RenderResolution, rigId: string, rigSpecies?: string): ResolvedBone[] {
  if (r.kind === 'plan') {
    const plan = planById(r.plan as BodyPlanId);
    return plan.resolve(r.species, 'profile', plan.restPose(), planOptsForRecord(rigId));
  }
  const prof = entityRigProfile(rigId, 7, rigSpecies ? { species: rigSpecies } : undefined);
  if (!prof) return [];
  return resolveRig(prof.appearance, prof.equip, {}, prof.tenue, 'front', []);
}

const HUMAN_REF = bonesToSvg(restBones(resolveSpecies('humain'), 'humain', 'humain'));

function cell(row: Row): string {
  const { label, k, r, rigId, rigSpecies } = row;
  const svgBody = bonesToSvg(restBones(r, rigId, rigSpecies));
  const W = Math.max(126, Math.ceil(120 * k) + 6);
  const H = Math.ceil(150 * k) + 6;
  // pieds au sol (bas de cellule) : l'humain de réf (k=1) et la créature partagent la ligne.
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#171b26">
      <g transform="translate(${(W - 120) / 2},${H - 6 - 150})" opacity="0.22">${HUMAN_REF}</g>
      <g transform="translate(${(W - 120 * k) / 2},${H - 6 - 150 * k}) scale(${+k.toFixed(3)})">${svgBody}</g>
      <line x1="0" y1="${H - 5}" x2="${W}" y2="${H - 5}" stroke="#3a4256" stroke-width="2"/>
    </svg>
    <figcaption style="color:#cdd;font:11px sans-serif;max-width:${W}px">${label}<br><span style="color:#7e8aa0">×${k.toFixed(2)}</span></figcaption></figure>`;
}

interface Row { label: string; size: SizeCategory; k: number; r: RenderResolution; rigId: string; rigSpecies?: string }
const rows: Row[] = [];
const seen = new Set<string>();
for (const c of creatures) {
  if (seen.has(c.label)) continue;
  seen.add(c.label);
  const size = tailleDuProfil(c);
  const r = resolveById(c.id); // résolution PAR ID (record → espèce explicite)
  rows.push({ label: c.label, size, k: r.scale * sizeTokenScale(size), r, rigId: c.id });
}
// Espèces jouables (référence intra-Moyenne : elfe > humain > nain…) — par id d'espèce EXPLICITE.
for (const [id, label] of [['humain', 'Humain'], ['elfe', 'Elfe'], ['nain', 'Nain'], ['halfling', 'Halfling'], ['gnome', 'Gnome']] as const) {
  if (!seen.has(label)) rows.push({ label, size: 'moyenne', k: resolveSpecies(id).scale, r: resolveSpecies(id), rigId: id, rigSpecies: id });
}

const CATS = Object.keys(SIZE_ORDER) as SizeCategory[];
const sections = CATS.map((cat) => {
  const list = rows.filter((r) => r.size === cat).sort((a, b) => a.k - b.k);
  if (!list.length) return '';
  return `<h2 style="color:#d8a93b;font:15px sans-serif;margin:24px 0 8px">${SIZE_LABEL[cat]} — ×${sizeTokenScale(cat)} <span style="color:#7e8aa0;font-size:12px">(${list.length})</span></h2>
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">${list.map(cell).join('')}</div>`;
}).join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Toise — échelles en jeu</title></head>
<body style="background:#11141c;padding:18px;margin:0">
<svg width="0" height="0"><defs>${defsGlobaux()}</defs></svg>
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Toise — échelle FINALE en jeu (art × Taille), pieds au sol</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 6px">Chaque cellule : la créature à son échelle de rendu réelle, l'humain de référence (×1) en filigrane. Les cellules sont à l'échelle ENTRE elles.</p>
${sections}
</body></html>`;
writeFileSync('public/toise-gallery.html', html);
console.log(`OK: public/toise-gallery.html (${rows.length} entrées)`);

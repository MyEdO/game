/**
 * Planche-contact QC des ENGINS DE SIÈGE : rend l'art d'affût (`engin/defs/`) en face/profil/dos
 * pour chaque id du registre `ENGIN_ARTS`, pour valider d'un coup d'œil la vague d'art (silhouette,
 * cohérence des 3 vues). Même patron que `gen-tenue-views-gallery.mts` (rangée = objet, 3 colonnes = vues).
 * Lancer : npx tsx scripts/gen-engin-views-gallery.mts → public/qc-engins.html
 */
import { writeFileSync } from 'node:fs';
import { planById } from '../src/gameIso/rig/bodyPlan';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { VIEWS, type View } from '../src/gameIso/rig/facing';
import { ENGIN_ARTS } from '../src/gameIso/rig/engin/_registry.generated';
import { defsGlobaux } from '../src/gameIso/sprites';

const ids = ENGIN_ARTS.map((a) => a.id).slice().sort((a, b) => a.localeCompare(b, 'fr'));

function cell(id: string, view: View) {
  const plan = planById('engin');
  const svg = bonesToSvg(plan.resolve(id, view, plan.restPose(), {}));
  return `<figure style="margin:0;text-align:center">` +
    `<div><svg viewBox="0 0 120 150" width="92" height="115"><defs>${defsGlobaux()}</defs>` +
    `<rect width="120" height="150" fill="${view === 'back' ? '#241a1a' : '#1b1f2b'}"/>${svg}</svg></div>` +
    `<figcaption style="color:#bcd;font:10px sans-serif">${view}</figcaption></figure>`;
}

const rows = ids.map((id) =>
  `<div style="display:flex;align-items:center;gap:10px;margin:4px 0;border-bottom:1px solid #222">
     <div style="width:220px;color:#eee;font:12px sans-serif">${id}</div>
     <div style="display:flex;gap:8px">${VIEWS.map((v) => cell(id, v)).join('')}</div>
   </div>`,
);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Engins de siège — vues</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Engins de siège — planche-contact 3 vues — ${ids.length} engins</h1>
<p style="color:#9ab;font:12px sans-serif">Art d'affût (registre <code>engin/defs/</code>) en face/profil/dos, ancré au sol (plan <code>engin</code>).</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/qc-engins.html', html);
console.log(`OK: public/qc-engins.html (${ids.length} engins × 3 vues)`);

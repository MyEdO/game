/**
 * Galerie QC des ICÔNES UI (registre src/ui/icons/ — primitive <Icon>, LOT 4 anti-emoji) :
 * chaque icône rendue aux 3 tailles canon (sm 14 / md 18 / lg 24) + une loupe 48px, groupée
 * par famille. Vérifie que CHAQUE icône reste lisible à 14px et respecte la charte (currentColor).
 * Lancer : npx tsx scripts/gen-icon-gallery.mts
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { Icon } from '../src/ui/Icon';
import { ICON_FAMILIES } from '../src/ui/icons/_registry.generated';

const ALL = ICON_FAMILIES.flat();
const families = [...new Set(ALL.map((d) => d.id.split('/')[0]))];

const cell = (id: string, label: string) => {
  const at = (size: number) => renderToStaticMarkup(React.createElement(Icon, { id, size }));
  return `<figure class="cell">
    <div class="sizes">${at(14)}${at(18)}${at(24)}</div>
    <div class="loupe">${at(48)}</div>
    <figcaption><code>${id}</code><br>${label}</figcaption>
  </figure>`;
};

const sections = families
  .map((fam) => {
    const defs = ALL.filter((d) => d.id.startsWith(`${fam}/`));
    return `<h2>${fam}/ (${defs.length})</h2>
<div class="grid">${defs.map((d) => cell(d.id, d.label)).join('\n')}</div>`;
  })
  .join('\n');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="./favicon.svg" /><title>Icônes UI QC</title>
<style>
  :root { color-scheme: dark; --gold: #b8912f; }
  body { background:#11141c; color:#e8ecf4; font:13px/1.4 system-ui,sans-serif; padding:16px }
  a { color:#8fb6ff }
  h1 { font-size:18px } h2 { color:#d8a93b; font-size:14px; margin:20px 0 8px }
  .sub { color:#8a93a6; font-size:12px }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,150px); gap:10px }
  .cell { margin:0; background:#1a2030; border:1px solid #2a3348; border-radius:10px; padding:10px; text-align:center }
  .sizes { display:flex; align-items:center; justify-content:center; gap:8px; min-height:26px }
  .loupe { margin:8px 0 6px; opacity:.92 }
  figcaption { color:#9fb0c8; font-size:11px } figcaption code { color:#cfe0ff }
</style></head>
<body>
<a href="galeries.html">← Galeries</a>
<h1>Icônes UI (registre src/ui/icons/) — ${ALL.length} icônes, ${families.length} familles</h1>
<p class="sub">Primitive <b>&lt;Icon&gt;</b> : SVG maison 24×24 en <code>currentColor</code>, trait 1.8 « dessiné main ».
Rendu sm 14 / md 18 / lg 24 + loupe 48px. Garde-fou : src/ui/icons/icons.test.ts.</p>
${sections}
</body></html>`;
writeFileSync('public/icon-gallery.html', html);
console.log(`OK: public/icon-gallery.html (${ALL.length} icônes, ${families.length} familles)`);

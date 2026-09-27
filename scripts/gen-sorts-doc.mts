/**
 * Génère docs/sorts-implementation.md — INVENTAIRE des sorts/miracles :
 * pour chacun, son niveau de prise en charge mécanique et CE QUI RESTE à
 * implémenter (le texte « arbitrage MJ » journalisé en jeu).
 *
 * Migration #5 : les métadonnées de résolution (durée, ZdE, etc.) vivent désormais
 * dans SpellData (spells.json) — plus de src/data/spellspecs/. La colonne « Curé »
 * lit s.curated directement depuis la donnée JSON.
 *
 * Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au
 * .md committé, exit 1 avec message actionnable si diff — jamais d'écriture en --check.
 * Composé via `emitOrCheck` de scripts/docs/lib/jsdocUnion.mjs.
 *
 *   npx tsx scripts/gen-sorts-doc.mts
 */
import { spells } from '../src/data';
import { spellSupportOf } from '../src/engine/spellspec';
import { spellEffectOps } from '../src/engine/flowCore';
import { emitOrCheck } from './docs/lib/jsdocUnion.mjs';
import { parLibelle } from './guards/lib/lister.mjs';

const ICON = { mecanique: '✅', partiel: '🟡', narratif: '📜' } as const;

const lines: string[] = [
  '# Sorts & Miracles — état d\'implémentation',
  '',
  '> GÉNÉRÉ par `npx tsx scripts/gen-sorts-doc.mts` — ne pas éditer à la main.',
  '> ✅ = effets connus appliqués par le moteur ·',
  '> 🟡 = partiel (volet « arbitrage MJ » journalisé en jeu) · 📜 = rien de mécanique',
  '> (effet journalisé verbatim). « curé » = spec complète dans SpellData (spells.json).',
  '',
  '**Périmètre mesuré / angles morts** — la classification (État/Curé/Reste) lit `s.effects` (le `Flow` authoré) via ' +
  '`spellOps(s.effects, on)`, appelé seulement pour `on: \'target\'` et `on: \'caster\'`. `EffectOp.on` admet aussi ' +
  '`\'party\'` et `\'hero\'` (`src/engine/flowCore.ts`) : un effet authoré sur ces deux cibles est invisible ici — ni ' +
  'compté dans État/Curé, ni listé dans « Reste à mécaniser ». Mesuré sur `src/data/spells.json` : 0 occurrence ' +
  'de `party`/`hero` aujourd\'hui (angle mort inerte). Second angle mort, DISTINCT : `spellOps` ne descend jamais ' +
  'dans les `Flow` imbriqués d\'un `GameOp.onHitEffects` (`augmentWeapon`/`grantWeapon`, ex. Serres d\'ambre → ' +
  '« En flammes » à la touche) — ces ops ciblent la victime touchée via `TriggeredEffect.on: \'victim\'` (un champ ' +
  'DIFFÉRENT d\'`EffectOp.on`, cf. `EffectTargeting`). Mesuré : 5 sorts / 6 occurrences (`serres-d-ambre`, ' +
  '`l-epee-ardente-de-rhuin`, `marteau-ardent-de-sigmar`, `morsure-de-l-hiver`, `epee-de-justice`) — mais chacun ' +
  'porte déjà un autre op non-narratif au premier niveau (`augmentWeapon`/`grantWeapon`), donc la classification ' +
  'affichée n\'est PAS sous-évaluée par ce trou aujourd\'hui ; seul le détail « Reste à mécaniser » de ces 5 lignes ' +
  'est incomplet. Troisième angle mort : la mesure est STRUCTURELLE ' +
  '(le `Flow` authoré existe), pas une preuve d\'exécution — une op comptée « mécanique » ici peut rester ' +
  '« inerte au switch » d\'`applyOps` (cf. `docs/vocabulaire-mecanique.md`).',
  '',
];

const groups = new Map<string, typeof spells>();
for (const s of spells) {
  const key = s.subType ? `${s.ecole} — ${s.subType}` : s.ecole;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(s);
}

const totals = { mecanique: 0, partiel: 0, narratif: 0, curated: 0 };
for (const [group, list] of [...groups.entries()].sort(([a], [b]) => parLibelle(a, b))) {
  lines.push(`## ${group} (${list.length})`, '');
  lines.push('| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |');
  lines.push('|---|---|---|---|');
  for (const s of [...list].sort((a, b) => parLibelle(a.label, b.label))) {
    const ops = spellEffectOps(s.effects);
    const support = spellSupportOf(s);
    totals[support]++;
    if (s.curated) totals.curated++;
    const reste = ops
      .filter((o) => o.op === 'narrative')
      .map((o) => (o as { text: string }).text)
      .join(' ')
      .replace(/\|/g, '/');
    const fallbackNote = !s.curated && ops.length === 0 ? 'Non curé : desc journalisée telle quelle.' : '';
    lines.push(`| ${s.label} | ${ICON[support]} | ${s.curated ? 'oui' : 'repli'} | ${reste || fallbackNote} |`);
  }
  lines.push('');
}

lines.splice(10, 0,
  `**Synthèse** : ${spells.length} sorts — ✅ ${totals.mecanique} mécaniques · 🟡 ${totals.partiel} partiels · ` +
  `📜 ${totals.narratif} narratifs (arbitrage MJ) · ${totals.curated} specs curées.`,
  '');

const out = lines.join('\n');
const summary = `${spells.length} sorts — ✅ ${totals.mecanique} · 🟡 ${totals.partiel} · 📜 ${totals.narratif} · curés ${totals.curated}`;
const path = 'docs/sorts-implementation.md';
emitOrCheck({
  out,
  path,
  check: process.argv.includes('--check'),
  staleMsg: `docs:sorts — ${path} est PÉRIMÉ (diverge de src/data spells / src/engine/spellspec / src/state/flow).`,
  rerunMsg: '  → relancer `npm run docs:sorts` et committer le résultat.',
  okMsg: `docs:sorts — OK (${path} à jour, ${summary})`,
  writeMsg: `${path} : ${summary}`,
});

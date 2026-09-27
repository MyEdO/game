/**
 * Migration #1520 — les deux choix AUTHORÉS d'un pré-tiré (`src/data/pregens.json`) passent du
 * LIBELLÉ d'affichage à l'id STABLE :
 *   1. `pettySpells: ["Fléchette", …]` → ids de `spells.json` (`refs('spell')`) ;
 *   2. `careerTalent: "Béni (Sigmar)"` → `{ id, spec? }` (`refOuSpec('talent')`), la spécialisation
 *      en id de son catalogue.
 *
 * POURQUOI : `src/data/schemas/defs/pregens.ts` adopte la fabrique de référence
 * (`src/data/schemas/grammaire/ref.ts`), qui refine l'id AU PARSE ; la fabrique du pré-tiré
 * (`src/data/pregens.ts › buildPregenHero`) lit des ids.
 *
 * ENTRÉES : `src/data/pregens.json` (seule donnée écrite) ; catalogues LUS : `src/data/spells.json`,
 * `src/data/talents.json`, `src/data/gods.json` (catalogue des spécialisations `cultBlessings`,
 * `cultMiracles`, `cultChaos`).
 *
 * RÉSOLUTION : par les CATALOGUES, jamais par une table figée ici — `label` exact (comparaison
 * normalisée : accents, casse, apostrophes typographiques, espaces multiples). Une spécialisation se
 * résout dans le catalogue que son talent déclare : `specs[]` de l'entrée, ou `specsSource` parmi les
 * trois sources de culte ci-dessus.
 * FAIL-FAST — lecture SEULE, avant toute écriture : 0 ou 2+ candidats, une `specsSource` que cette
 * migration ne lit pas, une valeur ni libellé ni forme cible → rien n'est écrit, sortie 1, porteurs
 * nommés.
 * IDEMPOTENT : la forme CIBLE (`pettySpells` : id de sort connu ; `careerTalent` : objet `{ id,
 * spec? }`) est laissée intacte ; rejouée sur elle, la migration n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne
 * final), vérifié AVANT l'écriture — une forme non canonique fait sortir 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const abs = (rel) => path.join(ROOT, rel);
const CIBLE = abs('src/data/pregens.json');

const norm = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

const lire = (rel) => JSON.parse(fs.readFileSync(abs(rel), 'utf8'));

/** Index `libellé normalisé → ids` d'une liste d'entrées `{ id, label }`. */
function indexParLabel(entrees) {
  const m = new Map();
  for (const e of entrees) {
    if (typeof e?.label !== 'string' || typeof e?.id !== 'string') continue;
    const k = norm(e.label);
    m.set(k, [...(m.get(k) ?? []), e.id]);
  }
  return m;
}

const sorts = lire('src/data/spells.json');
const idsDeSort = new Set(sorts.map((s) => s?.id).filter((id) => typeof id === 'string'));
const sortParLabel = indexParLabel(sorts);
const talents = lire('src/data/talents.json');
const talentParId = new Map(talents.filter((t) => typeof t?.id === 'string').map((t) => [t.id, t]));
const talentParLabel = indexParLabel(talents);
const dieux = lire('src/data/gods.json');
/** Les sources de spécialisation de culte : leurs ids sont ceux de `gods.json`. */
const SOURCES_DE_CULTE = new Set(['cultBlessings', 'cultMiracles', 'cultChaos']);

const echecs = [];
/** L'unique id de `index` pour `label`, ou `null` (échec consigné). */
function unique(index, label, ou, quoi) {
  const ids = index.get(norm(label)) ?? [];
  if (ids.length === 1) return ids[0];
  echecs.push(`${ou} : « ${label} » — ${ids.length === 0 ? `aucun ${quoi} à ce libellé` : `${ids.length} candidats : ${ids.join(', ')}`}`);
  return null;
}

/** Id de la spécialisation `label` dans le catalogue que déclare le talent `t`, ou `null`. */
function specDe(t, label, ou) {
  if (Array.isArray(t.specs)) return unique(indexParLabel(t.specs), label, ou, `spécialisation de « ${t.id} »`);
  if (SOURCES_DE_CULTE.has(t.specsSource)) return unique(indexParLabel(dieux), label, ou, `dieu (${t.specsSource})`);
  if (t.specsSource === undefined) echecs.push(`${ou} : « ${t.id} » ne déclare aucune spécialisation (ni \`specs\` ni \`specsSource\`), « ${label} » n'en désigne donc aucune`);
  else echecs.push(`${ou} : « ${t.id} » tire ses spécialisations de \`${t.specsSource}\`, que cette migration ne lit pas`);
  return null;
}

const estCibleTalent = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string';

const brut = fs.readFileSync(CIBLE, 'utf8');
const doc = JSON.parse(brut);
const reecrits = [];
if (!Array.isArray(doc)) echecs.push('pregens.json : racine non-TABLEAU');
else if (brut !== JSON.stringify(doc, null, 2)) echecs.push('pregens.json : forme non canonique (JSON.stringify(doc, null, 2))');
else {
  for (const p of doc) {
    const qui = `pré-tiré « ${p?.id} »`;
    if (p.pettySpells !== undefined) {
      if (!Array.isArray(p.pettySpells)) echecs.push(`${qui} : \`pettySpells\` non-tableau`);
      else {
        p.pettySpells.forEach((s, i) => {
          const ou = `${qui} pettySpells[${i}]`;
          if (typeof s !== 'string' || !s) { echecs.push(`${ou} : ${JSON.stringify(s)} — ni libellé ni id de sort`); return; }
          if (idsDeSort.has(s)) return;
          const id = unique(sortParLabel, s, ou, 'sort');
          if (id) reecrits.push(() => { p.pettySpells[i] = id; });
        });
      }
    }
    if (p.careerTalent !== undefined && !estCibleTalent(p.careerTalent)) {
      const ou = `${qui} careerTalent`;
      const v = p.careerTalent;
      if (typeof v !== 'string' || !v) { echecs.push(`${ou} : ${JSON.stringify(v)} — ni libellé ni \`{ id, spec? }\``); continue; }
      const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(v);
      const nom = m ? m[1] : v;
      const id = unique(talentParLabel, nom, ou, 'talent');
      if (!id) continue;
      if (!m) { reecrits.push(() => { p.careerTalent = { id }; }); continue; }
      const spec = specDe(talentParId.get(id), m[2], ou);
      if (spec) reecrits.push(() => { p.careerTalent = { id, spec }; });
    }
  }
}
if (echecs.length) {
  console.error(`[${path.basename(fileURLToPath(import.meta.url))}] ARBITRAGE REQUIS, rien n'est écrit :\n  ${echecs.join('\n  ')}`);
  process.exit(1);
}

if (reecrits.length === 0) {
  console.log('pregens.json : no-op (0 libellé à résoudre)');
} else {
  for (const r of reecrits) r();
  fs.writeFileSync(CIBLE, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`pregens.json : ${reecrits.length} libellé(s) résolu(s) en id`);
}

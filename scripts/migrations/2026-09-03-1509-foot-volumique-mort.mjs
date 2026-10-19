/**
 * Migration #1509 — `PropData.foot` MEURT sur les décors à RECETTE.
 *
 * Depuis ce lot, les cases qu'un décor à recette occupe se DÉRIVENT de son corps tourné
 * (`empreinteDeriveeDuProp`, `src/data/props.types.ts`) : son `foot` n'est plus lu par aucun
 * consommateur de cases. Le laisser en donnée en ferait un CHAMP MORT que le prochain auteur
 * croirait porteur — et qui mentirait au premier cap E/O (le `foot` ne tourne pas, l'empreinte si).
 * `foot` redevient donc ce que le design #1509 point 6 tranche : la vérité d'un BILLBOARD seulement,
 * et son tri-état (absent / présent) y garde tout son sens (`noyau/monde/sceneRules.ts`, porte de blocage).
 *
 * Le refine `affinerEntree` (`src/data/schemas/defs/props.ts`) refuse désormais la co-présence à
 * l'entrée : ce script est ce qui rend le catalogue conforme à cette porte.
 *
 * ENTRÉES : `src/data/props.json` (seule donnée lue et écrite).
 *
 * MARQUEUR D'IDEMPOTENCE : la présence de `foot` sur une entrée qui porte `volume`. Rejoué sur l'état
 * final, le script n'en trouve aucune et n'écrit rien.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : racine non-tableau, cardinal de volumiques
 * inattendu, cardinal de volumiques À `foot` inattendu, ou entrée dont le `foot` déclaré DIFFÈRE de
 * l'empreinte que son corps dérive au cap d'identité — ce script SUPPRIME une donnée redondante, il
 * n'a pas le droit de supprimer une donnée qui disait autre chose que le corps.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');

/** Cardinaux FIGÉS, mesurés sur l'arbre à l'écriture (2026-09-03) — porte d'identité du périmètre :
 *  une recette ajoutée ou retirée depuis fait sortir 1 plutôt que migrer un catalogue qui n'est plus
 *  celui qu'on a mesuré. UNE seule recette porte un `foot` (`table-2x1`, posé par #1644). */
const VOLUMIQUES_A_FOOT = 1;

/** L'ÉCHELLE de la vérification, en m/case : le défaut du monde (`LDB 15 l.12`, `sceneMetresPerTile`).
 *  C'est à elle que le `foot` supprimé doit coïncider avec le corps — un catalogue authoré pour la
 *  grille terrestre. */
const MPT = 2;

const brut = fs.readFileSync(CIBLE, 'utf8');
const avant = JSON.parse(brut);
const echecs = [];
if (!Array.isArray(avant)) {
  console.error(`ARBITRAGE REQUIS — ${CIBLE} : racine non-tableau`);
  process.exit(1);
}

const volumiques = avant.filter((e) => e?.volume);
const aFoot = volumiques.filter((e) => e.foot !== undefined);
// FORME, jamais cardinal (#1812) : le catalogue de décor grandit, un décor neuf doit se MIGRER.
if (!volumiques.length) echecs.push('aucune recette volumique — périmètre déplacé');
if (aFoot.length !== VOLUMIQUES_A_FOOT && aFoot.length !== 0)
  echecs.push(`${aFoot.length} recette(s) à \`foot\` ≠ ${VOLUMIQUES_A_FOOT} mesurée(s)`);

// ── L'empreinte que le CORPS dérive, recalculée ICI : une migration ne dépend pas du code applicatif
// (il changera ; le fichier migré, non). Même définition que `empreinteDeriveeDuProp` — sièges exclus,
// étendue au plan arrondie au supérieur, plancher 1 — au CAP D'IDENTITÉ (`S`), où la recette est
// écrite telle quelle et où aucune rotation n'entre.
const empriseLocale = (p) => {
  const dx = (p.kind === 'cylinder' ? p.radiusM : p.size.xM / 2);
  const dy = (p.kind === 'cylinder' ? p.radiusM : p.size.yM / 2);
  const dh = (p.kind === 'cylinder' ? p.heightM : p.size.hM) / 2;
  return {
    x0: p.center.xM - dx, x1: p.center.xM + dx,
    y0: p.center.yM - dy, y1: p.center.yM + dy,
    haut: p.center.hM + dh,
  };
};
const estSiege = (prop, p) => {
  const e = empriseLocale(p);
  return (prop.seatSlots ?? []).some((s) =>
    s.anchor.xM >= e.x0 - 1e-9 && s.anchor.xM <= e.x1 + 1e-9
    && s.anchor.yM >= e.y0 - 1e-9 && s.anchor.yM <= e.y1 + 1e-9
    && e.haut <= s.anchor.hM + 1e-9);
};
const empreinteDuCorps = (prop) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of prop.volume.primitives) {
    if (estSiege(prop, p)) continue;
    const e = empriseLocale(p);
    x0 = Math.min(x0, e.x0); x1 = Math.max(x1, e.x1);
    y0 = Math.min(y0, e.y0); y1 = Math.max(y1, e.y1);
  }
  const enCases = (m) => Math.max(1, Math.ceil(m / MPT - 1e-9));
  return Number.isFinite(x0) ? { w: enCases(x1 - x0), h: enCases(y1 - y0) } : { w: 1, h: 1 };
};

for (const e of aFoot) {
  const corps = empreinteDuCorps(e);
  const declare = { w: e.foot.w ?? 1, h: e.foot.h ?? 1 };
  if (corps.w !== declare.w || corps.h !== declare.h)
    echecs.push(
      `${e.id} : \`foot\` ${declare.w}×${declare.h} ≠ empreinte du CORPS ${corps.w}×${corps.h} à ${MPT} m/case — `
      + 'ce script supprime une donnée REDONDANTE, pas une donnée qui dit autre chose',
    );
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), RIEN n’est écrit :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let retires = 0;
const apres = avant.map((e) => {
  if (!e?.volume || e.foot === undefined) return e;
  retires++;
  const { foot, ...reste } = e;
  void foot;
  return reste;
});

// NO-OP SÉMANTIQUE : ce script ne possède que le RETRAIT du `foot` des recettes. Aucun à retirer =
// rien à écrire, quel que soit l'ordre des clés ou le formatage du fichier.
if (retires === 0) {
  console.log(`src/data/props.json : no-op (0 \`foot\` à retirer sur ${volumiques.length} recette(s))`);
  process.exit(0);
}

const sortieTexte = JSON.stringify(apres, null, 2);

fs.writeFileSync(CIBLE, sortieTexte, 'utf8');

// ── PREUVE post-écriture : même cardinal d'entrées et même ordre, plus AUCUNE recette à `foot`, et le
// `foot` des BILLBOARDS intact (ce script ne touche que les décors à recette).
{
  const relu = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
  const post = [];
  if (relu.length !== avant.length) post.push(`POST : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    if (relu[i].id !== avant[i].id) post.push(`POST [${i}] : id ${relu[i].id} ≠ ${avant[i].id}`);
    if (relu[i].volume && relu[i].foot !== undefined) post.push(`POST ${relu[i].id} : \`foot\` survivant sur une recette`);
    if (!relu[i].volume && JSON.stringify(relu[i].foot) !== JSON.stringify(avant[i].foot))
      post.push(`POST ${relu[i].id} : \`foot\` de BILLBOARD altéré`);
  }
  if (post.length) {
    console.error(`ARBITRAGE REQUIS — ${post.length} anomalie(s) après écriture :`);
    for (const m of post) console.error(`  ${m}`);
    process.exit(1);
  }
}

console.log(
  `src/data/props.json : ${retires} \`foot\` retiré(s) d’une recette volumique — `
  + `${volumiques.length} recette(s) tirent désormais leurs cases de leur CORPS (#1509)`,
);

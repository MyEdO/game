// GARDE « géométrie recalculée à la main » (#1343 lot C, design `.superpowers/sdd/1343-lot-c/
// design-cylindre-couche.md`, décision 3) : aucun code de `src/**` ni de `scripts/**` ne BRANCHE sur
// la valeur `cylinder` du discriminant `kind` hors du SOCLE, `src/data/props.types.ts`
// (`polygonesDePrimitive`, `empriseLocaleM`, `erreursDePrimitive`). Le schéma
// (`src/data/schemas/defs/props.ts`) DÉCLARE la forme par `z.literal`, il ne branche pas dessus. Une
// emprise, une hauteur ou une demi-largeur relue sur `radiusM`/`longueurM` suppose un axe ; elle se
// lit sur la géométrie unique (`empriseLocaleM`, `polygonesDePrimitive`).
// Banc et balayage : `src/data/cylindre-hors-socle-guard.test.ts`.
// LIMITE : garde LEXICALE — une comparaison portée par une variable (`p[k] === nom`) lui échappe.

/** Le SOCLE : ce n'est pas une exemption, c'est l'endroit où la branche par forme a le droit de vivre. */
export const SOCLE = ['src/data/props.types.ts'];

/** Une BRANCHE par forme de cylindre : comparaison stricte d'égalité ou d'inégalité sur `kind` (avec
 *  ou sans chaînage optionnel), ou `case` d'un `switch`. */
export const BRANCHE_CYLINDRE = /\bkind\s*[!=]==?\s*(['"`])cylinder\1|\bcase\s+(['"`])cylinder\2\s*:/;

/** La cote PROPRE au cylindre, écrite par morceaux : ce module est lui-même balayé. */
const COTE = ['longueur', 'M'].join('');

/** Tous les motifs mordus, sur le texte ENTIER (`\s` franchit les fins de ligne) :
 *  - la valeur `cylinder` de part ou d'autre d'une comparaison stricte (`p['kind']`, forme inversée) ;
 *  - `case` d'un `switch` ;
 *  - un tableau de valeurs qui l'inclut (`[…].includes(p.kind)`) ;
 *  - la LECTURE de la cote propre au cylindre (`COTE` par point, par crochets, ou par `in`) —
 *    ce qui mord aussi le calcul PAR ÉLIMINATION des autres formes. */
export const MOTIFS = [
  /[!=]==?\s*(['"`])cylinder\1/g,
  /(['"`])cylinder\1\s*[!=]==?/g,
  /\bcase\s+(['"`])cylinder\1\s*:/g,
  /\[\s*(['"`])cylinder\1[^\]]*\]\s*\.\s*includes\b/g,
  new RegExp(`\\.\\s*${COTE}\\b`, 'g'),
  new RegExp(`\\[\\s*(['"\`])${COTE}\\1\\s*\\]`, 'g'),
  new RegExp(`(['"\`])${COTE}\\1\\s+in\\b`, 'g'),
];

// Exemptions AU SITE : `fichier` + `motif` de la ligne + `raison`. Chacune doit toucher un site.
// Les motifs écrivent le guillemet en classe (`['"]`) : ce module est lui-même balayé.
const RAISON_MIGRATION = 'migration DATÉE, rejouée telle qu’écrite (`migrations:replay`) : une migration ne dépend pas du code applicatif — ';
export const EXEMPTIONS = [
  { fichier: 'scripts/migrations/2026-09-02-1507-recettes-en-metres.mjs', motif: /marques\(primitives, \(p\) => \(p\.kind === ['"]cylinder['"] \? ['"]radiusM['"] in p/, raison: `${RAISON_MIGRATION}marqueur d’idempotence de SA conversion d’unité, aucune géométrie` },
  { fichier: 'scripts/migrations/2026-09-03-1509-foot-volumique-mort.mjs', motif: /^const d[xyh] = \(p\.kind === ['"]cylinder['"] \? p\.(radiusM|heightM) :/, raison: `${RAISON_MIGRATION}emprise FIGÉE à sa date (cylindres tous verticaux), lue seulement sur une recette à \`foot\` — aucune depuis` },
  { fichier: 'scripts/migrations/2026-09-03-1509-murale-1x2.mjs', motif: /^const d[xyh] = \(p\.kind === ['"]cylinder['"] \? p\.(radiusM|heightM) :/, raison: `${RAISON_MIGRATION}emprise FIGÉE à sa date (cylindres tous verticaux), lue seulement avant son no-op` },
  { fichier: 'scripts/migrations/2026-09-26-1343-cylindre-axe.mjs', motif: /p\?\.kind [!=]== ['"]cylinder['"]/, raison: `${RAISON_MIGRATION}sélectionne les cylindres dont elle RENOMME la cote, ne recalcule aucune géométrie` },
  { fichier: 'scripts/migrations/2026-09-26-1343-cylindre-axe.mjs', motif: /^if \(k === ['"]heightM['"]\) sortie\W+longueur[M] = v;$/, raison: `${RAISON_MIGRATION}ÉCRIT la cote renommée, ne la lit pas` },
  { fichier: 'scripts/migrations/2026-09-26-1343-cylindre-axe.mjs', motif: /^const est(Ancien|Migre) = \(p\) => /, raison: `${RAISON_MIGRATION}marqueur d’idempotence : la PRÉSENCE de la cote renommée, jamais sa valeur` },
];

/** Sites fautifs d'un texte : `[{ ligne, texte }]`, un par ligne où COMMENCE un motif, triés. PURE. */
export function sitesFautifs(texte) {
  const lignes = texte.split('\n');
  const debuts = [0];
  for (let i = 0; i < texte.length; i++) if (texte[i] === '\n') debuts.push(i + 1);
  const ligneDe = (index) => {
    let n = 0;
    while (n + 1 < debuts.length && debuts[n + 1] <= index) n++;
    return n;
  };
  const vues = new Set();
  for (const motif of MOTIFS)
    for (const m of texte.matchAll(motif)) vues.add(ligneDe(m.index));
  return [...vues].sort((a, b) => a - b).map((n) => ({ ligne: n + 1, texte: lignes[n].trim() }));
}

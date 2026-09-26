/**
 * Migration #1467 L1b V-FLIP-ENTITE-b — les 20 datasets `entite` de la vague 11b reçoivent la clé
 * d'ENVELOPPE `type` sur chacune de leurs entrées, en DEUXIÈME position (juste après `id`).
 *
 * MÊME patron que la vague 11a (`2026-08-28-l1b-11a-entite-type.mjs`), même contrat : `document()`
 * pose `type: z.literal(<type>)` en clé REQUISE de l'enveloppe, donc l'adoption d'un def et la
 * migration de sa donnée sont indissociables. Rien d'autre ne bouge : aucune valeur existante n'est
 * touchée, aucune clé n'est retirée ni réordonnée.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`, et c'est le
 * NOM DE BASE du dataset — la clé que `sans-livre.ts` consulte (`SANS_PROVENANCE_EXIGEE`, « Clé =
 * `type` du document, égal au nom de base de son dataset »). L'accord n'est pas gardé par une seconde
 * table mais par le SCHÉMA lui-même : `z.literal(<type>)` rend rouge toute entrée dont le `type`
 * diverge (mesuré par mutation du lot sur `careers.json`).
 *
 * ENTRÉES : les 20 fichiers de `src/data/` listés dans `TYPES` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP SÉMANTIQUE : le no-op se décide sur le CARDINAL du seul geste que ce script
 * POSSÈDE — la pose de `type`. Zéro `type` à poser dans un fichier = rien n'y est écrit et la sortie
 * est 0, quel que soit l'ordre des AUTRES clés de ses entrées : la remontée de `type` en 2ᵉ position
 * est une normalisation d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
 * La POSITION de `type` n'est PAS une condition du no-op ; elle est vérifiée après écriture.
 * FAIL-FAST : cardinal inattendu (porte de lecture SEULE, avant toute écriture), racine non-tableau,
 * entrée sans `id` de chaîne, `id` ailleurs qu'en TÊTE (cette vague ne promeut PAS `id` : sa preuve
 * post-écriture exige la charge utile dans son ordre d'origine), `type` déjà présent mais DIVERGENT
 * → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Fichier de `src/data/` → `type` du document, tel que son def le déclare à `document()`. */
const TYPES = {
  'advancementCosts.json': 'advancementCosts',
  'axes.json': 'axes',
  'books.json': 'books',
  'calendarMonths.json': 'calendarMonths',
  'careers.json': 'careers',
  'characteristics.json': 'characteristics',
  'gods.json': 'gods',
  'groups.json': 'groups',
  'interludeEvents.json': 'interludeEvents',
  'locations.json': 'locations',
  'mutations.json': 'mutations',
  'mutationTables.json': 'mutationTables',
  'primitives.manifest.json': 'primitives.manifest',
  'qualities.json': 'qualities',
  'regles.json': 'regles',
  'stars.json': 'stars',
  'systemes.manifest.json': 'systemes.manifest',
  'tables.json': 'tables',
  'voyage-stakes.json': 'voyage-stakes',
  'weaponGroups.json': 'weaponGroups',
};

/**
 * CARDINAL ATTENDU par fichier, et TOTAL — mesuré sur l'arbre au moment de l'écriture (2026-08-28).
 * Vérifié AVANT toute écriture : une entrée ajoutée ou retirée depuis fait sortir 1 plutôt que
 * migrer un périmètre qui n'est plus celui qu'on a mesuré.
 */
const CARDINAUX = {
  'advancementCosts.json': 15,
  'axes.json': 9,
  'books.json': 29,
  'calendarMonths.json': 12,
  'careers.json': 108,
  'characteristics.json': 19,
  'gods.json': 41,
  'groups.json': 38,
  'interludeEvents.json': 31,
  'locations.json': 55,
  'mutations.json': 116,
  'mutationTables.json': 17,
  // 30 → 62 (#1728) : les entrées de la table CLAUDE.md sont portées au manifeste, de la MÊME forme
  // que les 30 autres — primitives EXISTANTES, aucune donnée neuve.
  'primitives.manifest.json': 62,
  'qualities.json': 59,
  'regles.json': 85, // +1 `critiques-de-bateau` (#1657 B3-2)
  'stars.json': 23,
  'systemes.manifest.json': 16,
  // 20→21 : la table MAISON `mendier-ennuis` (Échec Stupéfiant à Mendier, LDB 09 l.97), #1612.
  'tables.json': 21,
  'voyage-stakes.json': 42, // −1 `river-splinter-dodge` (#1657 B3-2)
  'weaponGroups.json': 38,
};
// Puis 801→802 : +1 table d'effets `mendier-ennuis` (#1612).
// Puis 802→836 (#1728) : le manifeste des primitives passe de 28 à 62 entrées (table CLAUDE.md
// portée au manifeste — primitives EXISTANTES).
const TOTAL_ATTENDU = 836;

const echecs = [];
const rapport = [];

// PORTE DE CARDINAL — lecture SEULE, avant la moindre écriture.
{
  const ecarts = [];
  let total = 0;
  for (const fichier of Object.keys(TYPES)) {
    const brut = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', fichier), 'utf8'));
    if (!Array.isArray(brut)) {
      ecarts.push(`${fichier} : racine non-TABLEAU`);
      continue;
    }
    total += brut.length;
    if (brut.length !== CARDINAUX[fichier]) ecarts.push(`${fichier} : ${brut.length} entrée(s) ≠ ${CARDINAUX[fichier]} attendue(s)`);
  }
  const sommeDeclaree = Object.values(CARDINAUX).reduce((a, b) => a + b, 0);
  if (sommeDeclaree !== TOTAL_ATTENDU) ecarts.push(`table CARDINAUX : somme ${sommeDeclaree} ≠ TOTAL_ATTENDU ${TOTAL_ATTENDU}`);
  if (total !== TOTAL_ATTENDU) ecarts.push(`TOTAL mesuré ${total} ≠ ${TOTAL_ATTENDU}`);
  if (ecarts.length) {
    console.error(`CARDINAL INATTENDU — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

for (const [fichier, type] of Object.entries(TYPES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const avant = JSON.parse(brut);

  if (JSON.stringify(avant, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }

  const locales = [];
  let poses = 0;
  const apres = avant.map((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      locales.push(`${fichier}[${i}] : entrée non-objet`);
      return e;
    }
    if (typeof e.id !== 'string' || !e.id) {
      locales.push(`${fichier}[${i}] : entrée sans \`id\` de chaîne non vide`);
      return e;
    }
    if ('type' in e && e.type !== type) {
      locales.push(`${fichier} ${e.id} : \`type\` = ${JSON.stringify(e.type)} ≠ ${JSON.stringify(type)}`);
      return e;
    }
    // `id` en TÊTE : cette vague ne déclare AUCUNE promotion, et sa preuve post-écriture compare la
    // charge utile SÉRIALISÉE. Un `id` hors tête est donc une anomalie NOMMÉE, portée AVANT la porte
    // de no-op — donc avant toute écriture, jamais avalie par un no-op muet.
    const rangId = Object.keys(e).indexOf('id');
    if (rangId !== 0) {
      locales.push(`${fichier} ${e.id} : \`id\` au rang ${rangId} — aucune promotion de \`id\` n'est déclarée par cette vague`);
      return e;
    }
    // ENVELOPPE : `id` en tête, `type` juste après, puis le reste DANS SON ORDRE EXISTANT.
    if (!('type' in e)) poses++;
    const { id, type: _ancien, ...reste } = e;
    return { id, type, ...reste };
  });

  if (locales.length) {
    echecs.push(...locales);
    continue;
  }

  // NO-OP SÉMANTIQUE : ce script ne possède que la POSE de `type`. Aucune à poser = rien à écrire,
  // quel que soit l'ordre des clés du fichier — la promotion de `id` et `type` en tête est une
  // normalisation d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
  if (poses === 0) {
    rapport.push(`${fichier} : no-op (0 \`type\` à poser sur ${avant.length} entrée(s))`);
    continue;
  }

  const sortie = JSON.stringify(apres, null, 2);

  fs.writeFileSync(cible, sortie, 'utf8');

  // PREUVE post-écriture : même cardinal, et chaque entrée est EXACTEMENT l'ancienne PLUS la clé
  // `type` — deep-equal sur le reste, `type` retiré des deux côtés.
  const relu = JSON.parse(fs.readFileSync(cible, 'utf8'));
  if (relu.length !== avant.length) echecs.push(`POST ${fichier} : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i];
    if (Object.keys(d).slice(0, 2).join(',') !== 'id,type') echecs.push(`POST ${fichier} ${d.id} : tête ≠ id,type`);
    if (d.type !== type) echecs.push(`POST ${fichier} ${d.id} : \`type\` ≠ ${JSON.stringify(type)}`);
    const { type: _t, ...sansType } = d;
    const { type: _t0, ...avantSansType } = avant[i];
    if (JSON.stringify(sansType) !== JSON.stringify(avantSansType)) {
      echecs.push(`POST ${fichier} ${d.id} : la charge utile a été ALTÉRÉE (autre chose que \`type\` a bougé)`);
    }
  }
  rapport.push(`${fichier} : ${relu.length} entrée(s) × \`type: "${type}"\``);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const l of rapport) console.log(l);
console.log(`vague 11b — ${Object.keys(TYPES).length} dataset(s) \`entite\` portent leur \`type\` (${TOTAL_ATTENDU} entrées)`);

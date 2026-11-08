/**
 * Migration #1467 L1b V-FLIP-ENTITE-b — les 19 datasets `entite` de la vague 11b reçoivent la clé
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
 * ENTRÉES : les 19 fichiers de `src/data/` listés dans `TYPES` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP SÉMANTIQUE : le no-op se décide sur le NOMBRE du seul geste que ce script
 * POSSÈDE — la pose de `type`. Zéro `type` à poser dans un fichier = rien n'y est écrit et la sortie
 * est 0, quel que soit l'ordre des AUTRES clés de ses entrées : la remontée de `type` en 2ᵉ position
 * est une normalisation d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
 * La POSITION de `type` n'est PAS une condition du no-op ; elle est vérifiée après écriture.
 * PORTE DE FORME — lecture SEULE, avant la moindre écriture. Ce qui protège d'un rejeu sur une
 * donnée d'une AUTRE époque n'est pas un COMPTE d'entrées (un dataset app-owned croît légitimement,
 * et un compte gelé fait payer un recalage à chaque ajout, #1812) mais la FORME de chaque entrée :
 * elle porte soit la forme SOURCE (aucun `type`), soit la forme CIBLE (`type` du def). Ni l'une ni
 * l'autre → ARBITRAGE REQUIS, rien n'est écrit pour AUCUN fichier, sortie 1.
 * FAIL-FAST : forme inattendue (porte de lecture SEULE, avant toute écriture), racine non-tableau,
 * entrée sans `id` de chaîne, `id` ailleurs qu'en TÊTE (cette vague ne promeut PAS `id` : sa preuve
 * post-écriture exige la charge utile dans son ordre d'origine), `type` déjà présent mais DIVERGENT
 * → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estMonoTable } from './lib/monoTable.mjs';
import { estObjet } from '../../src/lib/objet.mjs';

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
  'weaponGroups.json': 'weaponGroups',
};

const echecs = [];
const rapport = [];

// PORTE DE FORME — lecture SEULE, avant la moindre écriture. Un rejeu sur une donnée d'une AUTRE
// époque se reconnaît à la FORME de ses entrées, jamais à leur NOMBRE (#1812) : chacune porte soit la
// forme SOURCE (aucun `type`), soit la forme CIBLE (le `type` que le def déclare).
{
  const ecarts = [];
  for (const [fichier, type] of Object.entries(TYPES)) {
    const brut = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', fichier), 'utf8'));
    // Document mono-table (`lib/monoTable.mjs`) : ses rangées ne portent pas `type`, ce geste n'y a plus d'objet.
    if (estMonoTable(brut)) continue;
    if (!Array.isArray(brut)) {
      ecarts.push(`${fichier} : racine non-TABLEAU`);
      continue;
    }
    if (!brut.length) {
      ecarts.push(`${fichier} : 0 entrée — périmètre vidé`);
      continue;
    }
    for (const [i, e] of brut.entries()) {
      if (!estObjet(e)) {
        ecarts.push(`${fichier}[${i}] : entrée non-objet`);
        continue;
      }
      if (typeof e.id !== 'string' || !e.id) {
        ecarts.push(`${fichier}[${i}] : entrée sans \`id\` de chaîne non vide`);
        continue;
      }
      if ('type' in e && e.type !== type) {
        ecarts.push(`${fichier} ${e.id} : \`type\` = ${JSON.stringify(e.type)} — ni la forme SOURCE (aucun \`type\`) ni la forme CIBLE (${JSON.stringify(type)})`);
      }
    }
  }
  if (ecarts.length) {
    console.error(`ARBITRAGE REQUIS — forme INATTENDUE, rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

for (const [fichier, type] of Object.entries(TYPES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const avant = JSON.parse(brut);
  if (estMonoTable(avant)) continue;

  if (JSON.stringify(avant, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }

  const locales = [];
  let poses = 0;
  const apres = avant.map((e, i) => {
    if (!estObjet(e)) {
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
console.log(`vague 11b — ${Object.keys(TYPES).length} dataset(s) \`entite\` portent leur \`type\``);

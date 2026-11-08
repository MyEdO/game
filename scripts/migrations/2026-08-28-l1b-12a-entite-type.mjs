/**
 * Migration #1467 L1b V-FLIP-ENTITE-b — les 19 datasets `entite` de la vague 12 reçoivent la clé
 * d'ENVELOPPE `type` sur chacune de leurs entrées, en DEUXIÈME position (juste après `id`).
 *
 * MÊME patron que les vagues 11a/11b (`2026-08-28-l1b-11a-entite-type.mjs`,
 * `2026-08-28-l1b-11b-entite-type.mjs`), même contrat : `document()` pose `type: z.literal(<type>)`
 * en clé REQUISE de l'enveloppe, donc l'adoption d'un def et la migration de sa donnée sont
 * indissociables. Rien d'autre ne bouge — à une exception NOMMÉE ci-dessous.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`, et c'est le
 * NOM DE BASE du dataset — la clé que `sans-livre.ts` consulte (`SANS_PROVENANCE_EXIGEE`, « Clé =
 * `type` du document, égal au nom de base de son dataset »). L'accord n'est pas gardé par une seconde
 * table mais par le SCHÉMA lui-même : `z.literal(<type>)` rend rouge toute entrée dont le `type`
 * diverge.
 *
 * PURGE NOMMÉE — `talents.json › talent-aleatoire` porte `desc: ""`. L'enveloppe déclare
 * `desc: z.string().min(1)` : la chaîne vide est le TROISIÈME état que la migration
 * `2026-08-27-l1b-3h-desc-null.mjs` a purgé partout où le schéma admettait l'absence, en renvoyant
 * NOMMÉMENT ce porteur-ci « au lot qui posera `min(1)` sur ce def » — c'est ce lot. La clé est donc
 * RETIRÉE (jamais remplie : aucune prose ne s'invente, règle 1 ; `talent-aleatoire` est une entrée
 * MÉTA du vocabulaire de tirage, `scripts/guards/lib/entityConsumers.mjs:144`). Le second porteur
 * cité par 3h, `species.json`, n'appartient PAS à cette vague et reste intact.
 *
 * ENTRÉES : les 19 fichiers de `src/data/` listés dans `TYPES` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP SÉMANTIQUE : le no-op se décide sur le NOMBRE des gestes que ce script
 * POSSÈDE — pose de `type`, purge de la `desc` vide nommée, promotion déclarée de `id`. Zéro geste à
 * poser dans un fichier = rien n'y est écrit et la sortie est 0, quel que soit l'ordre des AUTRES
 * clés de ses entrées : la remontée de `type` en 2ᵉ position est une normalisation d'enveloppe, et
 * une égalité à l'octet en ferait une réécriture à elle seule. La POSITION de `type` n'est PAS
 * une condition du no-op ; elle est vérifiée après chaque écriture.
 * PORTE DE FORME — lecture SEULE, avant la moindre écriture. Ce qui protège d'un rejeu sur une
 * donnée d'une AUTRE époque n'est pas un COMPTE d'entrées (un dataset app-owned croît légitimement,
 * et un compte gelé fait payer un recalage à chaque ajout, #1812) mais la FORME de chaque entrée :
 * elle porte soit la forme SOURCE (aucun `type`), soit la forme CIBLE (`type` du def). Ni l'une ni
 * l'autre → ARBITRAGE REQUIS, rien n'est écrit pour AUCUN fichier, sortie 1.
 * FAIL-FAST : forme inattendue (porte de lecture SEULE, avant toute écriture), racine non-tableau,
 * entrée sans `id` de chaîne, `id` hors tête sans promotion déclarée à `ID_PROMU`, `type` déjà présent
 * mais DIVERGENT, `desc: ""` sur un porteur NON prévu → rien n'est écrit, sortie 1.
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
  'careerLevels.json': 'careerLevels',
  'domains.json': 'domains',
  'etats.json': 'etats',
  'maladies.json': 'maladies',
  'maneuvers.json': 'maneuvers',
  'merchants.json': 'merchants',
  'naval-ports.json': 'naval-ports',
  'naval-traits.json': 'naval-traits',
  'pregens.json': 'pregens',
  'props.json': 'props',
  'reglesOptionnelles.json': 'reglesOptionnelles',
  'skills.json': 'skills',
  'steam-breakdown.json': 'steam-breakdown',
  'structures.json': 'structures',
  'symptoms.json': 'symptoms',
  'talents.json': 'talents',
  'traits.json': 'traits',
  'traumas.json': 'traumas',
  'vehicles.json': 'vehicles',
};

/**
 * PROMOTION DÉCLARÉE de `id` — `<fichier>` → rang qu'y occupait `id` AVANT la vague. L'enveloppe veut
 * `id` en tête ; un seul dataset ne l'y avait pas : `steam-breakdown.json` ouvre ses entrées par la
 * fourchette de tirage (`min`/`max`), `id` venant au rang 2. La suite des autres clés, elle, ne bouge
 * pas d'un cran (vérifié entrée par entrée après écriture). Tout autre fichier dont `id` ne serait pas
 * en tête fait sortir 1.
 */
const ID_PROMU = { 'steam-breakdown.json': 2 };

/** Le SEUL porteur de `desc: ""` que cette vague purge — `<fichier>` → `<id>` (cf. en-tête). */
const DESC_VIDE_PURGEE = { 'talents.json': 'talent-aleatoire' };

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

let descPurgees = 0;

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
    let purge = false;
    if (e.desc === '') {
      if (DESC_VIDE_PURGEE[fichier] !== e.id) {
        locales.push(`${fichier} ${e.id} : \`desc: ""\` sur un porteur NON prévu — arbitrage requis`);
        return e;
      }
      purge = true;
    }
    // PROMOTION de `id` : geste POSSÉDÉ, et seulement là où `ID_PROMU` le déclare — ailleurs, un `id`
    // hors tête est une anomalie NOMMÉE, portée AVANT la porte de no-op (donc avant toute écriture).
    const rangId = Object.keys(e).indexOf('id');
    if (rangId !== 0 && ID_PROMU[fichier] !== rangId) {
      locales.push(`${fichier} ${e.id} : \`id\` au rang ${rangId}, promotion NON déclarée`);
      return e;
    }
    // ENVELOPPE : `id` en tête, `type` juste après, puis le reste DANS SON ORDRE D'ORIGINE (les clés
    // sont reprises une à une, jamais par un spread qui remonterait `desc` d'un rang).
    if (purge) descPurgees++;
    if (purge || !('type' in e) || rangId !== 0) poses++;
    const sortie = { id: e.id, type };
    for (const [k, v] of Object.entries(e)) {
      if (k === 'id' || k === 'type') continue;
      if (k === 'desc' && purge) continue;
      sortie[k] = v;
    }
    return sortie;
  });

  if (locales.length) {
    echecs.push(...locales);
    continue;
  }

  // NO-OP SÉMANTIQUE : ce script ne possède que la POSE de `type` et la purge de la `desc` vide
  // nommée. Aucun des deux à faire = rien à écrire, quel que soit l'ordre des clés du fichier — la
  // promotion de `id` et `type` en tête est une normalisation d'enveloppe, et une égalité à l'octet
  // en ferait une réécriture à elle seule.
  if (poses === 0) {
    rapport.push(`${fichier} : no-op (0 \`type\` à poser sur ${avant.length} entrée(s))`);
    continue;
  }

  const sortie = JSON.stringify(apres, null, 2);

  fs.writeFileSync(cible, sortie, 'utf8');

  // PREUVE post-écriture : même cardinal, et chaque entrée est EXACTEMENT l'ancienne PLUS la clé
  // `type` (MOINS la `desc` vide nommément purgée) — deep-equal sur le reste.
  const relu = JSON.parse(fs.readFileSync(cible, 'utf8'));
  if (relu.length !== avant.length) echecs.push(`POST ${fichier} : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i];
    if (Object.keys(d).slice(0, 2).join(',') !== 'id,type') echecs.push(`POST ${fichier} ${d.id} : tête ≠ id,type`);
    if (d.type !== type) echecs.push(`POST ${fichier} ${d.id} : \`type\` ≠ ${JSON.stringify(type)}`);
    const { type: _t, ...sansType } = d;
    const { type: _t0, ...avantSansType } = avant[i];
    if (avantSansType.desc === '') delete avantSansType.desc;
    // Comparaison par CLÉ (jamais par l'ordre sérialisé) : la promotion de `id` en tête réordonne
    // légitimement les entrées de `ID_PROMU`, et l'ordre y est vérifié séparément ci-dessous.
    const paires = (o) => Object.keys(o).sort().map((k) => `${k}=${JSON.stringify(o[k])}`).join('\u0000');
    if (paires(sansType) !== paires(avantSansType)) {
      echecs.push(`POST ${fichier} ${d.id} : la charge utile a été ALTÉRÉE (autre chose que \`type\` a bougé)`);
    }
    // ORDRE : hors `id`/`type`, les clés survivantes gardent leur suite d'ORIGINE.
    const suiteAvant = Object.keys(avantSansType).filter((k) => k !== 'id').join(',');
    const suiteApres = Object.keys(sansType).filter((k) => k !== 'id').join(',');
    if (suiteAvant !== suiteApres) {
      echecs.push(`POST ${fichier} ${d.id} : l'ORDRE des clés a bougé au-delà de la promotion de \`id\` (${suiteAvant} → ${suiteApres})`);
    }
    const rangAvant = Object.keys(avant[i]).indexOf('id');
    if (rangAvant !== 0 && ID_PROMU[fichier] !== rangAvant) {
      echecs.push(`POST ${fichier} ${d.id} : \`id\` était au rang ${rangAvant}, promotion NON déclarée`);
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
console.log(`vague 12 — ${Object.keys(TYPES).length} dataset(s) \`entite\` portent leur \`type\``);
console.log(`\`desc: ""\` purgée(s) : ${descPurgees}`);

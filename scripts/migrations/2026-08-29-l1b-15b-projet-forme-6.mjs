/**
 * Migration #1467 L1b V-P7 — le document de PROJET passe en `schema: 6`. DEUX gestes, un seul passage :
 *
 *  - le LIBELLÉ prend sa graphie canonique : `nom` → `label`, À SA POSITION, sur chaque `scenes[]` et
 *    sur `worldMap`. Les deux ne portaient qu'un libellé d'AFFICHAGE — l'identité est `id`, présente
 *    sur les deux depuis toujours (mesuré : 27/27 scènes et 3/3 cartes des 4 projets committés) ;
 *  - les statblocs EMBARQUÉS (`scenes[].entities[].statblock`) s'ANNONCENT : `type: 'statblock'` en
 *    1ʳᵉ clé. Le schéma l'EXIGE désormais (`defs-scenes/communs.ts`, `z.literal('statblock')`), donc
 *    un projet qui ne l'a pas ne se parse plus.
 *
 * Pendant committé de `PROJECT_MIGRATIONS[5]` (`src/data/migrationsDeProjet.ts`), qui porte le MÊME geste au
 * CHARGEMENT pour les projets de bibliothèque utilisateur (`.json` portable exporté avant ce lot).
 *
 * ENTRÉES : les 4 `src/scenes/<campagne>/<campagne>-projet.json`. Les trois projets GÉNÉRÉS
 * (`arene`, `barge-du-sel`, `loup-et-saumure`) arrivent déjà en `schema: 6` — leurs générateurs
 * portent la forme d'arrivée, la migration les reconnaît no-op ; `diligence` est AUTHORÉ et c'est ici
 * qu'il migre.
 *
 * IDEMPOTENT : un document en `schema` ≥ 6 est reconnu migré ; rejouée, la migration n'écrit rien. La
 * borne est OUVERTE VERS LE HAUT depuis #1552, qui a porté le même document à 7 : sans cet
 * élargissement, le rejeu sur l'arbre courant sortirait ROUGE (même retouche que `…-3i-…` en son
 * temps). Ce qui rattrape le trou ainsi ouvert est la DERNIÈRE migration de la chaîne, seule à
 * savoir ce qui existe après elle — aujourd'hui `2026-08-31-1552-projet-sannonce.mjs`, dont la borne
 * haute est CLOSE (7, jamais « ≥ 7 »).
 * FAIL-FAST : `schema` absent, non numérique, ou < 5 ; une scène portant À LA FOIS `nom` et
 * `label` ; une scène en `schema: 5` SANS `nom` (forme hybride) ; un statbloc portant déjà un `type`
 * qui n'est pas `'statblock'` → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : sérialiseur des scènes `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RACINE = path.join(ROOT, 'src/scenes');
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Renomme UNE clé à sa POSITION, sans la créer si elle est absente. */
const renomme = (o, de, vers) =>
  (de in o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k === de ? vers : k, v])) : o);

/** `type: 'statblock'` en 1ʳᵉ clé du profil embarqué ; une entité sans statbloc traverse intacte. */
const annonce = (e) => {
  if (!e || typeof e !== 'object' || !e.statblock || typeof e.statblock !== 'object') return e;
  if ('type' in e.statblock) return e;
  return { ...e, statblock: { type: 'statblock', ...e.statblock } };
};

const migre = (doc) => {
  const scenes = Array.isArray(doc.scenes)
    ? doc.scenes.map((s) => {
      const sc = renomme(s, 'nom', 'label');
      return Array.isArray(sc.entities) ? { ...sc, entities: sc.entities.map(annonce) } : sc;
    })
    : doc.scenes;
  const worldMap = doc.worldMap && typeof doc.worldMap === 'object' ? renomme(doc.worldMap, 'nom', 'label') : doc.worldMap;
  const sortie = {};
  for (const k of Object.keys(doc)) sortie[k] = k === 'schema' ? 6 : k === 'scenes' ? scenes : k === 'worldMap' ? worldMap : doc[k];
  return sortie;
};

const echecs = [];
const ecritures = [];

for (const d of fs.readdirSync(RACINE, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE, d.name, `${d.name}-projet.json`);
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (typeof doc.schema === 'number' && doc.schema >= 6) { ecritures.push({ rel, abs, brut, out: brut, deja: true }); continue; }
  if (doc.schema !== 5) { echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (5 ou ≥ 6 attendus)`); continue; }

  for (const s of doc.scenes ?? []) {
    if ('nom' in s && 'label' in s) echecs.push(`${rel} : scène « ${s.id} » porte À LA FOIS \`nom\` et \`label\` — arbitrage requis`);
    if (!('nom' in s) && !('label' in s)) echecs.push(`${rel} : scène « ${s.id} » sans libellé (ni \`nom\` ni \`label\`)`);
    for (const e of s.entities ?? []) {
      const t = e?.statblock?.type;
      if (t !== undefined && t !== 'statblock') echecs.push(`${rel} : entité « ${e.id} » — statbloc à \`type\` inattendu ${JSON.stringify(t)}`);
    }
  }
  if (doc.worldMap && typeof doc.worldMap === 'object') {
    if ('nom' in doc.worldMap && 'label' in doc.worldMap) echecs.push(`${rel} : worldMap porte À LA FOIS \`nom\` et \`label\``);
    if (!('nom' in doc.worldMap) && !('label' in doc.worldMap)) echecs.push(`${rel} : worldMap sans libellé`);
  }
  ecritures.push({ rel, abs, brut, out: canonique(migre(doc)), deja: false });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let migres = 0;
for (const e of ecritures) {
  if (e.out !== e.brut) { fs.writeFileSync(e.abs, e.out, 'utf8'); migres++; }
  const apres = JSON.parse(e.out);
  if (e.deja) {
    const restes = JSON.stringify(apres).match(/"nom":/g)?.length ?? 0;
    if (!(apres.schema >= 6) || restes) {
      console.error(`VÉRIFICATION ROUGE — ${e.rel} : reconnu « déjà migré » mais schema=${apres.schema}, ${restes} \`nom\` résiduel(s)`);
      process.exit(1);
    }
    console.log(`${e.rel} — schema ${apres.schema} (déjà migré, no-op)`);
    continue;
  }
  // PREUVE post-écriture : le document d'après, RENOMMÉ EN SENS INVERSE et dépouillé des `type`
  // POSÉS, doit rendre l'octet d'avant — ordre des clés compris.
  const avant = JSON.parse(e.brut);
  const inverse = {};
  const scenesInv = (apres.scenes ?? []).map((s) => {
    const sc = renomme(s, 'label', 'nom');
    if (!Array.isArray(sc.entities)) return sc;
    return {
      ...sc,
      entities: sc.entities.map((x) => {
        if (!x?.statblock || !('type' in x.statblock)) return x;
        const { type: _t, ...reste } = x.statblock;
        return { ...x, statblock: reste };
      }),
    };
  });
  for (const k of Object.keys(avant)) {
    inverse[k] = k === 'schema' ? avant.schema
      : k === 'scenes' ? scenesInv
      : k === 'worldMap' ? (apres.worldMap && typeof apres.worldMap === 'object' ? renomme(apres.worldMap, 'label', 'nom') : apres.worldMap)
      : apres[k];
  }
  const restes = JSON.stringify(apres).match(/"nom":/g)?.length ?? 0;
  const fidele = JSON.stringify(inverse) === JSON.stringify(avant);
  if (apres.schema !== 6 || restes || !fidele) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${e.rel} : schema=${apres.schema}, ${restes} \`nom\` résiduel(s), charge utile ${fidele ? 'intacte' : 'ALTÉRÉE'}`);
    process.exit(1);
  }
  const nSb = (apres.scenes ?? []).flatMap((s) => (s.entities ?? []).filter((x) => x.statblock)).length;
  console.log(`${e.rel} — schema 5 → 6 : ${(apres.scenes ?? []).length} scène(s) + ${apres.worldMap ? 1 : 0} carte à \`label\`, ${nSb} statbloc(s) annoncé(s)`);
}
console.log(`TOTAL : ${migres} document(s) migré(s) sur ${ecritures.length}.`);

/**
 * Migration #1467 L1b V-FLIP-CONFIG — les 24 documents que le lot passe en famille `config` (23 déjà
 * `config`, plus `localisation` re-étiqueté `record` → `config`) reçoivent leur ENVELOPPE
 * d'identité : `id`, `type`, `label`.
 *
 * MOTIF : la fabrique `document()` (`src/data/schemas/grammaire/document.ts`) pose l'enveloppe sur
 * TOUT document ; un document de configuration est un document comme un autre — il porte son
 * identité, son type et son libellé, comme une entité. Les VALEURS de réglage ne bougent pas : la
 * migration n'ajoute que trois clés scalaires en TÊTE.
 *
 * CONVENTION DE POSITION (unique, appliquée aux 24 documents du lot) : `id`, `type`, `label` en tête
 * dans CET ordre, puis TOUTES les clés existantes dans leur ordre existant — une `source` de racine
 * garde donc exactement sa place. `water-exposure.json` porte déjà `id` et `label` : seul `type` lui
 * est INSÉRÉ, et l'ordre de tête s'harmonise sur les 23 autres.
 *
 * ENTRÉES : les 24 `src/data/*.json` nommés dans `IDENTITES` (les seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un document portant déjà les trois clés AUX BONNES VALEURS
 * est reconnu migré ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : clé présente avec une valeur DIVERGENTE (arbitrage requis), `id`/`label` non-chaîne ou
 * vide → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** `fichier → { id, type, label }` — le `type` est le nom de base du dataset, l'`id` est AUTHORÉ. */
const IDENTITES = {
  'ambiance.json': { id: 'ambiance', type: 'ambiance', label: 'Ambiance lumineuse' },
  'arcane-phenomena.json': { id: 'arcane-phenomena', type: 'arcane-phenomena', label: 'Magie environnementale' },
  'crew-morale.json': { id: 'crew-morale', type: 'crew-morale', label: "Moral d'équipage" },
  'crew-test-types.json': { id: 'crew-test-types', type: 'crew-test-types', label: "Tests d'équipage (types)" },
  'details.json': { id: 'details', type: 'details', label: 'Détails de création' },
  'disponibilite.json': { id: 'disponibilite', type: 'disponibilite', label: 'Disponibilité & Troc' },
  'donnees.manifest.json': { id: 'donnees-manifest', type: 'donnees.manifest', label: "Manifeste éditorial de l'atlas des données" },
  'grapple.json': { id: 'grapple', type: 'grapple', label: 'Empoignade — mécanique' },
  'land-cargo.json': { id: 'land-cargo', type: 'land-cargo', label: 'Cargaison terrestre' },
  'mass-battle.json': { id: 'mass-battle', type: 'mass-battle', label: 'Bataille de masse' },
  'progression-schemas.derived.json': {
    id: 'progression-schemas-derived',
    type: 'progression-schemas.derived',
    label: 'Schémas de progression (relevé dérivé)',
  },
  'river-navigation.json': { id: 'river-navigation', type: 'river-navigation', label: 'Navigation fluviale' },
  'river-perils.json': { id: 'river-perils', type: 'river-perils', label: 'Périls fluviaux' },
  'sea-cargo.json': { id: 'sea-cargo', type: 'sea-cargo', label: 'Cargaison maritime' },
  'sea-events.json': { id: 'sea-events', type: 'sea-events', label: 'Humeur de Manann et événements de mer' },
  'sea-navigation.json': { id: 'sea-navigation', type: 'sea-navigation', label: 'Navigation maritime' },
  'sea-perils.json': { id: 'sea-perils', type: 'sea-perils', label: 'Périls en mer' },
  'sea-weather.json': { id: 'sea-weather', type: 'sea-weather', label: 'Météo de la Mer des Griffes' },
  'ship-construction.json': { id: 'ship-construction', type: 'ship-construction', label: 'Construction navale' },
  'sizes.json': { id: 'sizes', type: 'sizes', label: 'Barèmes par Taille' },
  'speciesRace.json': { id: 'species-race', type: 'speciesRace', label: 'Correspondance espèce → race de rig' },
  // id ET label EXISTANTS, gardés tels quels : le label est le titre du chapitre Source (MSRC 16).
  'water-exposure.json': { id: 'maladies-hydriques', type: 'water-exposure', label: "Maladies transmises par l'eau" },
  'weather.json': { id: 'weather', type: 'weather', label: 'Météo de voyage' },
  // Les 3 RE-ÉTIQUETÉS `record` → `config` : leurs clés fixes deviennent des CHAMPS de document.
  'localisation.json': { id: 'localisation', type: 'localisation', label: 'Tables de Localisation (d100)' },
};

const echecs = [];
const rapport = [];

for (const [fichier, identite] of Object.entries(IDENTITES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const data = JSON.parse(brut);

  if (JSON.stringify(data, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }
  if (Array.isArray(data) || data === null || typeof data !== 'object') {
    echecs.push(`${fichier} : racine de forme inattendue (objet unique attendu pour la famille config)`);
    continue;
  }

  const divergents = ['id', 'type', 'label'].filter((k) => data[k] !== undefined && data[k] !== identite[k]);
  if (divergents.length) {
    echecs.push(`${fichier} : ${divergents.map((k) => `\`${k}\` = ${JSON.stringify(data[k])} ≠ ${JSON.stringify(identite[k])}`).join(', ')} — arbitrage requis`);
    continue;
  }

  const deja = ['id', 'type', 'label'].filter((k) => data[k] !== undefined);
  // ENVELOPPE en tête, puis les clés existantes DANS LEUR ORDRE (les 3 clés d'identité déjà
  // présentes sortent de la queue : leur seule position autorisée est celle de tête).
  const reste = Object.fromEntries(Object.entries(data).filter(([k]) => !['id', 'type', 'label'].includes(k)));
  const sortie = { ...identite, ...reste };
  const out = JSON.stringify(sortie, null, 2);
  if (out !== brut) fs.writeFileSync(cible, out, 'utf8');
  rapport.push(`  ${out === brut ? 'no-op' : 'migré'} ${fichier} — id=${identite.id} type=${identite.type} (déjà présentes : ${deja.length ? deja.join(',') : 'aucune'})`);

  // PREUVE post-écriture : les 3 clés sont en tête, dans l'ordre, et AUCUNE autre clé n'a bougé.
  const apres = JSON.parse(out);
  const clesApres = Object.keys(apres);
  const clesAvant = Object.keys(data).filter((k) => !['id', 'type', 'label'].includes(k));
  if (clesApres.slice(0, 3).join(',') !== 'id,type,label') echecs.push(`${fichier} : POST — tête ${clesApres.slice(0, 3).join(',')} ≠ id,type,label`);
  if (clesApres.slice(3).join(',') !== clesAvant.join(',')) echecs.push(`${fichier} : POST — la queue de clés a bougé (${clesApres.slice(3).join(',')} ≠ ${clesAvant.join(',')})`);
  for (const k of clesAvant) {
    if (JSON.stringify(apres[k]) !== JSON.stringify(data[k])) echecs.push(`${fichier} : POST — la valeur de \`${k}\` a été ALTÉRÉE`);
  }
  if (apres.id !== identite.id || apres.type !== identite.type || apres.label !== identite.label) {
    echecs.push(`${fichier} : POST — identité non conforme`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`config → enveloppe d'identité : ${Object.keys(IDENTITES).length} document(s)`);
for (const l of rapport) console.log(l);
const ids = Object.values(IDENTITES).map((i) => i.id);
if (new Set(ids).size !== ids.length) {
  console.error('ids en COLLISION entre les documents migrés');
  process.exit(1);
}
console.log(`ids distincts : ${new Set(ids).size}/${ids.length}`);

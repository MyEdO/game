/**
 * Migration #1882 (T2d) — une réf. VIVANTE d'effet n'est jamais VIDE, volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 14` : où que l'effet vive dans le DOCUMENT (Scène, péril de
 * route de `worldMap`, …), tout `startPursuit` dont un adversaire porte `ref.creatureId: ''`, tout
 * `givePossession` dont la `ref` porte `creatureId: ''` ou `vehicleId: ''`, et tout `setVessel` à
 * `vehicleId: ''` reçoit la réf. que l'outil sème aujourd'hui : la PREMIÈRE créature, le PREMIER véhicule,
 * le PREMIER navire (véhicule à facette `ship`) du catalogue — `creatureSemee()` / `vehiculeSeme()` /
 * `navireSeme()` (`src/data/index.ts`, `premierOffert`).
 *
 * POURQUOI : `livingRefSchema.creatureId`, `givePossession.ref.vehicleId` et `setVessel.vehicleId` exigent un id
 * RÉSOLU (`idDe`, `src/data/schemas/defs-scenes/effets.ts`). L'effet neuf d'avant (`make`, éditeur)
 * semait `''` : sans ce passage, un projet porteur serait REFUSÉ au parse. L'auteur n'avait rien choisi,
 * il reçoit le défaut de l'outil.
 *
 * Pendant applicatif : `PROJECT_MIGRATIONS[13]` (`src/state/worldMap.ts`, `semeLesRefsVides`) ; parité
 * mesurée par `src/state/projet-migration-13-vers-14.test.ts`.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json` ; `src/data/creatures.json` et
 * `src/data/vehicles.json` (le PREMIER offert de chacun).
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture : non
 * canonique = sortie 1, jamais un reflow silencieux. La réf. semée REMPLACE la valeur vide à sa place.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE CLOSE (`schema` ∈ {13, 14}) : DERNIÈRE de la chaîne dans l'ordre lexical, elle NOMME un
 * `schema` futur.
 * FAIL-FAST : `schema` absent, non numérique ou ∉ {13, 14}, `scenes` non-tableau, catalogue absent ou
 * vide, périmètre vide → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-24-1882-refs-vivantes-semees';
const RACINE = path.join(ROOT, 'src/scenes');

const SCHEMA_AVANT = 13;
const SCHEMA_APRES = 14;

const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const echecs = [];

/** Le PREMIER id offert d'un catalogue déclaré (qui passe `filtre`) — absent ou vide, il se NOMME. */
function premier(rel, filtre = () => true, quoi = '') {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { echecs.push(`${rel} absent — entrée déclarée de la réf. semée`); return undefined; }
  const id = JSON.parse(fs.readFileSync(abs, 'utf8')).filter(filtre)[0]?.id;
  if (typeof id !== 'string') echecs.push(`${rel} vide${quoi} — aucune réf. à semer`);
  return id;
}
const CREATURE = premier('src/data/creatures.json');
const VEHICULE = premier('src/data/vehicles.json');
const NAVIRE = premier('src/data/vehicles.json', (v) => !!v.ship, ' de navire (facette `ship`)');

/** Sème les réf. vides d'un effet, où qu'il soit niché ; compte chaque semis. */
function seme(v, compte) {
  if (Array.isArray(v)) return v.map((x) => seme(x, compte));
  if (!v || typeof v !== 'object') return v;
  const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, seme(x, compte)]));
  const ref = (r) => {
    if (!r || typeof r !== 'object') return r;
    if (r.creatureId === '') { compte.n++; return { ...r, creatureId: CREATURE }; }
    if (r.vehicleId === '') { compte.n++; return { ...r, vehicleId: VEHICULE }; }
    return r;
  };
  if (o.type === 'setVessel' && o.vehicleId === '') { compte.n++; return { ...o, vehicleId: NAVIRE }; }
  if (o.type === 'givePossession') return { ...o, ref: ref(o.ref) };
  if (o.type === 'startPursuit' && Array.isArray(o.foes)) return { ...o, foes: o.foes.map((f) => (f && typeof f === 'object' ? { ...f, ref: ref(f.ref) } : f)) };
  return o;
}

const cibles = fs.existsSync(RACINE)
  ? fs.readdirSync(RACINE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
    .filter((p) => fs.existsSync(p))
  : [];

const rapports = [];
let scenesVues = 0;
let semesVus = 0;

for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (doc.schema !== SCHEMA_AVANT && doc.schema !== SCHEMA_APRES) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }
  scenesVues += doc.scenes.length;
  const compte = { n: 0 };
  const seme_ = seme(doc, compte);
  semesVus += compte.n;
  rapports.push({ rel, abs, brut, doc, seme: seme_, semes: compte.n });
}

if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');
else if (!scenesVues) echecs.push('aucune Scène embarquée — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const sortie = { ...r.seme, schema: SCHEMA_APRES };
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');
  // PREUVE post-écriture : plus AUCUNE réf. vide, et le document s'annonce au format d'après.
  const reste = { n: 0 };
  seme(JSON.parse(out), reste);
  if (reste.n || JSON.parse(out).schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : ${reste.n} réf. vide(s) restante(s)`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${SCHEMA_APRES}, réf. vides semées : ${r.semes} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${scenesVues} Scène(s), ${semesVus} réf. semée(s) (créature : ${CREATURE}, véhicule : ${VEHICULE}, navire : ${NAVIRE})`);

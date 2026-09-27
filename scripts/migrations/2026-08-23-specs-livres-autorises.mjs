/**
 * Migration #1342 (L2-a) — `skills[].spec` hors catalogue des entrées SOURCÉES d'un livre EXTRAIT
 * dans `Source/` (`books.json` porte un `dir`, et ce dossier porte des chapitres sur disque) :
 * normalisation vers le catalogue `skills.json#specs[]`.
 *
 * Quatre gestes, tous adossés à la ligne « **Compétences :** » du statbloc lue au Source :
 *  - `ADDS` : la spéc est IMPRIMÉE au RAW et absente du catalogue → entrée `{id,label,source}`
 *    ajoutée à la `specs[]` de sa Compétence. `source.note` porte la citation à la ligne, que
 *    `src/data/folio-line-align.test.ts` confronte au marqueur `data-folio` (#1318 E8) ;
 *    `alsoIn` porte le 2ᵉ emplacement quand deux livres impriment la MÊME spéc (`SecondaryRef`).
 *  - `FUSIONS` : deux entrées pour UNE spéc — l'anglicisme meurt, ses porteurs sont remappés.
 *  - balayage LIBELLÉ vers ID : toute `spec` dont le normalisé est un `label` du catalogue devient
 *    son `id` (règle de la garde exhaustive de `refs-migrated.test.ts`, domaines OUVERTS compris).
 *    S'applique PARTOUT (le libellé est le même mot, aucune assertion nouvelle).
 *  - `REMAP` : les arbitrages nominatifs (synonyme morphologique, typo d'extraction, retrait d'une
 *    spéc que le Source n'imprime pas), appliqués aux SEULES entrées d'un livre extrait.
 *
 * Un `REMAP` vers `null` RETIRE la `ref` entière du tableau `skills` (`splice`) : effacer la seule
 * `spec` laisserait une Compétence de plus que la liste imprimée.
 *
 * REJOUABLE : un second passage ne réécrit rien. FAIL-FAST : arrêt en 1 si une `specs[]` cible
 * manque, si un id ajouté entre en collision, si une fusion ou un retrait ne trouve pas sa cible,
 * ou s'il reste une spéc non résolue sous un livre extrait — l'arbre n'est écrit qu'après mesure.
 *
 * Entrées : `src/data/books.json` + les dossiers d'extraction `Source/<dir>/NN - ….md` qu'il déclare
 * (périmètre « livre EXTRAIT », `extractedBooks`), `src/data/skills.json` (catalogue, écrit) et les
 * trois porteurs `src/data/{creatures,careerLevels,species}.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSentinel, norm, skillArraysOf, walkSkillRefs, extractedBooks } from '../data/lib/skillSpecWalk.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis ce script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

/** Entrées de catalogue à créer, par id de Compétence. `note` = citation à la ligne (chapitre du
 *  fichier d'extraction), `page` = folio imprimé qui gouverne cette ligne. */
const ADDS = {
  savoir: [
    { id: 'local', label: 'Local', source: { book: 'middenheim', page: 72, note: 'MCLB 02 l.1322' } },
    { id: 'tzeentch', label: 'Tzeentch', source: { book: 'middenheim', page: 106, note: 'MCLB 02 l.2426' } },
    { id: 'medecine', label: 'Médecine', source: { book: 'vents-de-la-magie', page: 36, note: 'VDM 03 l.74' } },
    { id: 'nehekhara', label: 'Néhékhara', source: { book: 'vents-de-la-magie', page: 56, note: 'VDM 04 l.82' } },
    { id: 'peaux-de-loup', label: 'Peaux-de-loup', source: { book: 'zoo-imperial', page: 70, note: 'ZI 07 l.119' } },
    { id: 'montagnes-du-bord-du-monde', label: 'Montagnes du Bord du Monde', source: { book: 'zoo-imperial', page: 35, note: 'ZI 04 l.42' } },
    { id: 'navigation', label: 'Navigation', source: { book: 'mer-des-griffes', page: 151, note: 'MDG 16 l.358' } },
    { id: 'elfes', label: 'Elfes', source: { book: 'mer-des-griffes', page: 149, note: 'MDG 16 l.301' } },
    { id: 'religion', label: 'Religion', source: { book: 'mer-des-griffes', page: 155, note: 'MDG 16 l.460' } },
    { id: 'norsca', label: 'Norsca', source: { book: 'mer-des-griffes', page: 56, note: 'MDG 07 l.230' } },
    { id: 'ogres', label: 'Ogres', source: { book: 'archives-de-l-empire-2', page: 20, note: 'ADE II 02 l.247' } },
    { id: 'rhinox', label: 'Rhinox', source: { book: 'archives-de-l-empire-2', page: 36, note: 'ADE II 02 l.925' } },
    { id: 'la-gueule', label: 'La Gueule', source: { book: 'archives-de-l-empire-2', page: 37, note: 'ADE II 02 l.972' } },
  ],
  metier: [
    { id: 'boucher', label: 'Boucher', source: { book: 'archives-de-l-empire-2', page: 37, note: 'ADE II 02 l.966' } },
    { id: 'frappeur-de-monnaie', label: 'Frappeur de monnaie', source: { book: 'middenheim', page: 89, note: 'MCLB 02 l.1844' } },
    { id: 'fabricant-de-fleches', label: 'Fabricant de flèches', source: { book: 'aux-armes', page: 10, note: 'AA 02 l.169' } },
  ],
  'signes-secrets': [
    // LDB 08 l.250 « Signes secrets (guilde) » — la GUILDE elle-même, symétrique de `langue/guilde`
    // (LDB 09 l.302). Distincte de la sentinelle `guilde-au-choix` (« Guilde (Au choix) », #1456).
    { id: 'guilde', label: 'Guilde', source: { book: 'livre-de-base', page: 54, note: 'LDB 08 l.250' } },
    {
      id: 'rodeur',
      label: 'Rôdeur',
      source: { book: 'zoo-imperial', page: 35, note: 'ZI 04 l.42' },
      alsoIn: [{ book: 'archives-de-l-empire-1', page: 91, note: 'ADE I 07 l.197', quote: 'Signes secrets (Ranger)' }],
    },
    { id: 'la-gueule', label: 'La Gueule', source: { book: 'archives-de-l-empire-2', page: 37, note: 'ADE II 02 l.972' } },
    { id: 'ulric', label: 'Ulric', source: { book: 'aux-armes', page: 32, note: 'AA 03 l.266' } },
    { id: 'soleil-flamboyant', label: 'Soleil flamboyant', source: { book: 'aux-armes', page: 34, note: 'AA 03 l.344' } },
    { id: 'chevaliers-pantheres', label: 'Chevaliers Panthères', source: { book: 'aux-armes', page: 36, note: 'AA 03 l.426' } },
  ],
  dressage: [
    { id: 'rhinox', label: 'Rhinox', source: { book: 'archives-de-l-empire-2', page: 36, note: 'ADE II 02 l.925' } },
    { id: 'perroquet', label: 'Perroquet', source: { book: 'mer-des-griffes', page: 152, note: 'MDG 16 l.401' } },
  ],
  divertissement: [
    { id: 'beuglement', label: 'Beuglement', source: { book: 'archives-de-l-empire-2', page: 35, note: 'ADE II 02 l.884' } },
  ],
  representation: [
    { id: 'parade', label: 'Parade', source: { book: 'aux-armes', page: 18, note: 'AA 02 l.469' } },
  ],
};

/** Deux entrées, UNE spéc : `mort` disparaît de `specs[]`, ses porteurs passent à `vers`.
 *  ADE I 07 l.156/197 imprime « Signes secrets (Ranger) », dont l.197 sur la Carrière nommée
 *  *Rôdeur fantôme* ; ZI 04 l.42 imprime « Signes secrets (Rôdeur) ». */
const FUSIONS = [{ skillId: 'signes-secrets', mort: 'ranger', vers: 'rodeur' }];

/** Arbitrages nominatifs, clé `"<skillId> <spec>"`, valeur = id (`null` = la `ref` entière part). */
const REMAP = new Map([
  // LDB 09 l.504 ; LDB 08 l.2991/3276/3386 ; ZI 05 l.46
  ['signes-secrets Voleurs', 'voleur'],
  // LDB 08 l.250/431/2037/2147 ; AA 02 l.415 — la guilde, pas la sentinelle « (Au choix) »
  ['signes-secrets Guilde', 'guilde'],
  // LDB 09 l.364 « Cuisinier » ; ADE II 02 l.972 « Métier (Cuisine) »
  ['metier Cuisine', 'cuisinier'],
  // LDB 08 l.173 « Métier (Imprimerie) » ; MCLB 07 l.278/295 « Métier (Imprimeur) »
  ['metier Imprimeur', 'imprimerie'],
  // AA 02 l.169 imprime « Métier (Fabricant de flèches) » — « Fletcher » est l'anglais du terme
  ['metier Fletcher', 'fabricant-de-fleches'],
  // AA 05 l.122 : la liste de l'espèce ne porte AUCUN Savoir — la ref entière part
  ['savoir Tilée', null],
]);

/** AA 05 l.122 : `Langue (Estalien)` de la liste imprimée manque à `humains-tileens` (perdue au
 *  profit du `Savoir (Tilée)` que le Source n'imprime pas, retiré ci-dessus). */
const ESTALIEN = { species: 'humains-tileens', after: 'arabien', noeud: { id: 'langue', spec: 'estalien' } };

// -- Catalogues de référence -------------------------------------------------------------------
const skillsPath = path.join(DATA_DIR, 'skills.json');
const skills = J(skillsPath);
const { extraits: EXTRAITS, dirManquant } = extractedBooks(J(path.join(DATA_DIR, 'books.json')), ROOT);
if (!EXTRAITS.size) {
  console.error('ARRÊT — aucune extraction de livre sur disque : rien pour borner le périmètre.');
  process.exit(1);
}
if (dirManquant.length) console.warn(`AVERTISSEMENT — dir déclaré mais absent du disque : ${dirManquant.join(', ')}`);

let ajoutees = 0;
for (const [skillId, entries] of Object.entries(ADDS)) {
  const def = skills.find((s) => s.id === skillId);
  if (!def || !Array.isArray(def.specs)) {
    console.error(`ARRÊT — ${skillId} : pas de specs[] inline dans skills.json.`);
    process.exit(1);
  }
  for (const e of entries) {
    const deja = def.specs.find((s) => s.id === e.id);
    if (deja) {
      if (deja.label !== e.label) {
        console.error(`ARRÊT — collision d'id ${skillId}/${e.id} : catalogue « ${deja.label} » vs ajout « ${e.label} ».`);
        process.exit(1);
      }
      continue;
    }
    def.specs.push(e);
    ajoutees++;
  }
}

let fusionnees = 0;
for (const { skillId, mort, vers } of FUSIONS) {
  const def = skills.find((s) => s.id === skillId);
  if (!def?.specs?.some((s) => s.id === vers)) {
    console.error(`ARRÊT — fusion ${skillId}/${mort} vers ${vers} : la cible ${vers} n'existe pas.`);
    process.exit(1);
  }
  const at = def.specs.findIndex((s) => s.id === mort);
  if (at >= 0) { def.specs.splice(at, 1); fusionnees++; }
  REMAP.set(`${skillId} ${mort}`, vers);
}

/** Libellé normalisé vers id, par Compétence (après ajouts et fusions). */
const LABEL_TO_ID = new Map();
const IDS = new Map();
for (const s of skills) {
  if (!Array.isArray(s.specs)) continue;
  IDS.set(s.id, new Set(s.specs.map((e) => e.id)));
  LABEL_TO_ID.set(s.id, new Map(s.specs.map((e) => [norm(e.label), e.id])));
}

// -- Passe de réécriture -----------------------------------------------------------------------
const migrees = [];
const restantes = [];

function migrerEntree(entry, file, ownerId) {
  const book = entry.source?.book;
  const extrait = typeof book === 'string' && EXTRAITS.has(book);
  const aRetirer = new Set();
  let n = 0;
  walkSkillRefs(entry, (node) => {
    if (typeof node.spec !== 'string' || isSentinel(node.spec)) return;
    const ids = IDS.get(node.id);
    if (!ids || ids.has(node.spec)) return;
    const parId = LABEL_TO_ID.get(node.id)?.get(norm(node.spec));
    const cle = `${node.id} ${node.spec}`;
    if (parId) {
      migrees.push({ file, ownerId, book: book ?? '(sans source)', skillId: node.id, de: node.spec, vers: parId, via: 'libellé' });
      node.spec = parId;
      n++;
    } else if (extrait && REMAP.has(cle)) {
      const vers = REMAP.get(cle);
      migrees.push({ file, ownerId, book, skillId: node.id, de: node.spec, vers, via: 'remap' });
      if (vers === null) aRetirer.add(node);
      else node.spec = vers;
      n++;
    } else if (extrait) {
      restantes.push(`${file} ${ownerId} (${book}) ${node.id}/${JSON.stringify(node.spec)}`);
    }
  });
  // Retrait de la `ref` PORTEUSE, jamais de la seule `spec` (sinon une Compétence de plus).
  for (const arr of skillArraysOf(entry)) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (aRetirer.has(arr[i])) arr.splice(i, 1);
    }
  }
  return n;
}

const CIBLES = ['creatures.json', 'careerLevels.json', 'species.json'];
const aEcrire = [];
for (const f of CIBLES) {
  const full = path.join(DATA_DIR, f);
  const data = J(full);
  let n = 0;
  for (const entry of data) n += migrerEntree(entry, f, entry.id ?? entry.label ?? '?');

  if (f === 'species.json') {
    const sp = data.find((s) => s.id === ESTALIEN.species);
    if (!sp || !Array.isArray(sp.skills)) {
      console.error(`ARRÊT — species ${ESTALIEN.species} introuvable ou sans skills[].`);
      process.exit(1);
    }
    if (!sp.skills.some((a) => a.id === 'langue' && a.spec === ESTALIEN.noeud.spec)) {
      const at = sp.skills.findIndex((a) => a.id === 'langue' && a.spec === ESTALIEN.after);
      if (at < 0) {
        console.error(`ARRÊT — ${ESTALIEN.species} : ancre langue/${ESTALIEN.after} absente, ordre inattendu.`);
        process.exit(1);
      }
      sp.skills.splice(at + 1, 0, { ...ESTALIEN.noeud });
      n++;
      console.log(`species/${ESTALIEN.species} : Langue (Estalien) restaurée (AA 05 l.122).`);
    }
  }

  if (n) aEcrire.push({ f, full, data });
}

// Écriture APRÈS la mesure complète : un arrêt fail-fast laisse l'arbre intact.
if (restantes.length) {
  console.error(`ARRÊT — ${restantes.length} spec(s) d'un livre EXTRAIT restent hors catalogue :`);
  for (const r of restantes) console.error(`  ${r}`);
  process.exit(1);
}
const ecrits = [];
for (const { f, full, data } of aEcrire) { fs.writeFileSync(full, serializeDataset(data), 'utf8'); ecrits.push(f); }
if (ajoutees || fusionnees) fs.writeFileSync(skillsPath, serializeDataset(skills), 'utf8');

// -- Rendu -------------------------------------------------------------------------------------
console.log(`Entrées de catalogue ajoutées à skills.json : ${ajoutees} · fusionnées : ${fusionnees}`);
console.log(`Fichiers de données réécrits : ${ecrits.join(', ') || '(aucun)'}`);
console.log(`\nSpecs migrées : ${migrees.length}`);
const parCle = new Map();
for (const m of migrees) {
  const k = `${m.skillId}/"${m.de}" -> ${m.vers === null ? '(ref retirée)' : m.vers}  [${m.via}]`;
  if (!parCle.has(k)) parCle.set(k, new Map());
  const b = parCle.get(k);
  b.set(m.book, (b.get(m.book) ?? 0) + 1);
}
for (const [k, b] of [...parCle.entries()].sort()) {
  console.log(`  ${String([...b.values()].reduce((a, x) => a + x, 0)).padStart(4)}  ${k}   {${[...b.entries()].map(([x, n]) => `${x}:${n}`).join(', ')}}`);
}
console.log('\nLivres extraits : 0 spec hors catalogue.');

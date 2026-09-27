/**
 * Migration #1342 (L2-b) — les `skills[].spec` des entrées sourcées `frenchy-bzh` résolvent au
 * catalogue `skills.json#specs[]`.
 *
 * L'extraction de ce livre EXISTE sur disque (`Source/Warhammer - Habitants & Créatures  du
 * Vieux-Monde (Discord) PDF`, 84 chapitres `NN - ….md`) : chaque spéc est citable au statbloc. La
 * première étape déclare donc son `extractionDir` dans `books.json` — sans quoi le périmètre
 * « livre EXTRAIT » de `scripts/data/lib/skillSpecWalk.mjs#extractedBooks` ne le voit pas.
 *
 * Le livre est une traduction FAN : ses noms de Compétences sont les siens (Annexe B, ch.81 :
 * « Distraction | Divertissement | *Entertain* », « Artisanat | Métier | *Trade* »). L'Annexe B ne
 * porte PAS les spécialisations — chaque spéc est donc relevée à son statbloc, puis :
 *  - `REMAP` : une entrée du catalogue désigne déjà ce concept, attestée au Source officiel FR
 *    (chaque clé porte sa double citation : la ligne frenchy, et la ligne officielle) ;
 *  - `ADDS` : la spéc est imprimée par frenchy et aucune entrée FR officielle ne la porte → entrée
 *    `{id,label,source:{book,page,note}}`. `page` = le folio imprimé au pied de page (« N sur 630 »).
 *  - `NORMALISE` : la valeur stockée revient à la forme IMPRIMÉE quand l'ingestion l'a mutilée.
 *  - `CHOIX_BORNE` : la ligne imprime un CHOIX de spécialisation (« Armurier OU Forgeron »,
 *    « Rivières ou Chemins », « Divinité ») — l'emplacement de choix borné est le sujet de #1456.
 *
 * Second geste, même arbre (règle 1) : trois créatures frenchy portent une valeur de Corps à corps
 * sans le Trait `arme` que leur ligne « **Armes** … Dégâts DR + N » impose — même lecture que leurs
 * voisines de statbloc déjà migrées (jeune araignée `arme 3` = « Dégâts DR + 3 », ch.40 l.52).
 *
 * Entrées : `src/data/books.json` (écrit : pose de l'`extractionDir`), le dossier d'extraction
 * `Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF` (chapitres `NN - ….md`),
 * `src/data/skills.json` (catalogue, écrit) et les trois porteurs
 * `src/data/{creatures,careerLevels,species}.json`.
 *
 * REJOUABLE : un second passage ne réécrit rien. FAIL-FAST : arrêt en 1 si l'extraction manque, si
 * une `specs[]` cible manque, si un id ajouté entre en collision, ou s'il reste une spéc frenchy
 * hors catalogue et hors `CHOIX_BORNE` — l'arbre n'est écrit qu'après mesure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSentinel, walkSkillRefs, extractedBooks } from '../data/lib/skillSpecWalk.mjs';
import { norm } from '../../src/lib/normalize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis ce script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const BOOK = 'frenchy-bzh';
const DIR_FRENCHY = 'Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF';

/** Entrées de catalogue à créer, par id de Compétence. `note` = citation à la ligne (chapitre du
 *  fichier d'extraction), `page` = folio imprimé au pied de page qui gouverne cette ligne.
 *  L'extraction frenchy n'a pas d'ancres `data-folio` : ces folios sont relevés aux pieds de page
 *  « N sur 630 », hors de portée de `folio-line-align`. */
const ADDS = {
  divertissement: [
    { id: 'sermons', label: 'Sermons', source: { book: BOOK, page: 89, note: 'frenchy.bzh 22 l.516' } },
    { id: 'seduction', label: 'Séduction', source: { book: BOOK, page: 285, note: 'frenchy.bzh 49 l.21' } },
    { id: 'ceremonie', label: 'Cérémonie', source: { book: BOOK, page: 470, note: 'frenchy.bzh 67 l.330' } },
    { id: 'anecdotes-militaires', label: 'Anecdotes Militaires', source: { book: BOOK, page: 62, note: 'frenchy.bzh 19 l.25' } },
    { id: 'grimaces-et-mimes', label: 'Grimaces & Mimes', source: { book: BOOK, page: 321, note: 'frenchy.bzh 51 l.92' } },
    { id: 'chants-de-marins', label: 'Chants de Marins', source: { book: BOOK, page: 133, note: 'frenchy.bzh 26 l.195' } },
    { id: 'plaidoirie', label: 'Plaidoirie', source: { book: BOOK, page: 59, note: 'frenchy.bzh 18 l.52' } },
    { id: 'urbain', label: 'Urbain', source: { book: BOOK, page: 102, note: 'frenchy.bzh 23 l.126' } },
    { id: 'fanfaron', label: 'Fanfaron', source: { book: BOOK, page: 435, note: 'frenchy.bzh 65 l.209' } },
  ],
  savoir: [
    { id: 'maladies', label: 'Maladies', source: { book: BOOK, page: 383, note: 'frenchy.bzh 58 l.56' } },
    { id: 'magie-peaux-verte', label: 'Magie Peaux-Verte', source: { book: BOOK, page: 450, note: 'frenchy.bzh 65 l.619' } },
    { id: 'zone-de-patrouille', label: 'Zone de Patrouille', source: { book: BOOK, page: 48, note: 'frenchy.bzh 16 l.141' } },
    { id: 'siege', label: 'Siège', source: { book: BOOK, page: 468, note: 'frenchy.bzh 67 l.268' } },
    { id: 'ranald', label: 'Ranald', source: { book: BOOK, page: 116, note: 'frenchy.bzh 23 l.570' } },
  ],
  metier: [
    { id: 'enluminure', label: 'Enluminure', source: { book: BOOK, page: 94, note: 'frenchy.bzh 22 l.652' } },
    { id: 'reliure', label: 'Reliure', source: { book: BOOK, page: 94, note: 'frenchy.bzh 22 l.652' } },
  ],
  'signes-secrets': [
    // Imprimée par un livre OFFICIEL extrait : EDO 10 l.736 « Signes secrets (Cultistes) 128 ».
    { id: 'cultistes', label: 'Cultistes', source: { book: 'ennemi-dans-l-ombre', page: 143, note: 'EDO 10 l.736' } },
    { id: 'rebouteux', label: 'Rebouteux', source: { book: BOOK, page: 139, note: 'frenchy.bzh 26 l.359' } },
  ],
  dressage: [
    { id: 'rats', label: 'Rats', source: { book: BOOK, page: 398, note: 'frenchy.bzh 59 l.114' } },
  ],
  representation: [
    { id: 'victimisation', label: 'Victimisation', source: { book: BOOK, page: 343, note: 'frenchy.bzh 54 l.23' } },
    { id: 'danse-tribale', label: 'Danse Tribale', source: { book: BOOK, page: 441, note: 'frenchy.bzh 65 l.380' } },
  ],
};

/** Arbitrages nominatifs, clé `"<skillId> <spec>"` → id du catalogue. Chaque ligne porte la ligne
 *  frenchy PUIS la ligne officielle FR qui atteste l'entrée visée. */
const REMAP = new Map([
  // frenchy.bzh 20 l.28 « Distraction (Conteur) » ; LDB 09 l.198 « Narration » ; EDO 06 l.481
  ['divertissement Conteur', 'narration'],
  // frenchy.bzh 26 l.793 « Distraction (Chants) » ; LDB 09 l.198 « Chant »
  ['divertissement Chants', 'chant'],
  // frenchy.bzh 23 l.325 « Distraction (Comédien) » ; LDB 09 l.198 « Comédie »
  ['divertissement Comédien', 'comedie'],
  // frenchy.bzh 23 l.187 « Distraction (Moqueries) » ; PDT 08 l.549 « Divertissement (Raillerie) »
  ['divertissement Moqueries', 'raillerie'],
  // frenchy.bzh 67 l.32 « Distraction (Insultes) » ; ADE II 01 l.227 « Divertissement (Raillerie) »
  ['divertissement Insultes', 'raillerie'],
  // frenchy.bzh 13 l.120 « Savoir (Droit) » ; LDB 09 l.495 « Loi »
  ['savoir Droit', 'loi'],
  // frenchy.bzh 14 l.142 « Savoir (Bataille) » ; PDT 10 l.505 « Savoir (Guerre …) »
  ['savoir Bataille', 'guerre'],
  // frenchy.bzh 16 l.94 « Savoir (Rivières) » ; MSR 11 l.16 « Savoir (Voies Fluviales) 45 »
  ['savoir Rivières', 'voies-fluviales'],
  // frenchy.bzh 56 l.52 « Savoir (Engingneur) » ; LDB 09 l.495 « Ingénierie »
  ['savoir Engingneur', 'ingenierie'],
  // frenchy.bzh 56 l.319 « Savoir (Engingneurie) » ; LDB 09 l.495 « Ingénierie »
  ['savoir Engingneurie', 'ingenierie'],
  // frenchy.bzh 22 l.38 « Savoir (Plante) » ; frenchy.bzh 26 l.300 « Savoir (Plantes) » (catalogue)
  ['savoir Plante', 'plantes'],
  // frenchy.bzh 17 l.62 « Savoir (Sorcellerie) » (Répurgateur) ; LDB 08 l.1897 « Répurgateur …
  // Savoir (Sorcières) »
  ['savoir Sorcellerie', 'sorcieres'],
  // frenchy.bzh 71 l.37 « Artisanat (Embaumement) » ; LDB 09 l.364 « Embaumeur »
  ['metier Embaumement', 'embaumeur'],
  // frenchy.bzh 22 l.156 « Artisanat (Herboristerie) » ; frenchy.bzh 26 l.359 « Artisanat
  // (Herboriste) » (catalogue)
  ['metier Herboristerie', 'herboriste'],
  // frenchy.bzh 26 l.764 « Artisanat (Brasserie) » ; catalogue « Brasseur »
  ['metier Brasserie', 'brasseur'],
  // frenchy.bzh 23 l.64 « Artisanat (Gravure) » ; catalogue « Graveur »
  ['metier Gravure', 'graveur'],
  // frenchy.bzh 57 l.343 « Artisanat (Poison) » ; frenchy.bzh 22 l.38 « Artisanat (Poisons) »
  ['metier Poison', 'poisons'],
  // frenchy.bzh 56 l.52 « Artisanat (Engingneur) » ; catalogue « Ingénieur »
  ['metier Engingneur', 'ingenieur'],
  // frenchy.bzh 65 l.164 « Artisanat (Archerie) » (archer gobelin) ; ADE I 07 l.189 « Métier
  // (Fabricant d'arcs) » — LDB 09 l.364 ne liste pas ce Métier, l'attestation FR est ADE I.
  ['metier Archerie', 'fabricant-d-arcs'],
  // frenchy.bzh 16 l.130 « Savoir (Zone Patrouille) » (statbloc) ; 15 l.166, 16 l.141 et 16 l.182
  // impriment « Savoir (Zone de Patrouille) » — l'entrée porte la forme longue.
  ['savoir Zone Patrouille', 'zone-de-patrouille'],
  // frenchy.bzh 23 l.64 « Signes Secrets (Voleurs) » ; LDB 09 l.504 « Voleurs »
  ['signes-secrets Voleurs', 'voleur'],
]);

/** Valeur STOCKÉE ramenée à la forme imprimée : frenchy.bzh 29 l.83 imprime « Savoir
 *  (Rivières_ou_Chemins) », dont l'ingestion a mangé les `_` d'italique. */
const NORMALISE = new Map([['savoir RivièresouChemins', 'Rivières ou Chemins']]);

/** La ligne imprime un CHOIX de spécialisation, pas une spéc — emplacement de choix BORNÉ : #1456.
 *  `Divinité` est le placeholder du livre pour « le dieu » : son Annexe D (83 l.25) le rend par
 *  « Béni (Divinité) | Béni (Divers) | *Blessed (Various)* ». */
const CHOIX_BORNE = new Set([
  'savoir Rivières ou Chemins', // frenchy.bzh 29 l.83 « Savoir (Rivières_ou_Chemins) »
  'metier Armurier OU Forgeron', // frenchy.bzh 43 l.95 « Artisanat (Armurier OU Forgeron) »
  'savoir Divinité', // frenchy.bzh 46 l.37, l.99, l.187 « Savoir (Divinité) »
]);

/** Trait `arme` (indice) imposé par la ligne « **Armes** … Dégâts DR + N » du statbloc. */
const TRAITS_ARME = [
  // « Armes Griffes (Mêlée 65, Dégâts DR ou Dé Unités + 4) » — frenchy.bzh 40 l.151
  { id: 'araignee-geante-impitoyable', value: 4 },
  // « Armes Griffes (Mêlée 85, Dégâts (DR + Dé Unités + 5) x 2) » — frenchy.bzh 40 l.208
  // Le facteur ×2 imprimé n'a pas de porteur au Trait `arme` : #1458.
  { id: 'chasseresse-des-ombres', value: 5 },
  // « Armes Appendices & Tentacules (Mêlée 60, Dégâts DR ou Dé Unités + 9) » — frenchy.bzh 51 l.51
  { id: 'grand-incendiaire-de-tzeentch', value: 9 },
];

// -- 1. Déclaration de l'extraction ------------------------------------------------------------
const booksPath = path.join(DATA_DIR, 'books.json');
const books = J(booksPath);
const livre = books.find((b) => b.id === BOOK);
if (!livre) {
  console.error(`ARRÊT — ${BOOK} absent de books.json.`);
  process.exit(1);
}
const absFrenchy = path.join(ROOT, DIR_FRENCHY);
if (!fs.existsSync(absFrenchy) || !fs.readdirSync(absFrenchy).some((f) => /^\d{2} - .+\.md$/.test(f))) {
  console.error(`ARRÊT — extraction introuvable sur disque : ${DIR_FRENCHY}`);
  process.exit(1);
}
let dirPose = false;
if (livre.extractionDir !== DIR_FRENCHY) {
  // `extractionDir` et non `dir` : `dir` est le champ des livres de l'Atlas RAW — `scripts/raw/
  // _lib.mjs#BOOKS` en dérive et `build-implemente.mjs#buildAbbrMap` refuse (exit 1)
  // tout `dir` dont l'`abbr` n'y est pas. Ordre des clés : id, label, abbr, <extraction>, language…
  const { id, label, abbr, ...reste } = livre;
  delete reste.extractionDir;
  books[books.indexOf(livre)] = { id, label, abbr, extractionDir: DIR_FRENCHY, ...reste };
  dirPose = true;
}

const { extraits: EXTRAITS } = extractedBooks(books, ROOT);
if (!EXTRAITS.has(BOOK)) {
  console.error(`ARRÊT — ${BOOK} toujours hors périmètre EXTRAIT après pose de l'extractionDir.`);
  process.exit(1);
}

// -- 2. Catalogue ------------------------------------------------------------------------------
const skillsPath = path.join(DATA_DIR, 'skills.json');
const skills = J(skillsPath);
let ajoutees = 0;
for (const [skillId, entries] of Object.entries(ADDS)) {
  const def = skills.find((s) => s.id === skillId);
  if (!def || !Array.isArray(def.specs)) {
    console.error(`ARRÊT — ${skillId} : pas de specs[] inline dans skills.json.`);
    process.exit(1);
  }
  for (const e of entries) {
    const deja = def.specs.find((s) => (typeof s === 'string' ? s : s.id) === e.id);
    if (deja) {
      const label = typeof deja === 'string' ? deja : deja.label;
      if (label !== e.label) {
        console.error(`ARRÊT — collision d'id ${skillId}/${e.id} : catalogue « ${label} » vs ajout « ${e.label} ».`);
        process.exit(1);
      }
      continue;
    }
    def.specs.push(e);
    ajoutees++;
  }
}

/** Libellé normalisé vers id, par Compétence (après ajouts). */
const LABEL_TO_ID = new Map();
const IDS = new Map();
for (const s of skills) {
  if (!Array.isArray(s.specs)) continue;
  IDS.set(s.id, new Set(s.specs.map((e) => (typeof e === 'string' ? e : e.id))));
  LABEL_TO_ID.set(s.id, new Map(s.specs.map((e) => [norm(typeof e === 'string' ? e : e.label), typeof e === 'string' ? e : e.id])));
}

// -- 3. Passe de réécriture --------------------------------------------------------------------
const migrees = [];
const restantes = [];
const bornees = [];

function migrerEntree(entry, file, ownerId) {
  const book = entry.source?.book;
  let n = 0;
  walkSkillRefs(entry, (node) => {
    if (typeof node.spec !== 'string' || isSentinel(node.spec)) return;
    const ids = IDS.get(node.id);
    if (!ids || ids.has(node.spec)) return;
    const cleBrute = `${node.id} ${node.spec}`;
    if (book === BOOK && NORMALISE.has(cleBrute)) {
      const forme = NORMALISE.get(cleBrute);
      if (node.spec !== forme) {
        migrees.push({ file, ownerId, book, skillId: node.id, de: node.spec, vers: forme, via: 'forme imprimée' });
        node.spec = forme;
        n++;
      }
    }
    const cle = `${node.id} ${node.spec}`;
    const parId = LABEL_TO_ID.get(node.id)?.get(norm(node.spec));
    if (parId) {
      migrees.push({ file, ownerId, book: book ?? '(sans source)', skillId: node.id, de: node.spec, vers: parId, via: 'libellé' });
      node.spec = parId;
      n++;
    } else if (book === BOOK && REMAP.has(cle) && !CHOIX_BORNE.has(cle)) {
      const vers = REMAP.get(cle);
      migrees.push({ file, ownerId, book, skillId: node.id, de: node.spec, vers, via: 'remap' });
      node.spec = vers;
      n++;
    } else if (book === BOOK && CHOIX_BORNE.has(cle)) {
      bornees.push(`${file} ${ownerId} : ${node.id}/${JSON.stringify(node.spec)}`);
    } else if (EXTRAITS.has(book)) {
      restantes.push(`${file} ${ownerId} (${book}) ${node.id}/${JSON.stringify(node.spec)}`);
    }
  });
  return n;
}

const CIBLES = ['creatures.json', 'careerLevels.json', 'species.json'];
const aEcrire = [];
for (const f of CIBLES) {
  const full = path.join(DATA_DIR, f);
  const data = J(full);
  let n = 0;
  for (const entry of data) n += migrerEntree(entry, f, entry.id ?? entry.label ?? '?');

  if (f === 'creatures.json') {
    for (const t of TRAITS_ARME) {
      const c = data.find((x) => x.id === t.id);
      if (!c || !Array.isArray(c.traits)) {
        console.error(`ARRÊT — créature ${t.id} introuvable ou sans traits[].`);
        process.exit(1);
      }
      const deja = c.traits.find((x) => x.id === 'arme');
      if (deja) {
        if (deja.value !== t.value) {
          console.error(`ARRÊT — ${t.id} : Trait arme déjà présent à ${deja.value}, la ligne du statbloc dit ${t.value}.`);
          process.exit(1);
        }
        continue;
      }
      c.traits.push({ id: 'arme', value: t.value });
      n++;
      console.log(`creatures/${t.id} : Trait arme ${t.value} posé.`);
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
if (ajoutees) fs.writeFileSync(skillsPath, serializeDataset(skills), 'utf8');
if (dirPose) fs.writeFileSync(booksPath, serializeDataset(books), 'utf8');

// -- 4. Rendu ----------------------------------------------------------------------------------
console.log(`books.json#${BOOK}.extractionDir : ${dirPose ? 'posé' : 'déjà en place'} (${DIR_FRENCHY})`);
console.log(`Entrées de catalogue ajoutées à skills.json : ${ajoutees}`);
console.log(`Fichiers de données réécrits : ${ecrits.join(', ') || '(aucun)'}`);
console.log(`\nSpecs migrées : ${migrees.length}`);
const parCle = new Map();
for (const m of migrees) {
  const k = `${m.skillId}/"${m.de}" -> ${m.vers}  [${m.via}]`;
  if (!parCle.has(k)) parCle.set(k, new Map());
  const b = parCle.get(k);
  b.set(m.book, (b.get(m.book) ?? 0) + 1);
}
for (const [k, b] of [...parCle.entries()].sort()) {
  console.log(`  ${String([...b.values()].reduce((a, x) => a + x, 0)).padStart(4)}  ${k}   {${[...b.entries()].map(([x, n]) => `${x}:${n}`).join(', ')}}`);
}
console.log(`\nChoix borné laissé tel quel (#1456) : ${bornees.length}`);
for (const b of bornees) console.log(`  ${b}`);

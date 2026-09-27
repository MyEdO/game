/**
 * Migration #1897 (lot 1 de #838) — les sorts du livre fan `frenchy-bzh` passent par LE PONT.
 *
 * POURQUOI : l'import du livre fan a lié ses créatures aux sorts PAR LIBELLÉ (au moins 28 liaisons
 * fausses) et créé une DEUXIÈME entité pour des sorts déjà au catalogue. Doctrine du 2026-07-17
 * (`.claude/memory/game-doctrine-une-entite-n-livres-n-variantes.md`) : une entité, N livres.
 *
 * GESTES, dans l'ordre :
 *  1. FUSIONS (`SORTS_FUSIONNES_1897`, `src/data/sortsFusionnes.ts`) : l'entrée fan disparaît, l'entrée qui
 *     l'absorbe gagne `alsoIn: { book: 'frenchy-bzh', page, quote }` — `quote` = la VF imprimée (sigle
 *     retiré), `page` = le folio de la PREMIÈRE cellule qui l'imprime et que le pont résout vers
 *     l'absorbante (pied de page, jamais recopié de l'entrée fan).
 *  2. ENTRÉES FAN NEUVES (`NEUVES` ci-dessous) : sorts imprimés sans entrée ; `desc` = la colonne Effet
 *     de la cellule citée, VERBATIM (seul `<br>` devient une espace).
 *  3. LISTES DÉRIVÉES : `spells` de chaque créature fan jointe = `listesDerivees` du pont
 *     (`scripts/data/lib/pontSortsFan.ts`) ; toute autre créature passe par `listeDeSortsVivants`.
 *
 * Entrées : `src/data/spells.json` et `src/data/creatures.json` (écrits), `src/data/books.json`
 * (registre des livres, via `scripts/raw/_lib.mjs`), le dossier d'extraction
 * `Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF` (chapitres `NN - ….md`),
 * `SORTS_FUSIONNES_1897` (`src/data/sortsFusionnes.ts`) et la table du pont (`scripts/data/lib/pontSortsFan.ts`).
 *
 * FAIL-FAST, rien n'est écrit (sortie 1, fautes nommées) si : forme non canonique d'un fichier, cible
 * de fusion absente ou elle-même fusionnée, fusion sans cellule imprimée, cellule que le pont ne résout
 * pas, id du pont absent du catalogue, DOUBLON non déclaré dans une liste dérivée.
 * IDEMPOTENT : rejouée sur son état d'arrivée, elle n'écrit rien et sort 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SORTS_FUSIONNES_1897, listeDeSortsVivants } from '../../src/data/sortsFusionnes.ts';
import { cellulesDeSortsFan, normCellule, LIVRE_FAN } from '../data/lib/cellulesDeSortsFan.ts';
import { ligneDeCellule, listesDerivees } from '../data/lib/pontSortsFan.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const F_SORTS = path.join(ROOT, 'src/data/spells.json');
const F_CREATURES = path.join(ROOT, 'src/data/creatures.json');
const NOM = path.basename(fileURLToPath(import.meta.url));

/** Sorts imprimés dans un profil fan sans entrée au catalogue. `cellule` = `<chapitre>:<ligne>` de la
 *  rangée dont la colonne Effet devient `desc` et dont le pied de page devient `source.page`. */
const NEUVES = [
  {
    cellule: '71 - Necromanciens.md:260',
    entree: { id: 'invocation-d-un-colosses-necrofex', type: 'spells', label: 'Invocation d’un Colosses Necrofex', ecole: 'Magie des Arcanes & de Nécromancie', subType: null, cn: 180, range: { kind: 'distance', value: 70, unit: 'm' }, target: { kind: 'special', text: '1 Cimetère / Charnier / Champ de Bataille' }, duration: { kind: 'special', text: 'jusqu’à l’aube suivante' } },
    fin: { family: 'arcane' },
  },
  {
    cellule: '71 - Necromanciens.md:259',
    entree: { id: 'invitation-a-la-danse-macabre-de-vanhel', type: 'spells', label: 'Invitation à la Danse Macabre de Vanhel', ecole: 'Magie des Arcanes & de Nécromancie', subType: null, cn: 14, range: { kind: 'self' }, target: { kind: 'area', span: 'diameter', meters: 700 }, duration: { kind: 'special', text: 'jusqu’à l’aube suivante' } },
    effects: { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'ops', on: 'caster', ops: [
        { op: 'narrative', text: 'Tous les corps décédés dans la zone se dressent s’ils n’ont pas été correctement enterrés et bénis.' },
        { op: 'narrative', text: 'Pour chaque rayon de 100 mètres, le mage gagne 1 Point de Corruption.' },
        { op: 'narrative', text: 'Si le mage est tué ou inconscient, les morts s’écroulent.' },
      ] } },
    ] },
    fin: { family: 'arcane' },
  },
  {
    cellule: '50 - Demons de Nurgle.md:217',
    entree: { id: 'putrefaction-2', type: 'spells', label: 'Putréfaction', ecole: 'Magie des Arcanes', subType: null, cn: 8, range: { kind: 'distance', value: 85, unit: 'm' }, target: { kind: 'area', span: 'diameter', meters: 8 }, duration: { kind: 'instant' } },
    effects: { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'ops', on: 'caster', ops: [
        { op: 'narrative', text: 'Le démon fait pourrir ou tourner toute la nourriture et toutes les boissons dans la zone d’effet.' },
        { op: 'narrative', text: 'Toute créature qui consomme ces aliments attrape automatiquement une Foirade (_Galloping_ _Trots_).' },
      ] } },
    ] },
    fin: { family: 'arcane' },
  },
  {
    cellule: '56 - Clan Skryre.md:145',
    entree: { id: 'bouclier-ruine', type: 'spells', label: 'Bouclier', ecole: 'du Domaine de la Ruine', subType: null, cn: 6, range: { kind: 'self' }, target: { kind: 'self' }, duration: { kind: 'rounds', value: 2, plus: true } },
    effects: { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'ap', amount: 10 }] } },
      { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'narrative', text: 'Si un adversaire attaque à mains nues ou avec une arme métallique, il encaisse 7 Points de Dégâts à cause des interférences (pas de PA d’armure métallique).' }] } },
    ] },
    fin: { family: 'arcane' },
  },
];

const SIGLE_VF = /\s+(Dev Diary #\d+|DotR Comp(?:anion)?|DotR p\.\d+|EiS Comp|EiR Companion|THR Comp|PbtT Comp(?:anion)?(?:, p\.\d+)?|WoM, p\.\d+|B&B|DSLF|DSFL|UA II|AotE III)$/;
const vfImprimee = (vf) => vf.replace(SIGLE_VF, '').trim();

const fautes = [];
const lire = (f) => {
  const brut = fs.readFileSync(f, 'utf8');
  const doc = JSON.parse(brut);
  if (!Array.isArray(doc)) fautes.push(`${path.basename(f)} : racine non-TABLEAU`);
  else if (brut !== JSON.stringify(doc, null, 2)) fautes.push(`${path.basename(f)} : forme non canonique (JSON.stringify(doc, null, 2))`);
  return { brut, doc };
};
const sorts = lire(F_SORTS);
const creatures = lire(F_CREATURES);
if (fautes.length) sortir();

const parId = new Map(sorts.doc.map((s) => [s.id, s]));
const cellules = cellulesDeSortsFan(creatures.doc);
const { parCreature, nonResolues } = listesDerivees(cellules);
for (const c of nonResolues) fautes.push(`cellule sans ligne de pont : ${c.fichier}:${c.ligne} « ${c.vf} » / « ${c.vo} » (${c.section})`);
for (const { doublons } of parCreature.values()) fautes.push(...doublons.map((d) => `doublon non déclaré — ${d}`));

// 1. Fusions : porte, puis emplacement secondaire calculé à la cellule.
const poses = [];
for (const [fan, cible] of Object.entries(SORTS_FUSIONNES_1897)) {
  const absorbante = parId.get(cible);
  if (!absorbante) { fautes.push(`fusion ${fan} → ${cible} : cible absente de spells.json`); continue; }
  if (SORTS_FUSIONNES_1897[cible]) { fautes.push(`fusion ${fan} → ${cible} : la cible est elle-même fusionnée`); continue; }
  const entreeFan = parId.get(fan);
  const libelle = entreeFan ? entreeFan.label : null;
  const imprimees = cellules.filter((c) => ligneDeCellule(c)?.id === cible);
  const cellule = libelle
    ? imprimees.find((c) => normCellule(vfImprimee(c.vf)) === normCellule(libelle))
      ?? imprimees.find((c) => normCellule(vfImprimee(c.vf)).startsWith(`${normCellule(libelle)} `))
    : null;
  if (entreeFan) {
    if (entreeFan.source?.book !== LIVRE_FAN) { fautes.push(`fusion ${fan} : entrée hors ${LIVRE_FAN} (${entreeFan.source?.book})`); continue; }
    if (!cellule || cellule.folio == null) { fautes.push(`fusion ${fan} → ${cible} : aucune cellule imprimée « ${libelle} » résolue vers ${cible}`); continue; }
    poses.push({ fan, cible, alsoIn: { book: LIVRE_FAN, page: cellule.folio, quote: vfImprimee(cellule.vf) } });
  }
}
// 2. Entrées neuves : la cellule citée doit exister et se résoudre vers l'id créé.
const neuves = [];
for (const n of NEUVES) {
  const [fichier, ligne] = n.cellule.split(/:(?=\d+$)/);
  const c = cellules.find((x) => x.fichier === fichier && x.ligne === Number(ligne));
  if (!c) { fautes.push(`entrée neuve ${n.entree.id} : cellule ${n.cellule} introuvable`); continue; }
  if (ligneDeCellule(c)?.id !== n.entree.id) { fautes.push(`entrée neuve ${n.entree.id} : la cellule ${n.cellule} se résout vers ${ligneDeCellule(c)?.id}`); continue; }
  neuves.push({ ...n.entree, desc: c.effetImprime, effects: n.effects ?? { kind: 'seq', steps: [] }, source: { book: LIVRE_FAN, page: c.folio }, ...n.fin });
}
// Tout id du pont doit exister (ou naître ici).
const naissants = new Set(NEUVES.map((n) => n.entree.id));
for (const c of cellules) {
  const id = ligneDeCellule(c)?.id;
  if (id && !parId.has(id) && !naissants.has(id)) fautes.push(`pont : ${c.fichier}:${c.ligne} → ${id}, absent de spells.json`);
  if (id && SORTS_FUSIONNES_1897[id]) fautes.push(`pont : ${c.fichier}:${c.ligne} → ${id}, id FUSIONNÉ`);
}
if (fautes.length) sortir();

// Écritures en mémoire.
let changes = 0;
for (const { fan, cible, alsoIn } of poses) {
  const absorbante = parId.get(cible);
  const deja = (absorbante.alsoIn ?? []).some((a) => a.book === alsoIn.book && a.page === alsoIn.page && a.quote === alsoIn.quote);
  if (!deja) { poseAlsoIn(absorbante, alsoIn); changes++; }
  if (parId.has(fan)) { parId.delete(fan); changes++; }
}
const docSorts = sorts.doc.filter((s) => parId.has(s.id));
for (const e of neuves) if (!parId.has(e.id)) { docSorts.push(e); parId.set(e.id, e); changes++; }

for (const c of creatures.doc) {
  if (!Array.isArray(c.spells)) continue;
  const derivee = c.source?.book === LIVRE_FAN ? parCreature.get(c.id)?.spells : undefined;
  const cible = derivee ?? listeDeSortsVivants(c.spells);
  if (JSON.stringify(cible) !== JSON.stringify(c.spells)) { c.spells = [...cible]; changes++; }
}

if (changes === 0) {
  console.log(`[${NOM}] no-op (fusions, entrées neuves et listes dérivées déjà en place)`);
  process.exit(0);
}
fs.writeFileSync(F_SORTS, JSON.stringify(docSorts, null, 2), 'utf8');
fs.writeFileSync(F_CREATURES, JSON.stringify(creatures.doc, null, 2), 'utf8');
console.log(`[${NOM}] ${poses.length} fusion(s) · ${neuves.length} entrée(s) neuve(s) · ${changes} changement(s) écrits`);

/** Ajoute l'emplacement à `alsoIn` ; une entrée qui n'en portait aucun le reçoit juste après `source`. */
function poseAlsoIn(entree, alsoIn) {
  if (Array.isArray(entree.alsoIn)) { entree.alsoIn.push(alsoIn); return; }
  const cles = Object.entries(entree);
  for (const k of Object.keys(entree)) delete entree[k];
  for (const [k, v] of cles) { entree[k] = v; if (k === 'source') entree.alsoIn = [alsoIn]; }
}

function sortir() {
  console.error(`[${NOM}] ARBITRAGE REQUIS, rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}

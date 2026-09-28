// CROISSANCE DES DONNÉES — la mécanisation du DoD de #1812 : « +1 entrée → aucun rouge ».
//
// Un compte d'entrées gelé dans une migration DÉJÀ JOUÉE est un PÉAGE : chaque dataset app-owned qui
// grandit légitimement (#1392 `regles.json` 85 → 86, #1800 puis #1806 `primitives.manifest.json`
// 62 → 66 → 67) paie
// un recalage dans un script sans rapport avec son lot. Aucune analyse de TEXTE ne tient cette
// promesse — un cardinal s'écrit `!== ATTENDU`, `!== CARDINAUX[f]`, `total += d.length` puis
// `total !== TOTAL`, sur une ligne ou sur trois. Ce module ne lit donc plus le CODE : il fabrique
// l'ÉVÉNEMENT que le ticket interdit de faire payer, et regarde qui proteste.
//
// PROTOCOLE : l'arbre d'un sha est exporté hors dépôt (`replay-head.mjs`, réutilisé tel quel) ;
// CHAQUE dataset à racine TABLEAU de `src/data/` reçoit UNE entrée de plus, clonée de sa dernière
// (donc à la forme CIBLE de toutes les migrations passées) sous un `id` suffixé ; chaque document de
// projet reçoit UNE Scène de plus, clonée de la dernière. Puis TOUTES les migrations datées sont
// rejouées.
//
// CONTRAT, par migration : sortie 0 ET rien de réécrit ; OU sortie ≠ 0 dont CHAQUE LIGNE de refus
// porte SA RÉFÉRENCE NUE RÉSOLVABLE (`LDB 18 l.53`, `AA 07 l.25-42`, un topic de `docs/raw/`).
// LIGNE PAR LIGNE, et pas « quelque part dans le stderr » : un script qui refuse pour DEUX raisons
// dont une seule est imposée par le livre exempterait l'autre par voisinage (mesuré sur
// `1659-sub-lengthm-plage`, dont la table nominative des sous-tirages passait grâce à la réf de la
// ligne CARDINAL voisine). L'exemption vit AU SITE, dans ce que le code PRONONCE en refusant — jamais
// dans une liste de fichiers. Une seule ligne de refus sans référence = cardinal VIVANT, rouge
// NOMINATIF (migration + ligne).
//
// PÉRIMÈTRE — ce que cette porte ne prouve PAS : le clone est à la forme CIBLE (il copie une entrée
// déjà migrée), donc la croissance n'exerce AUCUNE porte de FORME. Qu'une entrée à une forme
// ÉTRANGÈRE arrête le script, c'est `lib/idempotence-ordre-des-cles.test.mjs` (famille 4) et les bancs
// `lib/*-portes.test.mjs` qui le tiennent. Ici, une seule question : une donnée DE PLUS coûte-t-elle
// quelque chose ?
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { listerDossier } from '../../guards/lib/lister.mjs';
import { pagesDeLAtlas } from '../../raw/_lib.mjs';
import { comparer, empreinteDe } from './empreinteRejeu.mjs';
import { PERIMETRE } from '../replay.mjs';

/** Les migrations DATÉES d'un dossier — le périmètre que `replay.mjs` rejoue. */
export function migrationsDatees(dossier) {
  return listerDossier(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.mjs$/.test(f));
}

/** Les abréviations de livre, DÉRIVÉES du catalogue app-owned — jamais recopiées. */
function abreviations(racine) {
  const books = JSON.parse(fs.readFileSync(path.join(racine, 'src/data/books.json'), 'utf8'));
  return books.map((b) => b.abbr).filter((a) => typeof a === 'string' && /^[A-Z]/.test(a));
}

/** Acceptation DÉCLARÉE à la couture (`pagesDeLAtlas`) : les FICHES seules — un catalogue ou une
 *  page d'auteur n'ancre aucun topic. Le banc du contrat la LIT (`scripts/raw/_lib.test.mjs`). */
export const CLASSES = ['fiche'];

/** Les topics RAW, DÉRIVÉS des FICHES de l'Atlas par la couture d'énumération — un id y suffit à
 *  ancrer une règle. Le stem PORTE son cœur (`<coeur>/<domaine>`) : deux cœurs ne collisionnent pas. */
function topicsRaw(racine) {
  return pagesDeLAtlas(path.join(racine, 'docs/raw'), { classes: CLASSES })
    .map((p) => p.relatif.replace(/\.md$/, ''));
}

const echappe = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * La reconnaissance d'une RÉF NUE : `<ABBR> <chapitre>` (avec ou sans `l.<ligne>`), ou un topic de
 * l'Atlas DÉSIGNÉ comme tel — `docs/raw/<topic>` ou `<topic>#<ancre>`. Le mot NU ne suffit pas :
 * « combat », « destin » ou « creation » traînent dans toutes les proses, et une exemption qu'une
 * phrase quelconque déclenche n'est pas une exemption.
 * @param {string} racine racine du dépôt (ou de l'export)
 * @returns {(texte: string) => boolean}
 */
export function reconnaisseurDeRef(racine) {
  const abbr = new RegExp(`\\b(?:${abreviations(racine).map(echappe).join('|')})\\s+\\d+`, 'u');
  const noms = topicsRaw(racine).map(echappe).join('|');
  const topics = new RegExp(`(?:docs/raw/(?:${noms})|\\b(?:${noms})#[\\w-]+)`, 'u');
  return (texte) => abbr.test(texte) || topics.test(texte);
}

/**
 * Documents qu'un CLONE ne peut pas faire croître — non par un cardinal, mais par INTÉGRITÉ
 * RÉFÉRENTIELLE : leur entrée doit être connue d'un AUTRE document (table de folios, def d'art,
 * topic de l'Atlas) ou porter une identité DÉRIVÉE (un id calculé collisionne avec son jumeau).
 * Chaque entrée porte la porte QUI le dit, `fichier:ligne` — c'est une liste de FAITS vérifiables,
 * qui décroît dès qu'un de ces couplages disparaît, JAMAIS une exemption de cardinal.
 * @type {Record<string, string>}
 */
export const SANS_CROISSANCE = {
  'src/data/structures.json': 'chaque structure doit avoir son folio — 2026-08-27-l1b-1a-structures-folio.mjs:85',
  'src/data/careerLevels.json': 'l’id est DÉRIVÉ (carrière + rang) : un clone collisionne — 2026-08-27-l1b-2a-careerlevels-id.mjs:63',
  'src/data/names.json': 'les clés font EXACTEMENT les 7 RaceKey — 2026-08-27-l1b-5a-names-details-racekey.mjs:112',
  'src/data/raceAppearance.json': '`label` et `id` sont liés par le slug — 2026-08-27-l1b-5b-raceappearance-slug-label.mjs:86',
  'src/data/props.json': 'chaque décor doit avoir sa def d’art `src/gameIso/catalog/decor/defs/<id>.ts` — 2026-08-28-l1b-10a-props-labels.mjs:28',
  'src/data/raw.manifest.json': 'chaque entrée désigne un topic ou une fiche EXISTANTE de `docs/raw/` — 2026-08-28-l1b-10b-rawmanifest-label.mjs:23',
};

/** Forme canonique d'un `src/data/*.json`. */
export const FORME_DATA = { indent: 2, nl: false };
/** Forme canonique d'un document de projet de scène. */
export const FORME_PROJET = { indent: 1, nl: true };

/** Les formes canoniques admises d'un document JSON du dépôt : `{ indent, nl }`. */
const FORMES = [FORME_DATA, { indent: 2, nl: true }, FORME_PROJET, { indent: 1, nl: false }];

/** Le texte de `doc` sous la forme `{ indent, nl }`. */
export const serialise = (doc, forme) => JSON.stringify(doc, null, forme.indent) + (forme.nl ? '\n' : '');

/** La forme canonique de `brut`, ou `null` s'il n'en porte AUCUNE (on n'y touche alors pas). */
function formeDe(brut, doc) {
  return FORMES.find((f) => brut === serialise(doc, f)) ?? null;
}

/** Suffixe des entrées fabriquées — reconnaissable à l'œil dans un stderr de refus. */
export const SUFFIXE = '-croissance';

/**
 * Fait CROÎTRE une liste d'entrées d'UNE unité : la dernière est clonée, son `id` suffixé.
 * REND la liste crue (mutée) ou `null` quand rien ne s'y clone — racine non-tableau, liste vide, ou
 * dernière entrée sans `id` de chaîne (un clone sans identité propre ne serait pas une entrée de
 * plus, mais un doublon).
 * @param {unknown} liste
 * @returns {{ id: string } | null} l'entrée ajoutée
 */
export function croitre(liste) {
  if (!Array.isArray(liste) || liste.length === 0) return null;
  const derniere = liste[liste.length - 1];
  if (!derniere || typeof derniere !== 'object' || Array.isArray(derniere)) return null;
  if (typeof derniere.id !== 'string' || !derniere.id) return null;
  const clone = structuredClone(derniere);
  clone.id = `${derniere.id}${SUFFIXE}`;
  liste.push(clone);
  return clone;
}

/**
 * Fait croître, DANS `racine`, tout dataset à racine tableau de `src/data/` et toute liste de Scènes
 * des documents de projet. REND `{ faits, sautes }` — nominatifs tous les deux : ce qui n'a pas
 * grandi se DIT, sinon la garde serait verte par le vide.
 * @param {string} racine
 */
export function croitreDocuments(racine) {
  const faits = [];
  const sautes = [];

  const grandir = (rel, prendreListe) => {
    const abs = path.join(racine, rel);
    const brut = fs.readFileSync(abs, 'utf8');
    let doc;
    try {
      doc = JSON.parse(brut);
    } catch {
      sautes.push(`${rel} : JSON illisible`);
      return;
    }
    const forme = formeDe(brut, doc);
    if (!forme) {
      sautes.push(`${rel} : forme non canonique en entrée — la croissance ne reformate pas un document`);
      return;
    }
    const ajoute = croitre(prendreListe(doc));
    if (!ajoute) {
      sautes.push(`${rel} : rien à cloner (racine non-tableau, liste vide, ou dernière entrée sans \`id\`)`);
      return;
    }
    fs.writeFileSync(abs, serialise(doc, forme), 'utf8');
    faits.push(`${rel} → ${ajoute.id}`);
  };

  for (const nom of listerDossier(path.join(racine, 'src/data')).filter((f) => f.endsWith('.json'))) {
    const rel = `src/data/${nom}`;
    if (SANS_CROISSANCE[rel]) {
      sautes.push(`${rel} : ${SANS_CROISSANCE[rel]}`);
      continue;
    }
    grandir(rel, (doc) => doc);
  }

  for (const campagne of listerDossier(path.join(racine, 'src/scenes'), { absent: 'vide' })) {
    const rel = `src/scenes/${campagne}/${campagne}-projet.json`;
    if (fs.existsSync(path.join(racine, rel))) grandir(rel, (doc) => doc?.scenes);
  }

  return { faits, sautes };
}

/**
 * Les LIGNES DE REFUS d'une sortie de migration — ce que les scripts PRONONCENT réellement : un
 * en-tête d'erreur (`ARBITRAGE REQUIS — 3 anomalie(s) :`), puis UN écart par ligne, indenté de 1 à 3
 * espaces ; certains portent un `✗`. Une ligne indentée de 4 espaces ou plus est la SUITE de l'écart
 * au-dessus (`vues : …` / `nommées: …`), pas un écart de plus. L'en-tête est générique : il ne compte
 * pas, sauf s'il est TOUT ce que le script a dit.
 * REND `[{ texte, surplomb }]` — `texte` = l'écart et ses suites, `surplomb` = la ligne juste au-dessus.
 * @param {string} sortie
 * @returns {{ texte: string, surplomb: string }[]}
 */
export function lignesDeRefus(sortie) {
  const lignes = sortie.split(/\r?\n/).filter((l) => l.trim() !== '');
  const items = [];
  lignes.forEach((l, i) => {
    if (/^\s{4,}\S/.test(l) && items.length) {
      items[items.length - 1].texte += ` ${l.trim()}`;
      return;
    }
    if (/^\s{1,3}\S/.test(l) || l.includes('✗')) items.push({ texte: l.trim(), surplomb: lignes[i - 1] ?? '' });
  });
  if (items.length) return items;
  return lignes.length ? [{ texte: lignes.join(' '), surplomb: '' }] : [];
}

/**
 * Les lignes de refus qui ne portent AUCUNE référence RAW — ni sur elles-mêmes, ni sur leur surplomb
 * immédiat (certains formats portent la réf sur l'en-tête du bloc). La référence doit venir du REFUS,
 * jamais de l'entrée fabriquée : un id cloné qui contient `<topic>#<ancre>` (les entrées de
 * `raw.manifest.json` en portent) s'exempterait lui-même — il est donc masqué avant lecture.
 * @param {string} sortie @param {(texte: string) => boolean} porteRef
 * @returns {string[]}
 */
export function refusSansReference(sortie, porteRef) {
  const masque = (t) => t.replace(new RegExp(`\\S*${SUFFIXE}\\S*`, 'gu'), '‹clone›');
  return lignesDeRefus(sortie)
    .filter((b) => !porteRef(masque(b.texte)) && !porteRef(masque(b.surplomb)))
    .map((b) => b.texte);
}

/**
 * Rejoue TOUTES les migrations datées de `racine` (un export JETABLE, déjà grandi) et rend le verdict
 * du contrat de croissance.
 * @param {{ racine: string, ecrire?: (ligne: string) => void }} params
 * @returns {{ rouges: string[], exemptes: string[], lignes: string[] }}
 */
export function rejouerEnCroissance({ racine, ecrire = () => {} }) {
  const dossier = path.join(racine, 'scripts', 'migrations');
  const porteRef = reconnaisseurDeRef(racine);
  const avant = empreinteDe(racine, PERIMETRE);
  const rouges = [];
  const exemptes = [];
  const lignes = [];

  for (const f of migrationsDatees(dossier)) {
    const r = spawnSync(process.execPath, [path.join(dossier, f)], { cwd: racine, encoding: 'utf8' });
    const dit = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    if (r.status === 0) {
      ecrire(`  ✓ ${f} — exit 0`);
      continue;
    }
    const nus = refusSansReference(dit, porteRef);
    if (!nus.length) {
      ecrire(`  · ${f} — exit ${r.status}, refus à RÉFÉRENCE : cardinal IMPOSÉ par le livre`);
      exemptes.push(`${f} : ${lignesDeRefus(dit).map((b) => b.texte).join(' | ')}`);
      continue;
    }
    ecrire(`  ✗ ${f} — exit ${r.status}`);
    for (const nu of nus)
      rouges.push(`${f} : exit ${r.status} — ligne de refus SANS référence RAW, donc CARDINAL VIVANT :\n      ${nu}`);
  }

  const ecart = comparer(avant, empreinteDe(racine, PERIMETRE));
  for (const rel of ecart.reecrits)
    rouges.push(`${rel} : RÉÉCRIT par le rejeu — une entrée de plus ne se renormalise pas, elle se traverse`);
  for (const rel of ecart.neufs) rouges.push(`${rel} : fichier NEUF apparu pendant le rejeu de croissance`);
  for (const rel of ecart.disparus) rouges.push(`${rel} : document DISPARU pendant le rejeu de croissance`);
  lignes.push(`${avant.size} fichier(s) du périmètre mesurés avant/après rejeu`);

  return { rouges, exemptes, lignes };
}

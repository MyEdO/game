// Comparateur du SCHÉMA DE PROGRESSION (#905) : joint l'artefact `src/data/progression-schemas.derived.json`
// — lu dans les PDF de `Source/` par `scripts/data/gen-progression-schemas.py` — au `characteristics`
// de chaque niveau de `careerLevels.json`.
//
// CE QUE LA GARDE EXISTANTE NE VOYAIT PAS : `src/data/refs-migrated.test.ts` ne contrôle que la
// CARDINALITÉ (3/1/1/1) et la DISJONCTION des `characteristics` d'une Carrière. Une PERMUTATION entre
// deux niveaux satisfait les deux — mesuré sur `tueur` (LDB folio 76), niveaux 3 et 4 intervertis,
// garde verte. Ce module compare l'AFFECTATION marque -> Caractéristique, niveau par niveau.
//
// JOINTURE : par TITRE imprimé, dans le livre déclaré — jamais par folio. Le folio a été un support
// de jointure INFIDÈLE : 26 des 108 Carrières de `careers.json` déclaraient un `source.page` qui ne
// tombait pas sur le folio où le PDF imprime leur titre (à la veille de #1640 — `livre-de-base` 20,
// `aux-armes` 6 : « Joueur d'épée » déclarait AA folio 12, celui qu'imprime « Arquebusier »), donc un
// rapprochement par folio aurait apparié des Carrières entre elles. Ces écarts sont désormais NULS et
// BLOQUANTS : `folioEcarts`, recompté à chaque exécution, compte dans le code de sortie du CLI
// `scripts/data/check-progression-schemas.mjs` et est épinglé à vide par la suite.
//
// PÉRIMÈTRE MESURÉ (7 livres extraits, 111 bandes, 108 Carrières appariées) : `livre-de-base`
// (65 bandes / 64 Carrières), `vents-de-la-magie` (14/12), `aux-armes` (15/15), `mer-des-griffes`
// (9/9), `archives-de-l-empire-1` (4/4), `archives-de-l-empire-2` (3/3), `middenheim` (1/1). Les
// 3 bandes en surnombre n'appartiennent à aucune Carrière (l'exemple pédagogique du chapitre
// « Classes et Carrières », LDB folio 46 ; les deux familiers de VDM folio 188) : elles sont
// RAPPORTÉES nommément (`bandesHorsDonnee`), jamais tues — une Carrière du PDF jamais curée doit se
// voir.
//
// ANGLE MORT : toute Carrière d'un livre ABSENT de l'artefact (aucun PDF FR extrait, ou layout que la
// sonde ne sait pas lire) n'est comparée à RIEN. `auditProgressionSchemas` rend ce compte par livre
// (`nonCouvertes`) — un livre non extrait est un angle mort DÉCLARÉ, jamais un silence. La garde ne
// peut pas non plus réfuter l'ORDRE des Caractéristiques à l'intérieur d'un niveau : le schéma imprimé
// est un jeu de cases cochées, pas une liste ordonnée — la comparaison porte donc sur des ENSEMBLES.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DATA = join(ROOT, 'src', 'data')

/** Normalise un libellé pour le rapprochement titre PDF <-> `label` de donnée : la couche texte des
 *  petites capitales rend « Frère Loup » en « frèreloup » (glyphes recollés, casse arbitraire) et
 *  « Joueur d'épée » en « JOUEUR D’ÉPÉE » (apostrophe typographique). On réduit donc aux seules
 *  lettres, sans accent ni casse. @param {string} s @returns {string} */
export function normTitle(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** @param {string} f @returns {unknown} */
function readJson(f) {
  return JSON.parse(readFileSync(join(DATA, f), 'utf8'))
}

/**
 * Compare l'artefact dérivé du PDF à `careerLevels.json`.
 * @param {{ artefact?: unknown, careers?: unknown, careerLevels?: unknown }} [sources] Injection de
 *   test : par défaut, les trois fichiers de `src/data/`.
 * @returns {import('./progressionSchemas.d.mts').ProgressionAudit}
 */
export function auditProgressionSchemas(sources = {}) {
  const artefact = /** @type {any} */ (sources.artefact ?? readJson('progression-schemas.derived.json'))
  const careers = /** @type {any[]} */ (sources.careers ?? readJson('careers.json'))
  const levels = /** @type {any[]} */ (sources.careerLevels ?? readJson('careerLevels.json'))

  /** @type {Map<string, any[]>} carrières par livre, indexées par titre normalisé */
  const byBookTitle = new Map()
  for (const c of careers) {
    const book = c.source?.book
    if (!book) continue
    // Le `label` porte parfois un qualifiant que la page n'imprime PAS dans son titre : la Mer des
    // Griffes titre « MARIN » folio 68 là où la donnée distingue « Marin (Côtier) » du Marin du LDB.
    // La clé étant portée par le LIVRE, indexer aussi la forme sans parenthèse ne crée pas de collision.
    const labels = [c.label, c.labelF].filter((x) => typeof x === 'string')
    for (const label of [...labels, ...labels.map((l) => l.replace(/\s*\([^)]*\)/g, ''))]) {
      const key = `${book}::${normTitle(label)}`
      const bucket = byBookTitle.get(key) ?? []
      if (!bucket.some((x) => x.id === c.id)) bucket.push(c)
      byBookTitle.set(key, bucket)
    }
  }

  /** @type {Map<string, any>} niveaux par `career`+`level` */
  const levelOf = new Map()
  for (const l of levels) levelOf.set(`${l.career.id}::${l.level}`, l)

  const violations = []
  const ambigus = []
  const bandesHorsDonnee = []
  const folioEcarts = []
  const couvertes = new Set()
  const parLivre = {}

  for (const s of artefact.schemas) {
    // `career` peut être `null` (bande qu'aucun titre de sa page ne coiffe, VDM folio 188 colonne de
    // droite) : on rapproche alors par les titres de la page, et l'absence de candidat se RAPPORTE.
    const titres = [s.career, ...(s.titresPage ?? [])].filter((t) => typeof t === 'string')
    /** @type {any[]} */
    const hits = []
    for (const t of titres) {
      for (const c of byBookTitle.get(`${s.book}::${normTitle(t)}`) ?? []) {
        if (!hits.some((x) => x.id === c.id)) hits.push(c)
      }
    }
    if (hits.length === 0) {
      bandesHorsDonnee.push({ book: s.book, page: s.page, pdfpage: s.pdfpage, y: s.y, titres })
      continue
    }
    if (hits.length > 1) {
      ambigus.push({ book: s.book, page: s.page, pdfpage: s.pdfpage, y: s.y, titres, candidats: hits.map((c) => c.id) })
      continue
    }
    const career = hits[0]
    couvertes.add(career.id)
    parLivre[s.book] = (parLivre[s.book] ?? 0) + 1
    if (career.source?.page !== s.page) {
      folioEcarts.push({ career: career.id, book: s.book, declare: career.source?.page ?? null, imprime: s.page })
    }
    for (const n of ['1', '2', '3', '4']) {
      const lvl = levelOf.get(`${career.id}::${Number(n)}`)
      if (!lvl) {
        violations.push({
          career: career.id,
          book: s.book,
          level: Number(n),
          pdfpage: s.pdfpage,
          page: s.page,
          motif: 'niveau-absent-de-la-donnee',
          json: null,
          pdf: (s.lv[n] ?? []).map((m) => m.characteristic),
          marques: s.lv[n] ?? [],
        })
        continue
      }
      const json = [...(lvl.characteristics ?? [])].sort()
      const pdf = (s.lv[n] ?? []).map((m) => m.characteristic).sort()
      if (json.join('|') !== pdf.join('|')) {
        violations.push({
          career: career.id,
          book: s.book,
          level: Number(n),
          pdfpage: s.pdfpage,
          page: s.page,
          motif: 'affectation-divergente',
          json,
          pdf,
          marques: s.lv[n] ?? [],
        })
      }
    }
  }

  /** @type {Record<string, string[]>} */
  const nonCouvertes = {}
  for (const c of careers) {
    if (couvertes.has(c.id)) continue
    const book = c.source?.book ?? '(sans source)'
    ;(nonCouvertes[book] ??= []).push(c.id)
  }

  return {
    violations,
    ambigus,
    bandesHorsDonnee,
    folioEcarts,
    nonCouvertes,
    parLivre,
    totalBandes: artefact.schemas.length,
    totalCarrieres: careers.length,
    couvertes: couvertes.size,
    livresArtefact: artefact.livres ?? [],
  }
}

/** Rend un désaccord en une ligne DIAGNOSTIQUE : page PDF, folio, niveau, colonnes + teintes mesurées,
 *  valeur JSON vs valeur PDF — de quoi rouvrir la page et trancher sans relire tout l'artefact.
 *  @param {import('./progressionSchemas.d.mts').ProgressionViolation} v @returns {string} */
export function formatViolation(v) {
  const marques = v.marques
    .map((m) => `${m.col}${m.teinte ? ` teinte ${m.teinte.join('/')}` : ' glyphe'} @x=${m.x}`)
    .join(', ')
  return (
    `${v.career} niveau ${v.level} (${v.book} folio ${v.page}, page PDF ${v.pdfpage}) : ` +
    `JSON [${(v.json ?? []).join(', ') || '—'}] vs PDF [${v.pdf.join(', ') || '—'}]` +
    (marques ? ` — marques lues : ${marques}` : ' — aucune marque lue')
  )
}

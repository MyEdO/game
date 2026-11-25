// État des lieux des dossiers de chapitre (#2290) : pour chaque fiche commitée `docs/dossiers/<ABBR>/<NN>.json`
// (`chargerDossiers`, scripts/raw/lib/dossiers.mjs), chaque entrée est couverte (par quel porteur de quel
// paquet), écartée (motif) ou non couverte. DÉRIVÉ des `couvre` et `narratif.ecartes` des paquets mesurés, le
// contenu du commun par défaut (`paquetsDuCommun`) (`couverturesDuProjet`, src/data/source/couvertures.ts) — patron du champ `Implémente` de l'Atlas
// (scripts/raw/build-implemente.mjs) : la fiche ne connaît pas le paquet, le paquet la cite.
// Sortie : docs/dossiers-de-chapitre.md (cible pure, jamais commitée, #2203), sur le contenu du commun.
// Re-run : node scripts/docs/build-dossiers-de-chapitre.mjs (npm run docs:dossiers).
// Le lanceur des dérivés applique le mode `--check` en CLI et depuis `build-all.mjs`.
// Des paquets en arguments (chemins relatifs au dépôt) : leur état des lieux sur la sortie standard, aucun doc écrit
// (patron de `scripts/data/obtainability-graph.mts`).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancerDepuisCLI } from './lib/ecriture-derives.mjs'
import { chargerDossiers } from '../raw/lib/dossiers.mjs'
import { paquetsDuCommun } from '../guards/lib/paquetsDuCommun.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { entreesDeLaFiche, FAMILLES_DE_DOSSIER, LIBELLES_DE_FAMILLE, nomDeFiche } from '../../src/data/source/dossier.ts'
import { couverturesDuProjet, nommerPorteur } from '../../src/data/source/couvertures.ts'

const OUT = 'docs/dossiers-de-chapitre.md'
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les paquets `chemins` (relatifs au dépôt), `{ paquet, lu }` : `paquet` = son chemin, `lu` = ses couvertures.
 *  Le disque suffit : `couvre` et `ecartes` ne sont pas de la prose adressée. */
const lirePaquets = (chemins) =>
  chemins.map((paquet) => ({ paquet, lu: couverturesDuProjet(JSON.parse(readFileSync(path.join(RACINE, paquet), 'utf8'))) }))

/** Le statut d'une entrée : couverte dès qu'un porteur la cite, écartée sinon dès qu'un paquet l'écarte. */
const statut = ({ couvertures, ecartes }) => (couvertures.length ? 'couverte' : ecartes.length ? 'écartée' : 'non couverte')

const compter = (entrees) => ({
  total: entrees.length,
  couverte: entrees.filter((e) => e.statut === 'couverte').length,
  'écartée': entrees.filter((e) => e.statut === 'écartée').length,
  'non couverte': entrees.filter((e) => e.statut === 'non couverte').length,
})

const ligneDeCompte = (titre, c) => `| ${titre} | ${c.total} | ${c.couverte} | ${c['écartée']} | ${c['non couverte']} |`
const TETE_DE_COMPTE = (premiere) => `| ${premiere} | Entrées | Couvertes | Écartées | Non couvertes |\n|---|---|---|---|---|`

/** La ligne d'une entrée : identifiant, libellé court, statut et ses preuves. */
function ligneDEntree(e) {
  const tete = `- \`${e.id}\` ${coupeAuMot(e.libelle, 90)} — **${e.statut}**`
  const preuves = [
    ...e.couvertures.map((c) => `${nommerPorteur(c.porteur)}, \`${c.paquet}\``),
    ...e.ecartes.map((x) => `écartée par \`${x.paquet}\` : ${x.motif}`),
  ]
  return preuves.length ? `${tete} : ${preuves.join(' ; ')}` : tete
}

/** Le corps rendu, depuis les fiches et les paquets donnés. PUR. */
export function rendreEtat(fiches, paquets) {
  const couverturesPar = new Map()
  const ecartesPar = new Map()
  for (const { paquet, lu } of paquets) {
    for (const c of lu.couvertures) couverturesPar.set(c.entree, [...(couverturesPar.get(c.entree) ?? []), { ...c, paquet }])
    for (const x of lu.ecartes) ecartesPar.set(x.entree, [...(ecartesPar.get(x.entree) ?? []), { ...x, paquet }])
  }
  const parFiche = fiches.map(({ chemin, abbr, nn, fiche }) => ({
    chemin,
    nom: nomDeFiche(abbr, nn),
    lecture: fiche.lecture,
    entrees: entreesDeLaFiche(abbr, nn, fiche).map((e) => {
      const avecPreuves = { ...e, couvertures: couverturesPar.get(e.id) ?? [], ecartes: ecartesPar.get(e.id) ?? [] }
      return { ...avecPreuves, statut: statut(avecPreuves) }
    }),
  }))

  let out = `# Dossiers de chapitre — état des lieux\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-dossiers-de-chapitre.mjs\` (\`npm run docs:dossiers\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Sources : les fiches \`docs/dossiers/<ABBR>/<NN>.json\` (schéma \`ficheDeDossier\`, \`src/data/source/dossier.ts\`) et les\n`
  out += `> champs \`couvre\` / \`narratif.ecartes\` des paquets mesurés (${paquets.map((p) => `\`${p.paquet}\``).join(', ') || 'aucun'}). Lien : \`docs/campagne-authoring.md\` § 10quinquies.\n\n`
  out += `**Périmètre mesuré / angles morts** — une entrée est « couverte » dès qu'un élément d'un paquet mesuré la cite\n`
  out += `dans \`couvre\`, « écartée » quand aucun ne la cite et qu'un paquet l'écarte avec motif, « non couverte » sinon.\n`
  out += `Ce rendu ne juge pas si l'élément qui couvre une entrée la rend fidèlement, ni si un motif d'écart tient. Une\n`
  out += `entrée non couverte n'est pas une faute : un chapitre non adapté est un état normal. Un paquet hors de la\n`
  out += `liste ci-dessus, bibliothèque locale de l'éditeur comprise, n'est pas lu. Un lien vers une entrée absente\n`
  out += `des fiches rougit \`src/data/dossiers-couverture.test.ts\` et n'apparaît pas ici.\n\n`

  out += `## Synthèse\n\n${TETE_DE_COMPTE('Fiche')}\n`
  for (const f of parFiche) out += `${ligneDeCompte(`[${f.nom}](#${f.nom.toLowerCase()})`, compter(f.entrees))}\n`
  out += `\n`

  for (const f of parFiche) {
    out += `## ${f.nom}\n\n`
    out += `Fiche \`${f.chemin}\`, lue le ${f.lecture.date} (commit \`${f.lecture.commit.slice(0, 9)}\`).\n\n`
    out += `${TETE_DE_COMPTE('Famille')}\n`
    const familles = FAMILLES_DE_DOSSIER.map((famille) => ({ famille, entrees: f.entrees.filter((e) => e.famille === famille) })).filter((x) => x.entrees.length)
    for (const { famille, entrees } of familles) out += `${ligneDeCompte(LIBELLES_DE_FAMILLE[famille], compter(entrees))}\n`
    out += `\n`
    for (const { famille, entrees } of familles) {
      const c = compter(entrees)
      out += `### ${f.nom} · ${LIBELLES_DE_FAMILLE[famille]} — ${c.couverte} couverte(s), ${c['écartée']} écartée(s), ${c['non couverte']} non couverte(s) sur ${c.total}\n\n`
      out += `${entrees.map(ligneDEntree).join('\n')}\n\n`
    }
  }
  return out
}

/** Le corps rendu sur les paquets `paquets` (chemins relatifs au dépôt) et les messages du lanceur, sans rien écrire. */
function rendu(paquets = paquetsDuCommun(RACINE)) {
  const fiches = chargerDossiers()
  const out = rendreEtat(fiches, lirePaquets(paquets))
  return {
    out,
    path: OUT,
    staleMsg: `docs:dossiers — ${OUT} est PÉRIMÉ (diverge des fiches docs/dossiers et des liens couvre / ecartes des paquets mesurés).`,
    rerunMsg: '  → relancer `npm run docs:dossiers` (dérivé jamais commité, #2203).',
    okMsg: `docs:dossiers — OK (${OUT} à jour, ${fiches.length} fiche(s))`,
    writeMsg: `${OUT} — ${fiches.length} fiche(s).`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire, sur les paquets
 *  `paquets`. */
export function rendre(paquets) {
  const { path: cible, out } = rendu(paquets)
  return new Map([[cible, out]])
}

export function* produire() {
  yield rendu()
}

const PAQUETS_EN_ARGUMENTS = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (import.meta.main && PAQUETS_EN_ARGUMENTS.length) process.stdout.write(rendu(PAQUETS_EN_ARGUMENTS).out)
else await lancerDepuisCLI(import.meta, produire)

// État des lieux des dossiers de chapitre (#2290), un par projet qui en a : pour chaque fiche commitée
// `projets/<projet>/dossiers/<ABBR>/<NN>.json` (`chargerDossiers`, scripts/raw/lib/dossiers.mjs), chaque entrée est
// couverte (par quel porteur de quel paquet), écartée (motif) ou non couverte. DÉRIVÉ des `couvre` et
// `narratif.ecartes` des paquets livrés du même projet (`couverturesDuProjet`, src/data/schemas/source/couvertures.ts) — patron
// du champ `Implémente` de l'Atlas (scripts/raw/build-implemente.mjs) : la fiche ne connaît pas le paquet, le paquet la cite.
// Sortie : docs/projets/<projet>/dossiers-de-chapitre.md (cible pure, jamais commitée, #2203), régénérée par
// `npm run <projet>:docs`. Le lanceur des dérivés applique le mode `--check` en CLI et depuis `build-all.mjs`.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lancerDepuisCLI } from './lib/ecriture-derives.mjs'
import { chargerDossiers } from '../raw/lib/dossiers.mjs'
import { dossiersDesProjets } from '../raw/lib/fichiersCitants.mjs'
import { PROJETS_LIVRES } from '../guards/lib/projetsLivres.mjs'
import { cheminsDuCorpus } from '../guards/lib/lister.mjs'
import { porteDuProjet } from '../guards/lib/porteDesProjets.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { entreesDeLaFiche, FAMILLES_DE_DOSSIER, LIBELLES_DE_FAMILLE, nomDeFiche } from '../../src/data/schemas/source/dossier.ts'
import { couverturesDuProjet, nommerPorteur } from '../../src/data/schemas/source/couvertures.ts'

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

/** Le corps rendu, depuis les fiches du dossier `dossier` et les paquets donnés, régénéré par `npm run <commande>`. PUR. */
export function rendreEtat(fiches, paquets, { dossier, commande }) {
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
  out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-dossiers-de-chapitre.mjs\` (\`npm run ${commande}\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Sources : les fiches \`${dossier}/<ABBR>/<NN>.json\` (schéma \`ficheDeDossier\`, \`src/data/schemas/source/dossier.ts\`) et les\n`
  out += `> champs \`couvre\` / \`narratif.ecartes\` des paquets mesurés (${paquets.map((p) => `\`${p.paquet}\``).join(', ') || 'aucun'}). Lien : \`docs/campagne-authoring.md\` § 10quinquies.\n\n`
  out += `**Périmètre mesuré / angles morts** — une entrée est « couverte » dès qu'un élément d'un paquet mesuré la cite\n`
  out += `dans \`couvre\`, « écartée » quand aucun ne la cite et qu'un paquet l'écarte avec motif, « non couverte » sinon.\n`
  out += `Ce rendu ne juge pas si l'élément qui couvre une entrée la rend fidèlement, ni si un motif d'écart tient. Une\n`
  out += `entrée non couverte n'est pas une faute : un chapitre non adapté est un état normal. Un paquet hors de la\n`
  out += `liste ci-dessus, bibliothèque locale de l'éditeur comprise, n'est pas lu. Un lien vers une entrée absente\n`
  out += `des fiches rougit la suite de couverture du projet et n'apparaît pas ici.\n\n`

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

/** Le rendu du projet dont `dossier` (`projets/<projet>/dossiers`, relatif à la racine) porte les fiches, mesuré sur
 *  les paquets livrés du projet, et les messages du lanceur, sans rien écrire. */
function rendu(dossier) {
  const projet = path.posix.dirname(dossier)
  const commande = `${path.posix.basename(projet)}:docs`
  const cible = `docs/${projet}/dossiers-de-chapitre.md`
  const fiches = chargerDossiers(dossier)
  const out = rendreEtat(fiches, lirePaquets(cheminsDuCorpus({ ...PROJETS_LIVRES, dossier: projet }, RACINE, { porte: porteDuProjet(path.posix.basename(projet)) })), { dossier, commande })
  return {
    out,
    path: cible,
    staleMsg: `${commande} — ${cible} est PÉRIMÉ (diverge des fiches ${dossier} et des liens couvre / ecartes des paquets du projet).`,
    rerunMsg: `  → relancer \`npm run ${commande}\` (dérivé jamais commité, #2203).`,
    okMsg: `${commande} — OK (${cible} à jour, ${fiches.length} fiche(s))`,
    writeMsg: `${cible} — ${fiches.length} fiche(s).`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire, une par projet à fiches. */
export function rendre() {
  return new Map([...produire()].map(({ path: cible, out }) => [cible, out]))
}

export function* produire() {
  for (const dossier of dossiersDesProjets(RACINE)) yield rendu(dossier)
}

await lancerDepuisCLI(import.meta, produire)

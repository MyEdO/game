// État des lieux des dossiers de chapitre (#2290) : pour chaque fiche commitée `docs/dossiers/<ABBR>/<NN>.json`
// (`chargerDossiers`, scripts/raw/lib/dossiers.mjs), chaque entrée est couverte (par quel porteur de quel
// projet livré), écartée (motif) ou non couverte. DÉRIVÉ des `couvre` et `narratif.ecartes` des projets
// livrés (`couverturesDuProjet`, src/data/source/couvertures.ts) — patron du champ `Implémente` de l'Atlas
// (scripts/raw/build-implemente.mjs) : la fiche ne connaît pas le paquet, le paquet la cite.
// Sortie : docs/dossiers-de-chapitre.md (cible pure, jamais commitée, #2203).
// Re-run : node scripts/docs/build-dossiers-de-chapitre.mjs (npm run docs:dossiers).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'
import { chargerDossiers } from '../raw/lib/dossiers.mjs'
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_LIVRES } from '../guards/lib/projetsLivres.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { entreesDeLaFiche, FAMILLES_DE_DOSSIER, LIBELLES_DE_FAMILLE, nomDeFiche } from '../../src/data/source/dossier.ts'
import { couverturesDuProjet, nommerPorteur } from '../../src/data/source/couvertures.ts'

const OUT = 'docs/dossiers-de-chapitre.md'

/** Les projets livrés, `{ paquet, lu }` : `paquet` = chemin relatif au corpus, `lu` = ses couvertures.
 *  Le disque suffit : `couvre` et `ecartes` ne sont pas de la prose adressée. */
const lirePaquets = () =>
  listerProjetsLivres().map((rel) => ({
    paquet: rel,
    lu: couverturesDuProjet(JSON.parse(readFileSync(path.join(dossierDesProjetsLivres(), rel), 'utf8'))),
  }))

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
  const corpus = `${PROJETS_LIVRES.dossier}/**/*${PROJETS_LIVRES.suffixe}`

  let out = `# Dossiers de chapitre — état des lieux\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-dossiers-de-chapitre.mjs\` (\`npm run docs:dossiers\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Sources : les fiches \`docs/dossiers/<ABBR>/<NN>.json\` (schéma \`ficheDeDossier\`, \`src/data/source/dossier.ts\`) et les\n`
  out += `> champs \`couvre\` / \`narratif.ecartes\` des projets livrés (\`${corpus}\`). Lien : \`docs/campagne-authoring.md\` § 10quinquies.\n\n`
  out += `**Périmètre mesuré / angles morts** — une entrée est « couverte » dès qu'un élément d'un projet livré la cite\n`
  out += `dans \`couvre\`, « écartée » quand aucun ne la cite et qu'un projet l'écarte avec motif, « non couverte » sinon.\n`
  out += `Ce rendu ne juge pas si l'élément qui couvre une entrée la rend fidèlement, ni si un motif d'écart tient. Une\n`
  out += `entrée non couverte n'est pas une faute : un chapitre non adapté est un état normal. Les projets de la\n`
  out += `bibliothèque locale de l'éditeur, hors \`${PROJETS_LIVRES.dossier}\`, ne sont pas lus. Un lien vers une entrée absente\n`
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

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const fiches = chargerDossiers()
  const out = rendreEtat(fiches, lirePaquets())
  return {
    out,
    path: OUT,
    staleMsg: `docs:dossiers — ${OUT} est PÉRIMÉ (diverge des fiches docs/dossiers et des liens couvre / ecartes des projets livrés).`,
    rerunMsg: '  → relancer `npm run docs:dossiers` (dérivé jamais commité, #2203).',
    okMsg: `docs:dossiers — OK (${OUT} à jour, ${fiches.length} fiche(s))`,
    writeMsg: `${OUT} — ${fiches.length} fiche(s).`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path: cible, out } = rendu()
  return new Map([[cible, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })

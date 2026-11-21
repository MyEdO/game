// LA PAGE DE JUGEMENT DES MAQUETTES (#4585) : `kit-et-dispositions.html` et ses données, tirées d'une passe
// (`sources/passe.mjs`) et des comptes rendus `../*.md`, sous `<sortie>` (`dist/maquettes-page` par défaut, vidé avant) :
//   - `donnees.json` : les familles (un compte rendu chacune, et `dispositions.md`, transverse), les écrans et leurs
//     états (le journal de chaque écran de la passe), les « À valider » rattachés aux états de leur section, les
//     gabarits des états (`sources/maquettes/<écran>.ts`), la table `CADRES` de `sources/rendu.js`, les planches du kit ;
//   - `img/<écran>-<état>.jpg` (1600 de large), `min/` (320) et `kit/<planche>.jpg` (1600), réduits par le Chromium de
//     Playwright, depuis les captures de la passe (`png/`, `png/kit/`) :
//   node scripts/maquettes/page.mjs [<passe>] [--sortie <dossier>]      `<passe>` : `dist/maquettes-passe` par défaut
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

const P = fileURLToPath(new URL('../../hotes/godot/cibles/propositions/', import.meta.url))
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const { values: o, positionals: [cible] } = parseArgs({ allowPositionals: true, options: { sortie: { type: 'string' } } })
const passe = resolve(cible ?? join(DIST, 'maquettes-passe'))
const sortie = resolve(o.sortie ?? join(DIST, 'maquettes-page'))

/** Les états de chaque écran, dans l'ordre de leur rendu : les lignes `<état> erreurs <n>` du journal de la passe. */
const ecrans = {}
for (const f of readdirSync(join(passe, 'log')).filter((f) => f.endsWith('.log') && !f.startsWith('kit-')).sort()) {
  ecrans[f.slice(0, -4)] = readFileSync(join(passe, 'log', f), 'utf8').split('\n').filter((l) => / erreurs \d+/.test(l)).map((l) => l.split(' erreurs')[0])
}
const ecranDeLEtat = {}
for (const [e, etats] of Object.entries(ecrans)) for (const s of etats) {
  if (ecranDeLEtat[s]) throw new Error(`état ${s} dans ${ecranDeLEtat[s]} et ${e} : la page clé les états par leur nom`)
  ecranDeLEtat[s] = e
}
/** Le nom d'un compte rendu vers les états : l'état, l'écran (tous ses états), ou `<écran>-<état>` (`coop-ouvrir`). */
const resoudre = (t) => (ecranDeLEtat[t] || ecrans[t] ? [t]
  : Object.keys(ecrans).filter((e) => t.startsWith(e + '-') && ecranDeLEtat[t.slice(e.length + 1)] === e).map((e) => t.slice(e.length + 1)))

/** Les comptes rendus, dans l'ordre de la page ; `dispositions.md`, transverse, en dernier, ne prend aucun écran. */
const FAMILLES = [
  ['accueil-et-systeme', 'Accueil et système'], ['combat', 'Combat'], ['combat-suite', 'Combat, suite'],
  ['exploration-et-recit', 'Exploration et récit'], ['lieux-et-nuit', 'Lieux et nuit'], ['commerce', 'Commerce'],
  ['voyage', 'Voyage'], ['heros', 'Héros'], ['outils', 'Outils'], ['dispositions', 'Dispositions'],
]
const choix = [], irresolus = []
const familleDeLEcran = {}, nommeDans = {}
for (const [fam] of FAMILLES) {
  const lignes = readFileSync(join(P, `${fam}.md`), 'utf8').split('\n')
  let section = '', etatsDeSection = [], dansListe = false, courant = null
  const clore = () => { if (courant) { courant.texte = courant.texte.replace(/\s+/g, ' ').trim(); choix.push(courant); courant = null } }
  for (const l of lignes) {
    const h = /^(#{1,3})\s+(.*)$/.exec(l)
    if (h) {
      clore()
      section = h[2].trim()
      const tete = section.replace(/\(.*?\)/g, '')
      // le titre du compte rendu (`# Propositions : lieux et nuit`) ne nomme aucun écran : ses choix vont à toute la famille
      const noms = h[1] === '#' ? [] : tete.split(/[,;]| et /).map((s) => s.trim().replace(/[`«»]/g, ''))
      etatsDeSection = noms.flatMap(resoudre)
      for (const n of noms) if (/^[a-z0-9]+(?:-[a-z0-9]+)+$|^[a-z0-9]+$/.test(n) && !resoudre(n).length) irresolus.push(`${fam} · ${section} : ${n}`)
      // l'écran va à la famille dont une section porte son nom (`## fuite`, `## interlude`), sinon à la première qui le cite
      if (fam !== 'dispositions') {
        for (const n of noms) if (ecrans[n]) nommeDans[n] ??= fam
        for (const s of etatsDeSection) familleDeLEcran[ecranDeLEtat[s] ?? s] ??= fam
      }
      dansListe = /à valider/i.test(section)
      continue
    }
    // une section au titre libre (`editeur-scene`) ou au nom de l'écran (`compendium`) déclare son état : « État `porte` de l'écran … »
    const decl = /^- État `([a-z-]+)` de l'écran `([a-z-]+)`/.exec(l)
    const ecranSeul = etatsDeSection.every((s) => ecrans[s] && !ecranDeLEtat[s])
    if (decl && ecranSeul && ecranDeLEtat[decl[1]] === decl[2]) {
      etatsDeSection = [decl[1]]; familleDeLEcran[decl[2]] ??= fam
      for (let i = irresolus.length - 1; i >= 0; i--) if (irresolus[i].startsWith(`${fam} · ${section} :`)) irresolus.splice(i, 1)
    }
    // « - À valider : », « - À valider (#4585) : », le paragraphe « Choix transverses à valider : », et un « À valider : »
    // au fil d'une puce qui n'en est pas un (« Changement voulu … À valider : la cadence … »)
    const av = /^\s*[-*]\s+(?:\*\*)?(?:Choix\s+)?à valider(?:\*\*)?(?:\s*\([^)]*\))?\s*:\s*(.*)$/i.exec(l)
      ?? /^Choix(?: transverses)? à valider\s*:\s*(.*)$/.exec(l)
      ?? (courant ? null : /(?:^|[\s.;])À valider\s*:\s*(.*)$/.exec(l))
    const puce = /^[-*]\s+(.*)$/.exec(l)
    if (av || (dansListe && puce)) {
      clore()
      courant = { famille: fam, section, etats: etatsDeSection.flatMap((s) => (ecrans[s] && !ecranDeLEtat[s] ? ecrans[s] : [s])), texte: av ? av[1] : puce[1] }
    } else if (courant && /^\s+\S/.test(l)) courant.texte += ' ' + l.trim()
    else if (courant && (l.trim() === '' || /^[-*]\s/.test(l))) clore()
    else if (courant && /^\S/.test(l) && !/^[-*]/.test(l)) courant.texte += ' ' + l.trim()
  }
  clore()
}
// un écran sans section rattachée : la famille d'un écran voisin de même préfixe, sinon « autres »
Object.assign(familleDeLEcran, nommeDans)
for (const e of Object.keys(ecrans)) familleDeLEcran[e] ??= 'autres'
choix.forEach((c) => { c.id = `${c.famille}-${createHash('sha1').update(c.section + '\n' + c.texte).digest('hex').slice(0, 10)}` })

const src = readFileSync(join(P, 'sources', 'rendu.js'), 'utf8')
const debut = src.indexOf('const CADRES = {') + 'const CADRES = '.length
let prof = 0, fin = debut
for (; fin < src.length; fin++) { if (src[fin] === '{') prof++; if (src[fin] === '}' && --prof === 0) break }
const cadres = Function(`return ${src.slice(debut, fin + 1)}`)()

// les gabarits de chaque écran, dans l'ordre de ses états (`gabarit` de chaque état de `maquettes/<écran>.ts`)
const gabarits = {}
for (const e of Object.keys(ecrans)) {
  const { default: m } = await import(pathToFileURL(join(P, 'sources', 'maquettes', `${e}.ts`)).href)
  const parNom = Object.fromEntries(m.etats.map((x) => [x.nom, x.gabarit]))
  const manque = ecrans[e].filter((s) => !parNom[s])
  if (manque.length || m.etats.length !== ecrans[e].length) throw new Error(`${e} : journal et maquette divergent (${manque.join(', ')})`)
  gabarits[e] = [...new Set(ecrans[e].map((s) => parNom[s]))]
}
/** Une famille sans écran (`dispositions`) reste quand elle porte des choix. */
const familles = [...FAMILLES, ['autres', 'Autres']].map(([id, titre]) => ({ id, titre, ecrans: Object.keys(ecrans).filter((e) => familleDeLEcran[e] === id) }))
  .filter((f) => f.ecrans.length || choix.some((c) => c.famille === f.id))
const kit = readdirSync(join(passe, 'png', 'kit')).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort()

rmSync(sortie, { recursive: true, force: true })
for (const d of ['img', 'min', 'kit']) mkdirSync(join(sortie, d), { recursive: true })
copyFileSync(join(P, 'page', 'kit-et-dispositions.html'), join(sortie, 'kit-et-dispositions.html'))
writeFileSync(join(sortie, 'donnees.json'), JSON.stringify({ familles, ecrans, choix, cadres, kit, gabarits, cibles: [] }))

/** Les réductions : chaque capture, à la largeur de son dossier, en JPEG de qualité 82, par le Chromium de Playwright. */
const reductions = [
  ...Object.entries(ecrans).flatMap(([e, ss]) => ss.flatMap((s) => [['img', 1600], ['min', 320]].map(([d, l]) => [join(passe, 'png', `${e}-${s}.png`), join(sortie, d, `${e}-${s}.jpg`), l]))),
  ...kit.map((k) => [join(passe, 'png', 'kit', `${k}.png`), join(sortie, 'kit', `${k}.jpg`), 1600]),
]
const b = await chromium.launch({ channel: 'chromium' })
try {
  const p = await b.newPage({ deviceScaleFactor: 1 })
  for (const [png, jpg, largeur] of reductions) {
    const octets = readFileSync(png)
    const hauteur = Math.round((octets.readUInt32BE(20) * largeur) / octets.readUInt32BE(16))
    await p.setViewportSize({ width: largeur, height: hauteur })
    await p.setContent(`<body style="margin:0"><img style="display:block;width:${largeur}px;height:${hauteur}px" src="data:image/png;base64,${octets.toString('base64')}">`)
    await p.locator('img').evaluate((i) => i.decode())
    await p.screenshot({ path: jpg, type: 'jpeg', quality: 82 })
  }
} finally {
  await b.close()
}

const sans = choix.filter((c) => !c.etats.length)
console.log(`[page] ${familles.length} familles, ${Object.keys(ecrans).length} écrans, ${Object.values(ecrans).flat().length} états, ${kit.length} planches, ${reductions.length} images`)
console.log(`[page] ${choix.length} choix, ${sans.length} sans état`)
const parSection = {}
for (const c of sans) (parSection[`${c.famille} · ${c.section}`] ||= []).push(c)
for (const [k, cs] of Object.entries(parSection)) console.log(`[page]   sans état : ${k} (${cs.length})`)
for (const x of irresolus) console.log(`[page]   nom de section irrésolu : ${x}`)
console.log(`[page] ${join(sortie, 'kit-et-dispositions.html')}`)

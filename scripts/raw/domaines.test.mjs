// INTÉGRITÉ du registre des DOMAINES de l'Atlas (`scripts/raw/domaines.json`, #1825 lot F0b) : une
// clé de domaine est une PROMESSE sur le disque (la fiche `docs/raw/<coeur>/<cle>.md`), et un cœur
// une PROMESSE sur le registre des livres — deux choses qu'un schéma ne peut pas tenir. La garde vit
// donc ici, à côté de celle des chapitres (`chapitres.test.mjs`), et tourne sous `npm run test:raw`.
//
// Le CONTRAT : tout cœur déclaré est un cœur du registre des livres (l'inverse n'est PAS exigé — un
// cœur peut exister au registre avant que ses domaines ne soient cadrés) ; chaque entrée porte
// EXACTEMENT son jeu de clés ; tout domaine déclaré a sa fiche OU porte le `ticket` qui doit son
// EXTRACTION, jamais les deux ; toute fiche a son domaine ; et AUCUN consommateur ne reçoit une
// forme où deux cœurs coexistent par `cle` — une clé est une AIRE DOCUMENTAIRE, jamais une
// affirmation d'identité mécanique entre deux corps de règles.
//
// Une aire CADRÉE SANS fiche est donc déclarable : la carte d'un cœur existe ENTIÈRE avant
// sa première fiche (c'est elle qui BORNE chaque domaine contre les autres au cadrage du workflow).
// La marque `ticket` se RETIRE dans le commit qui publie la fiche — une seule vérité, tenue ici.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as lib from './_lib.mjs'
import { coeursDeDomaines, coeursDuRegistre, domainesDe, pagesDeLAtlas, readText } from './_lib.mjs'
import { listerArbre } from '../guards/lib/lister.mjs'
import { enTeteDeFiche } from './assemble-domain.mjs'
import { RAWDIR } from './build-atlas-index.mjs'

// Ce banc est LUI-MÊME au corpus du détecteur de lecteurs : le nom du registre s'y compose en
// morceaux, sans quoi chaque message d'assertion le dénoncerait comme un second lecteur.
const NOM_REGISTRE = ['domaines', 'json'].join('.')
const REGISTRE = `scripts/raw/${NOM_REGISTRE}`

const COEURS = coeursDeDomaines()
/** `<coeur>/<cle>` → l'entrée : la clé de jointure porte SON cœur, jamais la `cle` nue. */
const DECLARES = new Map(COEURS.flatMap((c) => domainesDe(c).map((d) => [`${c}/${d.cle}`, { ...d, coeur: c }])))

test('#1825 : tout cœur porteur de domaines est un cœur du registre des livres', () => {
  const connus = coeursDuRegistre()
  const inconnus = COEURS.filter((c) => !connus.includes(c))
  assert.deepEqual(
    inconnus,
    [],
    `un cœur de \`${NOM_REGISTRE}\` est une clé \`coeur\` de src/data/books.json — cœurs du registre : ${connus.join(', ')}`,
  )
})

// JEU DE CLÉS FERMÉ, EXACT : sans lui une faute de frappe est SILENCIEUSE — un `titre` écrit `title`
// rendrait une ligne d'index sans libellé et un prompt de workflow sans domaine nommé, sans un mot.
const CLES = { obligatoires: ['cle', 'titre'], facultatives: ['ticket'] }
/** La `cle` NOMME un fichier : elle est en minuscules sans accent, mots séparés par un tiret. */
const FORME_DE_CLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Un `ticket` DÉSIGNE une issue, à la MÊME graphie que celui du manifeste RAW : `#<numéro>`. */
const FORME_DE_TICKET = /^#\d+$/
/** Un `#` dans un `titre` serait lu comme un ticket PORTÉ par le registre : le scanner d'octets du
 *  hook de fermeture (`evaluateRegistresPorteurs`, `scripts/git-hooks/porte-du-commit.mjs`) y verrait `#N` et refuserait de fermer une issue qui
 *  n'a rien à voir — un refus incompréhensible, sur une cause invisible. Un titre de fiche n'a
 *  aucun besoin de `#` : la contrainte ne coûte rien. */
const MARQUE_DE_TICKET = /#/

/** Les fiches de l'Atlas, `<coeur>/<cle>.md` — la promesse sur le disque qu'une entrée tient. */
const FICHES = new Set(pagesDeLAtlas(RAWDIR, { classes: ['fiche'] }).map((p) => p.relatif))
const aSaFiche = (d) => FICHES.has(`${d.coeur}/${d.cle}.md`)

test('#1825 : chaque domaine porte EXACTEMENT son jeu de clés, et une `cle` qui nomme un fichier', () => {
  const admises = new Set([...CLES.obligatoires, ...CLES.facultatives])
  const fautes = []
  for (const coeur of COEURS) {
    const vues = new Set()
    for (const d of domainesDe(coeur)) {
      const ou = `${coeur} — ${JSON.stringify(d.cle ?? d)}`
      for (const k of Object.keys(d)) if (!admises.has(k)) fautes.push(`${ou} — clé INCONNUE \`${k}\``)
      for (const k of CLES.obligatoires) if (!(k in d)) fautes.push(`${ou} — clé MANQUANTE \`${k}\``)
      for (const k of Object.keys(d)) if (typeof d[k] !== 'string' || !d[k].trim()) fautes.push(`${ou} — \`${k}\` doit être une chaîne non vide`)
      if (typeof d.cle === 'string' && !FORME_DE_CLE.test(d.cle)) fautes.push(`${ou} — \`cle\` hors forme : minuscules, chiffres et tirets`)
      if (typeof d.ticket === 'string' && !FORME_DE_TICKET.test(d.ticket)) fautes.push(`${ou} — \`ticket\` hors forme : \`#<numéro>\``)
      if (typeof d.titre === 'string' && MARQUE_DE_TICKET.test(d.titre)) fautes.push(`${ou} — \`titre\` porte un \`#\` : le scanner du hook de fermeture y lirait un ticket PORTÉ`)
      if (vues.has(d.cle)) fautes.push(`${ou} — \`cle\` en DOUBLON dans son cœur`)
      vues.add(d.cle)
    }
  }
  assert.deepEqual(fautes, [], `jeu de clés violé :\n${fautes.join('\n')}`)
})

test('#1825 : tout domaine déclaré a sa fiche sous le dossier de son cœur, ou porte le `ticket` qui la doit', () => {
  const muets = [...DECLARES.values()]
    .filter((d) => !aSaFiche(d) && !d.ticket)
    .map((d) => `${d.coeur}/${d.cle}.md — déclaré au registre, absent de l'Atlas, sans \`ticket\``)
  assert.deepEqual(
    muets,
    [],
    `une aire sans fiche est une DETTE d'extraction : son \`ticket\` la porte, et l'index de son cœur `
      + `la rend alors SANS lien (un lien vers une fiche absente serait MORT) :\n${muets.join('\n')}`,
  )
})

test('#1825 : un domaine qui A sa fiche ne porte PLUS de `ticket` d’extraction', () => {
  const doubles = [...DECLARES.values()]
    .filter((d) => d.ticket && aSaFiche(d))
    .map((d) => `${d.coeur}/${d.cle} — fiche publiée ET \`ticket\` ${d.ticket}`)
  assert.deepEqual(
    doubles,
    [],
    `la dette d'EXTRACTION s'éteint quand la fiche existe : la marque se retire dans le commit de la `
      + `fiche, sans quoi deux vérités cohabitent (et le ticket porteur ne peut plus se fermer) :\n${doubles.join('\n')}`,
  )
})

test('#1825 : toute fiche de l’Atlas a son domaine déclaré au registre', () => {
  const orphelines = pagesDeLAtlas(RAWDIR, { classes: ['fiche'] })
    .filter((p) => !DECLARES.has(p.relatif.replace(/\.md$/, '')))
    .map((p) => `${p.relatif} — aucune entrée dans ${REGISTRE}`)
  assert.deepEqual(
    orphelines,
    [],
    `une fiche hors registre n'est citée par aucun index et n'entre dans aucun lot d'extraction :\n${orphelines.join('\n')}`,
  )
})

// TITRE d'un domaine : UNE source de vérité, la FICHE — c'est l'artefact que le lecteur voit, et le
// `titre` du registre n'en est que la projection (index du cœur, prompts du workflow). L'en-tête se
// fabrique par `enTeteDeFiche` (`assemble-domain.mjs`), qui l'ÉCRIT à l'assemblage : le préfixe ne
// s'écrit donc qu'une fois, et une fiche assemblée passe la garde par construction.
test('#1825 : la première H1 d’une fiche est EXACTEMENT l’en-tête de son titre déclaré', () => {
  const ecarts = [...DECLARES.values()]
    .filter(aSaFiche)
    .map((d) => {
      const attendu = enTeteDeFiche(d.titre)
      const premiere = readText(join(RAWDIR, d.coeur, `${d.cle}.md`)).split('\n').find((l) => l.startsWith('# '))
      return premiere === attendu ? null : `${d.coeur}/${d.cle}.md — H1 « ${premiere ?? '(aucune)'} » ≠ « ${attendu} »`
    })
    .filter(Boolean)
  assert.deepEqual(
    ecarts,
    [],
    `la fiche fait foi : aligner le \`titre\` de ${REGISTRE} sur le suffixe de la H1 (jamais l'inverse) :\n${ecarts.join('\n')}`,
  )
})

// --- PORTÉE : aucun code ne joint deux cœurs par `cle` ---
// Tenue par la FORME, pas par une promesse : personne ne reçoit une forme où deux cœurs coexistent.
// `domainesDe` rend les domaines d'UN cœur ; `coeursDeDomaines` ne rend que des noms de cœur. Un
// consommateur qui voudrait comparer deux cœurs devrait donc construire lui-même sa jointure — ce
// que rien dans le dépôt ne fait, et que la limite ci-dessous rend VISIBLE au lieu de tacite.
//
// CE QUE LA GARDE VISE, dit au site : un module de CODE qui nomme le registre, donc qui lit sa
// TABLE et pourrait en joindre deux cœurs. Un scanner d'OCTETS qui reçoit un chemin par la DONNÉE
// (`scripts/hooks/registres-porteurs.json` : y cherche-t-on `#N` ?) n'ouvre aucune entrée, ne
// connaît ni `cle` ni `coeur`, et ne peut rien joindre — il n'est pas un lecteur de la table. C'est
// la DONNÉE qui le lui désigne, et le détecteur ci-dessous ne scanne que du CODE : un module qui
// nommerait le registre, lui, rougit toujours (le banc du détecteur le mesure).
const EXTENSIONS_DE_CODE = /\.(mjs|js|cjs|mts|ts|tsx)$/
/** Les fichiers de DONNÉE — hors corpus du détecteur, par construction : ils ne s'exécutent pas. */
const EXTENSION_DE_DONNEE = /\.json$/
const LECTEUR_UNIQUE = 'scripts/raw/_lib.mjs'

/** Le source SANS ses commentaires : un module qui PARLE du registre ne le lit pas. `//` précédé de
 *  `:` reste (une URL n'est pas un commentaire). */
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/.*$/gm, '$1')

/** Le module NOMME-t-il le registre hors commentaire ? Le NOM DE FICHIER NU suffit : un `from`, un
 *  `require`, un `readFileSync`, un `createRequire` ou un chemin passé à un lecteur le portent tous,
 *  et un nom de registre dans du code n'a pas d'autre usage que de le lire. Ce que la garde NE VOIT
 *  PAS, et que le banc montre : un chemin ASSEMBLÉ à l'exécution. */
const nommeLeRegistre = (src) => sansCommentaires(src).includes(NOM_REGISTRE)

test(`#1825 : \`${NOM_REGISTRE}\` n’a qu’UN lecteur — \`_lib.mjs\``, () => {
  const lecteurs = ['scripts', 'src']
    .flatMap((racine) => listerArbre(racine, { filtre: (rel) => EXTENSIONS_DE_CODE.test(rel) }).map((rel) => `${racine}/${rel}`))
    .filter((chemin) => chemin !== LECTEUR_UNIQUE && nommeLeRegistre(readFileSync(chemin, 'utf8')))
  assert.deepEqual(
    lecteurs,
    [],
    `un second lecteur du registre des domaines pourrait en joindre deux cœurs par \`cle\` : passer par \`domainesDe(coeur)\` :\n${lecteurs.join('\n')}`,
  )
})

test('#1825 : le détecteur de lecteur MORD sur un nom de registre nu, et PAS sur une mention en prose', () => {
  const lus = [
    `import registre from './${NOM_REGISTRE}' with { type: 'json' }`,
    `const brut = readFileSync(join(ICI, '${NOM_REGISTRE}'), 'utf8')`,
    `const registre = createRequire(import.meta.url)('../raw/${NOM_REGISTRE}')`,
    `const CHEMIN = '${REGISTRE}'`,
  ]
  assert.deepEqual(lus.filter((s) => !nommeLeRegistre(s)), [], 'un nom de registre nu dans du CODE doit être VU')
  // Les deux premiers leurres disent la FRONTIÈRE (la prose ne lit rien) ; le troisième dit la
  // COUVERTURE qui manque : un chemin assemblé à l'exécution passe sous la garde.
  const leurres = [
    `// le vocabulaire des domaines vit dans ${REGISTRE}`,
    `/* ${NOM_REGISTRE} : lu par _lib.mjs, et par lui seul */`,
    `const chemin = join(ICI, ['domaines', 'json'].join('.'))`,
  ]
  assert.deepEqual(leurres.filter((s) => nommeLeRegistre(s)), [], 'une mention en commentaire n’est pas une lecture')
})

// La LISTE des registres porteurs de ticket est de la DONNÉE : c'est elle, pas du code, qui désigne
// ce registre au scanner d'octets du hook de fermeture. Le banc dit les DEUX bords de la frontière —
// la donnée passe (elle ne s'exécute pas, et le corpus du détecteur est fait d'extensions de CODE),
// un module qui nommerait le registre rougit toujours.
const LISTE_DES_PORTEURS = 'scripts/hooks/registres-porteurs.json'

test('#1825 : la liste des registres PORTEURS désigne le registre en DONNÉE — hors du corpus scanné', () => {
  const brut = readFileSync(LISTE_DES_PORTEURS, 'utf8')
  assert.ok(brut.includes(NOM_REGISTRE), `${LISTE_DES_PORTEURS} doit désigner le registre des domaines`)
  assert.equal(EXTENSIONS_DE_CODE.test(LISTE_DES_PORTEURS), false, 'un JSON n’est pas du code scanné')
  assert.equal(EXTENSION_DE_DONNEE.test(LISTE_DES_PORTEURS), true)
  const scannes = ['scripts', 'src']
    .flatMap((racine) => listerArbre(racine, { filtre: (rel) => EXTENSIONS_DE_CODE.test(rel) }).map((rel) => `${racine}/${rel}`))
  assert.equal(scannes.includes(LISTE_DES_PORTEURS), false, 'la donnée ne doit pas entrer au corpus du détecteur')
  // La garde N'EST PAS affaiblie : le MÊME chemin écrit dans du CODE reste vu.
  assert.equal(nommeLeRegistre(`const CHEMIN = 'scripts/raw/${NOM_REGISTRE}'`), true)
})

test('#1825 : aucun export de `_lib.mjs` ne rend une forme où deux cœurs coexistent par `cle`', () => {
  const coeurs = new Set(COEURS)
  const fuites = []
  for (const [nom, valeur] of Object.entries(lib)) {
    const cles = valeur instanceof Map ? [...valeur.keys()]
      : (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) ? Object.keys(valeur)
        : []
    if (cles.length && cles.every((k) => coeurs.has(k))) fuites.push(nom)
  }
  assert.deepEqual(
    fuites,
    [],
    `ces exports rendent la table des domaines keyée par cœur — un consommateur pourrait y joindre ` +
      `deux cœurs par \`cle\`, alors qu'une clé est une AIRE DOCUMENTAIRE :\n${fuites.join('\n')}`,
  )
})

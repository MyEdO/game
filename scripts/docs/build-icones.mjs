/**
 * Génère docs/ajouter-une-icone.md — recette d'ajout d'une icône + état du registre.
 * La part FACTUELLE (familles et ids du registre, charte de dessin lue au fichier étalon,
 * signatures des 3 rendus, entrée `ICON_FAMILIES` de gen-registry.mjs, données JSON porteuses
 * d'une icône, périmètre et glyphes tolérés du garde anti-emoji) est DÉRIVÉE des fichiers réels,
 * fail-fast si l'un disparaît ; la part ÉDITORIALE (pourquoi passer par le registre, quoi vérifier
 * avant de committer) vit ICI, en dur.
 *
 * Patron retenu : « éditorial EN DUR dans le générateur » (scripts/docs/build-sources-vf.mjs) —
 * aucun manifeste d'iconographie n'existe, et la charte de dessin est DÉJÀ écrite en tête de
 * `src/ui/icons/defs/action.ts` : elle se cite depuis là, elle ne se recopie pas.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-icones.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import { ALLOWED_CHARS } from '../guards/lib/emojiAffordance.mjs'

const OUTIL = 'build-icones'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}

function lire(p) {
  if (!existsSync(p)) abandon(`fichier « ${p} » introuvable (déplacé/supprimé ?)`)
  return readFileSync(p, 'utf8')
}

/** Première capture d'un motif, fail-fast (une constante déplacée casse ici, pas dans le .md). */
function capture(texte, motif, quoi, ou) {
  const m = texte.match(motif)
  if (!m) abandon(`${quoi} introuvable dans ${ou} (renommé/déplacé ?)`)
  return m[1]
}

// ── Registre : familles et ids ───────────────────────────────────────────────────────────────────

const REGISTRE = lire('src/ui/icons/_registry.generated.ts')
const IDS = [...REGISTRE.matchAll(/^\s*\|\s*'([a-z0-9-]+)\/([a-z0-9-]+)'$/gm)].map((m) => ({
  famille: m[1],
  id: `${m[1]}/${m[2]}`,
}))
if (!IDS.length) abandon("l'union `IconIdGenerated` de src/ui/icons/_registry.generated.ts est vide ou illisible")

const PAR_FAMILLE = new Map()
for (const { famille, id } of IDS) {
  if (!PAR_FAMILLE.has(famille)) PAR_FAMILLE.set(famille, [])
  PAR_FAMILLE.get(famille).push(id)
}
const FAMILLES = [...PAR_FAMILLE.keys()].sort()

const FICHIERS_DEFS = listerDossier('src/ui/icons/defs')
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
for (const f of FAMILLES) {
  if (!FICHIERS_DEFS.includes(f)) abandon(`famille « ${f} » de l'union sans fichier src/ui/icons/defs/${f}.ts`)
}

const TOUS_LES_IDS = new Set(IDS.map((i) => i.id))

// ── Charte de dessin : bloc VERBATIM du fichier étalon ───────────────────────────────────────────

const ACTION = lire('src/ui/icons/defs/action.ts')
const CHARTE = capture(
  ACTION,
  /\/\*\s*[═]+\s*CHARTE D'ICONOGRAPHIE[^\n]*\n([\s\S]*?)\n\s*[═]+\s*\*\//,
  "le bloc « CHARTE D'ICONOGRAPHIE »",
  'src/ui/icons/defs/action.ts',
)
  .split('\n')
  .map((l) => l.replace(/^\s{3}/, '').trimEnd())
  .filter((l) => l.trim() !== '')
  .join('\n')

const CONSTANTES_TRAIT = [...ACTION.matchAll(/\/\*\*([^*]+)\*\/\n(const (?:K|KF|F) = '[^']+';)/g)].map(
  (m) => `// ${m[1].trim()}\n${m[2]}`,
)
if (CONSTANTES_TRAIT.length !== 3) {
  abandon(`src/ui/icons/defs/action.ts ne déclare plus les 3 constantes de trait K/KF/F (${CONSTANTES_TRAIT.length} vue(s))`)
}

// ── Nommage : la regex de la garde, jamais une recopie ───────────────────────────────────────────

const ICONS_TEST = lire('src/ui/icons/icons.test.ts')
const KEBAB = capture(ICONS_TEST, /const kebab = (\/[^\n]+\/);/, 'la regex de nommage `kebab`', 'src/ui/icons/icons.test.ts')
const COULEURS_OK = capture(
  ICONS_TEST,
  /expect\(\[([^\]]+)\],\s*`\$\{d\.id\}/,
  'la liste des valeurs de couleur admises',
  'src/ui/icons/icons.test.ts',
)
  .split(',')
  .map((s) => s.trim().replace(/^'|'$/g, ''))

const TITRES_ICONS_TEST = [...ICONS_TEST.matchAll(/\bit\('([^']+)'/g)].map((m) => m[1])

// ── Les 3 rendus ─────────────────────────────────────────────────────────────────────────────────

const ICON_TSX = lire('src/ui/Icon.tsx')
const SIZES = capture(ICON_TSX, /const SIZES = \{([^}]+)\}/, 'la table `SIZES`', 'src/ui/Icon.tsx')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function signature(nom) {
  const m = ICON_TSX.match(new RegExp(`export function ${nom}\\(([\\s\\S]*?)\\)\\s*(?::[^{]+)?\\{`))
  if (!m) abandon(`export « ${nom} » introuvable dans src/ui/Icon.tsx`)
  return m[1].replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')
}

const RENDUS = [
  {
    contexte: 'Composant React HTML',
    primitive: `\`Icon(${signature('Icon')})\``,
    detail: `\`<svg viewBox="0 0 24 24">\`, tailles nommées ${SIZES.map((s) => `\`${s}\``).join(' / ')} px`,
  },
  {
    contexte: 'Contexte SVG existant (pion iso, carte du monde, FX)',
    primitive: `\`IconG(${signature('IconG')})\``,
    detail: '`<g transform="translate(x,y) scale(size/24)">`, couleur via `currentColor` posé sur un ancêtre',
  },
  {
    contexte: 'Fragment brut (scripts SSR/galeries)',
    primitive: `\`iconSvg(${signature('iconSvg')}): string\``,
    detail: 'retourne le fragment `svg` de la def, seul',
  },
]

// ── Entrée du générateur de registres ────────────────────────────────────────────────────────────

const GEN = lire('scripts/gen-registry.mjs')
const ENTREE = (() => {
  const lignes = GEN.split('\n')
  const i = lignes.findIndex((l) => l.includes("arrayName: 'ICON_FAMILIES'"))
  if (i === -1) abandon("l'entrée `ICON_FAMILIES` introuvable dans scripts/gen-registry.mjs (renommée/déplacée ?)")
  let debut = i
  while (debut > 0 && !/^\s*\{\s*$/.test(lignes[debut])) debut -= 1
  let fin = i
  while (fin < lignes.length - 1 && !/^\s*\},?\s*$/.test(lignes[fin])) fin += 1
  return lignes.slice(debut, fin + 1).join('\n')
})()
const CHAMPS_ENTREE = Object.fromEntries(
  [...ENTREE.matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
)
for (const requis of ['dir', 'out', 'arrayName']) {
  if (!CHAMPS_ENTREE[requis]) abandon(`l'entrée ICON_FAMILIES de gen-registry.mjs n'a plus de champ « ${requis} »`)
}
const UNION = capture(ENTREE, /idUnion: \{ typeName: '([^']+)'/, "le `typeName` de l'union d'ids ICON_FAMILIES", 'scripts/gen-registry.mjs')

const TYPES_TS = lire('src/ui/icons/types.ts')
const ALIAS_ID = capture(TYPES_TS, /export type (IconId) =/, "l'alias `IconId`", 'src/ui/icons/types.ts')
const ID_INPUT = capture(TYPES_TS, /export type IconIdInput = ([^;]+);/, "l'alias `IconIdInput`", 'src/ui/icons/types.ts').trim()

// ── Données JSON porteuses d'une icône ───────────────────────────────────────────────────────────

const DATA_ICONES = listerDossier('src/data')
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const brut = lire(`src/data/${f}`)
    const refs = new Set(
      [...brut.matchAll(/"icon"\s*:\s*"([^"]+)"/g)].map((m) => m[1]).filter((id) => TOUS_LES_IDS.has(id)),
    )
    const fantomes = new Set(
      [...brut.matchAll(/"icon"\s*:\s*"([^"]+)"/g)].map((m) => m[1]).filter((id) => !TOUS_LES_IDS.has(id)),
    )
    return { fichier: f, refs: refs.size, fantomes: [...fantomes] }
  })
  .filter((d) => d.refs > 0 || d.fantomes.length > 0)

// Cas de `data-wellformed.test.ts` qui résolvent une icône dans ICON_DEFS (numérotation mesurée).
const WELLFORMED = lire('src/data/data-wellformed.test.ts')
const CAS_ICONE = (() => {
  const blocs = [...WELLFORMED.matchAll(/\bit\(\s*(["'`])([\s\S]*?)\1/g)]
  const titres = []
  for (let i = 0; i < blocs.length; i += 1) {
    const debut = blocs[i].index
    const fin = i + 1 < blocs.length ? blocs[i + 1].index : WELLFORMED.length
    if (WELLFORMED.slice(debut, fin).includes('ICON_DEFS')) titres.push(blocs[i][2].replace(/\s+/g, ' '))
  }
  if (!titres.length) abandon('aucun cas de src/data/data-wellformed.test.ts ne résout plus une icône dans ICON_DEFS')
  return titres
})()

// ── Garde anti-emoji ─────────────────────────────────────────────────────────────────────────────

const EMOJI_LIB = lire('scripts/guards/lib/emojiAffordance.mjs')
const PLAGES = [...EMOJI_LIB.matchAll(/\[(0x[0-9a-f]+), (0x[0-9a-f]+)\],\s*\/\/ (.+)/g)].map((m) => ({
  de: m[1],
  a: m[2],
  quoi: m[3].trim(),
}))
if (!PLAGES.length) abandon('les plages `EMOJI_RANGES` de scripts/guards/lib/emojiAffordance.mjs sont illisibles')

const NO_EMOJI = lire('src/ui/no-emoji-affordance.test.ts')
const EXCLUSIONS = capture(
  NO_EMOJI,
  /\/\*\* Exclusions par NATURE([\s\S]*?)\*\/\nconst EXCLUDED/,
  'le bloc « Exclusions par NATURE »',
  'src/ui/no-emoji-affordance.test.ts',
)
  .split('\n')
  .map((l) => l.replace(/^\s*\*\s?/, '').trimEnd())
  .filter((l) => l.trim() !== '')
  .join('\n')
/** L'affirmation « couverture EXHAUSTIVE, sans liste opt-in » du § 7 est un fait d'ÉTAT de la garde :
 *  elle ne tient que tant qu'aucun STOCK d'exceptions n'y est déclaré. On ne l'écrit donc pas de
 *  confiance — on la VÉRIFIE aux identifiants déclarés/importés par la garde, et le générateur rougit
 *  nominativement si l'un d'eux nomme un cliquet, un stock ou une liste d'exceptions. */
const CONCEPTS_DE_STOCK = /EXCEPTION|CLIQUET|RATCHET|STOCK|ALLOWLIST|WHITELIST|WAIVER|OPT_?IN/i
const IDENTIFIANTS_GARDE = [
  ...NO_EMOJI.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g),
  ...NO_EMOJI.matchAll(/\bimport\s+(?:type\s+)?\{([^}]+)\}/g),
].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()))
for (const nom of IDENTIFIANTS_GARDE) {
  if (CONCEPTS_DE_STOCK.test(nom)) {
    abandon(
      `src/ui/no-emoji-affordance.test.ts déclare « ${nom} » : la garde porte de nouveau un STOCK d'exceptions, donc le § 7 de docs/ajouter-une-icone.md ne peut plus annoncer une couverture EXHAUSTIVE sans liste opt-in. Retirer le stock, ou réécrire ce § avant de régénérer.`,
    )
  }
}

const RACINE_SCAN = capture(NO_EMOJI, /const SRC = '([^']+)'/, 'la racine de scan `SRC`', 'src/ui/no-emoji-affordance.test.ts')
/** Les extensions que la garde demande à `readCorpus` (`exts: ['.ts', '.tsx', '.json']`), rendues en
 *  la forme que le § 7 affiche — un motif de fin de nom, comme la garde le lit. */
const EXTENSIONS_SCAN = `/\\.(${capture(
  NO_EMOJI,
  /exts: \[([^\]]+)\]/,
  'les extensions de `readCorpus`',
  'src/ui/no-emoji-affordance.test.ts',
)
  .split(',')
  .map((e) => e.trim().replace(/^'\.?|'$/g, ''))
  .join('|')})$/`

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const lignesFamilles = FAMILLES.map(
  (f) =>
    `| \`${f}\` | \`src/ui/icons/defs/${f}.ts\` | ${PAR_FAMILLE.get(f).length} | ${PAR_FAMILLE.get(f)
      .slice(0, 3)
      .map((i) => `\`${i}\``)
      .join(', ')}${PAR_FAMILLE.get(f).length > 3 ? ' …' : ''} |`,
).join('\n')

const lignesRendus = RENDUS.map((r) => `| ${r.contexte} | ${r.primitive} | ${r.detail} |`).join('\n')

const lignesData = DATA_ICONES.map(
  (d) =>
    `| \`src/data/${d.fichier}\` | ${d.refs} | ${
      d.fantomes.length ? `⚠️ ${d.fantomes.map((x) => `\`${x}\``).join(', ')}` : '—'
    } |`,
).join('\n')

const lignesPlages = PLAGES.map((p) => `- \`${p.de}\`–\`${p.a}\` — ${p.quoi}`).join('\n')

const out = `# Ajouter une icône (et bannir les émojis)

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-icones.mjs\` (\`npm run docs:icones\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUS aux fichiers réels : l'union \`${UNION}\` de
\`src/ui/icons/_registry.generated.ts\` (familles, ids, comptes), la charte de dessin et les
constantes de trait de \`src/ui/icons/defs/action.ts\`, la regex de nommage et les couleurs admises
de \`src/ui/icons/icons.test.ts\`, les signatures des trois rendus de \`src/ui/Icon.tsx\`, l'entrée
\`ICON_FAMILIES\` de \`scripts/gen-registry.mjs\`, les valeurs \`"icon"\` des \`src/data/*.json\`, et le
périmètre + les glyphes tolérés du garde anti-emoji
(\`scripts/guards/lib/emojiAffordance.mjs\`, \`src/ui/no-emoji-affordance.test.ts\`) — dont l'ABSENCE de
stock d'exceptions, contrôlée aux identifiants déclarés/importés par cette garde. **Angles morts** :
le comptage d'icônes en DONNÉE est textuel (clé \`"icon"\` d'un JSON de \`src/data/\`) — une icône
référencée sous un AUTRE nom de champ, ou depuis du TS, n'est pas comptée ici (la garde de
\`src/data/data-wellformed.test.ts\`, elle, résout vraiment) ; la QUALITÉ d'un dessin (lisibilité à
14 px, unicité de métaphore) ne se mesure pas — elle se juge à la galerie QC ; les conseils de
geste sont de l'ÉDITORIAL fixé dans le script.

Toute AFFORDANCE de l'UI (bouton, badge, libellé d'action, icône de donnée JSON) passe par le
**registre auto-collecté** \`src/ui/icons/\` : 1 famille d'icônes = 1 fichier dans
\`${CHAMPS_ENTREE.dir}/<famille>.ts\`, ramassé par \`npm run gen\` (câblé dans \`npm run build\`).
**Aucune table centrale à éditer.** Plus jamais d'emoji dans le code ou la donnée — garde
\`src/ui/no-emoji-affordance.test.ts\`.

## 0. Le registre : familles existantes

**${FAMILLES.length} familles, ${IDS.length} icônes.** Chercher d'abord si l'icône voulue existe déjà ;
n'ajouter une entrée que si aucune n'exprime le concept.

| Famille | Fichier de def | Icônes | Exemples d'ids |
|---|---|---|---|
${lignesFamilles}

## 1. Choisir la famille et l'id

Un id = \`famille/nom\` en kebab-case — la garde \`src/ui/icons/icons.test.ts\` applique
\`${KEBAB}\`. Créer une NOUVELLE famille seulement si le concept ne rentre dans aucune des
${FAMILLES.length} existantes — sinon ajouter l'entrée au fichier de famille pertinent.

## 2. Dessiner la def

\`\`\`ts
// ${CHAMPS_ENTREE.dir}/<famille>.ts
${CONSTANTES_TRAIT.join('\n')}

export const ${CHAMPS_ENTREE.exportName ?? 'icons'}: ${CHAMPS_ENTREE.type ?? 'IconFamily'} = [
  {
    id: 'famille/nom',
    label: 'Libellé FR',           // tooltip par défaut, galerie QC
    svg: \`<path \${F} d="…"/>\`,     // contenu INTERNE d'un viewBox 0 0 24 24
  },
  // … reste de la famille
];
\`\`\`

**Charte de dessin** — bloc en tête de \`src/ui/icons/defs/action.ts\`, référence pour toutes les
familles, cité ici tel quel :

> ${CHARTE.split('\n').join('\n> ')}

Couleur : la garde n'accepte que ${COULEURS_OK.map((c) => `\`${c}\``).join(', ')} pour tout
\`fill\`/\`stroke\` — **jamais de hex**.

## 3. Régénérer le registre

\`\`\`
npm run gen
\`\`\`

Réécrit \`${CHAMPS_ENTREE.out}\` (import explicite de chaque fichier de \`${CHAMPS_ENTREE.dir}\` +
union de littéraux \`${UNION}\`, dérivée des champs \`id: '…'\` — script générique
\`scripts/gen-registry.mjs\`, entrée \`${CHAMPS_ENTREE.arrayName}\`). Auto en dev (plugin Vite) et
câblé dans \`npm run build\` — mais lancer la commande à la main après un ajout pour vérifier le
compteur de fichiers (\`${CHAMPS_ENTREE.arrayName} ← N fichiers\`) et committer le fichier généré à jour.

Le nouvel id devient un littéral du type fermé \`${ALIAS_ID}\` (\`src/ui/icons/types.ts\`) — un id
inventé côté TS ne compile pas.

## 4. Les 3 rendus (\`src/ui/Icon.tsx\`)

| Contexte | Primitive | Détail |
|---|---|---|
${lignesRendus}

Les trois throw en DEV sur un id inconnu (\`import.meta.env?.DEV\` — \`?.\` car \`import.meta.env\`
n'existe pas sous \`tsx\`), en nommant le geste : déposer une def dans \`${CHAMPS_ENTREE.dir}/\` puis
\`npm run gen\`. Pas de repli muet ; en prod (non-DEV), \`Icon\`/\`IconG\` rendent \`null\`/\`''\`.

\`IconIdInput\` (\`src/ui/icons/types.ts\`) = \`${ID_INPUT}\` : les 3 primitives acceptent aussi un
\`string\` brut porté par la DONNÉE JSON, pas seulement l'union typée — l'autocomplete reste côté
code authoré en TS, la validation se fait au rendu.

## 5. Icône portée par une DONNÉE (JSON)

Toute affordance de contenu (\`src/data/*.json\`) référence une icône par **id de chaîne**, jamais
un émoji :

\`\`\`json
{ "id": "…", "icon": "${IDS[0].id}", … }
\`\`\`

Fichiers de \`src/data/\` qui portent une clé \`"icon"\` :

| Fichier | Ids d'icônes distincts | Hors registre |
|---|---|---|
${lignesData}

Gardes correspondantes dans \`src/data/data-wellformed.test.ts\` (chaque \`icon\` doit résoudre dans
\`ICON_DEFS\`) :

${CAS_ICONE.map((t) => `- « ${t} »`).join('\n')}

## 6. QC visuel

\`\`\`
npx tsx scripts/gen-icon-gallery.mts
\`\`\`

Génère une galerie HTML (dans \`npm run galleries\`) : chaque icône rendue aux tailles canon
(${SIZES.map((s) => s.split(':')[1].trim()).join('/')}) + loupe, groupée par famille — vérifier la
lisibilité à la plus petite taille et l'absence de couleur en dur AVANT de committer.

## 7. Bannir les émojis (garde \`src/ui/no-emoji-affordance.test.ts\`)

**Couverture EXHAUSTIVE, sans liste opt-in** : le test balaie TOUT \`${RACINE_SCAN}/\` en récursif
(extensions \`${EXTENSIONS_SCAN}\`) et fait échouer la suite sur tout emoji détecté. Aucun stock
d'exceptions par état de migration n'y est déclaré — état VÉRIFIÉ à chaque génération, aux
identifiants de la garde (\`npm run docs:icones\` échoue nominativement si un cliquet, un stock ou une
liste opt-in y réapparaît). Seulement des exclusions **par NATURE** :

> Exclusions par NATURE${EXCLUSIONS.split('\n').join('\n> ')}

Plages Unicode considérées comme emoji (\`EMOJI_RANGES\`, \`scripts/guards/lib/emojiAffordance.mjs\` —
délibérément SANS les blocs typographiques flèches/formes géométriques) :

${lignesPlages}

Glyphes TEXTE tolérés partout (\`ALLOWED_CHARS\`, ${ALLOWED_CHARS.size} entrées) :
${[...ALLOWED_CHARS].map((c) => `\`${c}\``).join(' ')} — coches/croix de résultat, fermeture,
ornement, burger de menu, symboles de sexe, particules FX en \`<text>\` SVG.

Pour ajouter une AFFORDANCE : utiliser \`<Icon id>\` / \`<IconG id>\` dès l'écriture — jamais un
emoji, même « juste pour l'instant ».

## Gardes

- \`npx vitest run src/ui/icons/icons.test.ts\` — ${TITRES_ICONS_TEST.map((t) => `${t}`).join(' ; ')}.
- \`npx vitest run src/ui/no-emoji-affordance.test.ts\` — zéro emoji dans tout \`${RACINE_SCAN}/\`,
  hors exclusions par nature.
- \`npx vitest run src/data/data-wellformed.test.ts\` — ${CAS_ICONE.length} cas résolvent une icône
  dans \`ICON_DEFS\`.
- \`npm run gen\` — régénère \`${CHAMPS_ENTREE.out}\` (n'écrit rien si le contenu est inchangé ;
  vérifier le compteur de fichiers affiché).
- \`npm run typecheck\` — un id d'icône authoré en TS hors du registre ne compile pas
  (\`${UNION}\` est une union fermée).
`

ecrireOuVerifier({
  out,
  path: 'docs/ajouter-une-icone.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:icones — docs/ajouter-une-icone.md est PÉRIMÉ (diverge du registre d’icônes, de Icon.tsx, des gardes ou du script).',
  rerunMsg: '  → relancer `npm run docs:icones` et committer le résultat.',
  okMsg: 'docs:icones — OK (docs/ajouter-une-icone.md à jour)',
  writeMsg: `docs/ajouter-une-icone.md — ${FAMILLES.length} familles, ${IDS.length} icônes, ${DATA_ICONES.length} fichiers de données porteurs.`,
})

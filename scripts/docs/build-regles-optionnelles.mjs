/**
 * Génère docs/regles-optionnelles.md — le registre des RÈGLES OPTIONNELLES et, surtout, le fait
 * qu'une partie du CONTENU du jeu (race, carrière, table, écran) n'existe à l'écran que si une
 * règle est ACTIVE. Cause d'origine : #1660 — une absence rapportée à tort en recette (« pas de
 * Gnome au créateur ») alors que `creation-gnome-jouable` est simplement désactivée par défaut, et
 * qu'AUCUN doc ne listait les règles ni ne disait où se trouve cette information.
 *
 * Part FACTUELLE, DÉRIVÉE à chaque génération :
 *  - les entrées de `src/data/reglesOptionnelles.json` : `id`, `label`, `group`, `kind`, `default`,
 *    `options`, `min`/`max`/`step`, `ref`, `source`, présence de `maison`, présence d'`action`, et
 *    le `hint` VERBATIM (seul porteur de « ce que la règle change ») ;
 *  - les clés déclarées par le schéma `src/data/schemas/defs/reglesOptionnelles.ts` — c'est SUR
 *    cette liste que s'appuie l'angle mort annoncé (aucune clé ne déclare le contenu gaté) ;
 *  - le découpage en ONGLETS du panneau : seuil `OWN_TAB_MIN` et libellé du fourre-tout, lus dans
 *    `src/ui/houseRuleTabs.ts` ;
 *  - la clé de persistance `localStorage`, lue dans `src/state/houseRules.ts`.
 * La part ÉDITORIALE (comment activer, quoi faire avant de rapporter une absence) vit ICI, en dur.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-regles-optionnelles.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const OUTIL = 'build-regles-optionnelles'
  const DATA = 'src/data/reglesOptionnelles.json'
  const DEF = 'src/data/schemas/defs/reglesOptionnelles.ts'
  const TABS = 'src/ui/houseRuleTabs.ts'
  const STORE = 'src/state/houseRules.ts'
  const PANNEAU = 'src/ui/HouseRulesModal.tsx'
  const POLICY = 'src/engine/policy.ts'
  const RECETTE = 'docs/recette-navigateur.md'

  function abandon(msg) {
    console.error(`${OUTIL} — ${msg}`)
    process.exit(1)
  }

  function lire(p) {
    if (!existsSync(p)) abandon(`fichier « ${p} » introuvable (déplacé/supprimé ?)`)
    return readFileSync(p, 'utf8')
  }

  /** Première capture d'un motif, fail-fast (une constante déplacée casse ICI, pas dans le .md). */
  function capture(texte, motif, quoi, ou) {
    const m = texte.match(motif)
    if (!m) abandon(`${quoi} introuvable dans ${ou} (renommé/déplacé ?)`)
    return m[1]
  }

  // ── Registre ─────────────────────────────────────────────────────────────────────────────────────

  const REGLES = JSON.parse(lire(DATA))
  if (!Array.isArray(REGLES) || !REGLES.length) abandon(`${DATA} est vide ou n'est pas un tableau`)
  for (const r of REGLES) {
    for (const requis of ['id', 'label', 'group', 'kind', 'ref', 'hint']) {
      if (r[requis] === undefined) abandon(`l'entrée « ${r.id ?? '?'} » de ${DATA} n'a pas de champ « ${requis} »`)
    }
    if (r.default === undefined) abandon(`l'entrée « ${r.id} » de ${DATA} n'a pas de champ « default »`)
  }

  // ── Clés déclarées par le schéma (support de l'angle mort annoncé) ───────────────────────────────

  const DEF_SRC = lire(DEF)
  // Le vocabulaire de `kind` est un enum NOMMÉ (`enumNomme`, `src/data/schemas/grammaire/valeurs.ts`) :
  // ses OPTIONS sont les clés de la table `{ option: 'Libellé FR' }` portée par le nœud (#1694).
  const KINDS_DECLARES = [
    ...capture(DEF_SRC, /kind: enumNomme\(\{([^}]+)\}\)/, "l'énumération `kind`", DEF).matchAll(
      /(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/g,
    ),
  ].map((m) => m[1] ?? m[2] ?? m[3])
  const KINDS_MESURES = [...new Set(REGLES.map((r) => r.kind))].sort()
  for (const k of KINDS_MESURES) {
    if (!KINDS_DECLARES.includes(k)) abandon(`kind « ${k} » mesuré dans ${DATA} mais absent de l'énumération de ${DEF}`)
  }

  /** Clés de PRÉSENTATION déclarées par le def zod (bloc `meta`) — l'ordre est celui du fichier. */
  const CLES_META = [...capture(DEF_SRC, /\{\n(\s*ref: \{ label:[\s\S]*?)\n\s*\},\n\s*\{\n\s*codex:/, 'le bloc `meta` des libellés de champs', DEF).matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1])
  if (!CLES_META.length) abandon(`aucun libellé de champ lisible dans le bloc \`meta\` de ${DEF}`)
  /** Clés d'ENVELOPPE mesurées en donnée mais posées par la fabrique (hors bloc `meta`). */
  const CLES_MESUREES = [...new Set(REGLES.flatMap((r) => Object.keys(r)))]

  // ── Panneau : onglets dérivés ────────────────────────────────────────────────────────────────────

  const TABS_SRC = lire(TABS)
  const OWN_TAB_MIN = Number(capture(TABS_SRC, /export const OWN_TAB_MIN = (\d+)/, 'la constante `OWN_TAB_MIN`', TABS))
  const MISC_LABEL = capture(TABS_SRC, /export const MISC_TAB_LABEL = '([^']+)'/, 'la constante `MISC_TAB_LABEL`', TABS)
  if (!Number.isFinite(OWN_TAB_MIN) || OWN_TAB_MIN < 1) abandon(`\`OWN_TAB_MIN\` illisible dans ${TABS}`)

  const CLE_PERSISTANCE = capture(lire(STORE), /export const HOUSE_RULES_STORAGE_KEY = '([^']+)'/, 'la clé de persistance `HOUSE_RULES_STORAGE_KEY`', STORE)

  for (const [f, sym] of [[POLICY, 'export function rule('], [POLICY, 'export function ruleDef(']]) {
    if (!lire(f).includes(sym)) abandon(`« ${sym.trim()} » introuvable dans ${f} (renommé ?)`)
  }
  if (!lire(PANNEAU).includes('houseRuleTabs')) abandon(`${PANNEAU} ne compose plus \`houseRuleTabs\``)

  // ── Agrégats ─────────────────────────────────────────────────────────────────────────────────────

  const PAR_GROUPE = new Map()
  for (const r of REGLES) {
    if (!PAR_GROUPE.has(r.group)) PAR_GROUPE.set(r.group, [])
    PAR_GROUPE.get(r.group).push(r)
  }
  const GROUPES = [...PAR_GROUPE.keys()] // ordre du registre (= ordre de découverte du panneau)
  const MAISON = REGLES.filter((r) => r.maison !== undefined)
  const AVEC_SOURCE = REGLES.filter((r) => r.source !== undefined)
  const AVEC_ACTION = REGLES.filter((r) => r.action !== undefined)

  const cellule = (s) => String(s).replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ')
  const litteral = (v) => `\`${typeof v === 'string' ? v : JSON.stringify(v)}\``

  /** Colonne « Valeurs » : ce que le contrôle accepte, dérivé du `kind` et des bornes. */
  function valeurs(r) {
    if (r.kind === 'mode') {
      const opts = r.options ?? abandon(`la règle « ${r.id} » est de kind \`mode\` sans \`options\``)
      return opts.map((o) => (o === r.default ? `**${litteral(o)}**` : litteral(o))).join(' · ')
    }
    if (r.kind === 'param') {
      const borne = r.min !== undefined && r.max !== undefined ? `${r.min} → ${r.max}` : '—'
      return `${borne}${r.step !== undefined ? `, pas ${r.step}` : ''}`
    }
    return `${litteral(false)} · ${litteral(true)}`
  }

  function referenceCell(r) {
    const folio = r.source ? ` (${r.source.book} f.${r.source.page})` : ''
    const maison = r.maison !== undefined ? ' · **maison**' : ''
    return `${cellule(r.ref)}${folio}${maison}`
  }

  const tableGroupe = (list) =>
    [
      '| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |',
      '|---|---|---|---|---|---|---|',
      ...list.map(
        (r) =>
          `| \`${r.id}\` | ${cellule(r.label)} | \`${r.kind}\` | ${litteral(r.default)} | ${valeurs(r)} | ${referenceCell(r)} | ${cellule(r.hint)}${r.action ? ` **Action liée** sous la rangée quand la valeur vaut ${litteral(r.action.when)} : « ${cellule(r.action.label)} ».` : ''} |`,
      ),
    ].join('\n')

  const sectionsGroupes = GROUPES.map((g) => {
    const list = PAR_GROUPE.get(g)
    const onglet = list.length >= OWN_TAB_MIN ? `onglet propre « ${g} »` : `onglet « ${MISC_LABEL} », intertitre « ${g} »`
    return `### ${g} — ${list.length} règle${list.length > 1 ? 's' : ''}\n\nPanneau : ${onglet}.\n\n${tableGroupe(list)}`
  }).join('\n\n')

  const tableGroupesResume = [
    '| Groupe | Règles | Onglet du panneau |',
    '|---|---|---|',
    ...GROUPES.map((g) => {
      const n = PAR_GROUPE.get(g).length
      return `| ${g} | ${n} | ${n >= OWN_TAB_MIN ? `propre` : MISC_LABEL} |`
    }),
  ].join('\n')

  const tableKinds = [
    '| `kind` | Entrées | Contrôle rendu | Forme de la valeur |',
    '|---|---|---|---|',
    ...KINDS_DECLARES.map((k) => {
      const n = REGLES.filter((r) => r.kind === k).length
      const forme =
        k === 'flag'
          ? 'booléen'
          : k === 'param'
            ? 'nombre borné (`min`/`max`, `step` optionnel)'
            : 'chaîne prise dans `options`'
      const controle = k === 'flag' ? 'interrupteur' : k === 'param' ? 'champ chiffré' : 'choix segmenté'
      return `| \`${k}\` | ${n} | ${controle} | ${forme} |`
    }),
  ].join('\n')

  // ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

  const out = `# Règles optionnelles — registre, et contenu qu'elles ouvrent

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-regles-optionnelles.mjs\`
> (\`npm run docs:regles-optionnelles\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUES aux fichiers réels : les ${REGLES.length} entrées de
\`${DATA}\` (id, libellé, groupe, forme, défaut, options/bornes, référence RAW, folio, présence de
\`maison\` et d'\`action\`, \`hint\` verbatim), les clés déclarées par \`${DEF}\`, le seuil d'onglet
\`OWN_TAB_MIN\` et le libellé du fourre-tout de \`${TABS}\`, la clé de persistance de \`${STORE}\`.
**ANGLE MORT STRUCTUREL** : *la liste des contenus gatés n'est pas déclarée structurellement, c'est
le \`hint\` qui le dit* — voir le § « Ce doc ne sait pas … » ci-dessous. Autre angle mort : ce doc
décrit le REGISTRE, pas les SITES qui consultent la règle ; qu'une règle existe ne dit pas combien
de coutures la lisent (\`rule(id)\`, \`${POLICY}\`).

## Avant de rapporter une ABSENCE

Une race, une carrière, une table, un écran, un événement peut être ABSENT à l'écran **parce qu'une
règle optionnelle est désactivée par défaut** — pas parce qu'il manque. Exemple mesuré (#1660) :
\`creation-gnome-jouable\` vaut \`false\` par défaut, donc le Gnome n'apparaît ni au Tableau des Races
aléatoires ni dans la grille de sélection du créateur. Chercher l'id dans les tables ci-dessous,
activer la règle, **puis** rejouer le geste avant de conclure.

## Activer / désactiver une règle

| Couture | Persistance | Où |
|---|---|---|
| Panneau **Options** in-game | **PERSISTÉE** — \`localStorage['${CLE_PERSISTANCE}']\` | \`${PANNEAU}\` (onglets dérivés par \`${TABS}\`), écriture par \`setHouseRule\` (\`${STORE}\`) |
| Console de recette \`__wfrp.rules(id, value)\` | **RUNTIME, NON persistée** (meurt au rechargement) | \`${RECETTE}\`, § « Groupe / campagne / règles » |
| Console de recette \`__wfrp.rules(id, null)\` | réinitialise **et purge la surcharge persistée** | idem |
| Lecture par le moteur | — | \`rule(id)\` / \`ruleDef(id)\` (\`${POLICY}\`) |

L'asymétrie entre ces trois gestes, le verrou en cours de combat et la vérification de l'état
persisté en fin de run sont décrits **une seule fois**, dans \`${RECETTE}\` : s'y reporter, ils ne
sont pas recopiés ici.

## Ce doc ne sait pas quelles règles gatent du CONTENU

Le registre ne porte **aucune** déclaration du contenu qu'une règle ouvre ou ferme. Les clés
déclarées par \`${DEF}\` sont : ${CLES_META.map((k) => `\`${k}\``).join(', ')} — plus les clés
d'enveloppe posées par la fabrique (${CLES_MESUREES.filter((k) => !CLES_META.includes(k)).map((k) => `\`${k}\``).join(', ')}).
Aucune ne nomme une race, une carrière, une table ni un écran.

Le SEUL porteur de cette information est le \`hint\`, **en prose**. Conséquence : le contenu gaté se
trouve en LISANT la colonne « Ce que la règle change » ci-dessous, jamais par une requête
structurelle — et une règle nouvellement gatante n'est signalée par aucune garde.

## Formes de contrôle

${tableKinds}

## Groupes et onglets

Le panneau ne code aucun groupe en dur : un groupe obtient son onglet à partir de
**${OWN_TAB_MIN} entrées**, les résiduels tombent dans l'onglet « ${MISC_LABEL} » en gardant leur
intertitre (\`${TABS}\`).

${tableGroupesResume}

## Provenance

${MAISON.length} règles sur ${REGLES.length} portent un champ \`maison\` : le RAW ne chiffre pas la
valeur, l'arbitrage est explicite (CLAUDE.md règle 7). ${AVEC_SOURCE.length} portent une ancre
\`source: {book, page}\` au folio imprimé. ${AVEC_ACTION.length} portent une \`action\` rendue sous la
rangée quand la règle atteint sa valeur de déclenchement.

## Le registre

${sectionsGroupes}
`
  return {
    out,
    path: 'docs/regles-optionnelles.md',
    staleMsg: `docs:regles-optionnelles — docs/regles-optionnelles.md est PÉRIMÉ (diverge de ${DATA}, ${DEF}, ${TABS}, ${STORE}, ou du script).`,
    rerunMsg: '  → relancer `npm run docs:regles-optionnelles` et committer le résultat.',
    okMsg: 'docs:regles-optionnelles — OK (docs/regles-optionnelles.md à jour)',
    writeMsg: `docs/regles-optionnelles.md — ${REGLES.length} règles, ${GROUPES.length} groupes, ${KINDS_DECLARES.length} formes de contrôle, ${MAISON.length} maison.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })

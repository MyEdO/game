// REGISTRE DES WORKFLOWS DU DÉPÔT (#1779). Module FEUILLE : `node:*` et le lecteur à ordre total —
// c'est lui qu'on importe, jamais lui qui importe une gate (`gatesDeCi.mjs` ne le connaît pas).
//
// La question : « comment un rouge de `main` hors `ci.yml` est-il vu ? ». Chaque workflow est dans UN
// des trois états d'`ETATS`, et chaque état DÉCLARÉ ici est MESURÉ sur le YAML par `mesurerEtat` :
// une déclaration sans mesure ne prouve rien. Un workflow neuf = une entrée ICI, ET son état se
// mesure : sans l'un ou sans l'autre, `verdict` rougit (scripts/gates/workflowsDuDepot.test.mjs).
//
// Le YAML est lu par regex ligne à ligne, comme `gatesDeCi.mjs` lit `ci.yml` : le contrat porte sur
// des lignes. Le dossier se liste par `listerDossier` — le lecteur à ORDRE TOTAL du dépôt
// (scripts/guards/lib/lister.mjs), dont la clôture est gardée par `lister.test.mjs:150`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'

/** Le workflow qui EST la porte de `main` : `coursesCi` le consulte par défaut, et le ruleset
 *  n'exige que SES jobs (scripts/ops/ruleset-main.mjs, par `jobsCi`). */
export const PORTE = 'ci.yml'

/** Le seul signaleur : un workflow se nomme lui-même en appelant CE script, jamais par un
 *  `gh issue create` écrit en ligne dans un YAML. */
export const SIGNALEUR = 'scripts/ops/signaler-rouge.mjs'

/** Ce que chaque état MESURE sur le YAML. Un état sans mesure n'existe pas. */
export const ETATS = Object.freeze({
  porte:
    'le workflow EST la porte : la porte au push consulte ses courses (scripts/git-hooks/pre-push.mjs ' +
    '→ `coursesCi`, dont le défaut est PORTE) et le ruleset `main` exige ses jobs',
  autosignale:
    `le workflow se nomme lui-même en rougissant : un step qui joue MÊME sur rouge (\`if\` portant ` +
    `\`always()\`, \`!cancelled()\` ou \`failure()\` non nié, jamais sous \`success()\`) EXÉCUTE ` +
    `\`${SIGNALEUR}\`, qui commente ou ouvre l'issue survivante`,
  manuel:
    'le workflow est lancé à la main sur demande explicite et regardé par celui qui le lance : son ' +
    'bloc `on:` ne porte que `workflow_dispatch`',
})

/**
 * L'état de CHAQUE workflow de `.github/workflows/`, avec la raison qui cite le fait.
 * @type {Readonly<Record<string, { etat: keyof ETATS, raison: string }>>}
 */
export const WORKFLOWS = Object.freeze({
  'ci.yml': {
    etat: 'porte',
    raison:
      'la porte au push lit ses courses pour le sha poussé — scripts/git-hooks/pre-push.mjs appelle ' +
      '`coursesCi` (scripts/guards/lib/coursesCi.mjs), dont le workflow par défaut EST PORTE — et le ruleset ' +
      '`main` en fait ses checks requis',
  },
  'canari.yml': {
    etat: 'autosignale',
    raison:
      'le step « Résumé du canari » (`if: ${{ !cancelled() }}`) poste son rapport dans l’issue ' +
      `survivante par \`${SIGNALEUR}\`, puis \`exit 1\` si une mesure est rouge`,
  },
  'deps-report.yml': {
    etat: 'autosignale',
    raison:
      'le step « Se nommer en rougissant » (`if: ${{ !cancelled() }}`) nomme le run et son ' +
      `\`job.status\` par \`${SIGNALEUR}\` : un rouge AVANT \`npm run deps:report\` a son canal`,
  },
  'deploy.yml': {
    etat: 'manuel',
    raison:
      '`on: workflow_dispatch:` seul : lancé et regardé par une main humaine (CLAUDE.md § Pile et ' +
      'commandes, « prod — sur demande explicite SEULEMENT »)',
  },
})

/** Dossier des workflows, relatif à la racine du dépôt. */
export const DOSSIER = '.github/workflows'

/**
 * Steps d'un workflow, un bloc par tiret de 6 espaces (la forme de CE dépôt : `jobs:` → job → `steps:`).
 * PUR. Source unique : `scripts/ops/canari.test.mjs` l'importe d'ici.
 * @param {string} texte @returns {Array<{ bloc: string, nom: string|null, id: string|null,
 *   tolerant: boolean, commande: boolean, run: boolean, si: string|null }>}
 */
export function stepsDu(texte) {
  const lignes = texte.split(/\r?\n/)
  const steps = []
  let courant = null
  for (const ligne of lignes) {
    if (/^ {6}- /.test(ligne)) {
      if (courant) steps.push(courant)
      courant = { lignes: [] }
    }
    if (courant) courant.lignes.push(ligne)
  }
  if (courant) steps.push(courant)
  return steps.map((s) => {
    const bloc = s.lignes.join('\n')
    return {
      bloc,
      nom: /^\s*-?\s*name:\s*(.+)$/m.exec(bloc)?.[1]?.trim() ?? null,
      id: /^\s*-?\s*id:\s*([A-Za-z0-9_-]+)\s*$/m.exec(bloc)?.[1] ?? null,
      tolerant: /^\s*continue-on-error:\s*true\s*$/m.test(bloc),
      commande: /^\s*-?\s*(run|uses):/m.test(bloc),
      run: /^\s*-?\s*run:/m.test(bloc),
      si: /^\s*-?\s*if:\s*(.+)$/m.exec(bloc)?.[1]?.trim() ?? null,
    }
  })
}

/**
 * Clés de premier niveau du bloc `on:` d'un workflow. PUR — même lecture ligne à ligne que
 * `scripts/docs/build-reprise.mjs`.
 * @param {string} texte @returns {string[]}
 */
export function declencheursDe(texte) {
  const lignes = texte.split(/\r?\n/)
  const debut = lignes.findIndex((l) => /^on:/.test(l))
  if (debut === -1) return []
  const suite = []
  for (const l of lignes.slice(debut + 1)) {
    if (l.trim() === '') continue
    if (!/^\s/.test(l)) break
    if (/^ {2}\S/.test(l)) suite.push(l.trim().replace(/:$/, ''))
  }
  return suite
}

/**
 * Corps SHELL de chaque `run:` d'un texte de workflow (valeur inline OU bloc scalaire `run: |`),
 * lignes EXÉCUTÉES seulement — une ligne de commentaire est de la prose, jamais une commande
 * (même mesure que `scripts/ops/canari.test.mjs`, « la mesure porte sur ce qui s'EXÉCUTE »). PUR.
 * Source unique : `scripts/docs/build-reprise.mjs` l'importe d'ici pour compter ses portes npm.
 * @param {string} texte @returns {string[]}
 */
export function corpsRun(texte) {
  const lignes = texte.split(/\r?\n/)
  const corps = []
  for (let i = 0; i < lignes.length; i += 1) {
    const m = lignes[i].match(/^(\s*)(-\s+)?run:(.*)$/)
    if (!m) continue
    const indentCle = m[1].length + (m[2] ? m[2].length : 0)
    const valeur = m[3].trim()
    if (valeur && !/^[|>][-+\d]*$/.test(valeur)) {
      corps.push(valeur)
      continue
    }
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (lignes[j].trim() === '') continue
      const indent = lignes[j].length - lignes[j].trimStart().length
      if (indent <= indentCle) break
      corps.push(lignes[j].trim())
    }
  }
  return corps.filter((l) => !l.startsWith('#'))
}

/**
 * `true` si la condition `if` d'un step le fait jouer MÊME quand une mesure précédente est rouge :
 * `always()`, `!cancelled()`, ou `failure()` NON nié — et jamais sous un `success()`, qui exige au
 * contraire que tout soit vert. PUR.
 * @param {string|null} si @returns {boolean}
 */
function joueSurRouge(si) {
  if (!si) return false
  if (/(^|[^!\w])success\s*\(\)/.test(si)) return false
  return /(^|[^!\w])always\s*\(\)/.test(si) || /!\s*cancelled\s*\(\)/.test(si) || /(^|[^!\w])failure\s*\(\)/.test(si)
}

/**
 * L'état MESURÉ d'un workflow, depuis son seul texte. PUR.
 * @param {string} fichier nom de fichier (`ci.yml`)
 * @param {string} texte contenu YAML
 * @returns {{ porte: boolean, autosignale: boolean, manuel: boolean, motifs: string[] }}
 */
export function mesurerEtat(fichier, texte) {
  const motifs = []

  const porte = fichier === PORTE
  if (porte) motifs.push(`porte : ce fichier EST PORTE (${PORTE})`)

  const declencheurs = declencheursDe(texte)
  const manuel = declencheurs.length === 1 && declencheurs[0] === 'workflow_dispatch'
  motifs.push(`déclencheurs : ${declencheurs.length ? declencheurs.join(', ') : '(aucun lu)'}`)

  // Le signaleur doit être EXÉCUTÉ (corps d'un `run:`, commentaires ôtés) sous un `if` qui joue sur
  // rouge : un chemin cité dans de la prose ne signale rien.
  const signaleurs = stepsDu(texte).filter(
    (s) => joueSurRouge(s.si) && corpsRun(s.bloc).some((l) => l.includes(SIGNALEUR)),
  )
  const autosignale = signaleurs.length > 0
  motifs.push(
    autosignale
      ? `autosignale : step(s) ${signaleurs.map((s) => `« ${s.nom ?? s.id ?? '(sans nom)'} »`).join(', ')} EXÉCUTENT ${SIGNALEUR} sous un \`if\` qui joue sur rouge`
      : `aucun step n’EXÉCUTE ${SIGNALEUR} sous un \`if\` qui joue sur rouge (always(), !cancelled() ou failure() non nié, hors success())`,
  )

  return { porte, autosignale, manuel, motifs }
}

/**
 * Les workflows PRÉSENTS sur disque, triés par nom de fichier.
 * @param {{ cwd?: string }} [p] @returns {Array<{ fichier: string, texte: string }>}
 */
export function lireWorkflows({ cwd = process.cwd() } = {}) {
  const dossier = join(cwd, DOSSIER)
  return listerDossier(dossier)
    .filter((f) => f.endsWith('.yml'))
    .map((fichier) => ({ fichier, texte: readFileSync(join(dossier, fichier), 'utf8') }))
}

/**
 * Les CONSTATS du registre confronté au disque — liste vide = vert.
 * @param {{ cwd?: string }} [p] @returns {string[]}
 */
export function verdict({ cwd = process.cwd() } = {}) {
  const constats = []
  const presents = lireWorkflows({ cwd })
  const declares = new Set(Object.keys(WORKFLOWS))

  if (!declares.has(PORTE))
    constats.push(`PORTE (${PORTE}) n’est pas déclarée dans WORKFLOWS — la porte de \`main\` n’a pas d’état`)
  else if (WORKFLOWS[PORTE].etat !== 'porte')
    constats.push(`PORTE (${PORTE}) est déclarée « ${WORKFLOWS[PORTE].etat} » : la porte se déclare « porte »`)

  for (const fichier of declares)
    if (!presents.some((w) => w.fichier === fichier))
      constats.push(`${DOSSIER}/${fichier} est déclaré mais ABSENT du disque (renommé/supprimé ?)`)

  for (const { fichier, texte } of presents) {
    const declare = WORKFLOWS[fichier]
    const mesure = mesurerEtat(fichier, texte)
    if (!declare) {
      constats.push(
        `${DOSSIER}/${fichier} n’est déclaré dans AUCUN état : ajoute une entrée à WORKFLOWS ` +
          `(scripts/gates/workflowsDuDepot.mjs) — états possibles : ${Object.keys(ETATS).join(', ')}`,
      )
      continue
    }
    if (!(declare.etat in ETATS)) {
      constats.push(`${DOSSIER}/${fichier} déclare l’état inconnu « ${declare.etat} »`)
      continue
    }
    if (!mesure[declare.etat])
      constats.push(
        `${DOSSIER}/${fichier} est déclaré « ${declare.etat} » mais le YAML ne le mesure PAS — ` +
          `${mesure.motifs.join(' ; ')}`,
      )
    for (const etat of Object.keys(ETATS))
      if (etat !== declare.etat && mesure[etat])
        constats.push(
          `${DOSSIER}/${fichier} est déclaré « ${declare.etat} » mais le YAML mesure AUSSI « ${etat} » — ` +
            `${mesure.motifs.join(' ; ')}`,
        )
  }
  return constats
}

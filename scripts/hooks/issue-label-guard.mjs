// Garde PreToolUse(`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : ÉMISSION de tickets GitHub.
// Constat utilisateur (2026-07-22) : « les labels sont sous-exploités par les agents/orchestrateur ».
// La doctrine (credo : « les LABELS sont l'index du backlog ») ne suffit pas — on la rend MÉCANIQUE.
//
// TROIS portes de création, deux régimes :
//   - REFUS : une création de ticket SANS aucun label, par sa porte CLI (`gh issue create|new`),
//     REST (`gh api … POST /repos/<o>/<r>/issues`) ou GraphQL (`gh api graphql` portant
//     `createIssue`) ; et tout corps/titre passé en ligne de commande qui porte un backtick ou un
//     `$(` — le shell l'EXÉCUTE avant que gh le voie (récidive ×3), le corps se passe en `--body-file`.
//   - CONTEXTE, jamais un refus : les familles `sev:`/`type:`/`domaine:` qui MANQUENT, et un titre
//     au-delà de 200 caractères. Mesure du 2026-09-02 : 10/50 tickets récents portent les trois
//     familles (31/400 sur le corpus entier) ; titres médiane 168 sur les 100 récents, 26/100 au-delà
//     de 200 (p90 = 204 sur 400). Un refus mordrait 4 émissions sur 5 — un geste ROUTINIER, que le
//     régime utilisateur du 2026-09-01 (« Personnellement je m'absente des heures ») interdit de
//     bloquer ; la mesure passe d'abord, le refus se re-décide sur la chute.
//
// Robustesse : on ne fait PAS un grep de sous-chaîne (`gh issue create` cité dans un `--body`/un
// `echo` mordrait à tort) — on réutilise le TOKENIZER quote-aware de `solde-ticket-guard`
// (`segmentsProfonds`, invariant partagé, jamais redupliqué) puis on détecte STRUCTURELLEMENT
// l'exécutable `gh` et sa sous-commande. Les segments sont PROFONDS : un `sh -c "gh issue create
// …"`, un `xargs gh issue create`, un `powershell -Command "…"` sont vus comme la création qu'ils
// exécutent.
//
// VU / HORS PORTÉE (dit, jamais supposé) : `node scripts/x.mjs` et `$GH issue create` (l'exécutable
// vient de l'environnement) PASSENT, par construction — une commande inconnue avant son exécution ne
// se garde pas au PreToolUse. `npm run x` est VU depuis que le socle résout le script dans
// `package.json` : la sonde `scripts/ops/sondes/audit-2026-09-01/sonde-bypass.mjs` le laisse passer
// tant qu'AUCUN script `open-ticket` n'existe dans ce dépôt — le jour où il en porte un qui appelle
// `gh issue create`, la création est refusée comme les autres.
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { segmentsProfonds } from './solde-ticket-guard.mjs'

/** Un token porte-t-il une option de label ? (`--label`, `--label=X`, `-l`, `-lX` glué) */
export const isLabelFlag = (t) => /^--label(=|$)/.test(t) || /^-l/.test(t)

/** Arguments d'un segment dont l'exe de tête est `gh` (basename, `.exe`/`.cmd` et un `&`
 *  call-operator PowerShell tolérés), ou `null` si ce segment n'exécute pas `gh`. */
export function ghArgs(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return null
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd)$/i, '').toLowerCase()
  return exe === 'gh' ? segment.slice(start + 1) : null
}

/** Index du token `action` suivant IMMÉDIATEMENT `groupe` (`issue create`), `-1` sinon. L'adjacence
 *  rend la lecture robuste à un flag global à valeur intercalé (`gh -R owner/repo issue create`). */
function indexSousCommande(args, groupe, actions) {
  for (let i = 0; i < args.length - 1; i++) if (args[i] === groupe && actions.includes(args[i + 1])) return i + 1
  return -1
}

/** Le SEGMENT exécute-t-il `gh issue create|new` ? */
export function isGhIssueCreateSegment(segment) {
  const args = ghArgs(segment)
  return args !== null && indexSousCommande(args, 'issue', ['create', 'new']) !== -1
}

/** Valeur d'un flag long/court, graphies `--flag v`, `--flag=v`, `-t v`, `-tv` (`''` si absent). */
function valeurFlag(args, noms) {
  const trouvees = valeursFlag(args, noms)
  return trouvees[0] ?? ''
}

/** Toutes les valeurs d'un flag répétable (`--label a --label b`, `-la`, `--label=c`). */
function valeursFlag(args, noms) {
  const out = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    for (const nom of noms) {
      if (a === nom) { if (args[i + 1] !== undefined) out.push(args[i + 1]); break }
      if (a.startsWith(nom + '=')) { out.push(a.slice(nom.length + 1)); break }
      if (/^-[a-zA-Z]$/.test(nom) && a.startsWith(nom) && a.length > nom.length) { out.push(a.slice(nom.length)); break }
    }
  }
  return out
}

/** Le SEGMENT crée-t-il un ticket par l'API REST (`gh api … /repos/<o>/<r>/issues`) ? `gh api` POSTe
 *  dès qu'un champ `-f`/`-F`/`--field`/`--raw-field` est présent, et sur `-X POST` explicite ; sans
 *  l'un ni l'autre, la même route LIT la liste des tickets. */
export function isGhApiIssueCreate(segment) {
  const args = ghArgs(segment)
  if (!args || args[0] !== 'api') return false
  if (!args.some((a) => /^\/?repos\/[^/]+\/[^/]+\/issues\/?$/.test(a))) return false
  const methode = valeurFlag(args, ['-X', '--method']).toUpperCase()
  if (methode && methode !== 'POST') return false
  return methode === 'POST' || args.some((a) => ['-f', '-F', '--field', '--raw-field'].includes(a))
}

/** Le SEGMENT crée-t-il un ticket par GraphQL (`gh api graphql` dont la requête porte `createIssue`) ? */
export function isGhGraphqlIssueCreate(segment) {
  const args = ghArgs(segment)
  return Boolean(args && args[0] === 'api' && args.includes('graphql') && /createIssue/.test(args.join(' ')))
}

/** Labels posés par une création d'API : champ `labels` du POST REST, `labelIds` de la mutation, ou
 *  corps pris en FICHIER (`--input`) — que la ligne de commande ne montre pas, et qu'on ne juge pas. */
function porteLabelsApi(args) {
  return args.includes('--input') ||
    /labelIds/.test(args.join(' ')) ||
    valeursFlag(args, ['-f', '-F', '--field', '--raw-field']).some((v) => /^labels\b/.test(v))
}

const MESSAGE_LABELS =
  '⚠ Création de ticket SANS label refusée (credo : « les LABELS sont l\'index du backlog », ' +
  'gabarit #101+). Ajouter au moins un label couvrant les axes pertinents : ' +
  '`livre:<source>` · `domaine:<naval|magie|combat|économie|art|coop|campagne|UX|moteur-pur|' +
  'primitives-UI|religion|maladie>` · `type:<donnée|système|règle-optionnelle>` · ' +
  '`sev:<majeur|mineur|smell>` · `audit:<contenu-manquant|non-branché|principe>` · le ' +
  '`chantier:*`/`campagne:*` s\'il existe. Vocabulaire canonique : `gh label list` — créer le ' +
  'label manquant (`gh label create`) plutôt que forcer un voisin inexact. Et AVANT de créer : ' +
  'dédupliquer PAR LABEL (`gh issue list --state all --label livre:X --label domaine:Y`).'

/** Sous-commandes dont un TEXTE part sur la ligne de commande. */
const ACTIONS_TEXTE = ['create', 'new', 'comment', 'edit']
const FLAGS_TEXTE = ['-b', '--body', '-m', '--title', '-t']
const INTERPOLATION_RE = /[`]|\$\(/

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision, reason }` sinon. Une commande
 * qui, dans un quelconque de ses segments PROFONDS (enchaînements, enrobeurs de tête, sous-shells),
 * ouvre un ticket SANS label — par l'une des trois portes — est refusée ; un texte interpolé aussi.
 * `options` va au socle (`{ scripts }` : table des scripts npm où `npm run <x>` se résout).
 */
export function evaluate(command, options) {
  if (!command) return null
  for (const segment of segmentsProfonds(command, 0, options)) {
    const args = ghArgs(segment)
    if (!args) continue
    const porteTexte = indexSousCommande(args, 'issue', ACTIONS_TEXTE) !== -1 ||
      indexSousCommande(args, 'pr', ACTIONS_TEXTE) !== -1
    const interpole = porteTexte ? (valeursFlag(args, FLAGS_TEXTE).find((v) => INTERPOLATION_RE.test(v)) ?? null) : null
    if (interpole !== null) {
      return {
        decision: 'deny',
        reason:
          '⛔ Texte de ticket INTERPOLÉ par le shell (« ' + interpole.slice(0, 60) + ' ») : un backtick ou ' +
          'un $( ) dans un -b/--body/--title est EXÉCUTÉ avant d\'atteindre gh (récidive ×3 ; sous ' +
          'PowerShell le backtick est de plus le caractère d\'échappement, jusque dans les guillemets). ' +
          'Écrire le corps dans un FICHIER et passer --body-file <fichier>.',
      }
    }
    if (isGhIssueCreateSegment(segment)) {
      if (!args.some(isLabelFlag)) return { decision: 'deny', reason: MESSAGE_LABELS }
      continue
    }
    if ((isGhApiIssueCreate(segment) || isGhGraphqlIssueCreate(segment)) && !porteLabelsApi(args)) {
      return {
        decision: 'deny',
        reason:
          MESSAGE_LABELS + ' — par l\'API, les labels se posent au MÊME titre : ' +
          '`-f \'labels[]=<label>\'` sur POST /repos/<o>/<r>/issues, `labelIds` sur la mutation createIssue.',
      }
    }
  }
  return null
}

const FAMILLES = ['sev:', 'type:', 'domaine:']
const TITRE_MAX = 200

/**
 * Contexte à INJECTER (jamais un refus) : familles de labels absentes, titre au-delà de `TITRE_MAX`.
 * `null` si la commande n'ouvre aucun ticket, ou si rien ne manque.
 */
export function contexteEmission(command, options) {
  if (!command) return null
  const notes = []
  for (const segment of segmentsProfonds(command, 0, options)) {
    if (!isGhIssueCreateSegment(segment)) continue
    const args = ghArgs(segment)
    const labels = valeursFlag(args, ['--label', '-l']).flatMap((v) => v.split(','))
    const absentes = FAMILLES.filter((f) => !labels.some((l) => l.trim().startsWith(f)))
    if (absentes.length > 0) {
      notes.push(
        'Familles de labels ABSENTES : ' + absentes.join(' ') + ' — l\'index du backlog se cherche PAR ' +
        'famille (`gh issue list --label sev:majeur --label domaine:X`) ; 10 tickets sur 50 les portent ' +
        'toutes les trois (mesure 2026-09-02).',
      )
    }
    const titre = valeurFlag(args, ['--title', '-t'])
    if (titre.length > TITRE_MAX) {
      notes.push(
        'Titre de ' + titre.length + ' caractères (> ' + TITRE_MAX + ') : un titre est un INDEX, pas un ' +
        'paragraphe — le détail va au corps (p90 mesuré = 204 sur les 400 derniers tickets).',
      )
    }
  }
  return notes.length > 0 ? notes.join('\n') : null
}

/** Le refus, sinon le contexte d'émission. `npm run <x>` se résout dans le répertoire cible du contexte
 *  (portée posée par le répartiteur). */
function evaluer(entree) {
  const command = commandeDe(entree)
  const refus = verdictDe(evaluate(command))
  if (refus) return refus
  const contexte = contexteEmission(command)
  return contexte ? { contexte } : null
}

export const garde = { nom: 'issue-label', outils: OUTILS_SHELL, evaluer }

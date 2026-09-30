// REGISTRE du répartiteur (#2125) : les gardes de chaque événement, dans leur ordre d'évaluation (un
// `deny` court-circuite les suivantes). Une garde de plus = une ligne. Le matcher déclaré de chaque
// événement est l'UNION des `outils` de ses gardes (`scripts/agents/compat-core.mjs`).
import { garde as canalOutil } from './canal-outil-guard.mjs'
import { garde as nouveauFichierSrc } from './new-src-file-guard.mjs'
import { garde as donneeEditee } from './data-edit-guard.mjs'
import { garde as exceptionAjoutee } from './exception-add-guard.mjs'
import { garde as memoireTombale } from './memoire-tombale-guard.mjs'
import { garde as commandePiege } from './commande-piege-guard.mjs'
import { garde as issueLabel } from './issue-label-guard.mjs'
import { garde as codeurGates } from './codeur-gates-guard.mjs'
import { garde as runnerCapture } from './runner-capture-guard.mjs'
import { garde as poison } from './poison-postcheck.mjs'

export const REGISTRE = {
  PreToolUse: [
    canalOutil, nouveauFichierSrc, donneeEditee, exceptionAjoutee, memoireTombale,
    commandePiege, issueLabel, codeurGates, runnerCapture,
  ],
  PostToolUse: [poison],
}

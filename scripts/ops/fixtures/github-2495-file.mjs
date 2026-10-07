import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dossier = fileURLToPath(new URL('.', import.meta.url))
const capture = (nom) => JSON.parse(readFileSync(join(dossier, `github-2495-${nom}.json`), 'utf8'))
export const PR_2495 = capture('489').data.repository.pullRequest
export const ENTREE_2495 = { ...PR_2495.mergeQueueEntry,
  id: capture('417').data.repository.pullRequest.mergeQueueEntry.id }
export const JEUNE_2495 = Date.parse(ENTREE_2495.enqueuedAt) + 60_000

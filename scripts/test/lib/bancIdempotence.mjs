import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../../guards/lib/lister.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

const MIGRATIONS = path.join(RACINE, 'scripts/migrations');

/** Les migrations DATÉES du dossier, dans l'ordre lexical — le périmètre que `replay.mjs` rejoue. */
const DATEES = listerDossier(MIGRATIONS).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.mjs$/.test(f));

export { DATEES, MIGRATIONS, RACINE }

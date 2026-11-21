import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { estUneMigration } from '../../migrations/replay.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

const MIGRATIONS = path.join(RACINE, 'scripts/migrations');

/** Les migrations DATÉES du dossier, dans l'ordre lexical — le périmètre que `replay.mjs` rejoue. */
const DATEES = listerDossier(MIGRATIONS).filter(estUneMigration);

export { DATEES, MIGRATIONS, RACINE }

#!/usr/bin/env node
/**
 * @contrat Transport
 * - Sur le projet en place, le pont du processus est `hotes/godot/vivant.mjs` (#3945) : il bâtit le bundle en mémoire
 *   (`empaqueter`, `construire.mjs`), et son serveur (`servir.mjs`, sans export) ne sert que `modeles/` et `depot/`.
 * - Son bundle est de développement : il vise le relay de `VITE_RELAY_URL`, sinon le relay local de
 *   `npm run relay:dev` (`relayHttpUrl`, `src/hote/coop/page.ts`).
 */
import { fileURLToPath } from 'node:url'
import { empaqueter } from './construire.mjs'
import { tenirLeTuyau } from './processus.mjs'
import { servir } from './servir.mjs'

await tenirLeTuyau((await empaqueter(null, 'development')).code, await servir({ depot: fileURLToPath(new URL('../..', import.meta.url)) }))

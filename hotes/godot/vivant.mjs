#!/usr/bin/env node
/**
 * @contrat Transport
 * - Sur le projet en place, le pont du processus est `hotes/godot/vivant.mjs` (#3945) : il bâtit le bundle en mémoire
 *   (`empaqueter`, `construire.mjs`) depuis l'entrée du jeu que son lanceur a posée dans l'environnement
 *   (`poserLEntree`, #4936), l'entrée commune sans elle (F5 dans l'éditeur ouvert à la main), et son serveur
 *   (`servir.mjs`, sans export) ne sert que `modeles/` et `depot/`.
 *   En F5, le serveur annonce son adresse avant la préparation du listage des modèles. Les recettes du constructeur
 *   (`WFRP_GODOT_ATTENDRE_LISTAGE=1`) attendent le listage avant l’annonce pour que le premier GET soit prêt (#3963).
 * - Son bundle est de développement : il vise le relay de `VITE_RELAY_URL`, sinon le relay local de
 *   `npm run relay:dev` (`relayHttpUrl`, `src/hote/coop/page.ts`).
 */
import { fileURLToPath } from 'node:url'
import { empaqueter } from './construire.mjs'
import { tenirLeTuyau } from './processus.mjs'
import { servir } from './servir.mjs'

const { code } = await empaqueter(null, 'development')
const attendreLeListage = process.env.WFRP_GODOT_ATTENDRE_LISTAGE === '1'
const serveur = await servir({ depot: fileURLToPath(new URL('../..', import.meta.url)), attendreLeListage })
await tenirLeTuyau(code, serveur)

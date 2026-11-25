// LE NAVIGATEUR ÉPINGLÉ DES OUTILS WEB (#4903 L6) : le build de Chromium que Playwright installe (`EPINGLE`), seul
// navigateur des images comparées au pixel (étalons des planches, maquettes, recette d'images du roguelite) et des
// recettes du roguelite. `lancerLeNavigateurEpingle` le lance et refuse tout autre build (`refusDuNavigateur`).
// Installation : `PLAYWRIGHT_BROWSERS_PATH=<dossier> npx -y playwright@<EPINGLE.playwright> install chromium`.
// `scripts/recette/lib.mjs` pilote encore l'export Web Godot par CDP, sans Playwright (#5016) ; ses étalons passent le
// même refus (`hotes/godot/etalons.mjs`).
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

/** Le build du navigateur : la version de Playwright qui l'installe (`devDependencies` de `package.json`), et celle de
 *  Chrome for Testing qu'il installe. Monter l'épingle, c'est reposer tous les étalons et références dans le même commit. */
export const EPINGLE = Object.freeze({
  playwright: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).devDependencies.playwright,
  chrome: '153.0.8010.12',
})
/** La plateforme où l'épingle a été mesurée (`process.platform`, `process.arch`). */
const PLATEFORME = Object.freeze({ plateforme: 'linux', architecture: 'x64' })

/** Le refus du navigateur `navigateur` (le `product` de `Browser.getVersion`, `<nom>/<version>`) lancé sur
 *  `plateforme` et `architecture` (`process.platform`, `process.arch`) : ce qu'il a lu, ce qu'il attend et la commande
 *  qui installe le build épinglé ; `null` pour le seul `Chrome/<EPINGLE.chrome>` sous Linux x86-64. PURE. */
export function refusDuNavigateur(navigateur, { plateforme, architecture }) {
  const surLaPlateforme = plateforme === PLATEFORME.plateforme && architecture === PLATEFORME.architecture
  if (surLaPlateforme && navigateur === `Chrome/${EPINGLE.chrome}`) return null
  return `navigateur ${navigateur} sous ${plateforme}-${architecture}, l'outil attend Chrome ${EPINGLE.chrome} sous ` +
    `${PLATEFORME.plateforme}-${PLATEFORME.architecture} ; sur une telle machine : ` +
    `PLAYWRIGHT_BROWSERS_PATH=<dossier> npx -y playwright@${EPINGLE.playwright} install chromium, puis l'outil avec ce même PLAYWRIGHT_BROWSERS_PATH`
}

/** Le navigateur épinglé lancé par Playwright, avec les `options` de `chromium.launch` : le build complet de Chromium
 *  (`channel`), jamais le headless shell ; un autre build est fermé, et son refus levé. */
export async function lancerLeNavigateurEpingle(options = {}) {
  const navigateur = await chromium.launch({ ...options, channel: 'chromium' })
  const { product } = await (await navigateur.newBrowserCDPSession()).send('Browser.getVersion')
  const refus = refusDuNavigateur(product, { plateforme: process.platform, architecture: process.arch })
  if (refus) {
    await navigateur.close()
    throw new Error(refus)
  }
  return navigateur
}

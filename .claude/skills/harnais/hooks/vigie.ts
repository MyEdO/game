// Fonction `vigie` du mod `harnais` (#2280, V5) : l'état de la CI (`main`, branche de l'arbre) et du train
// de publication sous les yeux de l'HUMAIN. Elle REND la mesure de `scripts/ops/vigie.mjs --json --arbre
// <racine> [--depuis <etat>]` : la status line, un toast par transition. Le réveil du modèle n'est pas
// ici (V1, `ops:ci -- --attendre`). Design : https://github.com/MyEdO/game/issues/2280#issuecomment-5995615185
import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'
import type { HarnaisMesureDeVigie, HarnaisVigie } from '../types'
import { appel, lire } from './ops'
import type { Lu } from './ops'

const DEPART: HarnaisVigie = { etat: null }
const atome = atom({ plugin: 'harnais', key: 'vigie' } as const, DEPART)

/** Période (ms) d'une mesure (#2280, V5). Valeur maison. */
const PERIODE_MS = 60 * 1000

/**
 * Une mesure depuis l'état retenu : la ligne va à la status line, chaque transition à un toast, l'état
 * rendu devient le `--depuis` suivant. Un échec va au journal de débogage et garde la dernière ligne.
 */
async function mesurer($: EngineInterface) {
  const { etat } = await read($, atome)
  const args = ['--json', '--arbre', await $.session.root(), ...(etat ? ['--depuis', etat] : [])]
  let lu: Lu<HarnaisMesureDeVigie>
  try {
    lu = lire(await $.process.run(...appel($.plugin.root, 'vigie', args)))
  } catch (erreur) {
    lu = { ok: false, motif: `non lancé (${String(erreur)})` }
  }
  if (!lu.ok) {
    $.ui.log(`harnais, vigie.mjs ${args.join(' ')} : ${lu.motif}`, { to: 'debug' })
    return
  }
  const mesure = lu.valeur
  await update($, atome, () => ({ etat: mesure.etat }))
  $.ui.status(mesure.ligne)
  for (const transition of mesure.transitions) $.ui.toast(transition)
}

export function vigie(on: On) {
  // Matcher `isInteractive` : le moteur 2.1.289 refuse deux `session.start` sans matcher dans un plugin
  // (`claude plugin validate --strict`, #2280), et la fonction rend pour l'humain ; une surface non
  // interactive (`-p`, SDK, Desktop s'il passe par le SDK) ne lance pas la vigie.
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    void mesurer($)
    $.clock.every(PERIODE_MS, () => {
      void mesurer($)
    })
    return next(e)
  })
}

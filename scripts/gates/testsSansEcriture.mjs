#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ouvrirControleEcritures } from '../guards/lib/controleEcritures.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { prendreVerrou, tenantEnUneLigne } from '../test/verrou.mjs'
import { verrouGestesLourds } from '../test/verrouGestesLourds.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Lance `node <args>` depuis `racine` sous le contrôle des écritures (`ouvrirControleEcritures`), le verrou `verrou`
 * (par défaut `verrouGestesLourds(racine)`) pris par `prendre` AVANT l'ouverture du contrôle, hors intercepteur :
 * l'enfant reçoit le jeton de la prise et l'emprunte (#2586). Refusé, imprime le refus et rend `CODE_DIFFERE` ;
 * le verrou se libère après l'enfant. Rend le code de sortie.
 */
export function lancerSansEcriture({ racine = RACINE, args, spawn = spawnSync, journal = console.error, env = process.env, verrou, prendre = prendreVerrou }) {
  let prise
  let controle
  try {
    const configuration = verrou ?? verrouGestesLourds(racine)
    const vu = prendre({
      ...configuration, env, cwd: racine, commande: ['testsSansEcriture', ...args].join(' '),
      attente: configuration.attente && { ...configuration.attente, annoncer: (tenant) => journal('[verrou] ' + tenantEnUneLigne(tenant)) },
    })
    if (vu.etat !== 'pris') { journal(vu.message); return CODE_DIFFERE }
    prise = vu
    controle = ouvrirControleEcritures(racine, { ...env, ...prise.env })
    const enfant = spawn(process.execPath, args, {
      cwd: racine,
      stdio: 'inherit',
      env: controle.env,
    })
    const refus = controle.fermer()
    for (const message of refus) journal(message)
    const code = enfant.status ?? 1
    return code || (refus.length ? 1 : 0)
  } catch (e) {
    journal(`[tests] contrôle des écritures impossible : ${e.message}`)
    return 1
  } finally {
    controle?.fermer()
    prise?.liberer()
  }
}

if (import.meta.main) process.exit(lancerSansEcriture({ args: [join(RACINE, 'scripts/test/node-tests.mjs'), ...process.argv.slice(2)] }))

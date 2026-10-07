// Point d'entrée PROPRE de la porte de fermeture (#2125) : hook séparé du répartiteur, parce qu'un
// commit de fermeture la fait durer plusieurs secondes et qu'un dépassement du `timeout` jetterait la
// sortie de toutes les gardes d'un même processus. Même barrière (`barriere-outil.mjs`, #2187), même
// moteur (`executer` de `repartition.mjs`), registre `REGISTRE_SOLDE` (`registre.mjs`).
import { franchir } from './barriere-outil.mjs'

await franchir(async () => {
  const [{ executer }, { REGISTRE_SOLDE }] = await Promise.all([import('./repartition.mjs'), import('./registre.mjs')])
  return () => executer(REGISTRE_SOLDE)
})

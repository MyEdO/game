// Point d'entrée du RÉPARTITEUR des hooks d'appel d'outil (#2125) : la barrière (`barriere-outil.mjs`,
// #2187), puis `executer` (`repartition.mjs`) sur le registre `REGISTRE` (`registre.mjs`). Imports
// statiques : la barrière seule.
import { franchir } from './barriere-outil.mjs'

await franchir(async () => {
  const [{ executer }, { REGISTRE }] = await Promise.all([import('./repartition.mjs'), import('./registre.mjs')])
  return () => executer(REGISTRE)
})

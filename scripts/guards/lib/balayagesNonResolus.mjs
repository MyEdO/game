// BALAYAGES NON RÉSOLUS (#2400) : les valeurs de site de lecture ou de listage que la dérivation du périmètre de
// tests (`balayagesNonResolus`, `scripts/test/perimetre.mjs`) ne rattache à aucune racine du dépôt, sur les
// modules qu'atteint la clôture d'au moins un test. Le CLASSIFIEUR (`classer`) exempte les classes légitimes par
// règle générale (`EXEMPTIONS`) et range le reste par classe (`CLASSES`, la famille de l'entrée de site) ; la
// régénération du stock (`regenerations`) sert `regenStock.mts` :
//   npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/balayagesNonResolus.mjs [--check]
// Le verdict vit dans `scripts/guards/balayages-non-resolus.test.mjs`.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { phraseDeNaissance } from './stock.mjs'
import { DECROISSANT, comptesParFamille, naissanceEnPlace } from './stockDeSites.mjs'
import { balayagesNonResolus } from '../../test/perimetre.mjs'

/** Le stock, relatif au dépôt. */
export const STOCK = 'scripts/guards/balayages-non-resolus-stock.json'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const CHEMIN_DU_STOCK = join(RACINE, STOCK)

/** Les classes LÉGITIMES, exemptées par règle générale (`exempte(valeur, raison repliée)`) : aucune entrée de stock. */
export const EXEMPTIONS = Object.freeze([
  Object.freeze({
    classe: 'valeur nulle',
    exempte: (_valeur, texte) => texte === 'forme NullKeyword',
    justification: "`null` ne désigne aucun chemin : une primitive de lecture le refuse, et l'autre branche d'une union `x ?? null` s'évalue et se classe pour elle-même.",
  }),
  Object.freeze({
    classe: 'module qui balaie la racine du dépôt',
    exempte: (valeur) => valeur.moduleBalaieLeDepot,
    justification: "un site RÉSOLU du même module balaie la racine du dépôt : tout fichier touché retient déjà chaque test qui atteint ce module, aucune autre lecture n'y échappe à la dérivation.",
  }),
])

/** Les classes de valeur non résolue, essayées dans l'ordre ; la dernière prend le reste. */
export const CLASSES = Object.freeze([
  Object.freeze({ classe: 'sortie de processus', motif: /^appel .*\b(?:stdout|execFileSync|execSync|spawnSync|sortieOuNull|gitDeLArbreReel|resultatDeLArbreReel|lancerGit)\b/ }),
  Object.freeze({ classe: 'paramètre non lié', motif: /^paramètre / }),
  Object.freeze({ classe: 'appel non suivi', motif: /^appel / }),
  Object.freeze({ classe: 'forme non évaluée', motif: /^forme / }),
  Object.freeze({ classe: 'déstructuration de tableau', motif: /^déstructuration de tableau / }),
  Object.freeze({ classe: 'variable sans valeur initiale', motif: / sans valeur initiale$/ }),
  Object.freeze({ classe: 'import non suivi', motif: /^import / }),
  Object.freeze({ classe: 'URL', motif: /^URL / }),
  Object.freeze({ classe: 'environnement de processus', motif: /^process introuvable$/ }),
  Object.freeze({ classe: 'identifiant introuvable', motif: / introuvable$/ }),
  Object.freeze({ classe: 'chemin absolu', motif: /^chemin absolu / }),
  Object.freeze({ classe: 'propriété non suivie', motif: /^propriété / }),
  Object.freeze({ classe: "cycle d'appels", motif: /^cycle d'appels / }),
  Object.freeze({ classe: "profondeur d'appels", motif: /^profondeur d'appels / }),
  Object.freeze({ classe: 'autre', motif: /^/ }),
])

/** Les familles du stock : les classes, dans leur ordre. */
export const FAMILLES = Object.freeze(CLASSES.map((c) => c.classe))

/** Une raison d'évaluateur sur une ligne : ses blancs repliés. PURE. */
const replier = (texte) => texte.replace(/\s+/g, ' ').trim()

/**
 * Le CLASSEMENT des valeurs non résolues (`balayagesNonResolus`) : les sites stockables, un par valeur, famille
 * = sa classe, `ref` = helper ou primitive et raison ; le compte exempté par règle (`EXEMPTIONS`). PURE.
 * @param {{ fichier: string, helper: string, raison: string, moduleBalaieLeDepot?: boolean }[]} nonResolus
 * @returns {{ sites: (import('./stock.mjs').Site & { famille: string })[], exemptes: Record<string, number> }}
 */
export function classer(nonResolus) {
  const sites = []
  const exemptes = Object.fromEntries(EXEMPTIONS.map((e) => [e.classe, 0]))
  for (const valeur of nonResolus) {
    const { fichier, helper, raison } = valeur
    const texte = replier(raison)
    const exemption = EXEMPTIONS.find((e) => e.exempte(valeur, texte))
    if (exemption) { exemptes[exemption.classe] += 1; continue }
    sites.push({ famille: CLASSES.find((c) => c.motif.test(texte)).classe, file: fichier, ref: `${helper} : ${texte}` })
  }
  return { sites, exemptes }
}

/** La MESURE du dépôt de `racine` : `classer` de ses balayages non résolus. */
export const mesure = (racine = RACINE) => classer(balayagesNonResolus(racine))

/** Le `quoi` du stock, comptes par classe à sa naissance. */
const QUOI = (comptes) => 'Balayages NON RÉSOLUS de la dérivation du périmètre de tests (#2400) : une ENTRÉE par valeur de site '
  + 'de lecture ou de listage que `scripts/test/perimetre.mjs` ne rattache à aucune racine, `famille` = sa classe '
  + `(\`CLASSES\`, \`scripts/guards/lib/balayagesNonResolus.mjs\`), \`ref\` = helper et raison. ${phraseDeNaissance(comptes, FAMILLES)} `
  + 'Une entrée se solde en rendant le site RÉSOLUBLE (forme lisible par `racinesBalayees.mjs`), puis en régénérant : '
  + '`npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/balayagesNonResolus.mjs`.'

/**
 * La RÉGÉNÉRATION du stock (`RegenerationDeStock`, `stockDeSites.mjs`) sur la mesure `sites`, politique
 * `DECROISSANT` ; le `quoi` garde les comptes de sa naissance.
 * @param {(import('./stock.mjs').Site & { famille: string })[]} [sites]
 * @returns {import('./stockDeSites.mjs').RegenerationDeStock[]}
 */
export function regenerations(sites = mesure().sites) {
  return [{
    chemin: CHEMIN_DU_STOCK,
    politique: DECROISSANT,
    horsCollections: QUOI(naissanceEnPlace(CHEMIN_DU_STOCK, FAMILLES) ?? comptesParFamille(sites, FAMILLES)),
    collections: [{
      nom: 'entrees',
      sites,
      motif: 'Un balayage neuf se rend RÉSOLUBLE (racine littérale, constante, relais à paramètre de premier niveau), il ne s’entérine pas ici.',
    }],
  }]
}

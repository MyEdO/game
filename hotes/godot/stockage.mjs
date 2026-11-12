// LE STOCKAGE DU PONT HORS D'UNE PAGE (#3009, `pont/CONTRAT.md`, section « Transport ») : ce que le bundle lit en
// `localStorage` quand aucun navigateur ne le porte (`pontDuBundle`, `processus.mjs`), au contrat de `Stockage`
// (`src/lib/stockage.ts`). Ses clés vivent en mémoire ; avec un fichier, elles en sont relues à l'ouverture et y sont
// réécrites à chaque changement.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { estObjet } from '../../src/lib/objet.mjs'

/** Les clés gardées dans `fichier` : un objet JSON de chaînes ; rien s'il est absent, illisible ou d'une autre forme. */
function relire(fichier) {
  try {
    const lu = JSON.parse(readFileSync(fichier, 'utf8'))
    return estObjet(lu) && Object.values(lu).every((v) => typeof v === 'string') ? Object.entries(lu) : []
  } catch {
    return []
  }
}

/** Le stockage d'un pont de processus : en mémoire seule sans `fichier` (`null`), sinon relu de `fichier` et réécrit
 *  en entier à chaque changement, par un fichier voisin renommé, pour qu'une coupure ne laisse jamais un fichier tronqué. */
export function stockageDuProcessus(fichier) {
  const contenu = new Map(fichier ? relire(fichier) : [])
  const garder = () => {
    if (!fichier) return
    mkdirSync(dirname(fichier), { recursive: true })
    writeFileSync(`${fichier}.tmp`, JSON.stringify(Object.fromEntries(contenu)))
    renameSync(`${fichier}.tmp`, fichier)
  }
  return {
    getItem: (cle) => contenu.get(cle) ?? null,
    setItem: (cle, valeur) => {
      contenu.set(cle, String(valeur))
      garder()
    },
    removeItem: (cle) => {
      if (contenu.delete(cle)) garder()
    },
  }
}

import { analyserCorpus } from '../../guards/lib/dialecte.mjs';
/**
 * Mesure des TROIS canaux par lesquels une entité mécanique porte sa mécanique EN DONNÉE, dérivée
 * des DÉCLARATIONS de champs (AST), jamais des commentaires :
 *  - `passive`  — modificateurs de VALEUR en `GameOp[]`, exécutés par `applyOps(target, ops)` ;
 *  - `effects`  — effets DÉCLENCHÉS en `TriggeredEffect[]`, dispatchés par `fireTriggers` ;
 *  - `drapeaux` — `capabilities` / `combat` : prédicats SANS cible, lus par des dispatchers
 *    génériques (`…Capabilities`, `CombatFeature`).
 *
 * Un champ ne compte pour un canal que si son TYPE le porte : `SpellData.effects: Flow` n'est pas
 * un canal d'effet déclenché, `WeaponGroupData.combat: 'melee' | 'ranged'` n'est pas un drapeau de
 * capacité. C'est le type déclaré qui tranche, pas le nom.
 */
import * as ts from 'typescript/unstable/ast'
import { readFileSync } from 'node:fs'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'

/** Les trois canaux, dans l'ordre de rendu. `champs` = noms acceptés, `marqueur` = motif que le
 *  TYPE déclaré doit porter pour que le champ compte. */
export const CANAUX = [
  { id: 'passive', libelle: 'passive', champs: ['passive'], marqueur: /\bGameOp\b/ },
  { id: 'effects', libelle: 'effects', champs: ['effects'], marqueur: /\bTriggeredEffect\b/ },
  { id: 'drapeaux', libelle: 'capabilities / combat', champs: ['capabilities', 'combat'], marqueur: /Capabilities\b|\bCombatFeature\b/ },
]

const plat = (s) => s.replace(/\s+/g, ' ').trim()

/** Canal d'un membre `nom: type`, ou `null` si ce membre n'est aucun des trois canaux. */
export function canalDuMembre(nom, type) {
  for (const c of CANAUX) if (c.champs.includes(nom) && c.marqueur.test(type)) return c.id
  return null
}

/** Membres (nom + type aplati) d'une déclaration d'interface. */
function membres(decl, sf) {
  const out = []
  for (const m of decl.members) {
    if (!ts.isPropertySignatureDeclaration(m) || !m.name) continue
    out.push({ nom: m.name.getText(sf), type: m.type ? plat(m.type.getText(sf)) : '' })
  }
  return out
}

/**
 * @param {string[]} fichiers chemins de sources TypeScript à sonder
 * @returns {{entites: Array, typesDrapeaux: Array}} entités portant ≥1 canal (triées par nom), et
 *   les types de drapeaux qu'elles référencent, avec leurs champs déclarés.
 */
export function mesurerCanaux(fichiers) {
  const entites = []
  /** nom de type de drapeaux → déclaration trouvée (toutes les interfaces du périmètre). */
  const interfaces = new Map()

  for (const { fichier: { rel: f }, sourceFile: sf } of analyserCorpus(fichiers.map((f) => ({ rel: f, text: readFileSync(f, 'utf8') })))) {
    const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    const visite = (n) => {
      if (ts.isInterfaceDeclaration(n)) {
        const ms = membres(n, sf)
        interfaces.set(n.name.text, { fichier: f, ligne: ligne(n), champs: ms.map((m) => m.nom) })
        const canaux = {}
        for (const m of ms) {
          const id = canalDuMembre(m.nom, m.type)
          if (id) canaux[id] = { champ: m.nom, type: m.type }
        }
        if (Object.keys(canaux).length) {
          entites.push({ entite: n.name.text, fichier: f, ligne: ligne(n), canaux, heritage: (n.heritageClauses ?? []).flatMap((h) => h.types.map((t) => plat(t.getText(sf)))) })
        }
      }
      n.forEachChild(visite)
    }
    sf.forEachChild(visite)
  }

  entites.sort((a, b) => parUnitesDeCode(a.entite, b.entite))

  // Types de drapeaux RÉELLEMENT référencés par les entités mesurées (l'univers du 3e canal).
  const noms = new Set()
  for (const e of entites) {
    const t = e.canaux.drapeaux?.type
    if (!t) continue
    for (const m of t.matchAll(/[A-Z][A-Za-z0-9_]*/g)) if (/Capabilities$|^CombatFeature$/.test(m[0])) noms.add(m[0])
  }
  const typesDrapeaux = [...noms].sort(parUnitesDeCode).map((nom) => ({ nom, ...(interfaces.get(nom) ?? { fichier: null, ligne: null, champs: [] }) }))

  return { entites, typesDrapeaux }
}

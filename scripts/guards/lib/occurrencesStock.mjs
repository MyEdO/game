import { analyserTexte, typescript } from './dialecte.mjs'
import { ecartsDeStock } from './stock.mjs'

export const siteDeForme = (f) => `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature}`
export const siteDeSlot = (s) => `${s.dataset} | ${s.champ}`

export function actualiserOccurrences(collections) {
  const ts = typescript()
  return collections.map(({ texte, rel, nom, observe, stock, site }) => {
    const ecarts = ecartsDeStock({ observe, stock, cle: site })
    if (ecarts.taille !== stock.length || new Set(observe.map(site)).size !== observe.length)
      throw new Error(`${nom} : identités dupliquées`)
    if (ecarts.neuves.length || ecarts.perimees.length)
      throw new Error(`${nom} : identités inconnues ${ecarts.neuves.join('; ')} ; disparues ${ecarts.perimees.join('; ')}`)
    const { sourceFile: sf, diagnostics } = analyserTexte({ rel, text: texte })
    if (!sf || diagnostics.length) throw new Error(`${nom} : AST invalide`)
    const declarations = sf.statements.filter((s) => ts.isVariableStatement(s)
      && s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      && (s.declarationList.flags & ts.NodeFlags.Const)).flatMap((s) => [...s.declarationList.declarations])
      .filter((d) => ts.isIdentifier(d.name) && d.name.text === nom)
    if (declarations.length !== 1 || !declarations[0].initializer || !ts.isArrayLiteralExpression(declarations[0].initializer))
      throw new Error(`${nom} : export const tableau littéral requis`)
    const mesures = new Map(observe.map((e) => [site(e), e.occurrences]))
    const attendus = new Map(stock.map((e) => [site(e), e]))
    const vus = new Set()
    const remplacements = []
    for (const objet of declarations[0].initializer.elements) {
      if (!ts.isObjectLiteralExpression(objet)) throw new Error(`${nom} : entrée AST non reconnue`)
      const valeurs = {}
      const proprietes = new Map()
      for (const p of objet.properties) {
        if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
          throw new Error(`${nom} : propriété AST non reconnue`)
        const cle = p.name.text
        if (proprietes.has(cle)) throw new Error(`${nom} : propriété ambiguë ${cle}`)
        proprietes.set(cle, p.initializer)
        if (ts.isStringLiteral(p.initializer)) valeurs[cle] = p.initializer.text
      }
      const cle = site(valeurs)
      const entree = attendus.get(cle)
      if (!entree || vus.has(cle)) throw new Error(`${nom} : identité AST inconnue ou dupliquée ${cle}`)
      vus.add(cle)
      const n = proprietes.get('occurrences')
      const mesure = mesures.get(cle)
      if (!n || !ts.isNumericLiteral(n) || !Number.isSafeInteger(Number(n.text)) || Number(n.text) < 0
        || Number(n.text) !== entree.occurrences || !Number.isSafeInteger(mesure) || mesure < 0)
        throw new Error(`${nom} : occurrences entières littérales requises pour ${cle}`)
      if (Number(n.text) !== mesure) remplacements.push({ debut: n.getStart(sf), fin: n.end, valeur: String(mesure), site: cle })
    }
    if (vus.size !== stock.length) throw new Error(`${nom} : identité AST disparue`)
    remplacements.sort((a, b) => b.debut - a.debut)
    let resultat = texte
    let borne = texte.length
    for (const r of remplacements) {
      if (r.fin > borne) throw new Error(`${nom} : spans recouvrants`)
      resultat = resultat.slice(0, r.debut) + r.valeur + resultat.slice(r.fin)
      borne = r.debut
    }
    return { rel, texte: resultat, changements: remplacements.map((r) => r.site) }
  })
}

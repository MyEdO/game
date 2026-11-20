// Reporter `node --test` des DURÉES par fichier (#2400), en JSON `{ durees: { [chemin absolu]: ms }, echecs: [chemin
// absolu], resume, fichiersTermines, echecsDesTests }` : l'ENVELOPPE du fichier (le `test:complete` de premier niveau qu'aucun `test:pass`/`test:fail` ne double :
// son processus, chargement compris), sinon la somme de ses tests de premier niveau ; en échec, le fichier qui porte un
// `test:fail` de premier niveau hors `todo` et `skip`. Les résumés attestent la fin, et `echecsDesTests` conserve
// les assertions structurées et les autres échecs de premier niveau si le processus du fichier quitte avant son résumé
// (doc Node, `test:fail`).
// Lu par `scripts/test/perimetre.mjs` et `scripts/test/node-tests.mjs`.
export default async function* dureesNodeTest(source) {
  const fichiers = new Map()
  const fichiersTermines = new Map()
  const echecsDesTests = new Set()
  let resume = null
  const fichier = (f) => fichiers.get(f) ?? fichiers.set(f, { somme: 0, tests: new Set(), complets: [], echoue: false }).get(f)
  for await (const { type, data } of source) {
    const entree = data?.entryFile ?? data?.file
    if (type === 'test:summary') {
      const fin = { succes: data.success, echecs: data.counts.failed }
      if (entree) fichiersTermines.set(entree, fin)
      else resume = fin
    }
    const echec = type === 'test:fail' && !data?.todo && !data?.skip
    if (echec && entree) {
      const erreur = data.details?.error
      const echecDuTest = data.nesting === 0 && data.entryFile && ['testCodeFailure', 'subtestsFailed', 'hookFailed'].includes(erreur?.failureType)
      if (erreur?.code === 'ERR_TEST_FAILURE' && erreur.exitCode == null && erreur.signal == null &&
        (echecDuTest || erreur.cause?.code === 'ERR_ASSERTION')) echecsDesTests.add(entree)
    }
    if (data?.nesting !== 0 || !data.file) continue
    const duree = data.details?.duration_ms ?? 0
    if (type === 'test:pass' || type === 'test:fail') {
      fichier(data.file).somme += duree
      fichier(data.file).tests.add(data.name)
      if (echec) fichier(data.file).echoue = true
    } else if (type === 'test:complete') fichier(data.file).complets.push([data.name, duree])
  }
  const durees = {}
  for (const [f, { somme, tests, complets }] of fichiers) durees[f] = complets.find(([nom]) => !tests.has(nom))?.[1] ?? somme
  yield JSON.stringify({ durees, echecs: [...fichiers].filter(([, { echoue }]) => echoue).map(([f]) => f), resume, fichiersTermines: Object.fromEntries(fichiersTermines), echecsDesTests: [...echecsDesTests] })
}

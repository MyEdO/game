// Reporter `node --test` des DURÉES par fichier (#2400), en JSON `{ durees: { [chemin absolu]: ms }, echecs: [chemin
// absolu] }` : l'ENVELOPPE du fichier (le `test:complete` de premier niveau qu'aucun `test:pass`/`test:fail` ne double :
// son processus, chargement compris), sinon la somme de ses tests de premier niveau ; en échec, le fichier qui porte un
// `test:fail` de premier niveau hors `todo` et `skip`, qui ne rougissent pas le run (doc Node, `test:fail`). Lu par `scripts/test/perimetre.mjs` et `scripts/test/node-tests.mjs`.
export default async function* dureesNodeTest(source) {
  const fichiers = new Map()
  const fichier = (f) => fichiers.get(f) ?? fichiers.set(f, { somme: 0, tests: new Set(), complets: [], echoue: false }).get(f)
  for await (const { type, data } of source) {
    if (data?.nesting !== 0 || !data.file) continue
    const duree = data.details?.duration_ms ?? 0
    if (type === 'test:pass' || type === 'test:fail') {
      fichier(data.file).somme += duree
      fichier(data.file).tests.add(data.name)
      if (type === 'test:fail' && !data.todo && !data.skip) fichier(data.file).echoue = true
    } else if (type === 'test:complete') fichier(data.file).complets.push([data.name, duree])
  }
  const durees = {}
  for (const [f, { somme, tests, complets }] of fichiers) durees[f] = complets.find(([nom]) => !tests.has(nom))?.[1] ?? somme
  yield JSON.stringify({ durees, echecs: [...fichiers].filter(([, { echoue }]) => echoue).map(([f]) => f) })
}

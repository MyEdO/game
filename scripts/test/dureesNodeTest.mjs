// Reporter `node --test` des DURÉES par fichier (#2400), en JSON `{ [chemin absolu]: ms }` : l'ENVELOPPE du
// fichier (le `test:complete` de premier niveau qu'aucun `test:pass`/`test:fail` ne double : son processus,
// chargement compris), sinon la somme de ses tests de premier niveau. Lu par `scripts/test/perimetre.mjs`.
export default async function* dureesNodeTest(source) {
  const fichiers = new Map()
  const fichier = (f) => fichiers.get(f) ?? fichiers.set(f, { somme: 0, tests: new Set(), complets: [] }).get(f)
  for await (const { type, data } of source) {
    if (data?.nesting !== 0 || !data.file) continue
    const duree = data.details?.duration_ms ?? 0
    if (type === 'test:pass' || type === 'test:fail') {
      fichier(data.file).somme += duree
      fichier(data.file).tests.add(data.name)
    } else if (type === 'test:complete') fichier(data.file).complets.push([data.name, duree])
  }
  const durees = {}
  for (const [f, { somme, tests, complets }] of fichiers) durees[f] = complets.find(([nom]) => !tests.has(nom))?.[1] ?? somme
  yield JSON.stringify(durees)
}

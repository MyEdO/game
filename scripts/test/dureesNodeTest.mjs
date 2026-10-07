// Reporter `node --test` des DURÉES par fichier (#2400) : la somme des durées de ses tests de premier
// niveau, en JSON `{ [chemin absolu]: ms }`. Lu par `scripts/test/perimetre.mjs`.
export default async function* dureesNodeTest(source) {
  const durees = {}
  for await (const { type, data } of source)
    if ((type === 'test:pass' || type === 'test:fail') && data.nesting === 0 && data.file)
      durees[data.file] = (durees[data.file] ?? 0) + (data.details?.duration_ms ?? 0)
  yield JSON.stringify(durees)
}

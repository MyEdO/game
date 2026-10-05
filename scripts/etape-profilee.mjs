export function etapeProfilee(nom, geste, { horloge = () => performance.now(), annoncer = (texte) => process.stderr.write(texte), mesurer = () => {} } = {}) {
  annoncer(`${nom} — début\n`)
  const depart = horloge()
  try {
    return geste()
  } finally {
    const ms = horloge() - depart
    mesurer(ms)
    annoncer(`${nom} — fin (${Math.round(ms)} ms)\n`)
  }
}

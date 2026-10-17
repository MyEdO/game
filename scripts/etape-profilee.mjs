export function etapeProfilee(nom, geste, { horloge = () => performance.now(), date = () => new Date(), annoncer = (texte) => process.stderr.write(texte), mesurer = () => {} } = {}) {
  annoncer(`${nom} — début\n`)
  const debut = date().toISOString()
  const depart = horloge()
  try {
    return geste()
  } finally {
    const ms = horloge() - depart
    mesurer({ nom, debut, fin: date().toISOString(), ms })
    annoncer(`${nom} — fin (${Math.round(ms)} ms)\n`)
  }
}

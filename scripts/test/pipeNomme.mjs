// PIPE NOMMÉ DE BANC (#2603) : un serveur `net` sur un pipe Windows neuf, qui compte les connexions
// qu'il accepte. Une connexion témoin, envoyée après le geste mesuré, n'est vue qu'une fois celles du
// geste acceptées : `connexionsHorsTemoin` l'attend puis la décompte.
import net from 'node:net'

/** Serveur fermé par `t.after`. `nom` : le segment propre au pipe, sans le préfixe `\\.\pipe\`. */
export async function servirPipe(t, prefixe) {
  const nom = `${prefixe}-${process.pid}-${Date.now()}`
  const pipe = '\\\\.\\pipe\\' + nom
  let vues = 0
  let temoinVu
  const temoin = new Promise((fin) => { temoinVu = fin })
  const serveur = net.createServer((s) => {
    vues++
    s.on('error', () => {})
    s.on('end', () => s.destroy())
    s.on('data', () => { temoinVu(); s.destroy() })
  })
  await new Promise((fin) => serveur.listen(pipe, fin))
  t.after(() => new Promise((fin) => serveur.close(fin)))
  const connexionsHorsTemoin = async () => {
    const client = net.connect(pipe, () => client.end('t'))
    client.on('error', () => {})
    await temoin
    return vues - 1
  }
  return { pipe, nom, connexionsHorsTemoin }
}

import { spawn } from 'node:child_process'
import { connect } from 'node:net'

const [adresse, jeton] = process.argv.slice(2)
const canal = connect(adresse)
canal.setEncoding('utf8')
let tampon = ''
let optionsRecues = false
let rendu = false
const borne = setTimeout(() => process.exit(1), 15000)
function erreurDe(e) {
  return { code: e.code ?? 'ESPAWN', message: /options\.env/.test(e.message) ? 'environnement de cible invalide' : e.message }
}
function rendre(resultat) {
  if (rendu) return
  rendu = true
  canal.end(JSON.stringify({ type: 'resultat', resultat }) + '\n', () => process.exit(0))
}
canal.once('connect', () => canal.write(JSON.stringify({ type: 'pret', jeton }) + '\n'))
canal.on('error', () => process.exit(1))
canal.on('end', () => { if (!rendu) process.exit(1) })
canal.on('data', (texte) => {
  tampon += texte
  const fin = tampon.indexOf('\n')
  if (fin < 0) return
  let message
  try { message = JSON.parse(tampon.slice(0, fin)) } catch { process.exit(1) }
  tampon = tampon.slice(fin + 1)
  if (optionsRecues || message.type !== 'options' || !message.options) process.exit(1)
  optionsRecues = true
  clearTimeout(borne)
  const { commande, args, cwd, env, shell } = message.options
  try {
    const enfant = spawn(commande, args, { shell, cwd, env, stdio: 'inherit', windowsHide: true })
    enfant.once('error', (e) => rendre({ status: null, signal: null, error: erreurDe(e) }))
    enfant.once('exit', (status, signal) => rendre({ status, signal }))
  } catch (e) {
    rendre({ status: null, signal: null, error: erreurDe(e) })
  }
})

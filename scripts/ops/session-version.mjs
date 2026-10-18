import { spawnSync } from 'node:child_process'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'

const refuser = (message) => { throw new Error(`${prefixeDeRefus('validation')} ${message}`) }
const versionDe = (texte) => {
  const m = /^(?:codex(?:-cli)?\s+)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(texte.trim())
  if (!m || m[4]?.split('.').some((s) => /^0\d+$/.test(s))) refuser(`VERSION CODEX INVALIDE : ${texte}`)
  return { texte: texte.trim().replace(/^codex(?:-cli)?\s+/, ''), nombres: m.slice(1, 4).map(Number), pre: m[4]?.split('.') }
}
export function comparerVersions(a, b) {
  const x = versionDe(a), y = versionDe(b)
  for (let i = 0; i < 3; i++) if (x.nombres[i] !== y.nombres[i]) return Math.sign(x.nombres[i] - y.nombres[i])
  if (!x.pre || !y.pre) return x.pre ? -1 : y.pre ? 1 : 0
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i]
    if (p === q) continue
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q)
    if (pn && qn) return Math.sign(Number(p) - Number(q))
    if (pn !== qn) return pn ? -1 : 1
    return p < q ? -1 : 1
  }
  return 0
}

export async function verifierVersionCodex(executable, { executer = spawnSync, fetcher = fetch, avertir = (message) => process.stderr.write(`${message}\n`), timeoutMs = 8000 } = {}) {
  const vu = executer(executable, ['--version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: timeoutMs })
  if (vu.error || vu.status !== 0) refuser(`VERSION CODEX INDISPONIBLE : ${vu.error?.message ?? vu.stderr ?? vu.status}`)
  const locale = versionDe(vu.stdout).texte
  const abort = new AbortController()
  let timer
  try {
    const resultat = await Promise.race([
      (async () => {
        const reponse = await fetcher('https://registry.npmjs.org/@openai%2fcodex/latest', { signal: abort.signal })
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
        return versionDe((await reponse.json()).version).texte
      })(),
      new Promise((_, non) => { timer = setTimeout(() => { abort.abort(); non(new Error('délai registre dépassé')) }, timeoutMs) }),
    ])
    if (comparerVersions(locale, resultat) < 0) refuser(`CODEX OBSOLÈTE : ${locale} < ${resultat} ; npm install -g @openai/codex@latest`)
    return { locale, derniere: resultat }
  } catch (e) {
    if (e.message.startsWith(prefixeDeRefus('validation'))) throw e
    avertir(`${prefixeDeRefus('transitoire')} REGISTRE CODEX INJOIGNABLE : ${e.message} ; version locale ${locale} conservée`)
    return { locale, derniere: null }
  } finally { clearTimeout(timer); abort.abort() }
}

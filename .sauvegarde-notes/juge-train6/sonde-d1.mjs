// Balayage du test (coupeAuMot.test.ts:48-73) rejoué contre l'implémentation réelle et deux mutants EN MÉMOIRE.
import { readFileSync } from 'node:fs'
const src = readFileSync('/home/user/game/.wt-1806-L2/src/lib/coupeAuMot.mjs', 'utf8')
const charge = async (texte) => (await import('data:text/javascript,' + encodeURIComponent(texte))).coupeAuMot
const variantes = {
  reel: src,
  exceptionRendTout: src.replace('if (coupe <= debut) {', 'if (coupe <= debut) { return s;'),
  sansEllipse: src.replace('return prefixe.length === s.trimEnd().length ? prefixe : `${prefixe}…`', 'return prefixe'),
}
for (const [k, v] of Object.entries(variantes)) if (k !== 'reel' && v === src) throw new Error('mutant non appliqué ' + k)
function balayage(coupeAuMot, avecTrim = true) {
  let graine = 42
  const alea = () => (graine = (graine * 1103515245 + 12345) >>> 0) / 2 ** 32
  const alphabet = ['a', 'b', 'c', 'é', ' ', ' ', ' ', '\n', '  ']
  const TETE_ET_MOT = /^\s*\S[\S   ]*/
  const f = {}
  const push = (k, cas) => { f[k] ??= { n: 0, ex: cas }; f[k].n++ }
  for (let i = 0; i < 20000; i++) {
    let s = ''
    for (let k = Math.floor(alea() * 30); k > 0; k--) s += alphabet[Math.floor(alea() * alphabet.length)]
    const n = 1 + Math.floor(alea() * 20)
    const rendu = coupeAuMot(s, n)
    const cas = `${JSON.stringify(s)} ${n} -> ${JSON.stringify(rendu)}`
    if (s.length <= n) { if (rendu !== s) push('entier attendu', cas); continue }
    const teteEtMot = TETE_ET_MOT.exec(s)?.[0].length ?? s.length
    const base = rendu.replace(/…$/, '')
    if (rendu.length > n && teteEtMot <= n - 1) push('au-delà de n', cas)
    const attendu = avecTrim ? s.slice(0, teteEtMot).trimEnd() : s.slice(0, teteEtMot)
    if (rendu.length > n && base !== attendu) push('sortie non entière', cas)
    if (rendu.endsWith('…') !== base.length < s.trimEnd().length) push('ellipse fausse', cas)
    if (!s.startsWith(base)) push('pas un préfixe', cas)
    if (base.trim() === '' && s.trim() !== '') push('texte perdu', cas)
  }
  return f
}
for (const [k, v] of Object.entries(variantes)) console.log(k, JSON.stringify(balayage(await charge(v))))
console.log('reel sans trimEnd', JSON.stringify(balayage(await charge(src), false)))
const c = await charge(src)
console.log('cas du rendu', JSON.stringify(c('b    \n  ccbaaaa', 1)))

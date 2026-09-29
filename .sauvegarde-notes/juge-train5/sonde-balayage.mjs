import { coupeAuMot } from '/home/user/game/.wt-1806-L2/src/lib/coupeAuMot.mjs'
// Rejoue le prédicat EXACT du balayage (coupeAuMot.test.ts:335-360) contre des mutants en mémoire.
function balayage(f) {
  let graine = 42; const alea = () => (graine = (graine * 1103515245 + 12345) >>> 0) / 2 ** 32
  const alphabet = ['a','b','c','é',' ',' ',' ','\n','  ']; const secable = /[^\S   ]/; const fautes = []
  for (let i = 0; i < 20000 && fautes.length < 5; i++) {
    let s = ''; for (let k = Math.floor(alea() * 30); k > 0; k--) s += alphabet[Math.floor(alea() * alphabet.length)]
    const n = 1 + Math.floor(alea() * 20); const rendu = f(s, n); const cas = `${JSON.stringify(s)} ${n} -> ${JSON.stringify(rendu)}`
    if (s.length <= n) { if (rendu !== s) fautes.push(`entier ${cas}`); continue }
    const debut = Math.max(0, s.search(/\S/)); const mot = s.slice(debut).search(secable); const teteEtMot = debut + (mot < 0 ? s.length - debut : mot)
    if (rendu.length > n && teteEtMot <= n - 1) fautes.push(`au-dela ${cas}`)
    const base = rendu.replace(/…$/, ''); if (!s.startsWith(base)) fautes.push(`prefixe ${cas}`)
    if (base.trim() === '' && s.trim() !== '') fautes.push(`perdu ${cas}`)
  }
  return fautes
}
const mutants = {
  reel: coupeAuMot,
  exceptionRendTout: (s, n) => { const r = coupeAuMot(s, n); return r.length > n ? s : r },
  unCaractere: (s, n) => s.length <= n ? s : (s.trimStart()[0] ? s.slice(0, s.search(/\S/) + 1) + '…' : ''),
  sansEllipse: (s, n) => coupeAuMot(s, n).replace(/…$/, ''),
  rendVide: (s, n) => s.length <= n ? s : '',
}
for (const [k, f] of Object.entries(mutants)) { const r = balayage(f); console.log(k, r.length, r[0] ?? '') }
for (const [s, n] of [['      ', 3], ['    ', 2], ['   abc def', 5], ['       ab cd', 3], ['   abcdef   ', 5]]) console.log(JSON.stringify(s), n, JSON.stringify(coupeAuMot(s, n)))

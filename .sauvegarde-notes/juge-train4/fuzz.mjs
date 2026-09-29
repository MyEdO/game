import { coupeAuMot } from '/home/user/game/.wt-1806-L2/src/lib/coupeAuMot.mjs'
let seed = 42; const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32)
const alpha = ['a','b','c',' ',' ',' ','\n','é','  ']
let viol = 0, exc = 0, n0 = 0, perte = 0
for (let i = 0; i < 200000; i++) {
  const len = Math.floor(r() * 30); let s = ''; for (let k = 0; k < len; k++) s += alpha[Math.floor(r() * alpha.length)]
  const n = 1 + Math.floor(r() * 20); const o = coupeAuMot(s, n)
  if (s.length <= n) { if (o !== s) viol++; continue }
  const debut = Math.max(0, s.search(/\S/)); const mot1 = s.slice(debut).search(/[^\S   ]/); const lmot = mot1 < 0 ? s.length - debut : mot1
  if (o.length > n) { if (debut + lmot > n - 1) exc++; else { viol++; if (viol < 4) console.log('VIOL', JSON.stringify(s), n, JSON.stringify(o)) } }
  const base = o.endsWith('…') ? o.slice(0, -1) : o
  if (!s.startsWith(base)) { perte++; if (perte < 4) console.log('PREFIXE', JSON.stringify(s), n, JSON.stringify(o)) }
  if (base.trim() === '' && s.trim() !== '') { n0++; if (n0 < 4) console.log('VIDE', JSON.stringify(s), n, JSON.stringify(o)) }
}
console.log({ viol, exc, perte, vide: n0 })

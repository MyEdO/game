import * as importe12_0 from 'node:assert/strict'
export const banccssCouchestestmjs = (() => {
const assert = importe12_0.default
const six = ({ SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE }) => ({ SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE })
const invariants = (nom, v) => {
  assert.equal(v.stock[1] - v.stock[0], v.APPARU + v.RETOURNE - v.SORTI, `${nom} : Δstock = APPARU + RETOURNÉ − SORTI`)
  assert.equal(v.SORTI, v.RECLASSE + v.PRIMITIVISE + v.DISPARU, `${nom} : SORTI = RECLASSÉ + PRIMITIVISÉ + DISPARU`)
  for (const [k, n] of Object.entries(six(v))) assert.ok(n >= 0, `${nom} : ${k} ≥ 0`)
}
const volet = ([SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE = 0]) => ({ SORTI, RECLASSE, PRIMITIVISE, DISPARU, APPARU, RETOURNE })
return { six, invariants, volet }
})()

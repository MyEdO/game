// `ecart` (ecart.mjs) compte les pixels qui diffèrent entre deux PNG et la boîte qui les contient ; d'une taille à
// l'autre, tous.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encoderPng } from '../qc/lib/pngEncode.mjs'
import { ecart } from './ecart.mjs'

const png = (w, h, autres = []) => encoderPng({ w, h, data: Buffer.from(Array.from({ length: w * h }, (_, k) => (autres.includes(k) ? [200, 10, 10, 255] : [10, 20, 30, 255])).flat()) })

test('compte les pixels qui diffèrent et leur boîte, aucun entre deux images égales', () => {
  assert.deepEqual(ecart(png(4, 3), png(4, 3)), { pixels: 0, boite: '' })
  assert.deepEqual(ecart(png(4, 3, [5, 11]), png(4, 3)), { pixels: 2, boite: 'de (1, 1) à (3, 2)' })
})

test('compte tous les pixels d’une taille à l’autre', () => {
  assert.deepEqual(ecart(png(4, 3), png(2, 2)), { pixels: 12, boite: 'étalon 2×2, rendu 4×3' })
})

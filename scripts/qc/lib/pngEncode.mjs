/**
 * ENCODEUR PNG PARTAGÉ des harnais (#3935, #5010), pendant de `pngDecode.mjs` : PNG RGBA 8 bits non entrelacé, pour les
 * planches côte à côte (`hotes/godot/planches.mjs`), les relevés de `hotes/godot/recette.mjs` et les bancs d'`ecart`.
 */
import { crc32, deflateSync } from 'node:zlib'

/** Le PNG RGBA 8 bits de l'image `image` (`data` : ses pixels RGBA, rangée après rangée). */
export function encoderPng({ w, h, data }) {
  const rangees = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) rangees.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1)
  const bloc = (type, donnees) => {
    const tete = Buffer.alloc(8)
    tete.writeUInt32BE(donnees.length)
    tete.write(type, 4)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), donnees])))
    return Buffer.concat([tete, donnees, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(rangees)), bloc('IEND', Buffer.alloc(0))])
}

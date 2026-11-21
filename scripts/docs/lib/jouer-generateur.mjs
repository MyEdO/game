import { pathToFileURL } from 'node:url'
import { lancerDepuisManifeste } from './ecriture-derives.mjs'

await lancerDepuisManifeste(import.meta, async (script) => {
  const { produire } = await import(pathToFileURL(script).href)
  return produire
})

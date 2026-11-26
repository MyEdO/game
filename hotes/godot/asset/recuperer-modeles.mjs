import { chargerAssets } from './charger.mjs'

const { recupererModeles, DOSSIER_DES_MODELES, recupererEpingles, DOSSIER_DES_TEXTURES } = await chargerAssets([
  "export { recupererEpingles, DOSSIER_DES_TEXTURES } from '/hotes/godot/asset/epingles.ts';",
])
await recupererModeles({ dossier: DOSSIER_DES_MODELES })
await recupererEpingles({ dossiers: [DOSSIER_DES_TEXTURES] })

import { chargerAssets } from './charger.mjs'

const { recupererModeles, DOSSIER_DES_MODELES } = await chargerAssets()
await recupererModeles({ dossier: DOSSIER_DES_MODELES })

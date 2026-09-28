/**
 * IDS STABLES des qualités d'objet — clés de RÈGLES côté moteur. L'`id` = `qualities.json[].id` :
 * ce que la DONNÉE et le runtime (`ItemInstance/Weapon.qualities`, des `QualityInstance{id,
 * value?}`) stockent. `hasQuality`/`qualityIndice` comparent par cet id.
 *
 * `QualityId` est GÉNÉRÉ depuis `qualities.json` par `scripts/gen-quality-ids.mjs`
 * (`npm run gen:quality-ids`) — voir `./qualityId.generated.ts`, NE PAS ÉDITER À LA MAIN. Union de
 * littéraux seulement (aucun export runtime) : les sites d'appel écrivent l'id directement
 * (`hasQuality(w, 'flexible')`), typé `QualityId` — un id renommé/retiré de `qualities.json` fait
 * échouer la compilation aux sites qui le citaient. Fraîcheur vérifiée par `npm run docs:check`
 * (ligne de `GENERATORS`, scripts/docs/build-all.mjs).
 */
export type { QualityId } from './qualityId.generated';

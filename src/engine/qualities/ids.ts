import type { IdsParEspace } from '../../data/schemas/_ids.generated';

/**
 * IDS STABLES des qualités d'objet — clés de RÈGLES côté moteur. L'`id` = `qualities.json[].id` :
 * ce que la DONNÉE et le runtime (`ItemInstance/Weapon.qualities`, des `QualityInstance{id,
 * value?}`) stockent. `hasQuality`/`qualityIndice` comparent par cet id.
 *
 * `QualityId` est l'espace `qualities.json` de `IdsParEspace` (`src/data/schemas/_ids.generated.ts`,
 * émis par `scripts/gen-espaces.mts`). Union de littéraux seulement (aucun export runtime) : les sites
 * d'appel écrivent l'id directement (`hasQuality(w, 'flexible')`), typé `QualityId` — un id
 * renommé/retiré de `qualities.json` fait échouer la compilation aux sites qui le citaient.
 */
export type QualityId = IdsParEspace['qualities.json'];

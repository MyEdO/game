import { PROPS } from '../../gameIso/catalog/decor';
import type { SceneEntity } from '../../state/scene';
import { EMPTY_FLOW } from '../../state/flow';
import { ACTION_FOUILLER } from '../../state/usable';
import { refEstVolumique } from '../../data';
import { CAP_IDENTITE_PROP, capDecorAdmis } from '../../data/props.types';

/** Patch d'inspecteur quand on choisit un décor : pré-arme une action authorée `fouiller` si le prop
 *  est `searchable` ET que l'instance n'en porte encore AUCUNE. Ne touche jamais une liste d'actions
 *  existante. L'empreinte n'est PAS patchée : elle vient du catalogue (`PropData.foot`) et suit la ref
 *  au rendu. Un cap que le nouveau type refuse (`capDecorAdmis`) retombe au cap d'identité dans le
 *  MÊME patch : le geste ne crée pas de faute. PUR. */
export function propRefPatch(ref: string, avant: Pick<SceneEntity, 'usable' | 'facing'> | undefined): Partial<SceneEntity> {
  const usable = avant?.usable;
  const cap = capDecorAdmis(refEstVolumique(ref), avant?.facing) ? {} : { facing: CAP_IDENTITE_PROP };
  if (PROPS[ref]?.searchable && !usable?.actions?.length)
    return { ref, ...cap, usable: { ...usable, actions: [{ id: ACTION_FOUILLER, flow: EMPTY_FLOW, unique: true }] } };
  return { ref, ...cap };
}

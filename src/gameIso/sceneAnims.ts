/**
 * Ambiances d'une ENTITÉ de scène (`SceneEntity.anim`), choisies dans l'éditeur (inspecteur
 * d'entité). Le monde volumique les joue sur les FIGURANTS (`backends/webgl/sceneMeshes`
 * `collectBillboards` : l'ambiance entre dans l'identité de la planche et cuit ses frames).
 */
export const SCENE_ANIMS: { key: string; label: string }[] = [
  { key: '', label: '— aucune (sprite fixe) —' },
  { key: 'breathe', label: 'Respire' },
  { key: 'feed', label: 'Dévore (charogne)' },
  { key: 'howl', label: 'Hurle' },
  { key: 'chop', label: 'Frappe (arme)' },
  { key: 'kick', label: 'S’agite' },
  { key: 'sway', label: 'Se balance' },
  { key: 'wrap', label: 'Ondule (tentacule)' },
  { key: 'glow', label: 'Luit' },
];

/** Ensemble des classes valides (pour validation/rendu). */
export const SCENE_ANIM_KEYS = new Set(SCENE_ANIMS.map((a) => a.key).filter(Boolean));

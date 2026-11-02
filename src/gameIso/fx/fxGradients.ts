/**
 * Dégradés FX GLOBAUX (halos arcaniques/divins, lueur, sang), assemblés dans `defsGlobaux()`
 * (`sprites.ts`) et montés une seule fois au niveau App (`GlobalSvgDefs`). Règle (#1903) : un dégradé
 * d'ici est de couleur FIXE, il ne suit pas la palette.
 */
export const FX_GRADIENTS_DEFS = `
  <radialGradient id="g_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bdf3ff"/><stop offset="55%" stop-color="#4ec3e0" stop-opacity="0.7"/><stop offset="100%" stop-color="#4ec3e0" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_arcane" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e7d8ff"/><stop offset="55%" stop-color="#8a5cf0" stop-opacity="0.72"/><stop offset="100%" stop-color="#6a3cd8" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_divine" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff4c2"/><stop offset="55%" stop-color="#f0c24a" stop-opacity="0.72"/><stop offset="100%" stop-color="#caa030" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_blood" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#7e1212"/><stop offset="100%" stop-color="#360707"/></radialGradient>`;

/** Ids des dégradés FIXES, les `<radialGradient>`/`<linearGradient>` de `FX_GRADIENTS_DEFS` : SOURCE
 *  UNIQUE de l'ensemble, lue dans la chaîne qui les déclare. */
export const FX_GRADIENT_IDS: ReadonlySet<string> = new Set(
  [...FX_GRADIENTS_DEFS.matchAll(/<(linear|radial)Gradient id="([^"]+)"/g)].map((m) => m[2]),
);

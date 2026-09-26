/**
 * Dégradés RIG / FX GLOBAUX (acier, lames, tenues, halos arcaniques/divins, sang, yeux…), assemblés
 * dans `defsGlobaux()` (`sprites.ts`) et montés une seule fois au niveau App (`GlobalSvgDefs`). Règle
 * (#1903) : un dégradé d'ici est de couleur FIXE, il ne suit pas la palette. Une matière qui suit la
 * palette se peint en dégradé DÉRIVÉ `url(#dg-<forme>-@<clé>…)`, résolu par `applyTokenMap`
 * (`palette.ts`).
 *
 * Contient aussi les clipPaths `rigCutBras*` (#633 D1, scission du bras au coude par `splitBrasSvg`)
 * et `rigJambeClip*` (#633 Lot 0, confinement du détail de tenue à la silhouette de jambe, `jambeVetue`)
 * et `rigCutQuad*` (#1082 Lot 1, scission crâne/nuque de l'art de tête quadrupède vu de dos).
 * En `userSpaceOnUse` : leur repère est celui de l'art de la part (`composeRig` injecte PART sous
 * `<g matrix><g scale>`, donc y=18=coude / jambe 0..50), pas l'écran ; symétriques en x → servent
 * aussi le membre droit rendu en `scale(-1,1)`.
 */
export const rigFxGradients = `
  <linearGradient id="g_steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8edf5"/><stop offset="45%" stop-color="#9aa6b8"/><stop offset="100%" stop-color="#5a6376"/></linearGradient>
  <linearGradient id="g_steelD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b94a6"/><stop offset="100%" stop-color="#444b5a"/></linearGradient>
  <linearGradient id="g_axe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe6ef"/><stop offset="100%" stop-color="#6a7384"/></linearGradient>
  <linearGradient id="g_cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8323a"/><stop offset="100%" stop-color="#5e1418"/></linearGradient>
  <linearGradient id="g_robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a3f7a"/><stop offset="100%" stop-color="#171a36"/></linearGradient>
  <radialGradient id="g_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bdf3ff"/><stop offset="55%" stop-color="#4ec3e0" stop-opacity="0.7"/><stop offset="100%" stop-color="#4ec3e0" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_arcane" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e7d8ff"/><stop offset="55%" stop-color="#8a5cf0" stop-opacity="0.72"/><stop offset="100%" stop-color="#6a3cd8" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_divine" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff4c2"/><stop offset="55%" stop-color="#f0c24a" stop-opacity="0.72"/><stop offset="100%" stop-color="#caa030" stop-opacity="0"/></radialGradient>
  <linearGradient id="g_coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#30303a"/><stop offset="100%" stop-color="#141419"/></linearGradient>
  <linearGradient id="g_hVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f7e3a"/><stop offset="100%" stop-color="#46521f"/></linearGradient>
  <linearGradient id="g_mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9152"/><stop offset="100%" stop-color="#39501f"/></linearGradient>
  <linearGradient id="g_mutD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d7540"/><stop offset="100%" stop-color="#2a3c18"/></linearGradient>
  <linearGradient id="g_crest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#c43f0a"/></linearGradient>
  <radialGradient id="g_eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialGradient>
  <radialGradient id="g_blood" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#7e1212"/><stop offset="100%" stop-color="#360707"/></radialGradient>
  <clipPath id="rigCutBrasHaut" clipPathUnits="userSpaceOnUse"><rect x="-20" y="-12" width="40" height="30"/></clipPath>
  <clipPath id="rigCutBrasBas" clipPathUnits="userSpaceOnUse"><rect x="-20" y="16" width="40" height="30"/></clipPath>
  <clipPath id="rigJambeClip" clipPathUnits="userSpaceOnUse"><rect x="-6" y="-4" width="12" height="60"/></clipPath>
  <clipPath id="rigJambeClipProfil" clipPathUnits="userSpaceOnUse"><rect x="-6" y="-4" width="13" height="60"/></clipPath>
  <clipPath id="rigCutQuadCrane" clipPathUnits="userSpaceOnUse"><rect x="-60" y="-80" width="120" height="80"/></clipPath>
  <clipPath id="rigCutQuadNuque" clipPathUnits="userSpaceOnUse"><rect x="-60" y="0" width="120" height="80"/></clipPath>`;

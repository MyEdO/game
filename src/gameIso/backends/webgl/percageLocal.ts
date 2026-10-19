/**
 * DÉCOUPE LOCALE PAR OCCLUSION (#1176) — LE CANAL. Ce qui coiffe un héros ne se lève plus en bloc :
 * un TROU s'ouvre autour de lui, à l'écran, dans la masse qui le cache. Le trou est un DISCARD de
 * fragment, jamais une géométrie retirée : la masse reste entière, seuls les pixels du disque tombent.
 *
 * TROIS pièces, et une seule d'entre elles est globale :
 *  1. l'attribut PAR SOMMET `aPercable` (`sceneMeshes.bakeWorldGeometry`) — `0` sur les nappes de SOL,
 *     `1` sur ce qui se dresse ou coiffe. L'exclusion du sol est STRUCTURELLE, cuite avec le monde ;
 *  2. la SURCHARGE des chunks de three, ici, module-level et idempotente, au patron d'`installFogGamma`
 *     (`sceneMeshes.ts`) : la raison y est écrite — « un `onBeforeCompile` par matériau referait ce
 *     même travail quatre-vingt-dix fois ». Sous `#ifdef` : sans le define, les chunks surchargés
 *     rendent EXACTEMENT les chunks d'origine, octet pour octet ;
 *  3. le branchement des UNIFORMES par matériau (`percerMateriau`) — et celui-là ne peut PAS être
 *     global. Mesuré au source de three (`three.core.js`, `cloneUniforms`) : les uniformes d'un
 *     matériau intégré sont clonés à la compilation, et un tableau d'objets three y est cloné ÉLÉMENT
 *     PAR ÉLÉMENT (`property[i].clone()`) — une valeur posée dans `ShaderLib` serait donc recopiée,
 *     pas partagée, et le rayon lerpé à la frame n'atteindrait jamais le GPU. Le seul canal vivant est
 *     `onBeforeCompile`, qui reçoit la table d'uniformes du matériau AVANT clonage et où l'on GREFFE
 *     les objets partagés. Aucun texte de shader n'y est touché (c'est le coût qu'on refuse), et la
 *     fonction est UNE référence partagée : `customProgramCacheKey` la sérialise, les matériaux
 *     gardent donc le même programme qu'avant.
 *
 * ORTHO — LE CADEAU DE LA VUE PLATEAU. Le test de profondeur (« ce fragment est-il DEVANT le héros ? »)
 * se fait sur la profondeur écran : en projection orthographique elle est AFFINE en profondeur vue, la
 * comparaison est donc EXACTE, et la position de clip interpolée au fragment vaut au pixel près celle
 * qu'aurait donnée la rastérisation. En perspective, ni l'un ni l'autre ne tiendrait (`z_w = a + b/z_v`,
 * et l'interpolation devient perspective-correcte) : ce canal est de la vue plateau, il ne se porte pas
 * tel quel au POV.
 *
 * LA PASSE D'OMBRE. Un discard de la passe opaque n'entre PAS dans la carte de profondeur : sans le
 * MÊME discard côté ombre, la masse trouée projetterait encore son ombre sur le héros dégagé. Deux
 * conséquences tenues ici : le critère est calculé depuis la position MONDE et la matrice de la caméra
 * DE JEU (`uPercageVP`), pas depuis `gl_FragCoord` — sous le soleil, `gl_FragCoord` est le raster de la
 * LUMIÈRE, il trouerait une autre bande de toit ; et le mesh du monde reçoit un `customDepthMaterial`
 * qui porte le même define (`materiauProfondeurPerce`), three ne recopiant pas les `defines` du
 * matériau de surface vers son matériau de profondeur.
 */
import * as THREE from 'three';
import { PARTY_MAX } from '../../../noyau/monde/combatants';

/** Nom de l'attribut de perçabilité, cuit par sommet (`BakedWorld.percables`). */
export const PERCABLE_ATTRIBUT = 'aPercable';

/** Nom du `#define` par lequel un matériau réclame la découpe locale. Sans lui, les chunks surchargés
 *  rendent le shader d'origine — la surcharge est globale au module three, la découpe ne l'est pas. */
export const PERCAGE_DEFINE = 'PERCAGE_LOCAL';

/** Nombre de trous simultanés — un par héros du groupe, donc `PARTY_MAX` : une seule vérité, celle
 *  du groupe. C'est une borne de COMPILATION (la boucle du fragment se déroule), pas une file :
 *  au-delà, un héros de plus ne troue rien. */
export const PERCAGE_MAX_HEROS = PARTY_MAX;

// ————————————————————————————————————————————————————————————————
// MOLETTES — les réglages que le juge de goût tourne
// ————————————————————————————————————————————————————————————————

/** RAYON du trou, en PIXELS d'écran : constant au zoom (un trou qui grandirait avec la molette se
 *  lirait comme un projecteur, pas comme une découpe). Calibre : ~1,5 × le disque d'un pion. */
export const PERCAGE_RAYON_PX = 96;

/** Part du rayon rendue PLEINE (cœur du trou). Au-delà, l'anneau de fondu : c'est lui qui porte le
 *  dither, et c'est lui qui donne le bord ORGANIQUE au lieu d'un cercle à l'emporte-pièce. */
export const PERCAGE_COEUR = 0.6;

/** Durée (ms) du fondu du rayon vers sa cible — la seule grandeur qui vit à la FRAME. Un trou qui
 *  s'ouvre d'un coup claque ; au-delà d'une demi-seconde il traîne derrière le pas. */
export const PERCAGE_FONDU_MS = 300;

// ————————————————————————————————————————————————————————————————
// UNIFORMES PARTAGÉS — les objets que tous les matériaux percés lisent
// ————————————————————————————————————————————————————————————————

/** Un trou : `xy` = centre en pixels d'écran, `z` = profondeur écran du héros dans `[0,1]`, `w` = rayon
 *  en pixels — `0` ÉTEINT le trou (la boucle du fragment le saute). Les quatre naissent à zéro : tant
 *  que rien ne les pose, le rendu est STRICTEMENT celui d'avant ce lot. */
const trous = Array.from({ length: PERCAGE_MAX_HEROS }, () => new THREE.Vector4(0, 0, 0, 0));

const uPercage = { value: trous };
const uPercageVP = { value: new THREE.Matrix4() };
const uPercageEcran = { value: new THREE.Vector2(1, 1) };

/** Les quatre trous, en écriture : l'appelant (`stage/percage.ts`) les mute en place — ce sont les
 *  objets MÊMES que les matériaux compilés tiennent, jamais des copies (cf. `cloneUniforms`). */
export function trousPercage(): readonly THREE.Vector4[] {
  return trous;
}

/** CADRE de la découpe : la matrice vue-projection de la caméra de JEU et la taille du viewport en
 *  pixels. Les deux se reposent à chaque changement de cadrage — et servent AUSSI la passe d'ombre,
 *  qui n'a pas d'autre moyen de savoir où le trou tombe à l'écran du joueur. */
export function cadrePercage(camera: THREE.Camera, largeurPx: number, hauteurPx: number): void {
  uPercageVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  uPercageEcran.value.set(largeurPx, hauteurPx);
}

/** Le cadre courant — pour un banc qui vérifie ce que le shader lira. */
export function cadreCourant(): { vp: THREE.Matrix4; ecran: THREE.Vector2 } {
  return { vp: uPercageVP.value, ecran: uPercageEcran.value };
}

// ————————————————————————————————————————————————————————————————
// SURCHARGE DE CHUNKS — module-level, idempotente
// ————————————————————————————————————————————————————————————————

/** Vrai une fois la surcharge posée : elle ne se pose qu'UNE fois par module three chargé. */
let percageInstallé = false;

/** GLSL du dither ordonné 8×8 (matrice de Bayer) — la forme RÉCURSIVE, sans table ni opérateur de bits
 *  (WebGL 1 comme 2). `percageBayer8` rend les 64 valeurs `k/64`, `k` de 0 à 63, une et une seule fois
 *  par bloc de 8×8 pixels : c'est ce que `percage-local.test.ts` mesure sur le portage exact. */
const BAYER_GLSL = `
	float percageBayer2( vec2 a ) {
		vec2 c = floor( a );
		return fract( c.x * 0.5 + c.y * c.y * 0.75 );
	}
	float percageBayer4( vec2 a ) {
		return percageBayer2( 0.5 * a ) * 0.25 + percageBayer2( a );
	}
	float percageBayer8( vec2 a ) {
		return percageBayer4( 0.5 * a ) * 0.25 + percageBayer2( a );
	}`;

const PARS_VERTEX = `
#ifdef ${PERCAGE_DEFINE}
	attribute float ${PERCABLE_ATTRIBUT};
	uniform mat4 uPercageVP;
	varying float vPercable;
	varying vec4 vPercClip;
#endif`;

const VERTEX = `
#ifdef ${PERCAGE_DEFINE}
	vPercable = ${PERCABLE_ATTRIBUT};
	vPercClip = uPercageVP * modelMatrix * vec4( transformed, 1.0 );
#endif`;

const PARS_FRAGMENT = `
#ifdef ${PERCAGE_DEFINE}
	uniform vec4 uPercage[ ${PERCAGE_MAX_HEROS} ];
	uniform vec2 uPercageEcran;
	varying float vPercable;
	varying vec4 vPercClip;
${BAYER_GLSL}
#endif`;

const FRAGMENT = `
#ifdef ${PERCAGE_DEFINE}
	if ( vPercable > 0.5 ) {
		vec3 percNdc = vPercClip.xyz / vPercClip.w;
		vec2 percPx = ( percNdc.xy * 0.5 + 0.5 ) * uPercageEcran;
		float percZ = percNdc.z * 0.5 + 0.5;
		for ( int i = 0; i < ${PERCAGE_MAX_HEROS}; i ++ ) {
			vec4 trou = uPercage[ i ];
			if ( trou.w <= 0.0 ) continue;
			if ( percZ >= trou.z ) continue;
			float d = distance( percPx, trou.xy ) / trou.w;
			if ( d >= 1.0 ) continue;
			if ( d <= ${PERCAGE_COEUR.toFixed(4)} ) discard;
			float anneau = ( d - ${PERCAGE_COEUR.toFixed(4)} ) / ( 1.0 - ${PERCAGE_COEUR.toFixed(4)} );
			if ( percageBayer8( gl_FragCoord.xy ) > anneau ) discard;
		}
	}
#endif`;

/** Les quatre chunks de three sur lesquels la découpe se greffe, et le bloc greffé à chacun. Le choix
 *  des chunks D'ÉCRÊTAGE n'est pas décoratif : ce sont les seuls que TOUS les shaders de maillage
 *  incluent — surface ET profondeur —, aux bons endroits (déclarations au fichier, corps dans `main`
 *  après `transformed` côté sommet et après `diffuseColor` côté fragment). Le bloc greffé se pose
 *  APRÈS le `#endif` de three : il ne dépend d'aucun plan d'écrêtage, et n'en dérange aucun. */
const GREFFES: readonly [keyof typeof THREE.ShaderChunk, string][] = [
  ['clipping_planes_pars_vertex', PARS_VERTEX],
  ['clipping_planes_vertex', VERTEX],
  ['clipping_planes_pars_fragment', PARS_FRAGMENT],
  ['clipping_planes_fragment', FRAGMENT],
];

export function installPercage(): void {
  if (percageInstallé) return;
  percageInstallé = true;
  for (const [nom, bloc] of GREFFES) THREE.ShaderChunk[nom] = THREE.ShaderChunk[nom] + bloc;
}

/** Les blocs greffés, dans l'ordre des chunks — ce qu'un banc retranche pour retrouver le chunk
 *  d'origine, octet pour octet. */
export const BLOCS_PERCAGE: readonly [string, string][] = GREFFES.map(([nom, bloc]) => [nom as string, bloc]);

// ————————————————————————————————————————————————————————————————
// BRANCHEMENT PAR MATÉRIAU
// ————————————————————————————————————————————————————————————————

/** UNE référence de fonction pour tous les matériaux percés : `Material.customProgramCacheKey` la
 *  sérialise, deux matériaux qui la partagent gardent donc la même clé de programme. Elle ne fait que
 *  GREFFER les objets d'uniformes partagés — aucun texte de shader, c'est là tout l'intérêt. */
const brancherUniformes = (shader: { uniforms: Record<string, unknown> }): void => {
  shader.uniforms.uPercage = uPercage;
  shader.uniforms.uPercageVP = uPercageVP;
  shader.uniforms.uPercageEcran = uPercageEcran;
};

/** Un matériau qui SAIT se trouer. Rend `true` quand le define vient d'être posé — donc quand une
 *  recompilation a été demandée. Au patron d'`applyFogGamma`, dont ce module est le jumeau. */
export function percerMateriau(mat: THREE.Material): boolean {
  installPercage();
  mat.onBeforeCompile = brancherUniformes as THREE.Material['onBeforeCompile'];
  if (mat.defines?.[PERCAGE_DEFINE] !== undefined) return false;
  (mat.defines ??= {})[PERCAGE_DEFINE] = '';
  mat.needsUpdate = true;
  return true;
}

/** Le MATÉRIAU DE PROFONDEUR du monde troué — à poser en `customDepthMaterial` sur le mesh, sans quoi
 *  la masse trouée continue de projeter son ombre à travers le trou (three ne recopie ni les `defines`
 *  ni le `onBeforeCompile` du matériau de surface vers le matériau de profondeur qu'il fabrique :
 *  `getDepthMaterial`, `WebGLShadowMap`). L'appelant en est PROPRIÉTAIRE : il le libère avec le mesh. */
export function materiauProfondeurPerce(side: THREE.Side = THREE.DoubleSide): THREE.MeshDepthMaterial {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
  percerMateriau(mat);
  return mat;
}

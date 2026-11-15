// Le voile de la vision sur un navire monté (`VolumeDeScene.voile`, #3950) : posé en `material_overlay` sur chacun de
// ses meshes (`MontageDeVehicule.voiler`), il fond au noir ce qui est déjà dessiné du mesh, d'une opacité qui laisse la
// part de lumière linéaire (`part_de_lumiere`, `art/vision.gdshaderinc`) de la case que sa surface regarde, sans
// éclairage mais sous le brouillard, que son noir reçoit : la surface se voile une fois, la brume de l'air
// (`art/brume-de-la-vision.gdshader`) et la brume de profondeur restent ce que le monde en rend, une
// fois par pixel : le pochoir (`stencil_mode`) écarte tout fragment du voile après le premier qui passe la profondeur
// de la surface dessinée, les faces coïncidentes comprises. Dans le
// repère de la carte (`MODEL_MATRIX`, le nœud des navires frère du monde, tous deux à l'identité), la normale tournée
// vers l'œil : le point regardé est à la hauteur du fragment décalée d'une demi-case le long de la normale, et décalé
// à l'horizontale le long de la projection horizontale de la normale (nulle pour une normale verticale), d'une
// demi-case puis d'une case ; le fragment prend le meilleur des deux états, chacun lu au point (`etat_regarde`,
// `art/vision.gdshaderinc`). Il écarte le fragment que la coupe écarte
// (`coupe`, le seuil d'opacité que `MontageDeVehicule._appliquer_la_coupe` pose sur chaque matière, comparé de même à
// l'opacité du sommet). Sous `OUTPUT_IS_SRGB` (rendu de compatibilité), le tampon tient des valeurs sRGB : la part
// laissée s'y porte en sRGB (`recettes/voile-du-navire.gd`).
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
stencil_mode read, write, compare_not_equal, 1;

#include "res://art/vision.gdshaderinc"
uniform float coupe : hint_range(0.0, 1.0) = 0.0;

varying vec3 position_carte;

void vertex() {
	position_carte = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	if (COLOR.a < coupe) {
		discard;
	}
	vec3 normale = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec2 horizontale = normale.xz;
	vec3 point = vec3(position_carte.x, position_carte.y + 0.5 * normale.y, position_carte.z);
	float etat = max(etat_regarde(point + 0.5 * vec3(horizontale.x, 0.0, horizontale.y)), etat_regarde(point + vec3(horizontale.x, 0.0, horizontale.y)));
	float part = part_de_lumiere(etat);
	ALBEDO = vec3(0.0);
	ALPHA = 1.0 - (OUTPUT_IS_SRGB ? en_srgb(vec3(part)).r : part);
}

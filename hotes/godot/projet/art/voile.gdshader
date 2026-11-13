// Le voile de la vision sur un navire monté (`VolumeDeScene.voile`, #3950) : posé en `material_overlay` sur chacun de
// ses meshes (`MontageDeVehicule.voiler`), il multiplie ce qui est déjà dessiné du mesh par la part de lumière linéaire
// (`part_de_lumiere`, `art/vision.gdshaderinc`) de la case que sa surface regarde, sans éclairage ni brouillard. Dans le
// repère de la carte (`MODEL_MATRIX`, le nœud des navires frère du monde, tous deux à l'identité), la normale tournée
// vers l'œil : le point regardé est à la hauteur du fragment décalée d'une demi-case le long de la normale, et décalé
// à l'horizontale le long de la projection horizontale de la normale (nulle pour une normale verticale), d'une
// demi-case puis d'une case ; le fragment prend le meilleur des deux états. À chaque point, sa colonne, et dans cette
// colonne la case dont le sol (`sols`, `VolumeDeScene._batir_les_sols`, en unités de plateau, infini hors des
// cases) est le plus haut à sa hauteur ou dessous, la plus basse de la colonne si aucune ; dans le plan de cette case,
// l'état se mêle à celui des trois cases voisines vers le point, comme le monde, mais une voisine sans case n'y compte
// pas, et sans aucune case l'état est celui de la case de la colonne. Il écarte le fragment que la coupe écarte
// (`coupe`, le seuil d'opacité que `MontageDeVehicule._appliquer_la_coupe` pose sur chaque matière, comparé de même à
// l'opacité du sommet). Sous `OUTPUT_IS_SRGB` (rendu de compatibilité), le tampon tient des valeurs sRGB : le facteur
// s'y porte en sRGB (`recettes/voile-du-navire.gd`).
shader_type spatial;
render_mode unshaded, blend_mul, fog_disabled, depth_draw_never, cull_disabled;

#include "res://art/vision.gdshaderinc"
uniform float coupe : hint_range(0.0, 1.0) = 0.0;
uniform sampler2D sols : filter_nearest, hint_default_black;

varying vec3 position_carte;

void vertex() {
	position_carte = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

// L'état de la case de texel `texel` de la vision, fondu depuis celle d'avant ; sans vision liée, la texture blanche.
float etat_fondu(ivec2 texel) {
	return etat_du_fondu(texelFetch(vision_avant, min(texel, textureSize(vision_avant, 0) - 1), 0).r, texelFetch(vision, min(texel, textureSize(vision, 0) - 1), 0).r);
}

// L'état fondu (de 0 à 1) que la vision donne au point `point` de la carte.
float etat_regarde(vec3 point) {
	int rangees = vision_rangees_par_plan;
	ivec2 taille = textureSize(sols, 0);
	ivec2 colonne = clamp(ivec2(floor(point.xz)), ivec2(0), ivec2(taille.x - 1, rangees - 1));
	int couche = -1;
	int basse = 0;
	float sol_haut = 0.0;
	float sol_bas = 0.0;
	for (int indice = 0; indice < taille.y / rangees; indice++) {
		float sol = texelFetch(sols, colonne + ivec2(0, indice * rangees), 0).r;
		if (!isinf(sol) && sol <= point.y && (couche < 0 || sol > sol_haut)) {
			couche = indice;
			sol_haut = sol;
		}
		if (indice == 0 || sol < sol_bas) {
			basse = indice;
			sol_bas = sol;
		}
	}
	ivec2 plan = ivec2(0, (couche < 0 ? basse : couche) * rangees);
	vec2 dans_le_plan = clamp(point.xz, vec2(0.5), vec2(float(taille.x), float(rangees)) - 0.5) - 0.5;
	ivec2 base = ivec2(floor(dans_le_plan));
	vec2 f = dans_le_plan - vec2(base);
	float somme = 0.0;
	float poids = 0.0;
	for (int k = 0; k < 4; k++) {
		ivec2 coin = ivec2(k % 2, k / 2);
		ivec2 c = base + coin;
		float p = (coin.x == 1 ? f.x : 1.0 - f.x) * (coin.y == 1 ? f.y : 1.0 - f.y);
		bool hors = any(lessThan(c, ivec2(0))) || c.x >= taille.x || c.y >= rangees;
		if (!hors && p > 0.0 && !isinf(texelFetch(sols, c + plan, 0).r)) {
			somme += p * etat_fondu(c + plan);
			poids += p;
		}
	}
	return poids > 0.0 ? somme / poids : etat_fondu(colonne + plan);
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
	ALBEDO = OUTPUT_IS_SRGB ? en_srgb(vec3(part)) : vec3(part);
}

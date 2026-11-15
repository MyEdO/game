// La vision du groupe (`VisionDuMonde`, `VolumeDeScene.voir`) que le shader de monde (`art/monde.gdshader`), le voile
// d'un navire (`art/voile.gdshader`) et la brume de la vision (`art/brume-de-la-vision.gdshader`) lisent, liée par
// `VolumeDeScene._lier_la_vision_a` : la texture d'un octet par case, un plan de `vision_rangees_par_plan` rangées par
// couche, celle d'où le fondu part, la part du fondu et les teintes (inconnue, explorée, vue) ; l'état fondu depuis
// celui d'avant (`etat_du_fondu`), la part de lumière linéaire d'un état (`part_de_lumiere`) et l'encodage sRGB
// (`en_srgb`). Sans vision liée, la texture blanche et les teintes à 1 : la part vaut 1. Pour un point de la carte
// (`etat_regarde`, le voile et la brume), le sol de chaque case (`sols`, `VolumeDeScene._batir_les_sols`, en unités de
// plateau, infini hors des cases) : dans sa colonne, la case dont le sol est le plus haut à sa hauteur ou dessous, la
// plus basse de la colonne si aucune ; dans le plan de cette case, l'état se mêle à celui des trois cases voisines vers
// le point, comme le monde, mais une voisine sans case n'y compte pas, et sans aucune case l'état est celui de la case
// de la colonne.
uniform sampler2D vision_avant : filter_linear, hint_default_white;
uniform sampler2D vision : filter_linear, hint_default_white;
uniform float vision_fondu : hint_range(0.0, 1.0) = 1.0;
uniform vec3 vision_teintes = vec3(1.0);
uniform int vision_rangees_par_plan = 1;
uniform sampler2D sols : filter_nearest, hint_default_black;

vec3 en_srgb(vec3 couleur) {
	return mix(
			pow(couleur, vec3(1.0 / 2.4)) * (1.0 + 0.055) - vec3(0.055),
			couleur * 12.92,
			lessThan(couleur, vec3(0.0031308)));
}

float etat_du_fondu(float avant, float neuve) {
	return mix(avant, neuve, vision_fondu);
}

float part_de_lumiere(float etat) {
	float exploree = 128.0 / 255.0;
	float sous = mix(vision_teintes.x, vision_teintes.y, clamp(etat / exploree, 0.0, 1.0));
	float dessus = mix(vision_teintes.y, vision_teintes.z, clamp((etat - exploree) / (1.0 - exploree), 0.0, 1.0));
	return mix(sous, dessus, step(exploree, etat));
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

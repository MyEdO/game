// La vision du groupe (`VisionDuMonde`, `VolumeDeScene.voir`) que le shader de monde (`art/monde.gdshader`) et le voile
// d'un navire (`art/voile.gdshader`) lisent tous deux, liée par `VolumeDeScene._lier_la_vision_a` : la texture d'un
// octet par case, un plan de `vision_rangees_par_plan` rangées par couche, celle d'où le fondu part, la part du fondu et
// les teintes (inconnue, explorée, vue) ; l'état fondu depuis celui d'avant (`etat_du_fondu`), la part de lumière
// linéaire d'un état (`part_de_lumiere`) et l'encodage sRGB (`en_srgb`). Sans vision liée, la texture blanche et les
// teintes à 1 : la part vaut 1.
uniform sampler2D vision_avant : filter_linear, hint_default_white;
uniform sampler2D vision : filter_linear, hint_default_white;
uniform float vision_fondu : hint_range(0.0, 1.0) = 1.0;
uniform vec3 vision_teintes = vec3(1.0);
uniform int vision_rangees_par_plan = 1;

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

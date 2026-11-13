// Le voile de la vision sur un véhicule monté (`MontageDeVehicule.voiler`, #3950) : posé en `material_overlay` sur
// chacun de ses meshes, il multiplie ce qui est déjà dessiné du mesh par sa part de lumière linéaire (`part`), sans
// éclairage ni brouillard. Il écarte le fragment que la coupe écarte (`coupe`, le seuil d'opacité que
// `MontageDeVehicule._appliquer_la_coupe` pose sur chaque matière, comparé de même à l'opacité du sommet). Sous
// `OUTPUT_IS_SRGB` (rendu de compatibilité), le tampon tient des valeurs sRGB : le facteur s'y porte en sRGB
// (`recettes/voile-du-navire.gd`).
shader_type spatial;
render_mode unshaded, blend_mul, fog_disabled, depth_draw_never, cull_disabled;

uniform float part : hint_range(0.0, 1.0) = 1.0;
uniform float coupe : hint_range(0.0, 1.0) = 0.0;

// La jumelle de `en_srgb` de `art/monde.gdshader`, sur un canal.
float en_srgb(float couleur) {
	return couleur < 0.0031308 ? couleur * 12.92 : pow(couleur, 1.0 / 2.4) * (1.0 + 0.055) - 0.055;
}

void fragment() {
	if (COLOR.a < coupe) {
		discard;
	}
	ALBEDO = vec3(OUTPUT_IS_SRGB ? en_srgb(part) : part);
}

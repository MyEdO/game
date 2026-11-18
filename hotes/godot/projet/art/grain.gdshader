// Le grain de l'écran (#3935) : un bruit fin posé en incrustation sur ce que l'écran a déjà tracé, comme le calque
// `#grain` des maquettes (`propositions/sources/combat/socle.js`) : un gris de 0,5 en lumière linéaire (0,735 en sRGB),
// d'alpha la moitié du bruit, mêlé en `overlay`, à l'opacité `opacite`.
shader_type canvas_item;

uniform sampler2D ecran : hint_screen_texture, filter_nearest;
uniform sampler2D bruit : repeat_enable, filter_nearest;
uniform float opacite = 0.28;
// Le côté de la tuile du bruit, en pixels de la fenêtre.
uniform float tuile = 300.0;

const float GRIS = 0.7354;

void fragment() {
	vec3 fond = texture(ecran, SCREEN_UV).rgb;
	vec3 incruste = mix(1.0 - 2.0 * (1.0 - fond) * (1.0 - GRIS), 2.0 * fond * GRIS, step(fond, vec3(0.5)));
	float part = 0.5 * texture(bruit, FRAGCOORD.xy / tuile).r * opacite;
	COLOR = vec4(mix(fond, incruste, part), 1.0);
}

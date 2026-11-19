// Un geste fermé (#3935) : ce qu'il trace en niveaux de gris, à l'opacité `opacite`, comme `filter: grayscale(1)` et
// `opacity: .42` des règles fermées des maquettes (`propositions/sources/accueil-et-systeme/options.css`, `#registre.verrou`).
shader_type canvas_item;

uniform float opacite = 0.42;

// Les poids de la luminance de `grayscale()` (Filter Effects, `feColorMatrix` de type `saturate` à 0).
const vec3 LUMINANCE = vec3(0.2126, 0.7152, 0.0722);

void fragment() {
	vec4 trace = texture(TEXTURE, UV) * COLOR;
	COLOR = vec4(vec3(dot(trace.rgb, LUMINANCE)), trace.a * opacite);
}

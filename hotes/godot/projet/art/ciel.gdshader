// Le ciel d'un extérieur en immersion (`Lumiere`, `vue.lumiere.ciel`, #4392) : le dégradé du zénith à l'horizon, sous
// l'horizon le sol à la teinte de la brume, et une couche de nuages qui couvre le ciel à `couverture`, éclaircis vers
// le zénith et fondus dans l'horizon, qui dérive à `derive` par seconde ; la ressource (`scenes/Lumiere.tscn`) porte
// leurs réglages, le noyau les teintes.
shader_type sky;

uniform vec3 zenith : source_color = vec3(0.3, 0.35, 0.45);
uniform vec3 horizon : source_color = vec3(0.6, 0.65, 0.7);
uniform vec3 sol : source_color = vec3(0.3);
uniform float couverture : hint_range(0.0, 1.0) = 0.6;
uniform float clarte_des_nuages : hint_range(0.0, 2.0) = 1.1;
uniform float ombre_des_nuages : hint_range(0.0, 1.0) = 0.55;
uniform float echelle_des_nuages = 1.6;
uniform vec2 derive = vec2(0.004, 0.0015);

float hachage(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float bruit(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hachage(i), hachage(i + vec2(1.0, 0.0)), u.x), mix(hachage(i + vec2(0.0, 1.0)), hachage(i + vec2(1.0, 1.0)), u.x), u.y);
}

float volutes(vec2 p) {
	float somme = 0.0;
	float poids = 0.5;
	for (int octave = 0; octave < 5; octave++) {
		somme += poids * bruit(p);
		p = p * 2.03 + vec2(1.7, 9.2);
		poids *= 0.5;
	}
	return somme;
}

void sky() {
	float hauteur = EYEDIR.y;
	vec3 fond = mix(horizon, zenith, clamp(pow(max(hauteur, 0.0), 0.6), 0.0, 1.0));
	if (hauteur > 0.0) {
		vec2 plan = EYEDIR.xz / (hauteur + 0.12) * echelle_des_nuages + derive * TIME;
		float densite = smoothstep(1.0 - couverture, 1.0 - couverture + 0.35, volutes(plan));
		float relief = volutes(plan + vec2(0.08, 0.05));
		vec3 nuage = mix(horizon * ombre_des_nuages, horizon * clarte_des_nuages, clamp(relief * 1.4 - 0.2, 0.0, 1.0));
		fond = mix(fond, nuage, densite * smoothstep(0.0, 0.25, hauteur));
	}
	COLOR = hauteur >= 0.0 ? fond : mix(horizon, sol, clamp(-hauteur * 6.0, 0.0, 1.0));
}

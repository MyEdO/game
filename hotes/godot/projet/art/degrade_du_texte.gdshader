// Un texte teint d'un dégradé vertical (#3935), comme un `background-clip: text` des maquettes : les glyphes tracés à la
// couleur blanche du thème prennent la teinte de leur hauteur, de `haut` à `bas` par `milieu`, chacune posée à sa hauteur
// dans le contrôle (`hauteurs`, en unités du contrôle) ; l'ombre portée, d'une autre couleur, garde la sienne.
shader_type canvas_item;

uniform vec4 haut : source_color;
uniform vec4 milieu : source_color;
uniform vec4 bas : source_color;
uniform vec3 hauteurs = vec3(0.0, 50.0, 100.0);

varying float hauteur;
varying float blanc;

void vertex() {
	hauteur = VERTEX.y;
	blanc = step(0.99, min(COLOR.r, min(COLOR.g, COLOR.b)));
}

void fragment() {
	float t = clamp((hauteur - hauteurs.x) / (hauteurs.y - hauteurs.x), 0.0, 1.0);
	float u = clamp((hauteur - hauteurs.y) / (hauteurs.z - hauteurs.y), 0.0, 1.0);
	vec3 teinte = hauteur < hauteurs.y ? mix(haut.rgb, milieu.rgb, t) : mix(milieu.rgb, bas.rgb, u);
	COLOR.rgb = mix(COLOR.rgb, teinte, blanc);
}

// Le sol du hors-carte (`Lumiere`, `vue.lumiere.horsCarte`, #4392) : un plan sous le plateau, dans le repère de la carte
// (le monde à l'identité, comme `art/brume-de-la-vision.gdshader`), habillé de la matière du sol du pourtour comme le
// dessus d'une case du monde (`VolumeDeScene.texturer` : texture et relief, un motif tous les
// `MiseEnPage.METRES_PAR_MOTIF`, à `metres_par_case` mètres par case, calé sur les sommets des cases, à leur coin), ou de
// sa `teinte` sans texture, voilé par l'état que la vision donne au point (`etat_regarde`, la case du bord hors de la
// carte, `art/vision.gdshaderinc`) comme `art/monde.gdshader`. Sous le plateau de `plateau` cases, il ne se dessine pas :
// une case sans sol y montre le fond ; au-delà, il s'efface dans le fond (la pénombre, couleur de l'environnement) en
// `fondu_cases` cases depuis le bord, par transparence, pour se confondre avec lui sous les deux rendus ; aucun fondu à 0.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform bool normal_enabled = false;
uniform sampler2D albedo_texture : source_color, filter_linear_mipmap, repeat_enable, hint_default_white;
uniform vec3 teinte : source_color = vec3(1.0);
uniform sampler2D normal_texture : hint_roughness_normal, filter_linear_mipmap, repeat_enable;
uniform vec3 uv1_scale = vec3(1.0);
uniform float metres_par_case = 1.0;
uniform vec2 plateau = vec2(1.0);
uniform float fondu_cases = 0.0;
#include "res://art/vision.gdshaderinc"

varying vec3 point;

void vertex() {
	point = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	if (all(lessThan(abs(point.xz - plateau * 0.5), plateau * 0.5))) {
		discard;
	}
	vec2 uv = (point.xz - 0.5) * metres_par_case * uv1_scale.xz;
	ALBEDO = texture(albedo_texture, uv).rgb * teinte;
	if (normal_enabled) {
		NORMAL_MAP = texture(normal_texture, uv).rgb;
	}
	float lumiere = part_de_lumiere(etat_regarde(vec3(point.x, 0.0, point.z)));
	ALBEDO = OUTPUT_IS_SRGB ? en_srgb(en_lineaire(ALBEDO) * lumiere) : ALBEDO * lumiere;
	float ecart = length(max(abs(point.xz - plateau * 0.5) - plateau * 0.5, vec2(0.0)));
	float perdu = fondu_cases > 0.0 ? smoothstep(0.0, fondu_cases, ecart) : 0.0;
	if (perdu >= 1.0) {
		discard;
	}
	ALPHA = 1.0 - perdu;
	SPECULAR = 0.5;
	ROUGHNESS = 1.0;
}

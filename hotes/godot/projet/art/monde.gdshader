// Le shader du monde (`VolumeDeScene`, #3948), qui habille l'instance vue de chaque morceau et de chaque nappe de toit
// ou couronne, seule à ne porter aucune ombre : le code que Godot 4.7 génère pour un `StandardMaterial3D` coloré par ses
// sommets (sRGB) ou texturé en triplanaire dans le repère du maillage, relief compris, rendu des deux côtés, ses
// paramètres nommés comme les propriétés de cette matière (`VolumeDeScene.texturer`), plus le masque du retrait
// (`retrait`, `RetraitDuMonde`) : un sommet dont la case (`UV2`) est retirée se replie ; une case hors du masque lié
// (aucun lié, avant le premier `VolumeDeScene.retirer`, après `retirer(null)` ou sur une nappe : la texture noire par
// défaut) n'est pas lue, rien ne s'y replie ; et la vision du groupe (`vision`, `VisionDuMonde`, `VolumeDeScene.voir`) :
// l'état de la case sous le fragment, lu au plan `sol` de sa couche (au plan `toit` pour une nappe ou une couronne,
// `VisionDuMonde`) et fondu depuis la vision d'avant, multiplie l'albédo par
// sa teinte, en lumière linéaire : sous `OUTPUT_IS_SRGB` (rendu de compatibilité), l'albédo est en sRGB et le moteur le
// linéarise après `fragment()` (`recettes/voile-de-la-vision.gd`) ; sans vision liée, la texture blanche et les teintes
// à 1 : rien n'est voilé ; la vision, sa part de lumière (`part_de_lumiere`), `en_lineaire` et `en_srgb` viennent de
// `art/vision.gdshaderinc`, que le voile d'un navire lit aussi. La part de lumière a sa jumelle en GDScript pour la
// teinte d'une instance d'arête (`MiseEnPage.teinte_d_instance`), tenue égale par `recettes/voile-du-bati.gd`.
// Une nappe de toit ou une couronne (`nappe` à 1, `VolumeDeScene._matiere`) projette sa texture sur le plan de chaque
// face, u le long de l'horizontale de la face (l'égout d'un pan), v le long de sa plus grande pente, en mètres, pour que
// les rangs restent horizontaux et se raccordent d'un pan à l'autre ; `TANGENT` et `BINORMAL` suivent ces axes, et le
// relief avec eux. Sur une face d'axe, c'est la projection du code généré ; une face à normale verticale garde sa
// projection sur `xz`. Sa texture, la neutre de sa matière (`VolumeDeScene.texture_neutre_de`), est teinte par la couleur
// de ses sommets, multipliée en lumière linéaire comme la vision.
// `vertex()` sans branche, comme le code généré : sous une branche, le pilote arrondit autrement la projection des
// textures ; la projection de nappe s'y mêle à la générée par le poids `nappe`.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform sampler2D retrait : filter_nearest, hint_default_black;
uniform bool uv1_triplanar = false;
uniform bool normal_enabled = false;
uniform float roughness : hint_range(0.0, 1.0) = 1.0;
uniform sampler2D albedo_texture : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_texture : hint_roughness_normal, filter_linear_mipmap, repeat_enable;
uniform float uv1_triplanar_sharpness : hint_range(0.0, 150.0, 0.001);
uniform vec3 uv1_scale = vec3(1.0);
uniform float nappe : hint_range(0.0, 1.0) = 0.0;
#include "res://art/vision.gdshaderinc"
uniform float vision_cases_par_metre = 1.0;

varying vec3 uv1_triplanar_pos;
varying vec3 uv1_power_normal;
varying vec2 vision_case;
varying flat float vision_premiere_rangee;

void vertex() {
	TANGENT = vec3(0.0, 0.0, -1.0) * abs(NORMAL.x);
	TANGENT += vec3(1.0, 0.0, 0.0) * abs(NORMAL.y);
	TANGENT += vec3(1.0, 0.0, 0.0) * abs(NORMAL.z);
	TANGENT = normalize(TANGENT);
	BINORMAL = vec3(0.0, 1.0, 0.0) * abs(NORMAL.x);
	BINORMAL += vec3(0.0, 0.0, -1.0) * abs(NORMAL.y);
	BINORMAL += vec3(0.0, 1.0, 0.0) * abs(NORMAL.z);
	BINORMAL = normalize(BINORMAL);
	uv1_power_normal = pow(abs(NORMAL), vec3(uv1_triplanar_sharpness));
	uv1_triplanar_pos = VERTEX * uv1_scale;
	uv1_power_normal /= dot(uv1_power_normal, vec3(1.0));
	uv1_triplanar_pos *= vec3(1.0, -1.0, 1.0);
	vec3 egout = cross(vec3(0.0, 1.0, 0.0), NORMAL);
	float pente = max(length(egout), 1e-4);
	egout *= (2.0 * step(0.0, egout.x - egout.z) - 1.0) / pente;
	float projetee_sur_la_face = nappe * step(0.01, pente);
	TANGENT = mix(TANGENT, egout, projetee_sur_la_face);
	BINORMAL = mix(BINORMAL, (vec3(0.0, 1.0, 0.0) - NORMAL * NORMAL.y) / pente, projetee_sur_la_face);
	uv1_power_normal = mix(uv1_power_normal, vec3(0.0, 1.0, 0.0), projetee_sur_la_face);
	uv1_triplanar_pos = mix(uv1_triplanar_pos, vec3(dot(VERTEX, egout), 0.0, -VERTEX.y / pente) * uv1_scale, projetee_sur_la_face);
	if (!OUTPUT_IS_SRGB) {
		COLOR.rgb = en_lineaire(COLOR.rgb);
	}
	vision_case = VERTEX.xz * vision_cases_par_metre;
	float rangees_par_plan = float(vision_rangees_par_plan);
	vision_premiere_rangee = floor(UV2.y / (2.0 * rangees_par_plan)) * rangees_par_plan + nappe * float(textureSize(vision, 0).y / 2);
	ivec2 texel = ivec2(UV2);
	ivec2 taille = textureSize(retrait, 0);
	float lue = float(all(lessThan(texel, taille))) * texelFetch(retrait, min(texel, taille - 1), 0).r;
	VERTEX *= 1.0 - step(0.5, lue);
}

vec4 triplanar_texture(sampler2D p_sampler, vec3 p_weights, vec3 p_triplanar_pos) {
	vec4 samp = vec4(0.0);
	samp += texture(p_sampler, p_triplanar_pos.xy) * p_weights.z;
	samp += texture(p_sampler, p_triplanar_pos.xz) * p_weights.y;
	samp += texture(p_sampler, p_triplanar_pos.zy * vec2(-1.0, 1.0)) * p_weights.x;
	return samp;
}

float etat_vu(sampler2D plan) {
	float rangees_par_plan = float(vision_rangees_par_plan);
	vec2 texel = vec2(vision_case.x + 0.5, vision_premiere_rangee + clamp(vision_case.y + 0.5, 0.5, rangees_par_plan - 0.5));
	return texture(plan, texel / vec2(textureSize(plan, 0))).r;
}

void fragment() {
	if (uv1_triplanar) {
		ALBEDO = triplanar_texture(albedo_texture, uv1_power_normal, uv1_triplanar_pos).rgb;
		if (normal_enabled) {
			NORMAL_MAP = triplanar_texture(normal_texture, uv1_power_normal, uv1_triplanar_pos).rgb;
		}
		vec3 teinte = OUTPUT_IS_SRGB ? en_srgb(en_lineaire(ALBEDO) * en_lineaire(COLOR.rgb)) : ALBEDO * COLOR.rgb;
		ALBEDO = mix(ALBEDO, teinte, nappe);
	} else {
		ALBEDO = COLOR.rgb;
	}
	float lumiere = part_de_lumiere(etat_du_fondu(etat_vu(vision_avant), etat_vu(vision)));
	if (lumiere != 1.0) {
		ALBEDO = OUTPUT_IS_SRGB ? en_srgb(en_lineaire(ALBEDO) * lumiere) : ALBEDO * lumiere;
		// #3950
		SPECULAR = 0.5 * sqrt(lumiere);
	}
	ROUGHNESS = roughness;
}

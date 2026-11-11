// Le shader du monde (`VolumeDeScene`, #3948) : le code que Godot 4.7 génère pour un `StandardMaterial3D` coloré par
// ses sommets (sRGB) ou texturé en triplanaire dans le repère du maillage, relief compris, rendu des deux côtés, plus
// le masque du retrait (`retrait`, `RetraitDuMonde`) : un sommet dont la case (`UV2`) est retirée se replie ; une case
// hors du masque lié (aucun lié : la texture noire par défaut) n'est pas lue, rien ne s'y replie.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform sampler2D retrait : filter_nearest, hint_default_black;
uniform bool texturee = false;
uniform bool relief = false;
uniform float roughness : hint_range(0.0, 1.0) = 1.0;
uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D texture_normal : hint_roughness_normal, filter_linear_mipmap, repeat_enable;
uniform float uv1_blend_sharpness : hint_range(0.0, 150.0, 0.001);
uniform vec3 uv1_scale = vec3(1.0);

varying vec3 uv1_triplanar_pos;
varying vec3 uv1_power_normal;

void vertex() {
	if (texturee) {
		TANGENT = vec3(0.0, 0.0, -1.0) * abs(NORMAL.x);
		TANGENT += vec3(1.0, 0.0, 0.0) * abs(NORMAL.y);
		TANGENT += vec3(1.0, 0.0, 0.0) * abs(NORMAL.z);
		TANGENT = normalize(TANGENT);
		BINORMAL = vec3(0.0, 1.0, 0.0) * abs(NORMAL.x);
		BINORMAL += vec3(0.0, 0.0, -1.0) * abs(NORMAL.y);
		BINORMAL += vec3(0.0, 1.0, 0.0) * abs(NORMAL.z);
		BINORMAL = normalize(BINORMAL);
		uv1_power_normal = pow(abs(NORMAL), vec3(uv1_blend_sharpness));
		uv1_triplanar_pos = VERTEX * uv1_scale;
		uv1_power_normal /= dot(uv1_power_normal, vec3(1.0));
		uv1_triplanar_pos *= vec3(1.0, -1.0, 1.0);
	} else if (!OUTPUT_IS_SRGB) {
		COLOR.rgb = mix(
				pow((COLOR.rgb + vec3(0.055)) * (1.0 / (1.0 + 0.055)), vec3(2.4)),
				COLOR.rgb * (1.0 / 12.92),
				lessThan(COLOR.rgb, vec3(0.04045)));
	}
	ivec2 texel = ivec2(UV2);
	if (all(lessThan(texel, textureSize(retrait, 0))) && texelFetch(retrait, texel, 0).r > 0.5) {
		VERTEX = vec3(0.0);
	}
}

vec4 triplanar_texture(sampler2D p_sampler, vec3 p_weights, vec3 p_triplanar_pos) {
	vec4 samp = vec4(0.0);
	samp += texture(p_sampler, p_triplanar_pos.xy) * p_weights.z;
	samp += texture(p_sampler, p_triplanar_pos.xz) * p_weights.y;
	samp += texture(p_sampler, p_triplanar_pos.zy * vec2(-1.0, 1.0)) * p_weights.x;
	return samp;
}

void fragment() {
	if (texturee) {
		ALBEDO = triplanar_texture(texture_albedo, uv1_power_normal, uv1_triplanar_pos).rgb;
		if (relief) {
			NORMAL_MAP = triplanar_texture(texture_normal, uv1_power_normal, uv1_triplanar_pos).rgb;
		}
	} else {
		ALBEDO = COLOR.rgb;
	}
	ROUGHNESS = roughness;
}

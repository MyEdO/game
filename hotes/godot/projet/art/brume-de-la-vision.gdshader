// La brume de la vision (#4066) : la matière du volume de brouillard qui porte, sous Forward+ seul, tout le brouillard
// volumétrique de la scène (`Lumiere.brume`, sa densité celle de `scenes/Lumiere.tscn`). En chaque point de l'air, dans
// le repère de la carte (le monde à l'identité, comme `art/voile.gdshader`), la lumière qu'elle diffuse (`ALBEDO`) est
// la part de lumière (`part_de_lumiere`, `art/vision.gdshaderinc`) de l'état que la vision donne au point
// (`etat_regarde`, la case du bord hors de la carte) ; sa densité reste celle de la ressource : la case voilée rend sa
// part sous la brume comme sans elle (`recettes/voile-du-bati.gd`).
shader_type fog;

#include "res://art/vision.gdshaderinc"
uniform float densite = 0.0;

void fog() {
	DENSITY = densite;
	ALBEDO = vec3(part_de_lumiere(etat_regarde(WORLD_POSITION)));
}

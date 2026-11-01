## Le gabarit d'une base (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ») posé sur la pose de son squelette à
## chaque mise à jour, après le clip : un `SkeletonModifier3D` enfant du `Skeleton3D` modifie la pose que l'`AnimationMixer`
## a jouée (classe `SkeletonModifier3D`, Godot 4.7), et le squelette restaure la pose non modifiée après le skinning
## (`Skeleton3D::_notification`, `NOTIFICATION_UPDATE_SKELETON`, `bones_backup`) : rien ne s'accumule d'une image à
## l'autre, au repos comme pendant un clip. Le gabarit posé se mesure une fois au repos, à la première mise à jour qui
## suit : seule la pose modifiée y donne la place des os.
class_name GabaritDuSquelette
extends SkeletonModifier3D

## Le gabarit posé est mesuré au repos : `mesures()` porte `neutre` et `repos`.
signal mesure

## Le rang de l'os `racine` du gabarit, -1 sans gabarit.
var _racine := -1
var _echelle := 1.0
## Par rang d'os enfant d'un os de `enfantsDe`, son facteur.
var _facteurs: Dictionary = {}
## Les rangs des os de `pieds`.
var _pieds: Array[int] = []
var _a_mesurer := false
## `neutre` (le repos sans gabarit), `repos` (le repos au gabarit) et `image` (la dernière pose modifiée) : chacun la
## hauteur monde du pied le plus bas (`pied`), celle du pied le plus bas de la même pose sans gabarit (`piedSansGabarit`),
## celle de l'os le plus haut (`sommet`) et l'échelle monde de la racine (`echelle`) ; vide sans gabarit.
var _mesures: Dictionary = {}


## Le gabarit `gabarit` (`gabarit` de `composer`, vide : aucun) posé sur le squelette parent : les os qu'il nomme et que le
## squelette n'a pas, rendus.
func poser(gabarit: Dictionary) -> Array[String]:
	var squelette := get_skeleton()
	var absents: Array[String] = []
	_racine = -1
	_facteurs.clear()
	_pieds.clear()
	_mesures = {}
	_a_mesurer = false
	if gabarit.is_empty():
		return absents
	_racine = squelette.find_bone(gabarit.racine.os)
	_echelle = float(gabarit.racine.echelle)
	if _racine == -1:
		absents.append(gabarit.racine.os)
	for parent in gabarit.enfantsDe:
		var rang := squelette.find_bone(parent)
		if rang == -1:
			absents.append(parent)
			continue
		for enfant in squelette.get_bone_children(rang):
			_facteurs[enfant] = float(gabarit.enfantsDe[parent])
	for pied in gabarit.pieds:
		var rang := squelette.find_bone(pied)
		if rang == -1:
			absents.append(pied)
		else:
			_pieds.append(rang)
	_a_mesurer = absents.is_empty()
	return absents


## Les mesures du gabarit posé (voir `_mesures`).
func mesures() -> Dictionary:
	return _mesures


func _process_modification_with_delta(_delta: float) -> void:
	var squelette := get_skeleton()
	if _a_mesurer:
		_mesurer(squelette)
	var sans_gabarit := _pied(squelette)
	_poser_sur(squelette, sans_gabarit)
	if not _mesures.is_empty():
		_mesures.image = _mesure(squelette, sans_gabarit)


## Sur la pose courante, l'échelle de la racine et la position des enfants, puis la racine translatée verticalement dans
## le repère de son parent (la verticale monde rapportée au repère du squelette, puis à celui du parent de la racine,
## `MiseEnPage.dans_la_base`) jusqu'à porter le pied le plus bas à la hauteur `sol`, la sienne dans la pose sans gabarit.
func _poser_sur(squelette: Skeleton3D, sol: float) -> void:
	for enfant in _facteurs:
		squelette.set_bone_pose_position(enfant, MiseEnPage.position_au_gabarit(squelette.get_bone_pose_position(enfant), _facteurs[enfant]))
	if _racine == -1:
		return
	squelette.set_bone_pose_scale(_racine, MiseEnPage.echelle_au_gabarit(squelette.get_bone_pose_scale(_racine), _echelle))
	if _pieds.is_empty():
		return
	var verticale := MiseEnPage.dans_la_base(squelette.global_basis, Vector3.UP)
	var parent := squelette.get_bone_parent(_racine)
	if parent != -1:
		verticale = MiseEnPage.dans_la_base(squelette.get_bone_global_pose(parent).basis, verticale)
	var decalage := MiseEnPage.decalage_au_sol(verticale, sol, _pied(squelette))
	squelette.set_bone_pose(_racine, squelette.get_bone_pose(_racine).translated(decalage))


## Au repos : la mesure sans gabarit, puis au gabarit ; la pose de l'image rendue ensuite.
func _mesurer(squelette: Skeleton3D) -> void:
	var poses: Array[Transform3D] = []
	for os in squelette.get_bone_count():
		poses.append(squelette.get_bone_pose(os))
	squelette.reset_bone_poses()
	var sol := _pied(squelette)
	var neutre := _mesure(squelette, sol)
	_poser_sur(squelette, sol)
	_mesures = {neutre = neutre, repos = _mesure(squelette, sol)}
	for os in squelette.get_bone_count():
		squelette.set_bone_pose(os, poses[os])
	_a_mesurer = false
	mesure.emit.call_deferred()


## Sur la pose courante, la hauteur monde du pied le plus bas, `sans_gabarit` celle de la même pose sans gabarit, celle
## de l'os le plus haut, et l'échelle monde de la racine.
func _mesure(squelette: Skeleton3D, sans_gabarit: float) -> Dictionary:
	var sommet := -INF
	for os in squelette.get_bone_count():
		sommet = MiseEnPage.plus_haut(sommet, _hauteur(squelette, os))
	var echelle := MiseEnPage.echelle_composee(squelette.global_basis.get_scale().y, squelette.get_bone_global_pose(_racine).basis.get_scale().y)
	return {pied = _pied(squelette), piedSansGabarit = sans_gabarit, sommet = sommet, echelle = echelle}


## La hauteur monde du plus bas des os de `pieds` sur la pose courante, `INF` sans pied.
func _pied(squelette: Skeleton3D) -> float:
	var pied := INF
	for os in _pieds:
		pied = MiseEnPage.plus_bas(pied, _hauteur(squelette, os))
	return pied


func _hauteur(squelette: Skeleton3D, os: int) -> float:
	return squelette.to_global(squelette.get_bone_global_pose(os).origin).y

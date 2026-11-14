## Le gabarit d'une base (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ») posé sur la pose de son squelette à
## chaque mise à jour, après le clip : un `SkeletonModifier3D` enfant du `Skeleton3D` modifie la pose que l'`AnimationMixer`
## a jouée (classe `SkeletonModifier3D`, Godot 4.7), et le squelette restaure la pose non modifiée après le skinning
## (`Skeleton3D::_notification`, `NOTIFICATION_UPDATE_SKELETON`, `bones_backup`) : rien ne s'accumule d'une image à
## l'autre, au repos comme pendant un clip. Le gabarit posé se mesure une fois au repos, à la première mise à jour qui
## suit : seule la pose modifiée y donne la place des os. Sur un clip planté engagé au `lecteur`, les jambes se plient
## comme `poserLeGabarit` (« Gabarit d'une base ») : ce modificateur monte la racine et pose la visée de chaque pied ;
## des modificateurs natifs posés à sa suite, dans cet ordre, `TwoBoneIK3D` plie chaque jambe vers sa visée, le genou
## vers sa place courante, et `CopyTransformModifier3D` donne au pied l'orientation de sa visée ; `Sol` porte enfin la
## pose au sol.
class_name GabaritDuSquelette
extends SkeletonModifier3D

## @contrat Gabarit d'une base
## Godot applique actuellement (1) la lecture du plus bas des os `appuis.pieds` sans gabarit, (2) la composition des
## facteurs et des translations de `deplacementsDesOs` après le clip, la translation ajoutée après le Y multiplié
## (`poserEnfantsDuGabarit`), puis (3) la translation qui ramène ces os à leur minimum de (1), dans
## `GabaritDuSquelette` ; à l'étape (2), sur le clip engagé à son lecteur (`AnimationPlayer.assigned_animation`,
## `MontageDeComposition.lecteur`) s'il est dans `clipsPlantes`, il plie les jambes comme `poserLeGabarit`, dans le
## repère du squelette : il monte la racine et pose la visée de chaque pied, translatée du déplacement que les seules
## translations donnent à ce pied, puis des modificateurs natifs posés à sa suite, `TwoBoneIK3D` (le genou vers sa
## place courante) et `CopyTransformModifier3D` (l'orientation de la visée), plient chaque jambe, avant la
## translation (3) (recettes `projet/recettes/marche-au-gabarit.gd`, legs 0,62, 1 et 1,12, et
## `projet/recettes/os-deplaces-du-gabarit.gd`).
## `MontageDeComposition` compense les translations dans les liaisons de chaque pièce skinnée, fondue ou dessinée
## seule : la liaison de l'os b devient `Transform3D(Basis.IDENTITY, -R_b.basis⁻¹·D_b)·liaison`, R_b son repos
## global sans gabarit et D_b son déplacement au repos (`GabaritDuSquelette.deplacement_au_repos`). Au repos, la peau
## vaut ainsi bind et clés quels que soient ses poids ; une pièce rigide suit son os. Une pièce dessinée seule
## reçoit une copie de son skin, celui du GLB restant aux lecteurs du bind d'origine (recette
## `projet/recettes/os-deplaces-du-gabarit.gd`).
## `TwoBoneIK3D` mesure les os sur leurs positions de pose sans l'échelle de pose de leurs parents (Godot 4.7) : sa
## cible se pose à l'échelle de cette mesure autour de la hanche (`MiseEnPage.visee_de_l_ik`). Le lot GD devra
## remplacer (1) par le minimum des copies `appuis.plusBas` skinnées sans gabarit et sans clés `gabarit_*`, (2) par la
## même mesure avec les binds compensés et les formes au gabarit, et (3) par la translation vers `sl` fois le minimum
## de (1). Le code de l'hôte reste celui des os jusqu'à ce lot. `appuis.pieds` reste consommé par les surfaces de
## marche (`evaluer.ts`, `surfacesDesPieds`), par la composition et par les mesures de l'atelier Godot.

## Le gabarit posé est mesuré au repos : `mesures()` porte `neutre` et `repos`.
signal mesure

## Le rang de l'os `racine` du gabarit, -1 sans gabarit.
var _racine := -1
var _echelle := 1.0
## Par rang d'os que la pose déplace (`enfantsDuGabarit`) : chaque enfant d'un os de `enfantsDe` et chaque os de
## `deplacementsDesOs`, `[facteur, translation]` ; facteur 1 sans parent dans `enfantsDe`, translation nulle sans
## déplacement.
var _enfants: Dictionary = {}
## Les rangs des os de `pieds`.
var _pieds: Array[int] = []
## Par jambe de `jambes`, les rangs de sa cuisse, de son mollet et de son pied (`jambesDuGabarit`).
var _jambes: Array[PackedInt32Array] = []
var _clips_plantes: PackedStringArray = []
## Le lecteur des clips de la base, `null` sans lui : son clip engagé (`assigned_animation`) plie les jambes s'il est
## planté.
var lecteur: AnimationPlayer = null
## Les modificateurs posés à la suite du gabarit, créés au premier `poser`.
var _ik: TwoBoneIK3D = null
var _orientation: CopyTransformModifier3D = null
var _sol: Sol = null
## Par jambe, le nœud de sa visée et celui de son genou, dans le repère du squelette.
var _visees: Array[Node3D] = []
var _genoux: Array[Node3D] = []
## La hauteur du pied le plus bas de la pose sans gabarit de la mise à jour courante.
var _hauteur_sans_gabarit := INF
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
	_enfants.clear()
	_pieds.clear()
	_jambes.clear()
	_clips_plantes = []
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
			_enfants[enfant] = [float(gabarit.enfantsDe[parent]), Vector3.ZERO]
	for nom in gabarit.deplacementsDesOs:
		var rang := squelette.find_bone(nom)
		if rang == -1:
			absents.append(nom)
			continue
		var translation: Array = gabarit.deplacementsDesOs[nom]
		_enfants.get_or_add(rang, [1.0, Vector3.ZERO])[1] = Vector3(translation[0], translation[1], translation[2])
	for pied in gabarit.pieds:
		var rang := squelette.find_bone(pied)
		if rang == -1:
			absents.append(pied)
		else:
			_pieds.append(rang)
	_clips_plantes = PackedStringArray(gabarit.clipsPlantes)
	for nom in gabarit.jambes:
		var mollet := squelette.find_bone(nom)
		if mollet == -1:
			absents.append(nom)
			continue
		var cuisse := squelette.get_bone_parent(mollet)
		if cuisse == -1 or not gabarit.jambes.has(squelette.get_bone_name(cuisse)):
			continue
		var pieds := squelette.get_bone_children(mollet)
		if pieds.size() != 1:
			absents.append("pied de %s" % nom)
			continue
		_jambes.append(PackedInt32Array([cuisse, mollet, pieds[0]]))
	_poser_les_jambes()
	_a_mesurer = absents.is_empty()
	return absents


## Le modificateur qui porte la pose au sol, après les jambes pliées.
class Sol extends SkeletonModifier3D:
	var gabarit: GabaritDuSquelette

	func _process_modification_with_delta(_delta: float) -> void:
		gabarit.porter_au_sol(get_skeleton())


## Les modificateurs des jambes, créés une fois à la suite du gabarit, réglés sur `_jambes`.
func _poser_les_jambes() -> void:
	if _ik == null:
		_sol = Sol.new()
		_sol.name = "GabaritDuSquelette_Sol"
		_sol.gabarit = self
		_orientation = CopyTransformModifier3D.new()
		_orientation.name = "GabaritDuSquelette_Pieds"
		_ik = TwoBoneIK3D.new()
		_ik.name = "GabaritDuSquelette_Jambes"
		for modificateur in [_sol, _orientation, _ik]:
			add_sibling(modificateur)
	for noeuds in [_visees, _genoux]:
		for noeud in noeuds:
			noeud.free()
	_visees.clear()
	_genoux.clear()
	_ik.setting_count = _jambes.size()
	_orientation.setting_count = _jambes.size()
	for rang in _jambes.size():
		_visees.append(Node3D.new())
		_genoux.append(Node3D.new())
		add_child(_visees[rang])
		add_child(_genoux[rang])
		_ik.set_root_bone(rang, _jambes[rang][0])
		_ik.set_middle_bone(rang, _jambes[rang][1])
		_ik.set_end_bone(rang, _jambes[rang][2])
		_ik.set_target_node(rang, _ik.get_path_to(_visees[rang]))
		_ik.set_pole_node(rang, _ik.get_path_to(_genoux[rang]))
		_orientation.set_apply_bone(rang, _jambes[rang][2])
		_orientation.set_reference_type(rang, BoneConstraint3D.REFERENCE_TYPE_NODE)
		_orientation.set_reference_node(rang, _orientation.get_path_to(_visees[rang]))
		_orientation.set_copy_flags(rang, CopyTransformModifier3D.TRANSFORM_FLAG_ROTATION)
		_orientation.set_relative(rang, false)
	_plier(false)


func _plier(plante: bool) -> void:
	if _ik == null:
		return
	_ik.active = plante
	_orientation.active = plante


## Les mesures du gabarit posé (voir `_mesures`).
func mesures() -> Dictionary:
	return _mesures


func _process_modification_with_delta(_delta: float) -> void:
	var squelette := get_skeleton()
	if _a_mesurer:
		_mesurer(squelette)
	_hauteur_sans_gabarit = _pied(squelette)
	_poser_sur(squelette, lecteur != null and _clips_plantes.has(String(lecteur.assigned_animation)))


## La pose au sol (voir `_au_sol`) de la mise à jour courante, puis sa mesure.
func porter_au_sol(squelette: Skeleton3D) -> void:
	_au_sol(squelette, _hauteur_sans_gabarit)
	if not _mesures.is_empty():
		_mesures.image = _mesure(squelette, _hauteur_sans_gabarit)


## Sur la pose courante, l'échelle de la racine et la position des enfants, le Y multiplié par son facteur puis la
## translation ajoutée (`poserEnfantsDuGabarit`) ; si `plante`, la visée de chaque jambe prise avant les enfants et
## translatée du déplacement de son pied sous les seules translations (`deplacementsMondeDesOs`), puis la racine
## montée et les jambes à plier (`poserLeGabarit`). `TwoBoneIK3D` mesure les os de
## la jambe sur ses positions de pose et ses bases de repos, sans l'échelle de pose de leurs parents
## (`TwoBoneIK3D::_get_bone_global_rest`, Godot 4.7) : sa cible se pose à l'échelle de cette mesure autour de la hanche
## (`MiseEnPage.visee_de_l_ik`), le triangle de la jambe restant semblable, et l'orientation du pied reste celle de sa
## visée.
func _poser_sur(squelette: Skeleton3D, plante: bool) -> void:
	plante = plante and _racine != -1 and not _jambes.is_empty()
	_plier(plante)
	if _racine != -1:
		squelette.set_bone_pose_scale(_racine, MiseEnPage.echelle_au_gabarit(squelette.get_bone_pose_scale(_racine), _echelle))
	var extensions: Array[float] = []
	if plante:
		for rang in _jambes.size():
			_visees[rang].transform = squelette.get_bone_global_pose(_jambes[rang][2]).translated(_deplacement(squelette, _jambes[rang][2], false))
			extensions.append(MiseEnPage.extension_de_jambe(_longueur(squelette, _jambes[rang][0], _jambes[rang][2]),
				_longueur(squelette, _jambes[rang][0], _jambes[rang][1]), _longueur(squelette, _jambes[rang][1], _jambes[rang][2])))
	for enfant in _enfants:
		var au_gabarit := MiseEnPage.position_au_gabarit(squelette.get_bone_pose_position(enfant), _enfants[enfant][0])
		squelette.set_bone_pose_position(enfant, Transform3D(Basis.IDENTITY, au_gabarit).translated(_enfants[enfant][1]).origin)
	if not plante:
		return
	var montee := INF
	for rang in _jambes.size():
		var portee := MiseEnPage.portee_de_jambe(extensions[rang], _longueur(squelette, _jambes[rang][0], _jambes[rang][1]),
			_longueur(squelette, _jambes[rang][1], _jambes[rang][2]))
		var vers := _visees[rang].transform.translated(-_origine(squelette, _jambes[rang][0])).origin
		montee = MiseEnPage.plus_bas(montee, MiseEnPage.montee_de_jambe(vers, squelette.global_basis, portee))
	var deplacement := _vers_la_racine(squelette, MiseEnPage.deplacement_de_montee(squelette.global_basis, montee))
	squelette.set_bone_pose(_racine, squelette.get_bone_pose(_racine).translated(deplacement))
	for rang in _jambes.size():
		var hanche := _origine(squelette, _jambes[rang][0])
		var visee := _visees[rang].transform
		_visees[rang].transform = Transform3D(visee.basis, hanche).translated(MiseEnPage.visee_de_l_ik(visee.translated(-hanche).origin,
			squelette.get_bone_global_pose(_jambes[rang][0]).basis.get_scale().y, squelette.get_bone_global_rest(_jambes[rang][0]).basis.get_scale().y))
		_genoux[rang].position = _origine(squelette, _jambes[rang][1])


## Le déplacement de l'os `os` au repos sans gabarit, dans le repère du squelette, sous les seules translations du
## gabarit posé : celui de son parent plus la base de repos du parent appliquée à sa translation ; nul sans gabarit.
## `MontageDeComposition` en compense les liaisons des pièces skinnées.
func deplacement_au_repos(os: int) -> Vector3:
	return _deplacement(get_skeleton(), os, true)


## Le déplacement de l'os `os` sous les seules translations de `_enfants`, sur la pose courante ou, `au_repos`, au repos
## sans gabarit : la somme, sur l'os et chacun de ses ascendants, de sa translation dans la base de son parent.
func _deplacement(squelette: Skeleton3D, os: int, au_repos: bool) -> Vector3:
	var deplacement := Vector3.ZERO
	var rang := os
	while rang != -1:
		var parent := squelette.get_bone_parent(rang)
		var base := Basis.IDENTITY
		if parent != -1:
			base = (squelette.get_bone_global_rest(parent) if au_repos else squelette.get_bone_global_pose(parent)).basis
		deplacement = Transform3D(base, deplacement).translated_local(_enfants.get(rang, [1.0, Vector3.ZERO])[1]).origin
		rang = parent
	return deplacement


## La racine translatée verticalement dans le repère de son parent (la verticale monde rapportée au repère du squelette,
## puis à celui du parent de la racine, `MiseEnPage.dans_la_base`) jusqu'à porter le pied le plus bas à la hauteur
## `sol`, la sienne dans la pose sans gabarit.
func _au_sol(squelette: Skeleton3D, sol: float) -> void:
	if _racine == -1 or _pieds.is_empty():
		return
	var decalage := MiseEnPage.decalage_au_sol(_vers_la_racine(squelette, MiseEnPage.dans_la_base(squelette.global_basis, Vector3.UP)), sol, _pied(squelette))
	squelette.set_bone_pose(_racine, squelette.get_bone_pose(_racine).translated(decalage))


## Le vecteur `vecteur` du repère du squelette rapporté à celui du parent de la racine.
func _vers_la_racine(squelette: Skeleton3D, vecteur: Vector3) -> Vector3:
	var parent := squelette.get_bone_parent(_racine)
	return vecteur if parent == -1 else MiseEnPage.dans_la_base(squelette.get_bone_global_pose(parent).basis, vecteur)


## La distance de l'os `de` à l'os `a` sur la pose courante.
func _longueur(squelette: Skeleton3D, de: int, a: int) -> float:
	return MiseEnPage.longueur(squelette.get_bone_global_pose(a).translated(-_origine(squelette, de)).origin)


func _origine(squelette: Skeleton3D, os: int) -> Vector3:
	return squelette.get_bone_global_pose(os).origin


## Au repos : la mesure sans gabarit, puis au gabarit ; la pose de l'image rendue ensuite.
func _mesurer(squelette: Skeleton3D) -> void:
	var poses: Array[Transform3D] = []
	for os in squelette.get_bone_count():
		poses.append(squelette.get_bone_pose(os))
	squelette.reset_bone_poses()
	var sol := _pied(squelette)
	var neutre := _mesure(squelette, sol)
	_poser_sur(squelette, false)
	_au_sol(squelette, sol)
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

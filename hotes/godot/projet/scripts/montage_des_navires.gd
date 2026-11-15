## Les navires d'une scène montés sur son monde (#3686, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `navires`), que le plateau du jeu (`vue.corps.navires`) et l'éditeur de carte (la réponse de `editer`) posent tous deux
## ici : chaque navire servi sous le modèle de son corps (`MontageDeVehicule`), à l'échelle métrique du plateau, sa proue,
## le +Z de son repère, tournée vers son cap (`MiseEnPage.lacet_de_proue`), son origine au point de la carte sous elle
## (`centre`), à la hauteur 0 de la scène, sa flottaison ; coupé à la hauteur de coupe que le regard lui donne, entier
## sinon ; posé, la mer de sa flottaison bordée par ce que sa coque plonge sous la hauteur 0 (`MontageDeVehicule.contour_sous`,
## `VolumeDeScene.border_la_mer`). Un navire dont seul le centre change (l'éditeur le déplace) se repose sans se recharger ;
## ceux qui ne sont plus servis se retirent. Chacun se voile par la vision du groupe que le volume du monde tient
## (`VolumeDeScene.voile`, `MontageDeVehicule.voiler`), case par case.
class_name MontageDesNavires
extends Node3D

## Le modèle d'un navire s'est posé.
signal pose

## Le monde dont le volume borde la mer de chaque navire.
@export var monde: Monde

## Le montage qui tire les modèles des navires (`MontageDeComposition.scene_du_modele`) et en recueille les erreurs.
@onready var _chargeur: MontageDeComposition = $Chargeur

## Par id d'entité, le montage de chaque navire, le dernier navire servi, le repère de la scène nue de son modèle et le
## centre où ce modèle est posé.
var _montes: Dictionary = {}
var _servis: Dictionary = {}
var _reperes: Dictionary = {}
var _centres: Dictionary = {}
## L'échelle métrique du dernier plateau, en mètres par case.
var _metres_par_case := 1.0


## Chaque navire de `navires` monté (`_monter`), coupé à la hauteur de coupe du plus bas des sols que le regard lui retire
## (`coupes`, en mètres, `MiseEnPage.hauteur_de_coupe`), entier sinon, sur un plateau de `metres_par_case` ; ceux que
## `navires` ne sert plus, retirés.
func poser(navires: Dictionary, coupes: Dictionary, metres_par_case: float) -> void:
	_metres_par_case = metres_par_case
	for id: String in _montes.keys():
		if not navires.has(id):
			_montes[id].queue_free()
			monde.volume.oublier_le_voile(id)
			for table in [_montes, _servis, _reperes, _centres]:
				table.erase(id)
	for id: String in navires:
		_servis[id] = navires[id]
		if not _montes.has(id):
			var montage := MontageDeVehicule.new()
			add_child(montage)
			_montes[id] = montage
			montage.voiler(monde.volume.voile(id))
		_montes[id].couper(MiseEnPage.hauteur_de_coupe(coupes[id], metres_par_case) if coupes.has(id) else null)
		_monter(id)


## Sorti de l'arbre avec son plateau ou son éditeur, qui n'y reviennent pas (#4195) : ses navires sont oubliés, et le
## montage en vol de chacun ne poursuit rien (`_montes`, `_monter`).
func _exit_tree() -> void:
	_montes.clear()


## Les ids des navires dont le modèle est posé.
func poses() -> Array:
	return _montes.keys().filter(func(id: String) -> bool: return _montes[id].scene != null)


## Le corps du navire `id` monté (`MontageDeVehicule.monter`), sa scène nue posée (`_placer`) ; son corps inchangé, sa
## scène reposée si son centre a changé ; posée ou reposée, la mer de sa flottaison bordée, et `pose` émis.
func _monter(id: String) -> void:
	var montage: MontageDeVehicule = _montes[id]
	var monte: bool = await montage.monter(_servis[id].corps, _chargeur, func(scene: Node3D) -> void:
		_reperes[id] = scene.transform
		_placer(id, scene))
	if _montes.get(id) != montage or montage.scene == null:
		return
	if not monte:
		if _centres[id] == _servis[id].centre:
			return
		_placer(id, montage.scene)
	monde.volume.border_la_mer(id, montage.contour_sous(MiseEnPage.hauteur_au_plateau(0.0, _metres_par_case)))
	pose.emit()


## La scène `scene` du navire `id`, depuis le repère de sa scène nue, à l'échelle métrique du plateau, sa proue tournée
## vers son cap, son origine au point de la carte sous son centre, à la hauteur 0.
func _placer(id: String, scene: Node3D) -> void:
	var navire: Dictionary = _servis[id]
	var echelle := MiseEnPage.echelle_metrique(_metres_par_case)
	var origine := MiseEnPage.point_de_la_carte(navire.centre.x, navire.centre.y, 0.0)
	scene.transform = (_reperes[id] as Transform3D).scaled(Vector3(echelle, echelle, echelle)).rotated(Vector3.UP, MiseEnPage.lacet_de_proue(MiseEnPage.LACETS_DES_CAPS[navire.corps.cap])).translated(origine)
	_centres[id] = navire.centre


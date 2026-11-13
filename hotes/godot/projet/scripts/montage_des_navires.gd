## Les navires d'une scène montés sur son monde (#3686, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `navires`), que le plateau du jeu (`vue.corps.navires`) et l'éditeur de carte (la réponse de `editer`) posent tous deux
## ici : chaque navire servi sous le modèle de son corps (`MontageDeVehicule`), à l'échelle métrique du plateau, sa proue,
## le +Z de son repère, tournée vers son cap (`MiseEnPage.lacet_de_proue`), son origine au point de la carte sous elle
## (`centre`), à la hauteur 0 de la scène, sa flottaison ; coupé à la hauteur de coupe que le regard lui donne, entier
## sinon ; posé, la mer de sa flottaison bordée par ce que sa coque plonge sous la hauteur 0 (`MontageDeVehicule.contour_sous`,
## `VolumeDeScene.border_la_mer`). Un navire dont seul le centre change (l'éditeur le déplace) se repose sans se recharger ;
## ceux qui ne sont plus servis se retirent. Chacun se voile à l'état que la vision du groupe lui donne (`voir`,
## `MontageDeVehicule.voiler`), que Godot ne calcule pas.
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
## La dernière vision posée (`voir`) : par id d'entité, l'octet de l'état de chaque navire qu'elle nomme, et ses teintes
## (inconnue, explorée, vue) ; `null` sans vision.
var _vision: Variant = null
var _teintes := Vector3.ONE
## Par id, l'octet d'avant et l'octet posé de l'état de chaque navire monté, la part du fondu de l'un à l'autre, et la
## vision reçue pendant un fondu, qui attend sa fin (`null` : aucune).
var _etats: Dictionary = {}
var _part_du_fondu := 1.0
var _vision_en_attente: Variant = null


## Chaque navire de `navires` monté (`_monter`), coupé à la hauteur de coupe du plus bas des sols que le regard lui retire
## (`coupes`, en mètres, `MiseEnPage.hauteur_de_coupe`), entier sinon, sur un plateau de `metres_par_case` ; ceux que
## `navires` ne sert plus, retirés.
func poser(navires: Dictionary, coupes: Dictionary, metres_par_case: float) -> void:
	_metres_par_case = metres_par_case
	for id: String in _montes.keys():
		if not navires.has(id):
			_montes[id].queue_free()
			for table in [_montes, _servis, _reperes, _centres, _etats]:
				table.erase(id)
	for id: String in navires:
		_servis[id] = navires[id]
		if not _montes.has(id):
			var montage := MontageDeVehicule.new()
			add_child(montage)
			_montes[id] = montage
			var etat := _etat_vu(id)
			_etats[id] = [etat, etat]
			_voiler(id)
		_montes[id].couper(MiseEnPage.hauteur_de_coupe(coupes[id], metres_par_case) if coupes.has(id) else null)
		_monter(id)


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


## La vision du groupe `vision` (la réponse de la méthode `vision` du pont : `navires`, par id d'entité l'octet 0, 128 ou
## 255 de l'état de chaque navire, et `teintes`) posée sur chaque navire monté, à la part de lumière de son état sous
## ses teintes (`MiseEnPage.part_de_lumiere`) ; `null` : aucun navire voilé. La première vision se pose sans fondu ;
## une autre fond chaque navire de l'état d'avant au neuf en `VolumeDeScene.DUREE_DU_FONDU_S` (`avancer_le_fondu`), et
## une vision reçue pendant un fondu attend sa fin, à la place de celle qui attendait. Un navire monté ensuite prend
## l'état de la vision posée sans fondu (`poser`) ; un navire que la vision ne nomme pas est vu.
func voir(vision: Variant) -> void:
	if vision != null and _part_du_fondu != 1.0:
		_vision_en_attente = vision
		return
	var premiere := _vision == null
	_vision = vision
	_vision_en_attente = null
	_teintes = Vector3.ONE if vision == null else Vector3(vision.teintes.unknown, vision.teintes.explored, vision.teintes.visible)
	for id: String in _montes:
		var neuf := _etat_vu(id)
		_etats[id] = [neuf if premiere or vision == null else _etats[id][1], neuf]
	_part_du_fondu = 1.0 if premiere or vision == null else 0.0
	for id: String in _montes:
		_voiler(id)


func _process(secondes: float) -> void:
	avancer_le_fondu(secondes)


## Le fondu de la vision (`voir`) avancé de `secondes` secondes, que `_process` avance à chaque image ; parvenu à sa fin,
## la vision qui attend se pose.
func avancer_le_fondu(secondes: float) -> void:
	if _part_du_fondu == 1.0:
		return
	_part_du_fondu = MiseEnPage.part_du_fondu(_part_du_fondu, secondes, VolumeDeScene.DUREE_DU_FONDU_S)
	for id: String in _montes:
		_voiler(id)
	if _part_du_fondu == 1.0 and _vision_en_attente != null:
		voir(_vision_en_attente)


## L'octet de l'état du navire `id` dans la vision posée (`voir`) : vu sans vision ou s'il n'y est pas nommé.
func _etat_vu(id: String) -> int:
	return 255 if _vision == null else int(_vision.navires.get(id, 255))


## Le navire `id` voilé à la part de lumière de son état fondu (`MiseEnPage.etat_fondu`) sous les teintes posées.
func _voiler(id: String) -> void:
	var etat: Array = _etats[id]
	_montes[id].voiler(MiseEnPage.part_de_lumiere(MiseEnPage.etat_fondu(etat[0], etat[1], _part_du_fondu), _teintes))

## Les modèles posés dans le monde d'une scène à la place de surfaces de son volume (`hotes/godot/pont/CONTRAT.md`,
## section « Corps d'un combattant ») : chaque navire servi (`navires`, #3686) sous le modèle de son corps, et chaque
## pose de chaque décor servi (`decors`, #4335) sous le modèle de son élément, que le plateau du jeu (`vue.corps`),
## l'éditeur de carte (la réponse de `editer`) et l'atelier (la réponse de `echantillon`) posent tous trois ici. Chaque
## pose (`_poses_servies`) se monte comme un véhicule (`MontageDeVehicule`), à l'échelle métrique du plateau, le +Z de
## son repère tourné vers son cap (`MiseEnPage.lacet_de_proue`), son origine au point de la carte de la pose, à la
## hauteur de son pied (`_placer`) ; la lecture d'un même GLB sert toutes ses poses (`MontageDeComposition.scene_du_modele`).
## Ce que la pose porte fait le reste : coupée à la hauteur de coupe que le regard lui donne (`coupes`), entière sinon ;
## sa flottaison bordée par ce que son modèle plonge sous la hauteur 0 (`flottaison`, `MontageDeVehicule.contour_sous`,
## `VolumeDeScene.border_la_mer`) ; rangée sur la couche des luminaires si elle éclaire (`luminaire`,
## `VolumeDeScene.COUCHE_DES_LUMINAIRES`) ; retirée avec sa case quand le regard la retire (`case`, `_retirer`). Une
## pose dont seul le lieu change se repose sans se recharger ; celles qui ne sont plus servies se retirent. Chacune se
## voile par la vision du groupe que le volume tient (`VolumeDeScene.voile`, `MontageDeVehicule.voiler`), case par case.
## Un décor que la saison change (`palette`, `caches`) se remonte quand son corps change, ceux qu'elle ne change pas
## restent montés (`MontageDeVehicule.monter`).
## Le volume ne peint pas les surfaces des décors servis (`VolumeDeScene.peindre_sans`), que leurs modèles montrent.
class_name MontageDesModeles
extends Node3D

## Le modèle d'une pose s'est posé.
signal pose

## Un décor se monte comme un véhicule nu : son élément, sa palette et ses nœuds cachés servis, sans poste, Amélioration
## ni clip.
const DECOR_NU := {postes = [], ameliorations = [], clips = {}}

## Le volume de la scène, qui voile chaque modèle, borde la mer de chaque navire et retire chaque case.
@export var volume: VolumeDeScene
## Le montage qui tire les modèles (`MontageDeComposition.scene_du_modele`) et en recueille les erreurs.
@export var chargeur: MontageDeComposition

## Par clé de pose (`_poses_servies`), le montage de son modèle, la dernière pose servie, le repère de la scène nue de
## son modèle et la pose où ce modèle est placé.
var _montes: Dictionary = {}
var _servis: Dictionary = {}
var _reperes: Dictionary = {}
var _places: Dictionary = {}
## L'échelle métrique du dernier plateau, en mètres par case.
var _metres_par_case := 1.0


func _ready() -> void:
	volume.retire.connect(_retirer_les_cases)


## Chaque pose de `navires` et de `decors` (`_poses_servies`) montée (`_monter`), coupée à la hauteur de coupe du plus
## bas des sols que le regard lui retire (`coupes`, en mètres, `MiseEnPage.hauteur_de_coupe`), entière sinon, sur un
## plateau de `metres_par_case` ; celles qu'ils ne servent plus, retirées. Le volume ne peint plus les surfaces des
## décors de `decors` (`VolumeDeScene.peindre_sans`), dès qu'ils sont servis.
func poser(navires: Dictionary, decors: Dictionary, coupes: Dictionary, metres_par_case: float) -> void:
	_metres_par_case = metres_par_case
	volume.peindre_sans(decors.keys())
	var poses := _poses_servies(navires, decors)
	for cle: String in _montes.keys():
		if not poses.has(cle):
			_montes[cle].queue_free()
			volume.oublier_le_voile(cle)
			for table in [_montes, _servis, _reperes, _places]:
				table.erase(cle)
	for cle: String in poses:
		_servis[cle] = poses[cle]
		if not _montes.has(cle):
			var montage := MontageDeVehicule.new()
			add_child(montage)
			_montes[cle] = montage
			montage.voiler(volume.voile(cle))
		_montes[cle].couper(MiseEnPage.hauteur_de_coupe(coupes[cle], metres_par_case) if coupes.has(cle) else null)
		_monter(cle)


## Aucune pose : chaque modèle retiré, et le volume peint entier.
func vider() -> void:
	poser({}, {}, {}, _metres_par_case)


## Les poses de `navires` (`vue.corps.navires`) et de `decors` (`vue.corps.decors`), par clé : chaque navire sous l'id de
## son entité, son corps, son `centre` à la hauteur 0, au `cap` de son corps, sa `flottaison` ; chaque pose d'un décor
## sous sa `cle` (`PoseDeDecor.cle`), son élément monté nu (`DECOR_NU`), peint de sa `palette` et ses `caches` cachés
## (`MontageDeVehicule.monter`), son `ancre` à son `piedM`, à son `cap`, sa `case`, et `luminaire` s'il éclaire.
static func _poses_servies(navires: Dictionary, decors: Dictionary) -> Dictionary:
	var poses := {}
	for id: String in navires:
		var navire: Dictionary = navires[id]
		poses[id] = {corps = navire.corps, x = navire.centre.x, y = navire.centre.y, piedM = 0.0, cap = navire.corps.cap, flottaison = id}
	for prop: String in decors:
		var corps: Dictionary = DECOR_NU.merged({element = decors[prop].element, palette = decors[prop].palette, caches = decors[prop].caches})
		for p: Dictionary in decors[prop].poses:
			var servie := {corps = corps, x = p.ancre.x, y = p.ancre.y, piedM = p.piedM, cap = p.cap, case = p.case}
			if p.has("luminaire"):
				servie.luminaire = true
			poses[p.cle] = servie
	return poses


## Sorti de l'arbre avec son plateau, son éditeur ou son atelier, qui n'y reviennent pas (#4195) : ses poses sont
## oubliées, et le montage en vol de chacune ne poursuit rien (`_montes`, `_monter`).
func _exit_tree() -> void:
	_montes.clear()


## Les clés des poses dont le modèle est posé.
func poses() -> Array:
	return _montes.keys().filter(func(cle: String) -> bool: return _montes[cle].scene != null)


## Les clés des navires dont le modèle est posé (`poses`, servies avec leur `flottaison`).
func navires() -> Array:
	return poses().filter(func(cle: String) -> bool: return _servis[cle].has("flottaison"))


## Le corps de la pose `cle` monté (`MontageDeVehicule.monter`), sa scène nue placée (`_placer`) ; son corps inchangé,
## sa scène replacée si sa pose a changé ; montée ou replacée, sa couche posée et sa case retirée (`_ranger`), sa
## flottaison bordée, et `pose` émis.
func _monter(cle: String) -> void:
	var montage: MontageDeVehicule = _montes[cle]
	var monte: bool = await montage.monter(_servis[cle].corps, chargeur, func(scene: Node3D) -> void:
		_reperes[cle] = scene.transform
		_placer(cle, scene))
	if _montes.get(cle) != montage or montage.scene == null:
		return
	if not monte:
		if _places.get(cle) == _servis[cle]:
			return
		_placer(cle, montage.scene)
	_ranger(cle)
	if _servis[cle].has("flottaison"):
		volume.border_la_mer(_servis[cle].flottaison, montage.contour_sous(MiseEnPage.hauteur_au_plateau(0.0, _metres_par_case)))
	pose.emit()


## La scène `scene` de la pose `cle`, depuis le repère de sa scène nue, à l'échelle métrique du plateau, le +Z de son
## repère tourné vers son cap, son origine au point de la carte de la pose, à la hauteur de son pied.
func _placer(cle: String, scene: Node3D) -> void:
	var servie: Dictionary = _servis[cle]
	var echelle := MiseEnPage.echelle_metrique(_metres_par_case)
	var origine := MiseEnPage.point_de_la_carte(servie.x, servie.y, MiseEnPage.hauteur_au_plateau(servie.piedM, _metres_par_case))
	scene.transform = (_reperes[cle] as Transform3D).scaled(Vector3(echelle, echelle, echelle)).rotated(Vector3.UP, MiseEnPage.lacet_de_proue(MiseEnPage.LACETS_DES_CAPS[servie.cap])).translated(origine)
	_places[cle] = servie


## Chaque mesh du modèle de la pose `cle` sur la couche des luminaires si elle éclaire (`luminaire`), que la lampe d'un
## foyer exclut de son ombre (`Foyer`), sur la couche du monde sinon ; puis sa case retirée (`_retirer`).
func _ranger(cle: String) -> void:
	var couche := VolumeDeScene.COUCHE_DES_LUMINAIRES if _servis[cle].has("luminaire") else VolumeDeScene.COUCHE_DU_MONDE
	for piece: MeshInstance3D in _montes[cle].scene.find_children("*", "MeshInstance3D", true, false):
		piece.layers = couche
	_retirer(cle)


## Le modèle de chaque pose posée retiré ou montré selon le retrait posé au volume (`_retirer`).
func _retirer_les_cases() -> void:
	for cle: String in poses():
		_retirer(cle)


## Le modèle de la pose `cle`, si elle porte une `case` : quand le regard retire cette case (`VolumeDeScene.posee_retiree`),
## aucun de ses meshes ne se voit, chacun portant son ombre (`SHADOWS_ONLY`), comme ce que le masque retire du volume ;
## montré sinon.
func _retirer(cle: String) -> void:
	if not _servis[cle].has("case"):
		return
	var c: Dictionary = _servis[cle].case
	var ombre := GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if volume.posee_retiree(Vector3i(int(c.x), int(c.y), int(c.z))) else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	for piece: MeshInstance3D in _montes[cle].scene.find_children("*", "MeshInstance3D", true, false):
		piece.cast_shadow = ombre

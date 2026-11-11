## Le studio des portraits (#3534) : un seul corps (`Combattant`), dans le monde propre d'un `SubViewport` hors de l'écran,
## vêtu tour à tour de chaque corps qu'un portrait demande (`photographier`), puis photographié en buste
## (`MiseEnPage.cadrage_en_buste`), de face, son clip de repos arrêté. Une photo se garde par corps : un corps déjà
## photographié ne se revêt plus. Un seul corps de plus que le plateau, quel que soit le nombre de portraits, car chaque
## corps monté instancie le GLB de sa base.
class_name StudioDePortraits
extends Node

## Le temps sans habillage neuf (s) qu'un corps attend avant sa photo : ses éléments se montent après sa base.
const REPOS_S := 0.15

static var _studio: StudioDePortraits = null

@onready var _monde: SubViewport = $Monde
@onready var _combattant: Combattant = $Monde/Combattant
@onready var _montage: MontageDeComposition = $Monde/Combattant/Modele
@onready var _camera: Camera3D = $Monde/Camera
@onready var _repos: Timer = $Repos

## Par empreinte de corps (`JSON.stringify`), sa photo.
var _photos := {}
## Les corps à photographier, dans l'ordre des demandes, chacun `{cle, corps}`.
var _file: Array[Dictionary] = []
var _en_cours := false

## Une photo prise : l'empreinte du corps photographié et son image.
signal photographie(cle: String, image: Texture2D)


## Le studio, posé à la racine de l'arbre à la première demande.
static func studio() -> StudioDePortraits:
	if _studio == null:
		_studio = load("res://scenes/StudioDePortraits.tscn").instantiate()
		(Engine.get_main_loop() as SceneTree).root.add_child.call_deferred(_studio)
	return _studio


## L'empreinte du corps `corps`, sous laquelle sa photo se garde.
static func cle(corps: Variant) -> String:
	return JSON.stringify(corps)


## La photo du corps `corps` si elle est prise ; sinon `null`, et le corps attend son tour (`photographie`).
func photographier(corps: Dictionary) -> Texture2D:
	var cle_du_corps := cle(corps)
	if _photos.has(cle_du_corps):
		return _photos[cle_du_corps]
	if not _file.any(func(d: Dictionary) -> bool: return d.cle == cle_du_corps):
		_file.append({cle = cle_du_corps, corps = corps})
	return null


func _ready() -> void:
	_camera.fov = MiseEnPage.ANGLE_DU_PORTRAIT
	_combattant.habille.connect(_repos.start.bind(REPOS_S))
	_repos.timeout.connect(_photographier)


## Le corps en tête de file vêtu, s'il y en a un et qu'aucun n'est en cours.
func _process(_delta: float) -> void:
	if _en_cours or _file.is_empty():
		return
	_en_cours = true
	_combattant.vetir(_file[0].corps)


## Le corps en tête de file photographié : son clip arrêté, la caméra cadrée, une image rendue puis gardée. Une photo
## déjà prise de lui pendant le rendu (un habillage tardif relance le repos) n'en reprend pas une autre.
func _photographier() -> void:
	if _file.is_empty():
		return
	var demande: Dictionary = _file[0]
	if _montage.lecteur != null:
		_montage.lecteur.pause()
	var cadrage := MiseEnPage.cadrage_en_buste(_combattant.hauteur_de_la_tete())
	_camera.position = Vector3(0.0, cadrage.x, cadrage.y)
	_camera.look_at(Vector3(0.0, cadrage.x, 0.0), Vector3.UP)
	_monde.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	if _file.is_empty() or _file[0] != demande:
		return
	_file.pop_front()
	var image := ImageTexture.create_from_image(_monde.get_texture().get_image())
	_photos[demande.cle] = image
	_en_cours = false
	photographie.emit(demande.cle, image)

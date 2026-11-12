## Le studio des portraits (#3534) : un seul corps (`Combattant`), dans le monde propre d'un `SubViewport` hors de l'écran,
## vêtu tour à tour de chaque corps qu'un portrait demande (`photographier`), puis photographié en buste
## (`MiseEnPage.cadrage_en_buste`), de face, son clip de repos arrêté à sa première image. Une photo se garde par corps : un corps déjà
## photographié ne se revêt plus. Un seul corps de plus que le plateau, quel que soit le nombre de portraits, car chaque
## corps monté instancie le GLB de sa base.
class_name StudioDePortraits
extends Node

static var _studio: StudioDePortraits = null

@onready var _monde: SubViewport = $Monde
@onready var _combattant: Combattant = $Monde/Combattant
@onready var _montage: MontageDeComposition = $Monde/Combattant/Modele
@onready var _camera: Camera3D = $Monde/Camera

## Par empreinte de corps (`JSON.stringify`), sa photo.
var _photos := {}
## Les corps à photographier, dans l'ordre des demandes, chacun `{cle, corps}`.
var _file: Array[Dictionary] = []
## Où en est le corps en tête de file : à vêtir, en train de se monter, ou à la photo.
enum Etape { ATTENTE, HABILLAGE, PHOTO }
var _etape := Etape.ATTENTE

## Une photo prise : l'empreinte du corps photographié et son image.
signal photographie(cle: String, image: Texture2D)


## Le studio, posé à la racine de l'arbre à la première demande.
static func studio() -> StudioDePortraits:
	if _studio == null:
		_studio = load("res://scenes/StudioDePortraits.tscn").instantiate()
		(Engine.get_main_loop() as SceneTree).root.add_child.call_deferred(_studio)
	return _studio


## Si aucun corps n'attend sa photo.
static func au_repos() -> bool:
	return _studio == null or _studio._file.is_empty()


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


## Le corps en tête de file, s'il y en a un : vêtu, puis photographié à la première image où il est monté en entier
## (`Combattant.est_vetu`).
func _process(_delta: float) -> void:
	if _file.is_empty():
		return
	if _etape == Etape.ATTENTE:
		_etape = Etape.HABILLAGE
		_combattant.vetir(_file[0].corps)
	elif _etape == Etape.HABILLAGE and _combattant.est_vetu():
		_etape = Etape.PHOTO
		_photographier()


## Le corps en tête de file photographié : son arbre d'états arrêté (`Combattant.figer`), son squelette remis à sa pose
## de repos puis son clip de repos figé à sa première image (un os que ce clip n'anime pas ne garde rien du clip joué
## avant), la caméra cadrée, une image rendue puis gardée.
func _photographier() -> void:
	_combattant.figer()
	if _montage.squelette != null:
		_montage.squelette.reset_bone_poses()
	if _montage.lecteur != null:
		_montage.lecteur.seek(0.0, true)
		_montage.lecteur.pause()
	var cadrage := MiseEnPage.cadrage_en_buste(_combattant.hauteur_de_la_tete())
	_camera.position = Vector3(0.0, cadrage.x, cadrage.y)
	_camera.look_at(Vector3(0.0, cadrage.x, 0.0), Vector3.UP)
	_monde.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	var demande: Dictionary = _file.pop_front()
	var image := ImageTexture.create_from_image(_monde.get_texture().get_image())
	_photos[demande.cle] = image
	_etape = Etape.ATTENTE
	photographie.emit(demande.cle, image)

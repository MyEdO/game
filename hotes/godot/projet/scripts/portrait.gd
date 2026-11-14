## Un portrait (#3534, `Portrait` de `src/hote/elements.ts`) : la photo en buste du corps du combattant que l'élément
## nomme, celui que le plateau monte (`vue.corps.combattants`, `CorpsDuCombat` de `hotes/godot/pont/pont.ts`), prise par le
## studio des portraits (`StudioDePortraits`) et posée dans l'image de son composant ; vide sans corps.
class_name Portrait
extends Node

## Les corps de la dernière vue, par id de combattant (`vue.corps.combattants`), que l'écran pose avant de montrer ses
## zones (`combat.gd`).
static var corps := {}

@onready var _image: TextureRect = $"../Image"

## L'empreinte du corps montré (`StudioDePortraits.cle`).
var _cle := ""


func poser(element: Dictionary) -> void:
	var du_combattant: Variant = corps.get(element.combattant)
	_cle = StudioDePortraits.cle(du_combattant)
	if du_combattant == null:
		_image.texture = null
		return
	var studio := StudioDePortraits.studio()
	_image.texture = studio.photographier(du_combattant)
	if _image.texture == null and not studio.photographie.is_connected(_recevoir):
		studio.photographie.connect(_recevoir)


## La photo prise du corps montré, posée dans l'image.
func _recevoir(cle: String, image: Texture2D) -> void:
	if cle == _cle:
		_image.texture = image

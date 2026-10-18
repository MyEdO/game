## Modèle 3D d'un combattant (primitives de `Combattant3D.tscn`) : camp, actif, hors de combat, étiquette,
## déplacement animé.
class_name Combattant3D
extends Node3D

const DUREE_PAS_S := 0.16
const OPACITE_HORS_DE_COMBAT := 0.35
## Hauteur du modèle couché, pour que le corps affleure le sol.
const HAUTEUR_COUCHE := 0.2

@export var materiau_heros: Material
@export var materiau_adversaires: Material

@onready var _modele: Node3D = $Modele
@onready var _corps: MeshInstance3D = $Modele/Corps
@onready var _bouclier: MeshInstance3D = $Modele/Bouclier
@onready var _capuche: MeshInstance3D = $Modele/Capuche
@onready var _selection: MeshInstance3D = $Selection
@onready var _etiquette: Etiquette = $Vue/Etiquette
@onready var _panneau: Sprite3D = $Panneau

var hors_de_combat := false


func configurer(combattant: Dictionary) -> void:
	var heros: bool = combattant.camp == "heros"
	_corps.material_override = materiau_heros if heros else materiau_adversaires
	_bouclier.visible = heros
	_capuche.visible = not heros
	mettre_a_jour(combattant, false)


func mettre_a_jour(combattant: Dictionary, actif: bool) -> void:
	_etiquette.afficher(combattant)
	_selection.visible = actif and not combattant.horsDeCombat
	if combattant.horsDeCombat and not hors_de_combat:
		hors_de_combat = true
		_modele.rotation.x = -PI / 2.0
		_modele.position.y = HAUTEUR_COUCHE
		_panneau.modulate.a = OPACITE_HORS_DE_COMBAT


## Tourne le modèle (avant = -Z) vers `cible`, sur le plan du sol.
func regarder(cible: Vector3) -> void:
	var direction := cible - position
	if Vector2(direction.x, direction.z).length() > 0.01:
		_modele.rotation.y = atan2(-direction.x, -direction.z)


## Parcourt `points` (positions de monde, départ compris) case par case.
func parcourir(points: Array[Vector3]) -> void:
	var tween := create_tween()
	for p in points.slice(1):
		tween.tween_callback(regarder.bind(p))
		tween.tween_property(self, "position", p, DUREE_PAS_S)
	await tween.finished

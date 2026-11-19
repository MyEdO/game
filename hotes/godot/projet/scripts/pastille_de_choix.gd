## La pastille d'un choix de la barre du combat (#3935), une `Ouvrante` : son icône, son libellé dessous ; ouverte, sa
## pastille pressée, sa liste se pose au-dessus du socle de l'écran (le groupe `socle`, le chêne du meuble de l'actif),
## alignée sur elle et tenue dans l'écran (`MiseEnPage.coin_de_la_liste`), son libellé en titre, puis ses valeurs en
## plaques en colonne, chacune sur toute la largeur, son libellé à gauche (`valeurDeListe`), en défilement au-delà de
## `MiseEnPage.HAUTEUR_DE_LISTE`.
class_name PastilleDeChoix
extends Ouvrante

@onready var _defilement: ScrollContainer = $Liste/Pile/Defilement
@onready var _valeurs: Control = $Liste/Pile/Defilement/Valeurs
@onready var _presser: Button = $Presser


func _ready() -> void:
	super()
	_valeurs.minimum_size_changed.connect(func() -> void: if liste.visible: _placer())
	change.connect(func() -> void: _presser.set_pressed_no_signal(liste.visible))


func _placer() -> void:
	_defilement.custom_minimum_size.y = MiseEnPage.hauteur_de_liste(_valeurs.get_combined_minimum_size().y)
	liste.reset_size()
	var socle := get_tree().get_first_node_in_group(&"socle") as Control
	var largeur := get_viewport().get_visible_rect().size.x
	liste.global_position = MiseEnPage.coin_de_la_liste(global_position.x, socle.get_global_rect().position.y, largeur, liste.size)

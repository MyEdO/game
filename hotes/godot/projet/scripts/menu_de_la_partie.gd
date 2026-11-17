## Le menu de la partie (#3935), une `Ouvrante` : la pastille du menu (`partie.menu`, en `pastille`) et, ouverte, la
## liste des gestes du groupe puis de la partie (`groupe.gestes`, `partie.gestes`) dans un cartouche ancré au-dessus
## ou au-dessous d'elle (`ancrer`).
class_name MenuDeLaPartie
extends Ouvrante


## Le menu ancré au coin haut-droit de la fenêtre, sa liste ouverte sous la pastille (`en_haut`), ou au coin bas-droit,
## sa liste ouverte au-dessus d'elle.
func ancrer(en_haut: bool) -> void:
	var bord := 0.0 if en_haut else 1.0
	var oppose := 1.0 if en_haut else 0.0
	anchor_top = bord
	anchor_bottom = bord
	offset_top = 8.0 if en_haut else -42.0
	offset_bottom = 42.0 if en_haut else -8.0
	grow_vertical = Control.GROW_DIRECTION_END if en_haut else Control.GROW_DIRECTION_BEGIN
	liste.anchor_top = oppose
	liste.anchor_bottom = oppose
	liste.offset_top = 8.0 if en_haut else -8.0
	liste.offset_bottom = liste.offset_top
	liste.grow_vertical = grow_vertical

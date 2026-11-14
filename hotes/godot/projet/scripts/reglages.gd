## Le panneau des réglages (#3009, `ZonesDesReglages` de `src/hote/reglages.ts`), au-dessus de l'écran qui le porte :
## ouvert sur les zones de la méthode `reglages`, il rend à cette méthode le geste de chacun de ses contrôles, repose
## ensuite le volume des bus du mixage (`PontDuNoyau.regler_les_volumes`) et se ferme sur `{ reglages: false }`. Un
## geste refusé laisse le panneau tel quel, le refus dit par le pont (`PontDuNoyau.refus`).
class_name PanneauDesReglages
extends CanvasLayer

## Ce que le panneau porte à l'écran a changé : ouvert, relu, défilé ou fermé.
signal change

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _cadre: Control = $Cadre


func _ready() -> void:
	for zone in Zone.racines(_cadre):
		zone.geste.connect(_jouer)
	(%Defilement as ScrollContainer).get_v_scroll_bar().value_changed.connect(change.emit.unbind(1))


## Le panneau ouvert sur les réglages du pont.
func ouvrir() -> void:
	_montrer(_pont.appeler("reglages"))


## La racine de ce que le panneau porte à l'écran (`PontDuNoyau.boutons_a_l_ecran`).
func racine() -> Control:
	return _cadre


func _jouer(jeu: Dictionary) -> void:
	if jeu.has("reglages"):
		_cadre.visible = false
		change.emit()
		return
	_montrer(_pont.appeler("reglages", jeu))
	_pont.regler_les_volumes()


func _montrer(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	Zone.montrer_toutes(Zone.racines(_cadre), reponse.zones)
	_cadre.visible = true
	change.emit()

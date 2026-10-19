## Une rangée de jet de `ModaleAttaque` (étalon `src/ui/RollLine.tsx`) : remplit les textes et choisit les
## variations du thème ; la mise en forme vit dans `RangeeJet.tscn` et `theme/wfrp.tres`.
class_name RangeeJet
extends VBoxContainer

## Teinte de la rangée perdante d'un Test opposé (accent gagnant/perdant de l'étalon).
@export var teinte_perdant := Color(1, 1, 1, 0.55)

@onready var _ligne: PanelContainer = $Ligne
@onready var _competence: Label = $Ligne/Colonnes/Libelle/Competence
@onready var _difficulte: Label = $Ligne/Colonnes/Libelle/Difficulte
@onready var _calcul: Label = $Ligne/Colonnes/Calcul
@onready var _de: Label = $Ligne/Colonnes/De
@onready var _dr: Label = $Ligne/Colonnes/DR
@onready var _mods: HFlowContainer = $Mods


## Avant le jet : `calcul` vaut « ? » pour la défense adverse, dont la valeur reste cachée.
func afficher_avant(competence: String, difficulte: String, calcul: String, mods: Array) -> void:
	_poser_libelle(competence, difficulte, calcul, mods)
	_de.text = "à lancer"
	_de.theme_type_variation = &"Attenue"
	_dr.text = "—"
	_dr.theme_type_variation = &"Attenue"
	_ligne.theme_type_variation = &"RangeeAttente"
	modulate = Color.WHITE


## Après le jet : `ligne` est une `LigneApres` du contrat.
func afficher_apres(ligne: Dictionary, difficulte: String, calcul: String, gagnante: bool) -> void:
	_poser_libelle(str(ligne.competence), difficulte, calcul, ligne.mods)
	var reussite: bool = ligne.reussite
	_de.text = "%d" % int(ligne.jet)
	_de.theme_type_variation = &"DeJet"
	_dr.text = "%s %s DR" % ["✓" if reussite else "✗", signe(int(ligne.dr))]
	_dr.theme_type_variation = &"ResultatReussite" if reussite else &"ResultatEchec"
	_ligne.theme_type_variation = &"RangeeReussite" if reussite else &"RangeeEchec"
	modulate = Color.WHITE if gagnante else teinte_perdant


## « base ±mod = cible », ou la cible seule sans modificateur ni base (`RollCalc`, `RollLine.tsx`).
static func calcul(base: Variant, cible: int) -> String:
	if base == null or int(base) == cible:
		return "%d" % cible
	return "%d %s = %d" % [int(base), signe(cible - int(base)), cible]


static func signe(n: int) -> String:
	return ("+%d" if n >= 0 else "−%d") % absi(n)


func _poser_libelle(competence: String, difficulte: String, texte_calcul: String, mods: Array) -> void:
	_competence.text = competence
	_difficulte.text = difficulte
	_difficulte.visible = difficulte != ""
	_calcul.text = texte_calcul
	for pastille in _mods.get_children():
		_mods.remove_child(pastille)
		pastille.queue_free()
	for m in mods:
		var valeur := int(m.valeur)
		var pastille := Label.new()
		pastille.text = "%s %s" % [signe(valeur), str(m.libelle)]
		pastille.theme_type_variation = &"PastillePositive" if valeur >= 0 else &"PastilleNegative"
		_mods.add_child(pastille)
	_mods.visible = not mods.is_empty()

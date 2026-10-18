## Contrat d'un plateau de combat, implémenté par `Plateau2D` et `Plateau3D` : la carte, la saisie de case
## (signaux) et l'affichage des combattants et des surbrillances. `combat.gd` ne parle qu'à ce contrat.
class_name Plateau
extends Node

## Case sous le pointeur, hors carte comprise.
signal case_survolee(case: Vector2i)
signal case_cliquee(case: Vector2i)

@export var carte: Carte


func cases() -> Array[Vector2i]:
	return carte.cases()


func est_bloquante(case: Vector2i) -> bool:
	return carte.est_bloquante(case)


func departs(camp: String) -> Array[Vector2i]:
	return carte.departs(camp)


## Crée le modèle de `combattant` (vue du pont) sur `case`.
func placer(_combattant: Dictionary, _case: Vector2i) -> void:
	push_error("[plateau] placer non implémenté")


## Repose le combattant `id` sur `case`, sans animation.
func poser(_id: String, _case: Vector2i) -> void:
	push_error("[plateau] poser non implémenté")


## Anime le combattant `id` le long de `chemin` (départ compris) ; rend la main à l'arrivée.
func parcourir(_id: String, _chemin: Array[Vector2i]) -> void:
	push_error("[plateau] parcourir non implémenté")


## Montre `attaquant` frappant `cible` ; les Blessures perdues passent ensuite par `mettre_a_jour`.
func attaquer(_attaquant: String, _cible: String) -> void:
	push_error("[plateau] attaquer non implémenté")


## Blessures, actif, hors de combat.
func mettre_a_jour(_combattant: Dictionary, _actif: bool) -> void:
	push_error("[plateau] mettre_a_jour non implémenté")


## Remplace les surbrillances ; `survol` hors carte = aucun survol.
func peindre(_atteignables: Array[Vector2i], _cibles: Array[Vector2i], _survol: Vector2i) -> void:
	push_error("[plateau] peindre non implémenté")

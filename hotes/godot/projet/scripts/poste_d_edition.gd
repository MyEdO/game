## Ce que les écrans d'édition (l'éditeur de carte, le Compendium) attendent du poste qui sert le dépôt (`servir.mjs`) :
## l'index des chapitres du `Source/`, un chapitre, une écriture, un fichier choisi. Chaque attente tient un jeton, que
## l'écran jette à sa sortie de l'arbre (`abandonner`, #4195) : la reprise d'une attente abandonnée rend la main.
class_name PosteDEdition
extends RefCounted

var _pont: PontDuNoyau
## Les attentes en vol, chacune par son jeton.
var _en_vol := {}


func _init(pont: PontDuNoyau) -> void:
	_pont = pont


## Chaque attente en vol abandonnée : aucune ne reprend.
func abandonner() -> void:
	_en_vol.clear()


## `suite` appelée du résultat de l'attente `attente`, si elle n'a pas été abandonnée entre-temps.
func reprendre(attente: Callable, suite: Callable) -> void:
	var jeton := RefCounted.new()
	_en_vol[jeton] = true
	var resultat: Variant = await attente.call()
	if _en_vol.erase(jeton):
		suite.call(resultat)


## `suite` appelée du texte de l'index des chapitres du `Source/` que sert le poste (`GET source/manifest.json`), `""`
## s'il ne répond pas.
func manifeste(suite: Callable) -> void:
	reprendre(func() -> String:
		var recueil: Array[String] = []
		var lu := await _pont.requeter("source/manifest.json", recueil)
		return lu.get_string_from_utf8(), suite)


## `suite` appelée du texte du chapitre `chapitre` (`{ book, ch }`) que sert le poste (`GET source/<book>/<ch>.md`), ou
## de `null` s'il ne se charge pas.
func charger_le_chapitre(chapitre: Dictionary, suite: Callable) -> void:
	reprendre(func() -> Variant:
		var recueil: Array[String] = []
		var lu := await _pont.requeter("source/%s/%s.md" % [chapitre.book, chapitre.ch], recueil)
		return lu.get_string_from_utf8() if recueil.is_empty() else null, suite)


## `suite` appelée des erreurs de l'écriture du texte `texte` au poste (`PUT <relative>`, en-têtes `entetes`), vides si
## elle réussit.
func ecrire(relative: String, texte: String, entetes: PackedStringArray, suite: Callable) -> void:
	reprendre(func() -> Array[String]:
		var recueil: Array[String] = []
		await _pont.requeter(relative, recueil, HTTPClient.METHOD_PUT, texte, entetes)
		return recueil, suite)

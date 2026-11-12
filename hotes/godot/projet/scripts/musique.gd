## La musique de la partie (`vue.musique`, `pont/CONTRAT.md`, section « Musique », #3825), telle que le noyau la choisit :
## une de ses pistes à son tour (`Effets.au_tour`), l'une de ses variantes (`Effets.variante_du_son`), en boucle, à son volume ; une autre sélection (sa `cle`) prend la place de la précédente en
## fondu enchaîné de `FONDU_S` secondes, le silence (`null`) éteint la précédente en fondu. La même sélection ne change
## rien. Elle joue sur le bus `BUS_JOUE`, qui envoie au bus `musique` où se pose le volume du joueur ; `attenuer` baisse
## puis relève `BUS_JOUE` sous un coup (#3949).
class_name Musique
extends Node

## @contrat Musique
## Godot (`projet/scripts/musique.gd`, nœud `Musique` de l'écran de combat) joue l'une des `pistes` à son tour (`Effets.au_tour`), en boucle,
## à son volume ; une autre `cle` prend la place de la précédente en fondu enchaîné, la même ne change rien. Elle joue
## sur le bus `musique-jouee` (`projet/default_bus_layout.tres`), qui envoie au bus `musique`, celui du canal `musique`
## où se pose son volume (`PontDuNoyau.regler_les_volumes`). Quand la phase d'arrivée d'un coup ou la nappe d'une zone
## joue un son (`Effets`), `Musique.attenuer` baisse `musique-jouee` puis le relève : descente, tenue, remontée ; un
## nouvel appel repart du volume courant et remplace le précédent. La recette `projet/recettes/mixage.gd` le vérifie.

## Le bus où joue la musique, qui envoie au bus `musique` (`default_bus_layout.tres`).
const BUS_JOUE := &"musique-jouee"
## Le volume (dB) de `BUS_JOUE` atténué, puis plein.
const ATTENUE_DB := -8.0
const PLEIN_DB := 0.0
## Les durées (s) de l'atténuation : la descente, la tenue au volume atténué, la remontée.
const DESCENTE_S := 0.08
const TENUE_S := 0.25
const REMONTEE_S := 0.6
## La durée (s) du fondu d'une piste qui entre ou qui sort.
const FONDU_S := 1.5
## Le volume (dB) d'une piste éteinte.
const SILENCE_DB := -60.0

## La clé de la sélection jouée, vide au silence.
var cle := ""
var _lecteur: AudioStreamPlayer = null
## L'atténuation en cours (`attenuer`), seule vivante.
static var _attenuation: Tween = null


## Joue `musique` (`{ cle, pistes }`, `null` : le silence).
func jouer(musique: Variant) -> void:
	var voulue: String = "" if musique == null else musique.cle
	if voulue == cle:
		return
	cle = voulue
	if _lecteur != null:
		var sortant := _lecteur
		var fondu := create_tween()
		fondu.tween_property(sortant, "volume_db", SILENCE_DB, FONDU_S)
		fondu.finished.connect(sortant.queue_free)
		_lecteur = null
	if musique == null:
		return
	var piste: Dictionary = Effets.au_tour(musique.pistes)
	_lecteur = AudioStreamPlayer.new()
	_lecteur.name = "musique"
	_lecteur.bus = BUS_JOUE
	_lecteur.stream = Effets.variante_du_son(piste, true)
	_lecteur.volume_db = SILENCE_DB
	add_child(_lecteur, true)
	_lecteur.play()
	create_tween().tween_property(_lecteur, "volume_db", linear_to_db(piste.volume), FONDU_S)


## Le lecteur de la musique qui joue, `null` au silence.
func lecteur() -> AudioStreamPlayer:
	return _lecteur


## La musique atténuée sous un coup : le volume de `BUS_JOUE` descend de son volume courant à `ATTENUE_DB`, y tient, puis
## remonte à `PLEIN_DB`, par un `Tween` de `arbre` ; il remplace l'atténuation en cours.
static func attenuer(arbre: SceneTree) -> void:
	var bus := AudioServer.get_bus_index(BUS_JOUE)
	var poser := func(db: float) -> void: AudioServer.set_bus_volume_db(bus, db)
	if _attenuation != null:
		_attenuation.kill()
	_attenuation = arbre.create_tween()
	_attenuation.tween_method(poser, AudioServer.get_bus_volume_db(bus), ATTENUE_DB, DESCENTE_S)
	_attenuation.tween_interval(TENUE_S)
	_attenuation.tween_method(poser, ATTENUE_DB, PLEIN_DB, REMONTEE_S)

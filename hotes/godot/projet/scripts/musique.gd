## La musique de la partie (`vue.musique`, `pont/CONTRAT.md`, section « Musique », #3825), telle que le noyau la choisit :
## une de ses pistes au hasard, en boucle, à son volume ; une autre sélection (sa `cle`) prend la place de la précédente en
## fondu enchaîné de `FONDU_S` secondes, le silence (`null`) éteint la précédente en fondu. La même sélection ne change
## rien.
class_name Musique
extends Node

## @contrat Musique
## Godot (`projet/scripts/musique.gd`, nœud `Musique` de l'écran de combat) joue l'une des `pistes` au hasard, en boucle,
## à son volume ; une autre `cle` prend la place de la précédente en fondu enchaîné, la même ne change rien.

## La durée (s) du fondu d'une piste qui entre ou qui sort.
const FONDU_S := 1.5
## Le volume (dB) d'une piste éteinte.
const SILENCE_DB := -60.0

## La clé de la sélection jouée, vide au silence.
var cle := ""
var _lecteur: AudioStreamPlayer = null


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
	_lecteur = AudioStreamPlayer.new()
	_lecteur.name = "musique"
	_lecteur.stream = pistes_de(musique)
	_lecteur.volume_db = SILENCE_DB
	add_child(_lecteur, true)
	_lecteur.play()
	create_tween().tween_property(_lecteur, "volume_db", 0.0, FONDU_S)


## Les pistes de `musique`, l'une au hasard à chaque lecture (`AudioStreamRandomizer`), chacune en boucle à son volume
## (`AudioStreamSynchronized`).
static func pistes_de(musique: Dictionary) -> AudioStreamRandomizer:
	var pistes := AudioStreamRandomizer.new()
	for piste: Dictionary in musique.pistes:
		var a_son_volume := AudioStreamSynchronized.new()
		a_son_volume.stream_count = 1
		a_son_volume.set_sync_stream(0, Effets.variantes_du_son(piste, true))
		a_son_volume.set_sync_stream_volume(0, linear_to_db(piste.volume))
		pistes.add_stream(-1, a_son_volume)
	return pistes


## Le lecteur de la musique qui joue, `null` au silence.
func lecteur() -> AudioStreamPlayer:
	return _lecteur

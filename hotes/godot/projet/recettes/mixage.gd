extends SceneTree

## Le mixage du son (#3949, `hotes/godot/pont/CONTRAT.md`, sections « Effets » et « Musique ») : les bus de
## `default_bus_layout.tres`, `musique`, `ambiance`, `effets` et `interface` vers `Master`, `musique-jouee` vers
## `musique` ; un son joué partout et à un point, une boucle, la météo sur le bus de leur canal, la musique sur
## `musique-jouee` ; les volumes des préférences posés sur les bus de leur canal (`PontDuNoyau.regler_les_volumes`), sans
## toucher le volume de `Master` ni de `musique-jouee`, `Master` coupé quand la préférence `son-coupe` le dit et rétabli
## sinon, et à `rejoindre` ceux du pont vivant, dont chaque préférence `volume-*` a son bus ; la musique atténuée (`Musique.attenuer`) descend à `ATTENUE_DB` puis revient à `PLEIN_DB`, deux appels
## rapprochés ne la laissent pas basse, et l'arrivée sonore d'un coup ou la nappe sonore d'une zone l'atténue, ni les
## pas ni une incantation. Le code de sortie dit le verdict : 0 tenu, 1 une faute.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
## Chaque bus du mixage et le bus où il envoie.
const ENVOIS := {"musique": "Master", "ambiance": "Master", "effets": "Master", "interface": "Master", "musique-jouee": "musique"}
const DES := {id = "des", fichiers = ["des-1.ogg", "des-2.ogg", "des-3.ogg"], volume = 0.7, canal = "interface"}
const CANON := {id = "canon", fichiers = ["canon-1.ogg", "canon-2.ogg", "canon-3.ogg"], volume = 1.0, canal = "effets"}
const CREPITEMENT := {id = "crepitement", fichiers = ["crepitement.ogg"], volume = 0.6, canal = "ambiance"}
const PLUIE := {id = "pluie", fichiers = ["pluie.ogg"], volume = 0.5, canal = "ambiance"}
const COMBAT := {id = "musique-combat", fichiers = ["musique-combat.mp3"], volume = 0.5, canal = "musique"}
const EXPLOSION := {id = "explosion", fichiers = ["explosion-1.ogg", "explosion-2.ogg"], volume = 1.0, canal = "effets"}
const INCANTATION := {id = "chant-d-incantation", fichiers = ["incantation-1.ogg", "incantation-2.ogg"], volume = 0.8, canal = "effets"}
const PAS := {id = "pas", fichiers = ["pas-1.ogg", "pas-2.ogg", "pas-3.ogg"], volume = 0.4, canal = "effets"}
const FLAMMES := {id = "sort-feu", fichiers = ["sort-feu-1.ogg", "sort-feu-2.ogg", "sort-feu-3.ogg"], volume = 0.85, canal = "effets"}
const COUP := {quoi = "coup", de = "a", vers = "b", issue = "touche", couleur = "#ffa040", depart = null, trajet = null,
	arrivee = {visuel = null, son = EXPLOSION}, flottants = []}
const ZONE := {quoi = "zone", de = "a", centre = {x = 1, y = 0}, cases = [{x = 1, y = 0}], couleur = "#ff6a20", depart = null,
	trajet = null, nappe = {visuel = null, son = FLAMMES}}
const PAS_DU_DEPLACEMENT := {quoi = "son", son = PAS, fois = 1, ecartS = 0.0}
const INCANTATION_REUSSIE := {quoi = "incantation", de = "a", vers = "b", reussie = true, couleur = "#9b7bff",
	depart = {visuel = null, son = INCANTATION}, arrivee = {visuel = null, son = INCANTATION}, flottants = []}
const LIEUX := {"a": Vector3(0.0, 0.0, 0.0), "b": Vector3(2.0, 0.0, 0.0), "1,0,0": Vector3(1.0, 0.0, 0.0)}
## Les préférences connues que sert le pont figé : un volume par canal, le son coupé, et une préférence qui n'est pas un
## volume.
const PREFERENCES := {"volume-musique": 0.25, "volume-ambiance": 0.5, "volume-effets": 0.75, "volume-interface": 0.1, "son-coupe": true, "animations": true}
## Le volume (dB) posé d'avance sur `Master` et `musique-jouee`, que `regler_les_volumes` ne touche pas.
const TEMOIN_DB := -3.0
## L'écart toléré entre deux volumes (dB ou linéaires).
const TOLERANCE := 0.001
## La durée (s) d'une atténuation entière, et la marge d'écoute qui suit.
const ATTENUATION_S := Musique.DESCENTE_S + Musique.TENUE_S + Musique.REMONTEE_S
const MARGE_S := 0.3
## L'instant (s) du second appel de deux atténuations rapprochées : à mi-remontée de la première.
const RELANCE_S := Musique.DESCENTE_S + Musique.TENUE_S + Musique.REMONTEE_S / 2.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[mixage] version=", Engine.get_version_info().string)
	_les_bus()
	await _les_lecteurs()
	await _les_volumes()
	await _l_attenuation()
	for faute in _fautes:
		push_error("[mixage] " + faute)
	print("[mixage] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)


## Les bus chargés de `default_bus_layout.tres`, chacun retrouvé par son nom, et son envoi.
func _les_bus() -> void:
	print("[mixage] bus : %s" % [range(AudioServer.bus_count).map(func(i: int) -> String: return "%s→%s" % [AudioServer.get_bus_name(i), AudioServer.get_bus_send(i)])])
	for nom: String in ENVOIS:
		var bus := AudioServer.get_bus_index(nom)
		_verifier(bus != -1, "bus %s absent" % nom)
		if bus != -1:
			_verifier(AudioServer.get_bus_send(bus) == StringName(ENVOIS[nom]), "bus %s : envoie à %s, attendu %s" % [nom, AudioServer.get_bus_send(bus), ENVOIS[nom]])
			_verifier(AudioServer.get_bus_effect_count(bus) == 0, "bus %s : %d effets" % [nom, AudioServer.get_bus_effect_count(bus)])


## Chaque lecteur sur le bus de son canal : un son partout et à un point, une boucle, la météo ; la musique sur
## `Musique.BUS_JOUE`.
func _les_lecteurs() -> void:
	var effets := Effets.new()
	root.add_child(effets)
	var plat := effets._jouer_le_son(DES, null) as AudioStreamPlayer
	_verifier(plat.bus == StringName(DES.canal), "son partout : bus %s, attendu %s" % [plat.bus, DES.canal])
	var spatial := effets._jouer_le_son(CANON, Vector3.ZERO) as AudioStreamPlayer3D
	_verifier(spatial.bus == StringName(CANON.canal), "son à un point : bus %s, attendu %s" % [spatial.bus, CANON.canal])
	var boucle := Effets.son_en_boucle(CREPITEMENT)
	effets.add_child(boucle)
	_verifier(boucle.bus == StringName(CREPITEMENT.canal), "boucle : bus %s, attendu %s" % [boucle.bus, CREPITEMENT.canal])
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde.poser_la_meteo({pluie = null, nappes = [], son = PLUIE})
	var meteo := monde.son_de_la_meteo()
	_verifier(meteo != null and meteo.bus == StringName(PLUIE.canal), "météo : bus %s, attendu %s" % [null if meteo == null else meteo.bus, PLUIE.canal])
	var musique := Musique.new()
	root.add_child(musique)
	musique.jouer({cle = "combat", pistes = [COMBAT]})
	_verifier(musique.lecteur().bus == Musique.BUS_JOUE, "musique : bus %s, attendu %s" % [musique.lecteur().bus, Musique.BUS_JOUE])
	effets.queue_free()
	monde.queue_free()
	musique.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout


## Les volumes des préférences : connues, servies par un pont figé, posées sur les bus de leur canal sans toucher le
## volume de `Master` ni de `musique-jouee`, `Master` coupé quand `son-coupe` le dit, rétabli sinon ; puis, à
## `rejoindre`, celles du pont vivant, chaque préférence `volume-*` sur son bus et `Master` coupé à sa valeur.
func _les_volumes() -> void:
	var master := AudioServer.get_bus_index("Master")
	for nom in ["Master", Musique.BUS_JOUE]:
		AudioServer.set_bus_volume_db(AudioServer.get_bus_index(nom), TEMOIN_DB)
	var fige := PontFige.new({preferences = {"null": {ok = true, preferences = PREFERENCES}}})
	fige.regler_les_volumes()
	fige.free()
	_verifier(AudioServer.is_bus_mute(master), "son-coupe vrai : Master non coupé")
	var retabli := PREFERENCES.duplicate()
	retabli["son-coupe"] = false
	fige = PontFige.new({preferences = {"null": {ok = true, preferences = retabli}}})
	fige.regler_les_volumes()
	fige.free()
	_verifier(not AudioServer.is_bus_mute(master), "son-coupe faux : Master resté coupé")
	for cle: String in PREFERENCES:
		if cle.begins_with("volume-"):
			var lu := AudioServer.get_bus_volume_linear(AudioServer.get_bus_index(cle.trim_prefix("volume-")))
			_verifier(absf(lu - PREFERENCES[cle]) < TOLERANCE, "%s : bus à %.3f, attendu %.3f" % [cle, lu, PREFERENCES[cle]])
	for nom in ["Master", Musique.BUS_JOUE]:
		var lu := AudioServer.get_bus_volume_db(AudioServer.get_bus_index(nom))
		_verifier(absf(lu - TEMOIN_DB) < TOLERANCE, "bus %s touché : %.3f dB, attendu %.3f" % [nom, lu, TEMOIN_DB])
		AudioServer.set_bus_volume_db(AudioServer.get_bus_index(nom), Musique.PLEIN_DB)
	AudioServer.set_bus_mute(master, true)
	var pont: PontDuNoyau = root.get_node("Pont")
	var signales: Array[String] = []
	if not await pont.rejoindre(func(m: String) -> void: signales.append("refus : " + m), func(m: String) -> void: signales.append("panne : " + m)):
		_fautes.append("le pont vivant ne s'ouvre pas : %s" % [signales])
		return
	var reponse := pont.appeler("preferences")
	_verifier(reponse.get("ok") == true, "preferences du pont vivant : %s" % JSON.stringify(reponse).left(200))
	var volumes: Array = reponse.get("preferences", {}).keys().filter(func(cle: String) -> bool: return cle.begins_with("volume-"))
	print("[mixage] volumes du pont vivant : %s" % [volumes.map(func(cle: String) -> String: return "%s=%s" % [cle, reponse.preferences[cle]])])
	_verifier(volumes.size() == ENVOIS.size() - 1, "pont vivant : %d préférences volume-*, une par canal attendue" % volumes.size())
	_verifier(AudioServer.is_bus_mute(master) == reponse.preferences.get("son-coupe"), "rejoindre : Master coupé à %s, son-coupe à %s" % [AudioServer.is_bus_mute(master), reponse.preferences.get("son-coupe")])
	for cle: String in volumes:
		var bus := AudioServer.get_bus_index(cle.trim_prefix("volume-"))
		_verifier(bus != -1, "pont vivant : %s sans bus" % cle)
		if bus != -1:
			var lu := AudioServer.get_bus_volume_linear(bus)
			_verifier(absf(lu - reponse.preferences[cle]) < TOLERANCE, "rejoindre : %s à %.3f, attendu %.3f" % [cle, lu, reponse.preferences[cle]])
	_verifier(signales.is_empty(), "pont vivant : %s" % [signales])


## L'atténuation de `Musique.BUS_JOUE`, mesurée image par image.
func _l_attenuation() -> void:
	var seule := await _ecouter(func() -> void: Musique.attenuer(self), 0.0)
	_verifier(absf(seule.min - Musique.ATTENUE_DB) < TOLERANCE and absf(seule.fin - Musique.PLEIN_DB) < TOLERANCE, "atténuation : descend à %.2f dB, finit à %.2f dB" % [seule.min, seule.fin])
	var double := await _ecouter(func() -> void:
		Musique.attenuer(self)
		await create_timer(RELANCE_S).timeout
		Musique.attenuer(self), RELANCE_S)
	_verifier(double.min > Musique.ATTENUE_DB - TOLERANCE and absf(double.fin - Musique.PLEIN_DB) < TOLERANCE, "deux atténuations : descend à %.2f dB, finit à %.2f dB" % [double.min, double.fin])
	var effets := Effets.new()
	root.add_child(effets)
	for cas in [["un coup qui sonne à l'arrivée", COUP, Effets.ELAN_S, true], ["la nappe sonore d'une zone", ZONE, Effets.ELAN_S, true],
			["les pas", PAS_DU_DEPLACEMENT, 0.0, false], ["une incantation", INCANTATION_REUSSIE, Effets.ELAN_S, false]]:
		var ecoute := await _ecouter(func() -> void: effets.jouer([cas[1]], LIEUX, METRES_PAR_CASE), cas[2])
		var attenue: bool = absf(ecoute.min - Musique.ATTENUE_DB) < TOLERANCE
		_verifier(attenue == cas[3], "%s : la musique descend à %.2f dB, %s" % [cas[0], ecoute.min, "atténuation attendue" if cas[3] else "aucune atténuation attendue"])
	effets.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout


## Le volume (dB) de `Musique.BUS_JOUE`, plein au départ, relevé à chaque image pendant `geste`, `avant_s` secondes et
## une atténuation entière : `{ min, fin }`.
func _ecouter(geste: Callable, avant_s: float) -> Dictionary:
	var bus := AudioServer.get_bus_index(Musique.BUS_JOUE)
	AudioServer.set_bus_volume_db(bus, Musique.PLEIN_DB)
	var minuterie := create_timer(avant_s + ATTENUATION_S + MARGE_S)
	geste.call()
	var plus_bas := Musique.PLEIN_DB
	while minuterie.time_left > 0.0:
		await process_frame
		plus_bas = minf(plus_bas, AudioServer.get_bus_volume_db(bus))
	return {min = plus_bas, fin = AudioServer.get_bus_volume_db(bus)}

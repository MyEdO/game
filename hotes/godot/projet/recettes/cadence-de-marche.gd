extends SceneTree

## Le Dôme, graine 7 : la charge émet un déplacement, sa suite ouvre le jet d'attaque à l'arrivée du héros, puis le
## coup validé part de lui. Le même parcours accéléré éprouve la reprise sur la fin réelle du tween (#3839).
const RECETTE_AUTONOME := true
const CIBLE := "enemy-enc-dome-1"
const CASE_DE_LA_CIBLE := Vector3i(7, 5, 0)
const ATTENTE_DU_PONT_MS := 120000
const ATTENTE_DE_LA_CHARGE_MS := 30000
const MARGE_DU_BEAT_MS := 1500

var _fautes: Array[String] = []


class PontDuDome extends PontEspion:
	var reprises_en_ms: Array[int] = []

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		if methode == "reprendre":
			reprises_en_ms.append(Time.get_ticks_msec())
		return super(methode, entree)

	func parametre(cle: String) -> String:
		match cle:
			"scenario": return "dome"
			"graine": return "7"
			_: return super(cle)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[cadence-de-marche] version=", Engine.get_version_info().string)
	var pont := PontDuDome.new()
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _fautes.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _fautes.append("refus : " + message))
	var marche := await _recetter_la_charge(pont, 1.0)
	if _fautes.is_empty():
		var acceleree := await _recetter_la_charge(pont, 4.0)
		_verifier(acceleree > 0 and acceleree < marche * 0.6, "le tween accéléré doit raccourcir la marche")
	for faute in _fautes:
		push_error("[cadence-de-marche] " + faute)
	print("[cadence-de-marche] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _recetter_la_charge(pont: PontDuDome, vitesse: float) -> int:
	var combat: Node = (load("res://scenes/Combat.tscn") as PackedScene).instantiate()
	root.add_child(combat)
	var duree := -1
	if await _attendre(func() -> bool: return not combat.get("_vue").is_empty(), ATTENTE_DU_PONT_MS, "la première vue"):
		duree = await _charger(combat, pont, vitesse)
		pont.appeler("quitter")
	combat.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	return duree


func _charger(combat: Node, pont: PontDuDome, vitesse: float) -> int:
	combat.call("_jouer", {type = "fenetreValider", args = ["debutDuRound"]})
	if not await _attendre(func() -> bool: return combat.get("_vue").projection.fenetre == null, ATTENTE_DE_LA_CHARGE_MS, "le tour du héros"):
		return -1
	var plateau: Plateau = combat.get_node("Plateau")
	var actif: String = combat.get("_vue").projection.combat.actif.id
	var combattant: Combattant = plateau.get("_modeles")[actif]
	var montage: MontageDeComposition = combattant.get_node("Modele")
	if not await _attendre(func() -> bool: return montage.modele != null and not combattant.se_deplace(), ATTENTE_DU_PONT_MS, "la base du héros au repos"):
		return -1

	combat.call("_jouer", {type = "armerLIntention", args = ["charge"]})
	if not await _attendre(func() -> bool: return combat.get("_vue").projection.combat.cibles.liste.has(CIBLE), ATTENTE_DE_LA_CHARGE_MS, "la cible de la charge"):
		return -1
	var reprises := pont.reprises_en_ms.size()
	pont.reponses.erase("reprendre")
	plateau.case_cliquee.emit(CASE_DE_LA_CIBLE)
	if not combattant.se_deplace():
		plateau.case_cliquee.emit(CASE_DE_LA_CIBLE)
	if not await _attendre(combattant.se_deplace, ATTENTE_DE_LA_CHARGE_MS, "le déplacement de la charge"):
		return -1
	var depart := Time.get_ticks_msec()
	var marche: Tween = combattant.get("_deplacement")
	marche.set_speed_scale(vitesse)
	var suite: Dictionary = pont.reponses["jouer"]
	var deplacements: Array = suite.effets.filter(func(e: Dictionary) -> bool: return e.quoi == Noyau.Effet.DEPLACEMENT and e.qui == actif)
	if not _verifier(deplacements.size() == 1, "la charge doit avoir émis un trajet pour son héros"):
		return -1
	var chemin: Array = deplacements[0].cases
	var metres := 0.0
	for case: Dictionary in chemin:
		metres += case.metres
	var arrivee: Dictionary = chemin.back()
	var lieu: Vector3 = (plateau.get_node("Monde") as Monde).lieu(Vector2i(int(arrivee.x), int(arrivee.y)), int(arrivee.z))
	var mesures := {fin = -1, demande = -1, attaque = -1, marche_a_l_attaque = false, lieu_a_l_attaque = Vector3.ZERO}
	combattant.deplacement_fini.connect(func() -> void: mesures.fin = Time.get_ticks_msec() - depart, CONNECT_ONE_SHOT)
	var limite := depart + ATTENTE_DE_LA_CHARGE_MS
	while Time.get_ticks_msec() < limite and (mesures.fin < 0 or mesures.attaque < 0):
		if mesures.attaque < 0 and _jet_d_attaque(pont.reponses.get("reprendre", {})):
			mesures.demande = pont.reprises_en_ms.back() - depart
			mesures.attaque = Time.get_ticks_msec() - depart
			mesures.marche_a_l_attaque = combattant.se_deplace()
			mesures.lieu_a_l_attaque = combattant.position
		await process_frame
	var delais: Array = suite.programmes.map(func(programme: Dictionary) -> int: return int(programme.delai))
	var echanges := pont.reprises_en_ms.size() - reprises
	print(("[cadence-de-marche] Dôme, graine 7, vitesse ×%.0f : %d pas, %.2f m ; délais=%s ms ; marche=%d ms ; " +
		"reprise=%d ms ; ouverture attaque=%d ms ; marche en cours=%s ; reprises=%d") %
		[vitesse, chemin.size() - 1, metres, delais, mesures.fin, mesures.demande, mesures.attaque, mesures.marche_a_l_attaque, echanges])
	_verifier(mesures.fin > 0 and mesures.demande >= mesures.fin and not mesures.marche_a_l_attaque, "la reprise qui ouvre l'attaque doit suivre la fin de la marche")
	_verifier(mesures.lieu_a_l_attaque.is_equal_approx(lieu), "à l'ouverture de l'attaque : héros en %s, arrivée attendue %s" % [mesures.lieu_a_l_attaque, lieu])
	if _verifier(echanges == 1 and delais.size() == 1, "la charge doit reprendre un seul jeton"):
		var tenue := int(mesures.demande) - int(mesures.fin)
		_verifier(tenue >= delais[0] - 40 and tenue <= delais[0] + MARGE_DU_BEAT_MS,
			"entre l'arrivée et la reprise : %d ms, tenue programmée %d ms" % [tenue, delais[0]])
	if _fautes.is_empty():
		await _frapper(combat, plateau, pont, actif)
	return mesures.fin


func _frapper(combat: Node, plateau: Plateau, pont: PontDuDome, actif: String) -> void:
	var effets: Effets = plateau.get_node("Effets")
	var departs: Array[String] = []
	effets.depart.connect(func(de: String, _vers: Vector3) -> void: departs.append(de))
	combat.call("_jouer", {type = "jetLancer", args = ["attaque"]})
	if not await _attendre(func() -> bool: return combat.get("_vue").projection.fenetre.fermes.has("jetLancer@attaque"),
			ATTENTE_DE_LA_CHARGE_MS, "le jet d'attaque lancé"):
		return
	combat.call("_jouer", {type = "jetValider", args = ["attaque"]})
	if await _attendre(func() -> bool: return not departs.is_empty(), ATTENTE_DE_LA_CHARGE_MS, "le départ du coup"):
		var coups: Array = pont.reponses["jouer"].effets.filter(func(e: Dictionary) -> bool: return e.quoi == Noyau.Effet.COUP)
		_verifier(departs == [actif] and coups.size() == 1 and coups[0].de == actif and coups[0].vers == CIBLE,
			"un coup du héros vers la cible de la charge, démarré au plateau")
		print("[cadence-de-marche] coup de %s vers %s ; départs=%s" % [actif, CIBLE, departs])


func _jet_d_attaque(reponse: Dictionary) -> bool:
	var fenetre: Variant = reponse.get("vue", {}).get("projection", {}).get("fenetre")
	return fenetre != null and fenetre.gestes.any(func(g: Dictionary) -> bool: return g.get("verbe") == "jetLancer" and g.get("flux") == "attaque")


func _attendre(tenu: Callable, delai_ms: int, quoi: String) -> bool:
	var limite := Time.get_ticks_msec() + delai_ms
	while Time.get_ticks_msec() < limite and _fautes.is_empty():
		if tenu.call():
			return true
		await process_frame
	return _verifier(false, "attente échue : " + quoi)


func _verifier(vrai: bool, faute: String) -> bool:
	if not vrai:
		_fautes.append(faute)
	return vrai

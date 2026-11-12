extends SceneTree

## Les effets d'un appel rendus au plateau (#3771, `hotes/godot/pont/CONTRAT.md`, section « Effets ») : le coup d'un canon
## part dans un éclair de bouche et sa fumée, au son du canon, son boulet vole puis explose sur la cible, qui accuse le
## coup, et ses Blessures puis « hors de combat » montent de la cible ; une incantation canalise au lanceur puis luit sur
## sa cible ; un son de scène joue partout ; un souffle de feu (#3783) vole jusqu'au centre de sa zone, puis pose sa nappe
## de flammes sur chacune de ses cases, au son des flammes ; un soin monte de sa case ; les pas d'un déplacement sonnent
## trois fois (#3825). Chaque son est tiré de `res://sons/`. Deux traits magiques de teintes différentes gardent chacun
## la sienne, leur maille, leur traînée et leur lampe (`Effets.teinter`).

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const CANON := {id = "canon", fichiers = ["canon-1.ogg", "canon-2.ogg", "canon-3.ogg"], volume = 1.0, canal = "effets"}
const EXPLOSION := {id = "explosion", fichiers = ["explosion-1.ogg", "explosion-2.ogg"], volume = 1.0, canal = "effets"}
const INCANTATION := {id = "chant-d-incantation", fichiers = ["incantation-1.ogg", "incantation-2.ogg"], volume = 0.8, canal = "effets"}
const PORTE := {id = "porte-ouvre", fichiers = ["porte-ouvre.ogg"], volume = 0.7, canal = "effets"}
const PAS := {id = "pas", fichiers = ["pas-1.ogg", "pas-2.ogg", "pas-3.ogg"], volume = 0.4, canal = "effets"}
const BLESSURES := {genre = "blessures", texte = "-4", couleur = "#ffd166", critique = true}
const HORS_DE_COMBAT := {genre = "horsDeCombat", texte = "✦ hors de combat", couleur = "#ff3030", critique = false}
const SOIN := {genre = "soin", texte = "+2", couleur = "#6fce8e", critique = false}
const SOUFFLE := {id = "souffle", fichiers = ["souffle-1.ogg", "souffle-2.ogg", "souffle-3.ogg"], volume = 0.9, canal = "effets"}
const FLAMMES := {id = "sort-feu", fichiers = ["sort-feu-1.ogg", "sort-feu-2.ogg", "sort-feu-3.ogg"], volume = 0.85, canal = "effets"}
const CASES := [{x = 5, y = 0}, {x = 6, y = 0}, {x = 7, y = 0}]
const TEINTES_DES_TRAITS := [Color("#3a7fd0"), Color("#c04030")]
const EFFETS := [
	{quoi = "coup", de = "canonnier", vers = "cible", issue = "touche", couleur = "#ffa040",
		depart = {visuel = "eclair-de-bouche", son = CANON}, trajet = {projectile = "boulet", dureeS = 0.15, hauteurM = 0.5},
		arrivee = {visuel = "explosion", son = EXPLOSION}, flottants = [BLESSURES, HORS_DE_COMBAT]},
	{quoi = "incantation", de = "sorciere", vers = "cible", reussie = true, couleur = "#9b7bff",
		depart = {visuel = "canalisation", son = INCANTATION}, arrivee = {visuel = "halo", son = null}, flottants = []},
	{quoi = "son", son = PORTE, fois = 1, ecartS = 0.0},
	{quoi = "zone", de = "dragon", centre = {x = 6, y = 0}, cases = CASES, couleur = "#ff6a20",
		depart = {visuel = null, son = SOUFFLE}, trajet = {projectile = "jet-de-flammes", dureeS = 0.2, hauteurM = 0.0},
		nappe = {visuel = "nappe-de-flammes", son = FLAMMES}},
	{quoi = "flottant", sur = null, case = {x = 5, y = 0}, flottant = SOIN},
	{quoi = "son", son = PAS, fois = 3, ecartS = 0.1},
]
const LIEUX := {"canonnier": Vector3(0.0, 0.0, 0.0), "sorciere": Vector3(0.0, 0.0, 3.0), "cible": Vector3(6.0, 0.0, 0.0), "dragon": Vector3(0.0, 0.0, -3.0),
	"5,0,0": Vector3(5.0, 0.0, 0.0), "6,0,0": Vector3(6.0, 0.0, 0.0), "7,0,0": Vector3(7.0, 0.0, 0.0)}
var _fautes: Array[String] = []
var _departs: Array = []
var _arrivees: Array = []
var _pas := 0


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[effets] version=", Engine.get_version_info().string)
	var effets := Effets.new()
	root.add_child(effets)
	effets.depart.connect(func(de: String, vers: Vector3) -> void: _departs.append([de, vers]))
	effets.arrivee.connect(func(vers: String, touche: bool) -> void:
		_arrivees.append([vers, touche])
		if touche:
			_attendre_le_noeud(effets, "explosion", 2)
			_attendre_le_son(effets, "son-explosion")
			_attendre_les_flottants(effets, ["-4"])
		else:
			_attendre_le_noeud(effets, "canalisation", 1)
			_attendre_le_noeud(effets, "halo", 1))
	_teintes_des_traits(effets)
	effets.child_entered_tree.connect(func(n: Node) -> void:
		if n is AudioStreamPlayer and n.name.begins_with("son-pas"):
			_pas += 1)
	effets.jouer(EFFETS, LIEUX, METRES_PAR_CASE)
	_attendre_le_noeud(effets, "eclair-de-bouche", 2)
	_attendre_le_son(effets, "son-canon")
	if effets.get_node_or_null("boulet") == null:
		_fautes.append("le boulet ne vole pas")
	await create_timer(Effets.ECART_S * 2.0 + 0.15).timeout
	if _arrivees != [["cible", true], ["cible", false]] or _departs != [["canonnier", LIEUX.cible], ["sorciere", LIEUX.cible]]:
		_fautes.append("départs %s, arrivées %s" % [_departs, _arrivees])
	var porte := effets.get_node_or_null("son-porte-ouvre")
	if not porte is AudioStreamPlayer or (porte as AudioStreamPlayer).stream == null:
		_fautes.append("le son de scène ne joue pas partout")
	await create_timer(0.3).timeout
	if _departs.size() != 3 or _departs[2] != ["dragon", LIEUX["6,0,0"]]:
		_fautes.append("le souffle ne part pas vers le centre de sa zone : %s" % [_departs])
	_attendre_le_son(effets, "son-souffle")
	if effets.get_node_or_null("jet-de-flammes") == null:
		_fautes.append("le jet de flammes ne vole pas")
	await create_timer(0.25).timeout
	var nappes := effets.get_children().filter(func(n: Node) -> bool: return n.name.begins_with("nappe-de-flammes"))
	if nappes.size() != CASES.size():
		_fautes.append("%d nappes de flammes posées, attendu une par case (%d)" % [nappes.size(), CASES.size()])
	_attendre_le_son(effets, "son-sort-feu")
	await create_timer(Effets.ECART_S).timeout
	_attendre_les_flottants(effets, ["+2"])
	var soin := effets.get_children().filter(func(n: Node) -> bool: return n is Label3D and (n as Label3D).text == "+2")
	if not soin.is_empty() and not MiseEnPage.point_du_flottant(LIEUX["5,0,0"], METRES_PAR_CASE).is_equal_approx(Vector3((soin[0] as Node3D).position.x, MiseEnPage.point_du_flottant(LIEUX["5,0,0"], METRES_PAR_CASE).y, (soin[0] as Node3D).position.z)):
		_fautes.append("le soin ne monte pas de sa case : %s" % [(soin[0] as Node3D).position])
	await create_timer(Effets.ECART_S + 0.25).timeout
	if _pas != 3:
		_fautes.append("%d pas sonnent, attendu 3" % _pas)
	await create_timer(3.0).timeout
	if effets.get_children().any(func(n: Node) -> bool: return not n is AudioStreamPlayer and not n is AudioStreamPlayer3D):
		_fautes.append("éteints, des éclats restent posés : %s" % [effets.get_children().map(func(n: Node) -> String: return n.name)])
	for faute in _fautes:
		push_error("[effets] " + faute)
	print("[effets] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## L'éclat `nom` posé sous `effets`, avec `gerbes` gerbes de particules qui émettent.
func _attendre_le_noeud(effets: Effets, nom: String, gerbes: int) -> void:
	var eclat := effets.get_node_or_null(nom)
	if eclat == null:
		_fautes.append("%s : aucun éclat" % nom)
		return
	var emises := eclat.get_children().filter(func(n: Node) -> bool: return n is CPUParticles3D and (n as CPUParticles3D).emitting)
	if emises.size() != gerbes:
		_fautes.append("%s : %d gerbes émettent, attendu %d" % [nom, emises.size(), gerbes])


## Un trait magique par teinte de `TEINTES_DES_TRAITS`, posés ensemble sous `effets` : chacun garde la sienne, sa maille
## (sa matière effective, émission comprise), sa traînée et sa lampe.
func _teintes_des_traits(effets: Effets) -> void:
	var traits := TEINTES_DES_TRAITS.map(func(teinte: Color) -> Node3D: return effets.projectile_de("trait-magique", teinte))
	for projectile: Node3D in traits:
		effets.add_child(projectile, true)
	for rang in traits.size():
		var teinte: Color = TEINTES_DES_TRAITS[rang]
		var matiere := (traits[rang].get_node("Corps/Maille") as MeshInstance3D).get_active_material(0) as StandardMaterial3D
		var trainee := traits[rang].get_node("Corps/Trainee") as CPUParticles3D
		var lampe := traits[rang].get_node("Corps/Lampe") as OmniLight3D
		if matiere.albedo_color != teinte or matiere.emission != teinte or trainee.color != teinte or lampe.light_color != teinte:
			_fautes.append("le trait magique %s ne garde pas sa teinte : maille %s, émission %s, traînée %s, lampe %s" % [teinte.to_html(false), matiere.albedo_color, matiere.emission, trainee.color, lampe.light_color])
	for projectile: Node3D in traits:
		projectile.free()


## Un flottant de chaque texte de `textes` posé sous `effets`, face à la caméra.
func _attendre_les_flottants(effets: Effets, textes: Array) -> void:
	for texte: String in textes:
		var trouves := effets.get_children().filter(func(n: Node) -> bool: return n is Label3D and (n as Label3D).text == texte)
		if trouves.is_empty() or (trouves[0] as Label3D).billboard != BaseMaterial3D.BILLBOARD_ENABLED:
			_fautes.append("le flottant « %s » ne monte pas" % texte)


## Le son `nom` qui joue sous `effets`, à son point, son flux tiré de `res://sons/`.
func _attendre_le_son(effets: Effets, nom: String) -> void:
	var lecteur := effets.get_node_or_null(nom)
	if not lecteur is AudioStreamPlayer3D or (lecteur as AudioStreamPlayer3D).stream == null:
		_fautes.append("%s : aucun son à son point" % nom)

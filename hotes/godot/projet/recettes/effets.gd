extends SceneTree

## Les effets d'un appel rendus au plateau (#3771, `hotes/godot/pont/CONTRAT.md`, section « Effets ») : le coup d'un canon
## part dans un éclair de bouche et sa fumée, au son du canon, son boulet vole puis explose sur la cible, qui accuse le
## coup ; une incantation canalise au lanceur puis luit sur sa cible ; un son de scène joue partout. Chaque son est tiré
## de `res://sons/`.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const CANON := {id = "canon", fichiers = ["canon-1.ogg", "canon-2.ogg", "canon-3.ogg"], volume = 1.0}
const EXPLOSION := {id = "explosion", fichiers = ["explosion-1.ogg", "explosion-2.ogg"], volume = 1.0}
const INCANTATION := {id = "chant-d-incantation", fichiers = ["incantation-1.ogg", "incantation-2.ogg"], volume = 0.8}
const PORTE := {id = "porte-ouvre", fichiers = ["porte-ouvre.ogg"], volume = 0.7}
const EFFETS := [
	{quoi = "coup", de = "canonnier", vers = "cible", issue = "touche", couleur = "#ffa040",
		depart = {visuel = "eclair-de-bouche", son = CANON}, trajet = {projectile = "boulet", dureeS = 0.15, hauteurM = 0.5},
		arrivee = {visuel = "explosion", son = EXPLOSION}},
	{quoi = "incantation", de = "sorciere", vers = "cible", reussie = true, couleur = "#9b7bff",
		depart = {visuel = "canalisation", son = INCANTATION}, arrivee = {visuel = "halo", son = null}},
	{quoi = "son", son = PORTE},
]
const LIEUX := {canonnier = Vector3(0.0, 0.0, 0.0), sorciere = Vector3(0.0, 0.0, 3.0), cible = Vector3(6.0, 0.0, 0.0)}
var _fautes: Array[String] = []
var _departs: Array = []
var _arrivees: Array = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[effets] version=", Engine.get_version_info().string)
	var effets := Effets.new()
	root.add_child(effets)
	effets.depart.connect(func(de: String, vers: String) -> void: _departs.append([de, vers]))
	effets.arrivee.connect(func(vers: String, touche: bool) -> void:
		_arrivees.append([vers, touche])
		if touche:
			_attendre_le_noeud(effets, "explosion", 2)
			_attendre_le_son(effets, "son-explosion")
		else:
			_attendre_le_noeud(effets, "canalisation", 1)
			_attendre_le_noeud(effets, "halo", 1))
	effets.jouer(EFFETS, LIEUX, METRES_PAR_CASE)
	_attendre_le_noeud(effets, "eclair-de-bouche", 2)
	_attendre_le_son(effets, "son-canon")
	if effets.get_node_or_null("boulet") == null:
		_fautes.append("le boulet ne vole pas")
	await create_timer(Effets.ECART_S * 2.0 + 0.15).timeout
	if _arrivees != [["cible", true], ["cible", false]] or _departs != [["canonnier", "cible"], ["sorciere", "cible"]]:
		_fautes.append("départs %s, arrivées %s" % [_departs, _arrivees])
	var porte := effets.get_node_or_null("son-porte-ouvre")
	if not porte is AudioStreamPlayer or (porte as AudioStreamPlayer).stream == null:
		_fautes.append("le son de scène ne joue pas partout")
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


## Le son `nom` qui joue sous `effets`, à son point, son flux tiré de `res://sons/`.
func _attendre_le_son(effets: Effets, nom: String) -> void:
	var lecteur := effets.get_node_or_null(nom)
	if not lecteur is AudioStreamPlayer3D or (lecteur as AudioStreamPlayer3D).stream == null:
		_fautes.append("%s : aucun son à son point" % nom)

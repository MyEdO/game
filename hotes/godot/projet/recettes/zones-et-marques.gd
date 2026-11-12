extends SceneTree

## Les zones qui durent et les marques des États (#3834, `hotes/godot/pont/CONTRAT.md`, section « Vue ») : une zone de
## feu pose les gerbes continues de sa nappe sur chacune de ses cases, à leur lieu, et joue son crépitement en boucle à
## sa case centrale ; une fumée, sa nappe sans son ; la même zone reposée reste telle quelle, une zone qui ne dure plus
## est retirée ; la même clé aux cases changées garde son nœud, les nappes de ses cases gardées et son crépitement, qui
## suit sa case centrale. Un porteur En flammes et Hémorragique 3 montre leurs deux textes l'un au-dessus de l'autre, le feu de la
## première et son crépitement, la lueur de la seconde ; les mêmes marques ne changent rien, aucune marque n'en laisse
## aucune.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const CREPITEMENT := {id = "crepitement", fichiers = ["crepitement.ogg"], volume = 0.6, canal = "ambiance"}
const CASES := [{x = 1, y = 0}, {x = 2, y = 0}, {x = 3, y = 0}]
## Les cases du feu une fois changées, sous la même clé : la première sortie, une neuve.
const CASES_DEPLACEES := [{x = 2, y = 0}, {x = 3, y = 0}, {x = 4, y = 0}]
const FEU := {cle = "mur-de-feu@2,0,0", cases = CASES, centre = {x = 2, y = 0}, couleur = "#ff5a2a", visuel = "nappe-de-flammes", boucle = CREPITEMENT}
const FUMEE := {cle = "souffle-de-fumee@5,5,0", cases = [{x = 5, y = 5}], centre = {x = 5, y = 5}, couleur = "#8a8a8a", visuel = "nuage", boucle = null}
const MARQUES := [
	{id = "en-flammes", texte = "En flammes", couleur = "#ff7a2a", visuel = "feu", son = CREPITEMENT},
	{id = "hemorragique", texte = "Hémorragique 3", couleur = "#d02828", visuel = "lueur", son = null},
]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[zones-et-marques] version=", Engine.get_version_info().string)
	var lieu := func(case: Dictionary) -> Vector3: return Vector3(case.x, 0.0, case.y)
	var zones := ZonesQuiDurent.new()
	root.add_child(zones)
	zones.poser([FEU, FUMEE], lieu, METRES_PAR_CASE)
	var feu := zones.zone(FEU.cle)
	var nappes := [] if feu == null else feu.get_children().filter(func(n: Node) -> bool: return n.name.begins_with("nappe-de-flammes"))
	if nappes.size() != CASES.size() or not (nappes[1] as Node3D).position.is_equal_approx(Vector3(2.0, 0.0, 0.0)):
		_fautes.append("le feu : %d nappes posées, une par case attendue à son lieu" % nappes.size())
	elif nappes.any(func(n: Node) -> bool: return n.get_children().any(func(g: Node) -> bool: return not (g is CPUParticles3D and (g as CPUParticles3D).emitting and not (g as CPUParticles3D).one_shot))):
		_fautes.append("le feu : ses gerbes n'émettent pas sans fin")
	var crepitement := null if feu == null else feu.get_node_or_null("son-crepitement") as AudioStreamPlayer3D
	if crepitement == null or not crepitement.playing or not crepitement.position.is_equal_approx(Vector3(2.0, 0.0, 0.0)):
		_fautes.append("le feu ne crépite pas à sa case centrale")
	var fumee := zones.zone(FUMEE.cle)
	if fumee == null or fumee.get_node_or_null("nuage") == null or fumee.get_children().any(func(n: Node) -> bool: return n is AudioStreamPlayer3D):
		_fautes.append("la fumée : sa nappe sans son attendue")
	zones.poser([FEU], lieu, METRES_PAR_CASE)
	await process_frame
	if zones.zone(FEU.cle) != feu or zones.zone(FUMEE.cle) != null or zones.get_child_count() != 1:
		_fautes.append("reposées : le feu doit rester tel quel, la fumée être retirée (%d zones)" % zones.get_child_count())
	var gardees := nappes.slice(1).map(func(n: Node) -> int: return n.get_instance_id())
	var feu_deplace := FEU.duplicate()
	feu_deplace.cases = CASES_DEPLACEES
	feu_deplace.centre = {x = 3, y = 0}
	zones.poser([feu_deplace], lieu, METRES_PAR_CASE)
	await process_frame
	var accordees := [] if zones.zone(FEU.cle) == null else zones.zone(FEU.cle).get_children().filter(func(n: Node) -> bool: return n.name.begins_with("nappe-de-flammes"))
	var lieux := accordees.map(func(n: Node3D) -> Vector3: return n.position)
	if zones.zone(FEU.cle) != feu or lieux != [Vector3(2.0, 0.0, 0.0), Vector3(3.0, 0.0, 0.0), Vector3(4.0, 0.0, 0.0)]:
		_fautes.append("cases changées : la zone garde son nœud, une nappe par case attendue à son lieu, posées %s" % [lieux])
	elif accordees.slice(0, 2).map(func(n: Node) -> int: return n.get_instance_id()) != gardees:
		_fautes.append("cases changées : les nappes des cases gardées doivent rester les mêmes instances")
	elif not crepitement.position.is_equal_approx(Vector3(3.0, 0.0, 0.0)) or zones.zone(FEU.cle).get_node_or_null("son-crepitement") != crepitement:
		_fautes.append("cases changées : le même crépitement doit suivre la case centrale")

	var marques := MarquesDEtats.new()
	root.add_child(marques)
	marques.montrer(MARQUES, METRES_PAR_CASE)
	var textes := marques.get_children().filter(func(n: Node) -> bool: return n is Label3D)
	if textes.map(func(t: Label3D) -> String: return t.text) != ["En flammes", "Hémorragique 3"]:
		_fautes.append("marques : %s, attendu les deux textes" % [textes.map(func(t: Label3D) -> String: return t.text)])
	elif not ((textes[1] as Node3D).position.y > (textes[0] as Node3D).position.y) or (textes[0] as Label3D).billboard != BaseMaterial3D.BILLBOARD_ENABLED:
		_fautes.append("marques : la seconde doit se poser au-dessus de la première, face à la caméra")
	if marques.get_node_or_null("feu") == null or marques.get_node_or_null("lueur") == null or marques.get_node_or_null("son-crepitement") == null:
		_fautes.append("marques : le feu, son crépitement et la lueur attendus, posés %s" % [marques.get_children().map(func(n: Node) -> String: return n.name)])
	var premier: Node = textes[0] if not textes.is_empty() else null
	marques.montrer(MARQUES, METRES_PAR_CASE)
	if premier != null and premier.is_queued_for_deletion():
		_fautes.append("les mêmes marques reposées changent")
	marques.montrer([], METRES_PAR_CASE)
	zones.poser([], lieu, METRES_PAR_CASE)
	await process_frame
	if marques.get_child_count() != 0 or zones.get_child_count() != 0:
		_fautes.append("sans marque ni zone : %d marques, %d zones restent" % [marques.get_child_count(), zones.get_child_count()])
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[zones-et-marques] " + faute)
	print("[zones-et-marques] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)

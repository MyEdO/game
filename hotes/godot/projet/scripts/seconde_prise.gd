## La main libre sur la seconde prise d'un objet tenu des deux mains (#3319, `hotes/godot/pont/CONTRAT.md`, « Atelier
## 3D ») : des modificateurs natifs du squelette, posés à sa suite (après le gabarit), dans cet ordre, actifs sous un
## clip à deux mains (`MontageDeComposition.poser_le_clip`), qui pose déjà les deux mains sur la seconde prise de son
## maniement : `ModifierBoneTarget3D` suit la main qui tient, et porte le repère de la seconde prise, puis celui où l'os
## de la main libre la tient ; `FABRIK3D` y ploie le bras libre (l'os de la main libre et ses deux parents), en partant
## chaque fois de la pose du clip (`deterministic`), sans borne d'angle par mise à jour, qui rejoue la pose en entier, et
## rejoint la seconde prise propre à l'objet ; `CopyTransformModifier3D` donne enfin à la main libre l'orientation de ce
## repère, et à chacun de ses doigts la rotation de son homologue sous la main qui tient (le poing), appariés enfant par
## enfant, en même nombre.
class_name SecondePrise
extends RefCounted

## Les passes de `FABRIK3D` par mise à jour : assez pour qu'un bras à deux os rejoigne sa cible au millimètre.
const ITERATIONS := 16


## Les modificateurs, posés sous `squelette`, qui saisissent la seconde prise `seconde` (`secondesPrises` de `modeles`)
## de l'objet tenu à la prise `tenante` avec la main de la prise `libre` (deux attaches de prise de la base) ; aucun si
## le squelette n'a pas l'os de chaque prise ou deux parents à l'os de la main libre.
static func poser(squelette: Skeleton3D, tenante: Dictionary, libre: Dictionary, seconde: Dictionary) -> Array[Node]:
	var main := squelette.find_bone(libre.os)
	var coude := squelette.get_bone_parent(main) if main != -1 else -1
	var epaule := squelette.get_bone_parent(coude) if coude != -1 else -1
	if squelette.find_bone(tenante.os) == -1 or epaule == -1:
		return []
	var suivi := ModifierBoneTarget3D.new()
	suivi.name = "SecondePrise_Suivi"
	suivi.bone_name = tenante.os
	var cible := _chainer(suivi, [MontageDeComposition.repere(tenante), MontageDeComposition.repere(seconde),
		MontageDeComposition.repere(libre).affine_inverse()])
	var bras := FABRIK3D.new()
	bras.name = "SecondePrise_Bras"
	bras.setting_count = 1
	bras.set_root_bone(0, epaule)
	bras.set_end_bone(0, main)
	bras.set_deterministic(true)
	bras.set_angular_delta_limit(PI)
	bras.set_max_iterations(ITERATIONS)
	var poing := CopyTransformModifier3D.new()
	poing.name = "SecondePrise_Poing"
	var paires: Array[Vector2i] = []
	_apparier(squelette, squelette.find_bone(tenante.os), main, paires)
	poing.setting_count = paires.size()
	for rang in paires.size():
		poing.set_apply_bone(rang, paires[rang].y)
		poing.set_reference_type(rang, BoneConstraint3D.REFERENCE_TYPE_BONE)
		poing.set_reference_bone(rang, paires[rang].x)
		poing.set_copy_flags(rang, CopyTransformModifier3D.TRANSFORM_FLAG_ROTATION)
		poing.set_relative(rang, true)
	var modificateurs: Array[Node] = [suivi, bras, poing]
	for modificateur in modificateurs:
		squelette.add_child(modificateur)
	bras.set_target_node(0, bras.get_path_to(cible))
	poing.set_reference_type(0, BoneConstraint3D.REFERENCE_TYPE_NODE)
	poing.set_reference_node(0, poing.get_path_to(cible))
	poing.set_relative(0, false)
	return modificateurs


## Le dernier d'une chaîne de nœuds posée sous `sous`, chacun au repère suivant de `reperes` dans le précédent.
static func _chainer(sous: Node3D, reperes: Array[Transform3D]) -> Node3D:
	var parent := sous
	for repere in reperes:
		var noeud := Node3D.new()
		noeud.transform = repere
		parent.add_child(noeud)
		parent = noeud
	return parent


## Les paires (os tenant, os libre) : `tenant` et `libre` eux-mêmes, puis leurs descendants appariés enfant par enfant,
## tant que leurs enfants sont en même nombre.
static func _apparier(squelette: Skeleton3D, tenant: int, libre: int, paires: Array[Vector2i]) -> void:
	paires.append(Vector2i(tenant, libre))
	var enfants_tenants := squelette.get_bone_children(tenant)
	var enfants_libres := squelette.get_bone_children(libre)
	if enfants_tenants.size() != enfants_libres.size():
		return
	for rang in enfants_tenants.size():
		_apparier(squelette, enfants_tenants[rang], enfants_libres[rang], paires)

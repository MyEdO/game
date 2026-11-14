"""Construction d'un élément sur une base (#3743) : lit `element/<base>/<categorie>--<valeur>/donnees.py`, bâtit l'élément par
son `modele.py`, l'exporte en GLB et écrit son dossier de production (`production.py`), que valide
`npm run godot:valider -- <element.json> <base.manifeste.json> <glb>` et qu'importe `node hotes/godot/importer.mjs`.

Les GLB lus viennent du cache des modèles (`CACHE_DES_MODELES` de `hotes/godot/asset/release.ts`, rempli par son
`recupererModeles`, que joue `npm run godot:sonde`), chacun sous l'empreinte que le dépôt épingle dans
`hotes/godot/projet/modeles/<id>.manifeste.json` : la base, les éléments publiés qu'une pièce contourne, et l'élément
lui-même pour une reprise. L'élément reçoit les licences des packs de la base, dont il
emprunte le squelette.

`donnees.py` porte `MANIFESTE` (les champs publiés propres à l'élément : `categorie`, `cle`, `liaison`, et pour une pièce
skinnée `couche`, `couvre`, `chaines`), `MATERIAUX` (`{nom: (emplacement de palette, matière)}`, `habillage.py`),
`BLASONS` s'il en a (les matériaux qui reçoivent l'emblème, exportés avec leurs UV, comme ceux d'un véhicule),
`BUDGET_TRIANGLES`, et chaque dimension nommée avec sa source. `modele.py` porte `construire`, selon la liaison :
- `rigide` : `construire(D, materiaux)` rend les objets, bâtis dans le repère de la prise `PRISE` (une prise du manifeste
  de base) ; ils pendent à l'os de cette prise ;
- `squelette` : `construire(D, materiaux, base)` reçoit la base au repos (`tissu.Base`) et rend la pièce jointe, ses clés
  transférées (`Base.transferer`) ; elle est découpée par zone et exportée avec l'armature, sans clip ; les emplacements
  qu'elle offre (`Base.offrir`) vont à `emplacements` de son manifeste ;
- `squelette` ou `surface` repris du GLB publié (`element/publie.py`, #3761) : `modele.py` porte `reprendre(materiaux, base,
  glb)` au lieu de `construire` et reçoit le GLB épinglé de l'élément ; `donnees.py` ne porte que `MANIFESTE` (ses
  `emplacements` recopiés du manifeste publié), `MATERIAUX` (valeurs lues dans les matériaux du GLB publié) et
  `BUDGET_TRIANGLES`.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/element/construire.py humanoide/rigide--baton \\
        --sortie <dossier neuf hors du dépôt>
"""
import argparse
import hashlib
import importlib.util
import json
import math
import runpy
import sys
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI), str(ICI.parent), str(ICI.parent / "base")]

import bpy  # noqa: E402
from mathutils import Euler, Matrix, Quaternion, Vector  # noqa: E402
import habillage  # noqa: E402
import tissu  # noqa: E402
from glb import lire_glb  # noqa: E402
from production import CACHE_DES_MODELES, MODELES, dossier_de_sortie, ecrire_le_dossier  # noqa: E402

ECART_ROTATION_MAX = 1e-4      # rad, entre le nœud exporté et le repère de prise
ECART_TRANSLATION_MAX = 1e-5   # m
ECART_DE_NORMALES_MIN = 1e-3
"""Écart minimal, par composante, entre deux normales différentes des coins d'un même sommet : l'export glTF les arrondit
à 4 décimales avant de fusionner les coins égaux, et deux normales plus proches fusionnent ou non selon le dernier bit de
la machine (#3865)."""


def elements():
    """Les éléments du dépôt, `<base>/<categorie>--<valeur>`."""
    return sorted(f"{d.parent.parent.name}/{d.parent.name}" for d in ICI.glob("*/*/donnees.py"))


def identifiant(base, manifeste):
    return f"{base}--{manifeste['categorie']}--{next(iter(manifeste['cle'].values()))}"


def lire(chemin):
    return json.loads(chemin.read_text(encoding="utf-8"))


def epingle(id_, cache):
    """Le GLB de `id_` dans `cache`, sous l'empreinte que le dépôt épingle ; refuse un GLB absent ou d'une autre empreinte."""
    attendue = lire(MODELES / f"{id_}.manifeste.json")["glb"]["sha256"]
    chemin = cache / f"{attendue}.glb"
    if not chemin.exists():
        raise ValueError(f"{chemin} : GLB de {id_} absent du cache des modèles (npm run godot:sonde)")
    empreinte = hashlib.sha256(chemin.read_bytes()).hexdigest()
    if empreinte != attendue:
        raise ValueError(f"{chemin} : empreinte {empreinte}, {id_} épinglé est {attendue}")
    return chemin


def armature_au_repos(glb):
    """La seule armature de la base, au repos, sans maillage ni clip."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb), bone_heuristic="BLENDER")
    rigs = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if len(rigs) != 1:
        raise ValueError(f"{len(rigs)} armatures dans la base, une attendue")
    rig = rigs[0]
    rig.animation_data_clear()
    rig.data.pose_position = "REST"
    for o in [o for o in bpy.data.objects if o is not rig]:
        bpy.data.objects.remove(o, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.context.view_layer.update()
    return rig


def pendre(objets, rig, prise):
    """Pend `objets`, bâtis dans le repère de `prise`, à l'os de cette prise ; rend la matrice d'attache."""
    attache = Matrix.Translation(prise["position"]) @ Euler(prise["rotation"], "ZYX").to_matrix().to_4x4()
    os_ = prise["os"]
    for objet in objets:
        objet.parent = rig
        objet.parent_type = "BONE"
        objet.parent_bone = os_
        bpy.context.view_layer.update()
        objet.matrix_world = rig.matrix_world @ rig.data.bones[os_].matrix_local @ attache
    bpy.context.view_layer.update()
    return attache


def verifier_les_normales(objets):
    """Refuse un objet dont deux coins d'un même sommet portent des normales différentes à moins de
    `ECART_DE_NORMALES_MIN` l'une de l'autre : leur fusion à l'export dépendrait de la machine."""
    fautes = {}
    for objet in objets:
        me = objet.data
        normales = np.empty(len(me.loops) * 3, dtype=np.float32)
        me.corner_normals.foreach_get("vector", normales)
        sommets = np.empty(len(me.loops), dtype=np.int64)
        me.loops.foreach_get("vertex_index", sommets)
        ordre = np.argsort(sommets, kind="stable")
        groupes = np.split(ordre, np.flatnonzero(np.diff(sommets[ordre])) + 1)
        proches = 0
        for groupe in groupes:
            n = normales.reshape(-1, 3)[groupe]
            ecart = np.abs(n[:, None] - n[None]).max(axis=2)
            proches += int(((ecart > 0) & (ecart < ECART_DE_NORMALES_MIN)).sum()) // 2
        if proches:
            fautes[objet.name] = proches
    if fautes:
        raise ValueError(f"coins d'un même sommet aux normales presque égales, fusion à l'export instable : {fautes}")


def exporter(chemin, rig, objets, skinne, avec_uv):
    """Exporte `rig` et `objets` seuls, sans clip, leurs normales vérifiées (`verifier_les_normales`), leurs UV si
    `avec_uv` ; une pièce skinnée garde ses clés, et chaque objet ses propriétés en `extras` : `zone` d'une pièce skinnée,
    `fourreau` d'un rigide (`element/lame.py`)."""
    verifier_les_normales(objets)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for objet in objets:
        objet.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(chemin), export_format="GLB", use_selection=True, export_animations=False,
                              export_skins=True, export_morph=skinne, export_morph_normal=False, export_extras=True,
                              export_yup=True, export_apply=False, export_texcoords=avec_uv, export_normals=True,
                              export_tangents=False, export_materials="EXPORT", export_cameras=False,
                              export_lights=False)
    return chemin.read_bytes()


def verifier_la_pendaison(chemin, os_, attache):
    """Relit le GLB exporté : chaque mesh pend à l'articulation `os_`, sans skin, au repère `attache` (Y-haut)."""
    doc, _ = lire_glb(chemin)
    noeuds = doc["nodes"]
    parents = {c: i for i, n in enumerate(noeuds) for c in n.get("children", [])}
    articulations = {j for s in doc.get("skins", []) for j in s["joints"]}
    attendu = attache.to_quaternion() @ Quaternion((1, 0, 0), math.pi / 2)
    fautes = []
    for i, n in enumerate(noeuds):
        if "mesh" not in n:
            continue
        p = parents.get(i)
        x, y, z, w = n.get("rotation") or (0, 0, 0, 1)
        angle = Quaternion((w, x, y, z)).rotation_difference(attendu).angle
        ecart_r = min(angle, 2 * math.pi - angle)
        ecart_t = (Vector(n.get("translation") or (0, 0, 0)) - attache.translation).length
        if "skin" in n or p not in articulations or noeuds[p].get("name") != os_ or ecart_r > ECART_ROTATION_MAX or ecart_t > ECART_TRANSLATION_MAX:
            fautes.append({"mesh": n.get("name"), "parent": noeuds[p].get("name") if p is not None else None,
                           "ecart_rotation_rad": ecart_r, "ecart_translation_m": ecart_t})
    if fautes or not doc.get("skins") or doc.get("animations"):
        raise ValueError(f"export non conforme : {fautes or 'skin absent ou clip présent'}")


def triangles_de(objets, budget):
    triangles = sum(len(p.vertices) - 2 for o in objets for p in o.data.polygons)
    if triangles > budget:
        raise ValueError(f"{triangles} triangles > budget {budget}")
    return triangles


def construire_rigide(D, modele, manifeste_de_base, glb_de_base, temporaire):
    """Les objets du modèle, pendus à l'os de la prise `D['PRISE']` ; rend les octets, les champs propres et le compte."""
    prise = manifeste_de_base["prises"][D["PRISE"]]
    rig = armature_au_repos(glb_de_base)
    objets = modele.construire(D, habillage.materiaux(D["MATERIAUX"]))
    triangles = triangles_de(objets, D["BUDGET_TRIANGLES"])
    attache = pendre(objets, rig, prise)
    octets = exporter(temporaire, rig, objets, skinne=False, avec_uv=bool(D.get("BLASONS")))
    verifier_la_pendaison(temporaire, prise["os"], attache)
    return octets, objets, {}, triangles


def construire_squelette(D, modele, manifeste_de_base, glb_de_base, cache, id_, temporaire):
    """La pièce du modèle, ses clés transférées, découpée par zone, ou les objets repris du GLB publié de `id_`
    (`reprendre`), exportés avec l'armature de la base."""
    base = tissu.Base(glb_de_base, manifeste_de_base, lambda id_: epingle(id_, cache))
    materiaux = habillage.materiaux(D["MATERIAUX"])
    if hasattr(modele, "reprendre"):
        objets = modele.reprendre(materiaux, base, epingle(id_, cache))
        triangles = triangles_de(objets, D["BUDGET_TRIANGLES"])
    else:
        piece = modele.construire(D, materiaux, base)
        triangles = triangles_de([piece], D["BUDGET_TRIANGLES"])
        objets = base.decouper_par_zone(piece)
    octets = exporter(temporaire, base.rig, objets, skinne=True, avec_uv=bool(D.get("BLASONS")))
    offerts = {"emplacements": base.emplacements} if base.emplacements else {}
    return octets, objets, {"silhouettes": list(manifeste_de_base["silhouettes"]), **offerts}, triangles


def main():
    p = argparse.ArgumentParser()
    p.add_argument("element", choices=elements())
    p.add_argument("--cache", type=Path, default=CACHE_DES_MODELES, help="cache des modèles, GLB nommés par empreinte")
    p.add_argument("--sortie", required=True)
    args = p.parse_args()
    base, dossier = args.element.split("/")
    D = runpy.run_path(str(ICI / base / dossier / "donnees.py"))
    spec = importlib.util.spec_from_file_location(f"modele_{dossier}", ICI / base / dossier / "modele.py")
    modele = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modele)
    M = D["MANIFESTE"]
    manifeste_de_base = lire(MODELES / f"{base}.manifeste.json")
    glb_de_base = epingle(base, args.cache)
    sortie = dossier_de_sortie(args.sortie)
    id_ = identifiant(base, M)
    temporaire = sortie / f"{id_}.tmp.glb"
    mode = M["liaison"]["mode"]
    if mode == "rigide":
        octets, objets, propres, triangles = construire_rigide(D, modele, manifeste_de_base, glb_de_base, temporaire)
    elif mode in ("squelette", "surface"):
        octets, objets, propres, triangles = construire_squelette(D, modele, manifeste_de_base, glb_de_base, args.cache,
                                                                  id_, temporaire)
    else:
        raise ValueError(f"{args.element} : liaison {mode} sans constructeur")
    temporaire.unlink()
    utilises = {m.name for o in objets for m in o.data.materials}
    surfaces = habillage.surfaces(utilises, D["MATERIAUX"], D.get("BLASONS", ()))
    manifeste = {"schema": 3, "base": base, **M, **propres, "surfaces": surfaces}
    licences = {l["fichier"]: MODELES / l["fichier"] for l in lire(MODELES / f"{base}.provenance.json")["licences_de_pack"]}
    ecrit = ecrire_le_dossier(sortie / id_, id_, octets, manifeste, licences)
    print("GLB", id_, ecrit["glb"]["octets"], ecrit["glb"]["sha256"], "TRIANGLES", triangles)


if __name__ == "__main__":
    main()

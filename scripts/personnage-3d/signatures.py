"""Empreintes stables d'objets Blender (maillage, action, matériau, squelette) : la preuve qu'une étape de
production n'a touché que les composants qu'elle déclare."""
import hashlib
import json

import bpy


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,
                                    separators=(",",":")).encode()).hexdigest()


def matrix(value):
    return [list(row) for row in value]


def mesh_signature(obj):
    data=obj.data
    return digest({
        "matrix":matrix(obj.matrix_world),
        "parent":obj.parent.name if obj.parent else None,
        "parent_type":obj.parent_type,"parent_bone":obj.parent_bone,
        "vertices":[list(v.co) for v in data.vertices],
        "weights":[[(g.group,g.weight) for g in v.groups] for v in data.vertices],
        "groups":[g.name for g in obj.vertex_groups],
        "faces":[[list(p.vertices),p.material_index,p.use_smooth] for p in data.polygons],
        "uv":[[uv.name,[list(v.uv) for v in uv.data]] for uv in data.uv_layers],
        "normals":[list(n.vector) for n in data.corner_normals],
        "materials":[m.name if m else None for m in data.materials],
        "modifiers":[[m.name,m.type,getattr(getattr(m,"object",None),"name",None)]
                     for m in obj.modifiers]})


def action_signature(action):
    bags=[]
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag=strip.channelbag(slot)
                if bag:
                    bags.extend([[curve.data_path,curve.array_index,
                                  [[list(k.co),list(k.handle_left),list(k.handle_right),
                                    k.interpolation] for k in curve.keyframe_points]]
                                 for curve in bag.fcurves])
    return digest({"name":action.name,"frames":list(action.frame_range),"curves":bags})


def material_signature(mat):
    return digest({"name":mat.name,"diffuse":list(mat.diffuse_color),
                   "roughness":mat.roughness,"metallic":mat.metallic,
                   "nodes":[[n.name,n.bl_idname,
                     [[i.name,list(i.default_value) if hasattr(i.default_value,"__len__")
                       else i.default_value] for i in n.inputs if hasattr(i,"default_value")
                      and isinstance(i.default_value,(int,float,bool,str,tuple,list))
                      or hasattr(i,"default_value") and hasattr(i.default_value,"__len__")]]
                     for n in mat.node_tree.nodes],
                   "links":[[l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name]
                            for l in mat.node_tree.links]})


def invariant(manifest, rig, touched):
    """Empreintes de tout ce qu'une étape ne doit pas modifier : maillages et matériaux des composants hors de
    `touched`, squelette et actions."""
    names = [piece["node"] for piece in manifest["pieces"].values() if piece["component"] not in touched]
    materials = {m for name in names for m in bpy.data.objects[name].data.materials if m}
    return {"meshes": {name: mesh_signature(bpy.data.objects[name]) for name in names},
            "materials": {m.name: material_signature(m) for m in materials},
            "rig": digest({"matrix": matrix(rig.matrix_world),
                           "bones": [[b.name, b.parent.name if b.parent else None,
                                      matrix(b.matrix_local), b.use_deform] for b in rig.data.bones]}),
            "actions": {a.name: action_signature(a) for a in bpy.data.actions}}

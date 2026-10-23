"""Prises anatomiques par quaternions pour les doigts du squelette de déformation game_engine de MPFB, et leurs
contrôles (bornes, idempotence, remise au repos, miroir, invariance au parent, isolation des autres os).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/mains.py --input <personnage.blend> --output <dossier vide> [--probe]
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

FINGERS = ("index", "middle", "ring", "pinky", "thumb")


def apply_hand_grip(rig, side, strength=1.0, kind="sword"):
    from mathutils import Quaternion, Vector
    if side not in ("l", "r") or kind not in ("sword", "pistol", "fist"):
        raise ValueError("side must be l/r and kind sword/pistol/fist")
    strength = float(strength)
    if not math.isfinite(strength):
        raise ValueError("strength must be finite")
    strength = max(0.0, min(1.0, strength))
    names = [f"{finger}_{segment:02d}_{side}" for finger in FINGERS for segment in (1, 2, 3)]
    if any(name not in rig.data.bones for name in names):
        raise ValueError("Missing game_engine finger bones")
    hand = rig.data.bones[f"hand_{side}"]
    bases = [rig.data.bones[f"{finger}_01_{side}"].head_local for finger in FINGERS[:4]]
    forward = (sum(bases, Vector()) / 4 - hand.head_local).normalized()
    across = (bases[0] - bases[3]).normalized()
    normal = forward.cross(across).normalized() * (1 if side == "l" else -1)
    report = {"side": side, "strength": strength, "kind": kind,
              "forward": list(forward), "across": list(across), "palm_normal": list(normal), "bones": {}}
    for finger in FINGERS:
        angles = [52, 72, 52] if kind != "fist" else [70, 88, 68]
        if kind == "pistol" and finger == "index":
            angles = [22, 36, 18]
        if finger == "thumb":
            angles = [30, 42, 38] if kind != "fist" else [38, 55, 45]
        for segment, degrees in enumerate(angles, 1):
            name = f"{finger}_{segment:02d}_{side}"
            bone = rig.data.bones[name]
            direction = (bone.tail_local - bone.head_local).normalized()
            inward = normal.copy()
            if finger == "thumb":
                inward = (bases[1] - bone.head_local).normalized()
                inward = (inward + normal * 0.65).normalized()
            axis = direction.cross(inward)
            if axis.length < 1e-7:
                raise ValueError(f"Degenerate curl axis: {name}")
            axis.normalize()
            local_axis = bone.matrix_local.to_quaternion().inverted() @ axis
            pose = rig.pose.bones[name]
            pose.rotation_mode = "QUATERNION"
            pose.rotation_quaternion = Quaternion(local_axis, math.radians(degrees) * strength)
            pose.location = (0, 0, 0)
            pose.scale = (1, 1, 1)
            report["bones"][name] = {"axis_local": list(local_axis), "degrees": degrees * strength}
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--probe", action="store_true")
    args = parser.parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be empty")
    output.mkdir(parents=True, exist_ok=True)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    import bpy
    bpy.ops.wm.open_mainfile(filepath=str(source), use_scripts=False)
    rig = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE" and "index_01_l" in obj.data.bones)
    report = {"source": source.name, "source_sha256_before": before, "bone_count": len(rig.data.bones),
              "rest": {b.name: {"head": list(b.head_local), "tail": list(b.tail_local)} for b in rig.data.bones if b.name.startswith(FINGERS + ("hand",))}}
    report["checks"] = check_grips(bpy, rig)
    if not args.probe:
        report["renders"] = render_fixture(bpy, rig, output)
        bpy.ops.wm.save_as_mainfile(filepath=str(output / "hand-fixture.blend"))
    report["source_sha256_after"] = hashlib.sha256(source.read_bytes()).hexdigest()
    exiger(before == report["source_sha256_after"], "source changed")
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("HAND CHECKS OK", f"{len(FINGERS) * 3} finger bones per hand, both hands:",
          ", ".join(name for name, value in report["checks"].items() if value is True))
    print("SOURCE UNCHANGED", report["source_sha256_after"])
    bpy.ops.wm.quit_blender()


def exiger(condition, controle):
    """Lève RuntimeError si le contrôle de prise nommé échoue."""
    if not condition:
        raise RuntimeError(f"Hand grip check failed: {controle}")


def check_grips(bpy, rig):
    from mathutils import Quaternion
    original = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
    results = []
    try:
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
        for side in ("l", "r"):
            names = {f"{finger}_{segment:02d}_{side}" for finger in FINGERS for segment in (1, 2, 3)}
            untouched = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones if bone.name not in names}
            full = apply_hand_grip(rig, side, 1, "sword")
            matrices = {name: rig.pose.bones[name].matrix_basis.copy() for name in names}
            apply_hand_grip(rig, side, 2, "sword")
            exiger(all(matrix_error(matrices[name], rig.pose.bones[name].matrix_basis) < 1e-6 for name in names), "upper clamp")
            apply_hand_grip(rig, side, 1, "sword")
            exiger(all(matrix_error(matrices[name], rig.pose.bones[name].matrix_basis) < 1e-6 for name in names), "accumulation")
            exiger(all(matrix_error(matrix, rig.pose.bones[name].matrix_basis) < 1e-6 for name, matrix in untouched.items()), "nonfinger changed")
            hand = rig.pose.bones[f"hand_{side}"]
            hand.rotation_mode = "QUATERNION"
            hand.rotation_quaternion = Quaternion((0.2, 0.6, 0.8), 0.73)
            apply_hand_grip(rig, side, 1, "sword")
            exiger(all(matrix_error(matrices[name], rig.pose.bones[name].matrix_basis) < 1e-6 for name in names), "posed parent changed grip")
            hand.matrix_basis.identity()
            for kind in ("sword", "pistol", "fist"):
                apply_hand_grip(rig, side, 1, kind)
                bpy.context.view_layer.update()
                exiger(all(math.isfinite(value) for name in names for row in rig.pose.bones[name].matrix for value in row), "nonfinite matrix")
            apply_hand_grip(rig, side, -1, "sword")
            from mathutils import Matrix
            exiger(all(matrix_error(Matrix.Identity(4), rig.pose.bones[name].matrix_basis) < 1e-6 for name in names), "rest reset")
            results.append(full)
        left, right = results
        exiger(abs(left["palm_normal"][0] + right["palm_normal"][0]) < 1e-4, "left/right mirror x")
        exiger(max(abs(left["palm_normal"][i] - right["palm_normal"][i]) for i in (1, 2)) < 1e-4, "left/right mirror yz")
        return {"pass": True, "clamp": True, "idempotent": True, "reset": True,
                "nonfinger_unchanged": True, "parent_pose_invariant": True, "left_right_mirror": True,
                "grips": results,
                "limits": ["No mesh contact or self-intersection certification", "Grip angles are engineering choices, not motion capture"]}
    finally:
        for name, matrix in original.items():
            rig.pose.bones[name].matrix_basis = matrix
        bpy.context.view_layer.update()


def matrix_error(a, b):
    return max(abs(a[row][col] - b[row][col]) for row in range(4) for col in range(4))


def render_fixture(bpy, rig, output):
    from mathutils import Vector
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.world.color = (0.16, 0.16, 0.16)
    scene.view_settings.view_transform = "AgX"
    body = max((obj for obj in bpy.data.objects if obj.type == "MESH" and "hand_l" in obj.vertex_groups), key=lambda obj: len(obj.data.vertices))
    for obj in bpy.data.objects:
        obj.hide_render = obj != body
    body.hide_render = False
    body.hide_set(False)
    camera_data = bpy.data.cameras.new("hand_camera")
    camera = bpy.data.objects.new("hand_camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 0.235
    light_data = bpy.data.lights.new("hand_softbox", "AREA")
    light = bpy.data.objects.new("hand_softbox", light_data)
    scene.collection.objects.link(light)
    light_data.energy = 3
    light_data.shape = "DISK"
    light_data.size = 0.35
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.012, depth=0.08)
    socket = bpy.context.object
    socket.name = "technical_handle_8cm"
    material = bpy.data.materials.new("technical_handle_blue")
    material.diffuse_color = (0.04, 0.22, 0.55, 1)
    socket.data.materials.append(material)
    renders = []
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    for side in ("l", "r"):
        info = apply_hand_grip(rig, side, 0)
        forward, across, normal = (Vector(info[key]) for key in ("forward", "across", "palm_normal"))
        bases = [rig.data.bones[f"{finger}_01_{side}"].head_local for finger in FINGERS[:4]]
        center = sum(bases, Vector()) / 4
        world_center = rig.matrix_world @ (center + forward * 0.012)
        camera.location = world_center + rig.matrix_world.to_3x3() @ (normal * 0.30 + forward * 0.05 + across * 0.06)
        camera.rotation_euler = (world_center - camera.location).to_track_quat("-Z", "Y").to_euler()
        light.location = camera.location + Vector((0, 0, 0.15))
        light.rotation_euler = (world_center - light.location).to_track_quat("-Z", "Y").to_euler()
        socket.location = rig.matrix_world @ (center + normal * 0.025 + forward * 0.01)
        socket.rotation_euler = (rig.matrix_world.to_3x3() @ across).to_track_quat("Z", "Y").to_euler()
        for label, kind, strength in (("rest", "sword", 0), ("sword", "sword", 1), ("pistol", "pistol", 1)):
            grip = apply_hand_grip(rig, side, strength, kind)
            socket.hide_render = label == "rest"
            bpy.context.view_layer.update()
            grip["tip_to_socket_axis_m"] = {}
            for finger in FINGERS:
                tip = rig.matrix_world @ rig.pose.bones[f"{finger}_03_{side}"].tail
                axis = (rig.matrix_world.to_3x3() @ across).normalized()
                delta = tip - socket.location
                grip["tip_to_socket_axis_m"][finger] = (delta - axis * delta.dot(axis)).length
            filename = f"hand_{side}_{label}.png"
            scene.render.filepath = str(output / filename)
            bpy.ops.render.render(write_still=True)
            renders.append({"file": filename, "grip": grip})
        apply_hand_grip(rig, side, 0)
    return renders


if __name__ == "__main__":
    main()

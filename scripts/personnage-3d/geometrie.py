"""Primitives de géométrie de vêtement et d'accessoire : maillages skinnés sur le squelette commun, inscrits au
manifeste de production (`pieces`, `components`), coques fermées, coques à double nappe, grilles épaisses, sondes de
surface et de recouvrement."""
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def principled(mat):
    return next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")


def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    shader = principled(mat)
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .87
    shader.inputs["Metallic"].default_value = metallic
    mat.use_backface_culling = False
    return mat


def own_material(original, name, color):
    result = original.copy()
    result.name = name
    result.diffuse_color = (*color, 1)
    principled(result).inputs["Base Color"].default_value = result.diffuse_color
    return result


def mesh(name, vertices, faces, mat, rig, weights, manifest, component, label, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    for group_name in sorted({key for item in weights for key in item}):
        group = obj.vertex_groups.new(name=group_name)
        for index, values in enumerate(weights):
            if values.get(group_name, 0) > 0:
                group.add([index], values[group_name], "REPLACE")
    mod = obj.modifiers.new("Common skeleton", "ARMATURE")
    mod.object = rig
    for face in data.polygons:
        face.use_smooth = smooth
    manifest["pieces"][name] = {"node": name, "mesh": name, "component": component,
                                "headVariant": None, "hiddenBy": [], "label_fr": label}
    manifest["components"][component] = {"id": component, "label_fr": label}
    return obj


def shell(name, rows, angles, mat, rig, weight_at, manifest, component, label, caps=False):
    vertices = [(rx * math.sin(a), cy - ry * math.cos(a), z)
                for z, rx, ry, cy in rows for a in angles]
    stride = len(angles)
    faces = [(row * stride + col, row * stride + col + 1,
              (row + 1) * stride + col + 1, (row + 1) * stride + col)
             for row in range(len(rows) - 1) for col in range(stride - 1)]
    if caps:
        faces.extend([tuple(range(stride - 1, -1, -1)),
                      tuple((len(rows) - 1) * stride + n for n in range(stride))])
    return mesh(name, vertices, faces, mat, rig,
                [weight_at(Vector(v)) for v in vertices], manifest, component, label)


def bone_tube(name, bone_name, radii, mat, rig, manifest, component, label):
    bone = rig.data.bones[bone_name]
    start, end = bone.head_local, bone.tail_local
    axis = (end - start).normalized()
    front = Vector((0, -1, 0))
    normal = axis.cross(front).normalized()
    vertices = []
    for fraction, radius in radii:
        center = start.lerp(end, fraction)
        vertices.extend([center + radius * (math.cos(a) * front + math.sin(a) * normal)
                         for a in [2 * math.pi * i / 10 for i in range(10)]])
    faces = [(r * 10 + i, r * 10 + (i + 1) % 10,
              (r + 1) * 10 + (i + 1) % 10, (r + 1) * 10 + i)
             for r in range(len(radii) - 1) for i in range(10)]
    faces.extend([tuple(range(9,-1,-1)),tuple((len(radii)-1)*10+i for i in range(10))])
    mesh(name, vertices, faces, mat, rig, [{bone_name: 1} for v in vertices],
         manifest, component, label)


def patch(name, points, mat, rig, bone, manifest, component, label):
    return mesh(name, points, [tuple(range(len(points)))], mat, rig,
                [{bone: 1} for p in points], manifest, component, label)


def ring_shape(z,rx,ry,cx,cy,pinch=0,count=16):
    points=[]
    for i in range(count):
        a=2*math.pi*i/count
        crease=1-pinch*math.exp(-((i-2)/.85)**2)-pinch*math.exp(-((i-(count-2))/.85)**2)
        valley = .014*math.sin(a)-.010*math.cos(a) if pinch >= .20 else 0
        points.append((cx+rx*math.sin(a)*crease,cy-ry*math.cos(a)*crease,
                       z+.003*math.cos(2*a)+valley))
    return points



def closed_shell(name,rows,mat,rig,manifest,component,label,bone="head",thickness=.004,count=16):
    outer=[p for row in rows for p in ring_shape(*row,count=count)]
    inner=[]
    for z,rx,ry,cx,cy,pinch in rows:
        inner.extend(ring_shape(z-.003 if z==rows[-1][0] else z,
                                rx-thickness,ry-thickness,cx,cy,pinch,count))
    total=len(outer)
    faces=[]
    for row in range(len(rows)-1):
        for i in range(count):
            j=(i+1)%count
            a=row*count+i
            b=row*count+j
            faces.append((a,b,b+count,a+count))
            faces.append((total+a,total+a+count,total+b+count,total+b))
    for i in range(count):
        j=(i+1)%count
        faces.append((i,total+i,total+j,j))
    last=(len(rows)-1)*count
    vertices = outer+inner
    z,rx,ry,cx,cy,pinch = rows[-1]
    center_outer = len(vertices)
    vertices.append((cx,cy,z-.024))
    center_inner = len(vertices)
    vertices.append((cx,cy,z-.027))
    for i in range(count):
        j=(i+1)%count
        faces.extend([(last+i,last+j,center_outer),
                      (total+last+j,total+last+i,center_inner)])
    return mesh(name,vertices,faces,mat,rig,[{bone:1}]*len(vertices),manifest,component,label)


def section_points(objects,z,count=16):
    points=[]
    for obj in objects:
        for edge in obj.data.edges:
            a,b=[obj.matrix_world@obj.data.vertices[i].co for i in edge.vertices]
            if (a.z-z)*(b.z-z)<0:
                points.append(a.lerp(b,(z-a.z)/(b.z-a.z)))
    if len(points)<count:
        raise RuntimeError(f"Insufficient head section at {z}")
    return points


def opening(objects,z,clearance=.0008,count=16):
    points=section_points(objects,z,count)
    vertices=[]
    for i in range(count):
        angle=2*math.pi*i/count
        normals=[Vector((math.sin(angle+d),-math.cos(angle+d)))
                 for d in (-math.pi/count,math.pi/count)]
        supports=[max(n.x*p.x+n.y*p.y for p in points)+clearance for n in normals]
        a,b=normals
        det=a.x*b.y-a.y*b.x
        vertices.append(Vector(((supports[0]*b.y-a.y*supports[1])/det,
                                (a.x*supports[1]-supports[0]*b.x)/det,z)))
    return vertices


def surface_tree(obj):
    return BVHTree.FromPolygons([v.co.copy() for v in obj.data.vertices],
                               [list(p.vertices) for p in obj.data.polygons])


def surface_hit(tree,origin,direction):
    point,normal,index,distance=tree.ray_cast(Vector(origin),Vector(direction))
    if point is None:
        raise RuntimeError(f"Missing attachment surface at {origin}")
    return point,normal


def hull_clearances(points,ring):
    values=sorted({(float(p.x),float(p.y)) for p in points})
    def cross(a,b,c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    halves=[]
    for ordered in (values,list(reversed(values))):
        half=[]
        for p in ordered:
            while len(half)>1 and cross(half[-2],half[-1],p)<=0:
                half.pop()
            half.append(p)
        halves.append(half[:-1])
    hull=[Vector(p) for p in halves[0]+halves[1]]
    distances=[]
    for point in ring:
        p=Vector((point.x,point.y))
        nearest=[]
        for a,b in zip(hull,hull[1:]+hull[:1]):
            edge=b-a
            t=max(0,min(1,(p-a).dot(edge)/edge.length_squared))
            nearest.append((p-a-edge*t).length)
        distances.append(min(nearest))
    return {"minimum_m":min(distances),"maximum_m":max(distances)}


def normalized(values):
    selected = sorted(((name, value) for name, value in values.items() if value > 1e-8),
                      key=lambda item: item[1], reverse=True)[:4]
    total = sum(value for _, value in selected)
    return {name: value / total for name, value in selected}

def interpolate(first, second, fraction):
    a, normal_a, weights_a = first
    b, normal_b, weights_b = second
    names = set(weights_a) | set(weights_b)
    return (a.lerp(b, fraction), normal_a.lerp(normal_b, fraction).normalized(),
            normalized({name: weights_a.get(name, 0)*(1-fraction)+weights_b.get(name, 0)*fraction for name in names}))


def clipped(polygon, distance):
    result = []
    for first, second in zip(polygon, polygon[1:]+polygon[:1]):
        a, b = distance(first[0]), distance(second[0])
        if a >= -1e-8:
            result.append(first)
        if (a >= 0) != (b >= 0):
            result.append(interpolate(first, second, a/(a-b)))
    return result

def double_shell(name, samples, triangles, material, rig, manifest, component, label, thickness=.002):
    points, normals, weights = [list(items) for items in zip(*samples)]
    for vertex in range(len(points)):
        incident = {index for index, triangle in enumerate(triangles) if vertex in triangle}
        fans = []
        while incident:
            fan, todo = set(), {min(incident)}
            while todo:
                index = todo.pop()
                if index in fan:
                    continue
                fan.add(index)
                todo.update(other for other in incident-fan
                            if len(set(triangles[index]) & set(triangles[other])) >= 2)
            incident.difference_update(fan)
            fans.append(fan)
        for fan in fans[1:]:
            replacement = len(points)
            points.append(points[vertex].copy())
            normals.append(normals[vertex].copy())
            weights.append(dict(weights[vertex]))
            for index in fan:
                triangles[index] = tuple(replacement if old == vertex else old for old in triangles[index])
    half = len(points)
    faces, kinds, edges = [], [], {}
    for triangle in triangles:
        faces.extend((triangle, tuple(half+index for index in reversed(triangle))))
        kinds.extend((0, 1))
        for a, b in zip(triangle, triangle[1:]+triangle[:1]):
            edge = tuple(sorted((a, b)))
            edges[edge] = edges.get(edge, 0)+1
    assert max(edges.values()) <= 2, (name, "Nonmanifold support")
    for (a, b), count in edges.items():
        if count == 1:
            faces.extend(((a, half+a, half+b), (a, half+b, b)))
            kinds.extend((2, 2))
    obj = mesh(name, points+[point-normal*thickness for point, normal in zip(points, normals)],
               faces, material, rig, weights+weights, manifest, component, label)
    obj.data.materials.append(material)
    obj.data.materials.append(material)
    for polygon, kind in zip(obj.data.polygons, kinds):
        polygon.material_index = kind
        polygon.use_smooth = kind != 2
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def thick_grid(name, rows, rig, manifest, materials, weight_at, component, label, thickness=.004, omit_cells=None):
    height, width = len(rows), len(rows[0])
    outside = [Vector(p) for row in rows for p in row]
    inside = []
    for p in outside:
        radial = Vector((p.x, p.y+.005, 0)).normalized()
        inside.append(p-radial*thickness)
    count = len(outside)
    faces, kinds, edge_counts = [], [], {}
    for row in range(height-1):
        for column in range(width-1):
            if omit_cells and (row,column) in omit_cells:
                continue
            a = row*width+column
            outer=(a,a+1,a+width+1,a+width)
            for triangle in ((outer[0],outer[1],outer[2]),(outer[0],outer[2],outer[3])):
                faces.extend([triangle,tuple(count+i for i in reversed(triangle))])
                kinds.extend([0,1])
            for first,second in zip(outer,outer[1:]+outer[:1]):
                edge=tuple(sorted((first,second)))
                edge_counts[edge]=edge_counts.get(edge,0)+1
    for (a,b),uses in edge_counts.items():
        if uses==1:
            faces.extend([(a,count+a,count+b),(a,count+b,b)])
            kinds.extend([2,2])
    vertices = outside+inside
    outside_weights=[weight_at(p) for p in outside]
    result = mesh(name, vertices, faces, materials[0], rig,
                  outside_weights+outside_weights, manifest, component, label)
    for material in materials[1:]:
        result.data.materials.append(material)
    for polygon, kind in zip(result.data.polygons, kinds):
        polygon.material_index = kind
    bm = bmesh.new()
    bm.from_mesh(result.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(result.data)
    bm.free()
    return result


def tree(obj, evaluated=False, centers=False):
    if evaluated:
        current = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        data = current.to_mesh()
        result = BVHTree.FromPolygons([current.matrix_world@v.co for v in data.vertices],
                                     [list(p.vertices) for p in data.polygons])
        points = [current.matrix_world@v.co for v in data.vertices]
        locations = [sum((points[i] for i in p.vertices),Vector())/len(p.vertices) for p in data.polygons]
        current.to_mesh_clear()
        return (result,locations) if centers else result
    return BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],
                               [list(p.vertices) for p in obj.data.polygons])


def shell_overlap(obj):
    current=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    data=current.to_mesh()
    points=[current.matrix_world@v.co for v in data.vertices]
    surfaces=[BVHTree.FromPolygons(points,[tuple(face.vertices) for face in data.polygons
                                          if face.material_index==kind],all_triangles=True)
              for kind in (0,1)]
    count=len(surfaces[0].overlap(surfaces[1]))
    current.to_mesh_clear()
    return count

"""Main-thread Blender modeling with validated geometry and rollback."""
import math
import bpy
from . import materials

FIELDS = {'op', 'name', 'primitive', 'parent', 'location', 'rotation', 'scale', 'color', 'material', 'bevel', 'smooth', 'subdivision', 'vertices', 'faces', 'points', 'radius', 'cyclic'}
PRIMITIVES = {'cube', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'empty', 'mesh', 'curve'}
STYLE = {'color', 'material', 'bevel', 'smooth', 'subdivision'}

def name(value):
    if not isinstance(value, str) or not value.strip() or len(value.encode('utf-8')) > 63 or any(ord(c) < 32 or ord(c) == 127 for c in value): raise ValueError('Invalid object name.')
    return value

def number(value, low, high, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high or (integer and int(value) != value): raise ValueError('Invalid modeling value.')
    return value

def vector(value, size, maximum, positive=False):
    if not isinstance(value, list) or len(value) != size: raise ValueError('Invalid transform.')
    for n in value:
        number(n, -maximum, maximum)
        if positive and n <= 0: raise ValueError('Scale must be positive.')
    return value

def validate(plan):
    if not isinstance(plan, dict) or not isinstance(plan.get('summary'), str) or not 1 <= len(plan['summary']) <= 500: raise ValueError('Invalid modeling plan.')
    operations = plan.get('operations')
    if not isinstance(operations, list) or not 1 <= len(operations) <= 80: raise ValueError('Use a smaller modeling request.')
    created = set()
    total_vertices = total_faces = 0
    for o in operations:
        if not isinstance(o, dict) or set(o) - FIELDS or o.get('op') not in ('create', 'update'): raise ValueError('Unsupported modeling operation.')
        target = name(o.get('name'))
        if o['op'] == 'create':
            if o.get('primitive') not in PRIMITIVES or target in created: raise ValueError('Invalid primitive or duplicate name.')
            created.add(target)
            if 'parent' in o and name(o['parent']) == target: raise ValueError('An object cannot parent itself.')
        elif set(o).intersection({'primitive', 'parent', 'vertices', 'faces', 'points', 'radius', 'cyclic'}) or not set(o).intersection(STYLE | {'location', 'rotation', 'scale'}): raise ValueError('Invalid object update.')
        for key, maximum, positive in [('location', 100000, False), ('rotation', 36000, False), ('scale', 10000, True), ('color', 1, False)]:
            if key in o:
                vector(o[key], 4 if key == 'color' else 3, maximum, positive)
                if key == 'color' and any(n < 0 for n in o[key]): raise ValueError('Invalid color.')
        if 'bevel' in o: number(o['bevel'], 0, 10)
        if 'subdivision' in o: number(o['subdivision'], 0, 2, True)
        if 'smooth' in o and not isinstance(o['smooth'], bool): raise ValueError('Invalid smoothing.')
        if 'material' in o:
            m = o['material']
            if not isinstance(m, dict) or set(m) - {'type', 'kind', 'color', 'roughness', 'grainAxis', 'grainScale'} or m.get('type', m.get('kind')) not in ('wood', 'metal', 'fabric', 'plastic', 'glass', 'stone', 'paint'): raise ValueError('Invalid material.')
            if 'color' in m:
                vector(m['color'], 4, 1)
                if any(n < 0 for n in m['color']): raise ValueError('Invalid material color.')
            if 'grainScale' in m: vector(m['grainScale'], 3, 1000, True)
            if 'roughness' in m: number(m['roughness'], 0, 1)
            if 'grainAxis' in m and m['grainAxis'] not in ('X', 'Y', 'Z'): raise ValueError('Invalid grain axis.')
        if o.get('primitive') == 'mesh':
            vertices, faces = o.get('vertices'), o.get('faces')
            if not isinstance(vertices, list) or not 3 <= len(vertices) <= 2048 or not isinstance(faces, list) or not 1 <= len(faces) <= 4096: raise ValueError('Invalid custom mesh.')
            for v in vertices: vector(v, 3, 100000)
            for face in faces:
                if not isinstance(face, list) or not 3 <= len(face) <= 32: raise ValueError('Invalid mesh face.')
                for index in face: number(index, 0, len(vertices)-1, True)
                if len(set(face)) != len(face): raise ValueError('Repeated mesh vertex.')
            total_vertices += len(vertices)
            total_faces += len(faces)
        elif 'vertices' in o or 'faces' in o: raise ValueError('Mesh geometry requires mesh primitive.')
        if o.get('primitive') == 'curve':
            if not isinstance(o.get('points'), list) or not 2 <= len(o['points']) <= 128: raise ValueError('Invalid curved part.')
            for point in o['points']: vector(point, 3, 100000)
            number(o.get('radius'), .000001, 10)
            if 'cyclic' in o and not isinstance(o['cyclic'], bool): raise ValueError('Invalid curve closure.')
        elif set(o).intersection({'points', 'radius', 'cyclic'}): raise ValueError('Curve geometry requires curve primitive.')
    if total_vertices > 8192 or total_faces > 8192: raise ValueError('Split this detailed model into smaller requests.')
    return operations

def _modifier(obj, label, kind, changed):
    existing = obj.modifiers.get(label)
    if existing is not None and existing.type != kind: raise ValueError('Modifier name conflicts with ' + label)
    if existing is None:
        existing = obj.modifiers.new(label, kind)
        changed.append((obj, existing, None))
    else:
        props = ('width', 'segments') if kind == 'BEVEL' else ('levels', 'render_levels')
        changed.append((obj, existing, {key: getattr(existing, key) for key in props}))
    return existing

def execute(context, plan):
    from mathutils import Matrix
    operations = validate(plan)
    if context.mode != 'OBJECT': raise ValueError('Switch Blender to Object Mode and send the request again.')
    available = {obj.name: obj.type for obj in context.scene.objects}
    for o in operations:
        if o['op'] == 'create':
            if o['name'] in bpy.data.objects or o['name'] in available: raise ValueError('An object named ' + o['name'] + ' already exists. Request a different name.')
            if 'parent' in o and o['parent'] not in available: raise ValueError('Parent ' + o['parent'] + ' was not found.')
            available[o['name']] = 'EMPTY' if o['primitive'] == 'empty' else 'CURVE' if o['primitive'] == 'curve' else 'MESH'
        elif o['name'] not in available: raise ValueError('Object ' + o['name'] + ' was not found. Read the scene and try again.')
        kind = available[o['name']]
        if set(o).intersection(STYLE) and kind not in ('MESH', 'CURVE'): raise ValueError('Surface changes require a mesh or curve.')
        if ('subdivision' in o or 'smooth' in o or 'bevel' in o) and kind != 'MESH': raise ValueError('Mesh modifiers require a mesh; curves are already smooth.')
        if o['op'] == 'update' and 'subdivision' in o and o['name'] in context.scene.objects and len(context.scene.objects[o['name']].data.polygons) * (4 ** o['subdivision']) > 250000: raise ValueError('Subdivision would make this object too heavy. Use a lower level.')
    created, backups, made_materials, changed_modifiers, copied_data = [], {}, [], [], []
    selected, active = list(context.selected_objects), context.view_layer.objects.active
    try:
        for o in operations:
            if o['op'] == 'create':
                primitive = o['primitive']
                if primitive in ('empty', 'mesh', 'curve'):
                    data = None
                    if primitive == 'mesh':
                        data = bpy.data.meshes.new(o['name'])
                        try:
                            data.from_pydata(o['vertices'], [], o['faces'])
                            data.validate(verbose=False)
                            data.update()
                        except Exception:
                            bpy.data.meshes.remove(data)
                            raise
                    if primitive == 'curve':
                        data = bpy.data.curves.new(o['name'], 'CURVE')
                        try:
                            data.dimensions = '3D'
                            data.resolution_u = 16
                            data.bevel_depth = o['radius']
                            data.bevel_resolution = 4
                            data.use_fill_caps = True
                            spline = data.splines.new('BEZIER')
                            spline.bezier_points.add(len(o['points'])-1)
                            for point, co in zip(spline.bezier_points, o['points']):
                                point.co = co
                                point.handle_left_type = point.handle_right_type = 'AUTO'
                            spline.use_cyclic_u = o.get('cyclic', False)
                        except Exception:
                            bpy.data.curves.remove(data)
                            raise
                    obj = bpy.data.objects.new(o['name'], data)
                    created.append(obj)
                    context.scene.collection.objects.link(obj)
                else:
                    if primitive == 'cube': bpy.ops.mesh.primitive_cube_add()
                    elif primitive == 'sphere': bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24)
                    elif primitive == 'cylinder': bpy.ops.mesh.primitive_cylinder_add(vertices=48)
                    elif primitive == 'cone': bpy.ops.mesh.primitive_cone_add(vertices=48)
                    elif primitive == 'torus': bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=16, major_radius=1, minor_radius=.25)
                    elif primitive == 'plane': bpy.ops.mesh.primitive_plane_add()
                    obj = context.object
                    created.append(obj)
                    obj.name = o['name']
                if 'parent' in o: obj.parent = context.scene.objects[o['parent']]
            else:
                obj = context.scene.objects[o['name']]
                if obj not in created and obj not in backups:
                    backups[obj] = (obj.location.copy(), obj.rotation_euler.copy(), obj.rotation_mode, obj.rotation_quaternion.copy(), obj.rotation_axis_angle[:], obj.scale.copy(), obj.data)
                    if set(o).intersection({'color', 'material', 'smooth'}):
                        obj.data = obj.data.copy()
                        copied_data.append(obj.data)
                elif obj in backups and set(o).intersection({'color', 'material', 'smooth'}) and obj.data is backups[obj][-1]:
                    obj.data = obj.data.copy()
                    copied_data.append(obj.data)
            if 'location' in o: obj.location = o['location']
            if 'rotation' in o:
                obj.rotation_mode = 'XYZ'
                obj.rotation_euler = [math.radians(n) for n in o['rotation']]
            if 'scale' in o: obj.scale = o['scale']
            if o['op'] == 'create' and obj.type == 'MESH' and ('bevel' in o or 'material' in o):
                obj.data.transform(Matrix.Diagonal((*obj.scale, 1)))
                obj.scale = (1, 1, 1)
            if 'smooth' in o:
                for polygon in obj.data.polygons: polygon.use_smooth = o['smooth']
            if 'bevel' in o:
                mod = _modifier(obj, 'SkyData Bevel', 'BEVEL', changed_modifiers)
                mod.width, mod.segments = o['bevel'], 4
            if 'subdivision' in o:
                mod = _modifier(obj, 'SkyData Subdivision', 'SUBSURF', changed_modifiers)
                mod.levels = mod.render_levels = o['subdivision']
            if 'color' in o or 'material' in o:
                mat = materials.make(obj.name, o.get('material', {'type': 'plastic'}), o.get('color'))
                made_materials.append(mat)
                obj.data.materials.clear()
                obj.data.materials.append(mat)
        context.view_layer.update()
    except Exception:
        for obj, modifier, props in reversed(changed_modifiers):
            if props is None: obj.modifiers.remove(modifier)
            else:
                for key, value in props.items(): setattr(modifier, key, value)
        for obj, (location, rotation, mode, quaternion, axis_angle, scale, data) in backups.items():
            obj.location, obj.rotation_mode, obj.rotation_euler, obj.scale, obj.data = location, mode, rotation, scale, data
            obj.rotation_quaternion, obj.rotation_axis_angle = quaternion, axis_angle
        for obj in reversed(created):
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data is not None and data.users == 0:
                (bpy.data.meshes if isinstance(data, bpy.types.Mesh) else bpy.data.curves).remove(data)
        for data in copied_data:
            if data.users == 0: (bpy.data.meshes if isinstance(data, bpy.types.Mesh) else bpy.data.curves).remove(data)
        for mat in made_materials:
            if mat.users == 0: bpy.data.materials.remove(mat)
        raise
    finally:
        for obj in context.selected_objects: obj.select_set(False)
        for obj in selected:
            if obj.name in context.scene.objects: obj.select_set(True)
        context.view_layer.objects.active = active
    return str(len(created)) + ' objects created; ' + str(len(backups)) + ' objects updated. Use Material Preview to see surface textures.'

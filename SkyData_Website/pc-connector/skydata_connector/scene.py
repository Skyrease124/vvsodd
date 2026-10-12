"""Called only by Blender's main-thread timer; never by the HTTPS thread."""
import math

def label(value, maximum=128):
    return ''.join(c for c in str(value) if ord(c) >= 32 and ord(c) != 127)[:maximum]

def vector(value):
    result = [round(float(n), 6) for n in value]
    if len(result) != 3 or any(not math.isfinite(n) or abs(n) > 1e15 for n in result):
        raise ValueError('Invalid transform')
    return result

def snapshot(context):
    scene = context.scene
    selected = {obj for obj in scene.objects if obj.select_get(view_layer=context.view_layer)}
    active = context.view_layer.objects.active
    objects = []
    for obj in scene.objects:
        if len(objects) >= 100:
            break
        objects.append({'name': label(obj.name), 'type': label(obj.type, 32),
            'location': vector(obj.location), 'rotation': vector(obj.rotation_euler),
            'scale': vector(obj.scale), 'selected': obj in selected})
    total = len(scene.objects)
    return {'name': label(scene.name), 'totalObjects': total,
        'selectedObjects': sum(1 for obj in scene.objects if obj in selected),
        'activeObject': label(active.name) if active else None, 'frame': scene.frame_current,
        'objects': objects, 'truncated': total > len(objects)}

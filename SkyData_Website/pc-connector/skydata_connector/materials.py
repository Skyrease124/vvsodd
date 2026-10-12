"""Blender procedural surfaces; no downloads or external texture files."""
import bpy

def make(name, spec, fallback=None):
    kind = spec.get('type', spec.get('kind', 'plastic'))
    defaults = {'wood': [.32, .14, .055, 1], 'metal': [.55, .57, .6, 1], 'fabric': [.16, .22, .3, 1], 'plastic': [.35, .35, .35, 1], 'glass': [.92, .96, 1, 1], 'stone': [.35, .34, .32, 1], 'paint': [.35, .35, .35, 1]}
    color = spec.get('color', fallback or defaults[kind])
    mat = bpy.data.materials.new('SkyData ' + name)
    try:
        mat.diffuse_color = color
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = color
        shader.inputs['Roughness'].default_value = spec.get('roughness', {'wood': .4, 'metal': .22, 'fabric': .85, 'plastic': .4, 'glass': .08, 'stone': .8, 'paint': .4}[kind])
        if kind == 'metal': shader.inputs['Metallic'].default_value = 1
        if kind == 'glass':
            shader.inputs['Transmission Weight'].default_value = 1
            shader.inputs['IOR'].default_value = 1.45
        if kind in ('wood', 'fabric', 'stone'):
            coordinates = nodes.new('ShaderNodeTexCoord')
            mapping = nodes.new('ShaderNodeVectorMath')
            mapping.operation = 'MULTIPLY'
            stretch = [24, 24, 24] if kind == 'wood' else [1, 1, 1]
            if kind == 'wood': stretch['XYZ'.index(spec.get('grainAxis', 'Z'))] = .6
            mapping.inputs[1].default_value = spec.get('grainScale', stretch)
            links.new(coordinates.outputs['Generated'], mapping.inputs[0])
            noise = nodes.new('ShaderNodeTexNoise')
            noise.inputs['Scale'].default_value = 7 if kind == 'wood' else 160 if kind == 'fabric' else 6
            noise.inputs['Detail'].default_value = 3
            noise.inputs['Roughness'].default_value = .65
            links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
            ramp = nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].position = .22
            ramp.color_ramp.elements[0].color = [max(0, n * .55) for n in color[:3]] + [color[3]]
            ramp.color_ramp.elements[1].position = .78
            ramp.color_ramp.elements[1].color = [min(1, n * 1.18) for n in color[:3]] + [color[3]]
            links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
            links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
            bump = nodes.new('ShaderNodeBump')
            bump.inputs['Strength'].default_value = .22 if kind == 'wood' else .12
            bump.inputs['Distance'].default_value = .0006 if kind == 'wood' else .0003
            links.new(noise.outputs['Fac'], bump.inputs['Height'])
            links.new(bump.outputs['Normal'], shader.inputs['Normal'])
            if kind == 'wood': shader.inputs['Coat Weight'].default_value = .12
        return mat
    except Exception:
        bpy.data.materials.remove(mat)
        raise

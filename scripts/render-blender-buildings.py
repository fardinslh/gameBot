import bpy
import bmesh
import math
import os
import sys

# =============================================================================
# CROWN & COIN - ARTISAN 3D PROCEDURAL BUILDINGS GENERATOR (BLENDER 5.2.1 LTS)
# =============================================================================
# Generates 3D stylized low-poly building models and renders them in Cycles
# with the EXACT same lighting rig, materials, camera pitch (45 deg ortho),
# and AgX high-contrast color management as the terrain map (kingdom-base-v6).
# =============================================================================

argv = sys.argv
args = []
if "--" in argv:
    args = argv[argv.index("--") + 1:]

TARGET_BUILDING = None
TARGET_TIER = None
SAMPLES = 20
OUTPUT_DIR = os.path.abspath(os.path.join("art-source", "buildings"))

for arg in args:
    if arg.startswith("--building="):
        TARGET_BUILDING = arg.split("=")[1]
    elif arg.startswith("--tier="):
        TARGET_TIER = int(arg.split("=")[1])
    elif arg.startswith("--samples="):
        SAMPLES = int(arg.split("=")[1])
    elif arg.startswith("--output="):
        OUTPUT_DIR = os.path.abspath(arg.split("=")[1])

os.makedirs(OUTPUT_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# 1. Reset Scene & World Setup
# -----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

scene.world = bpy.data.worlds.new("KingdomWorld")
scene.world.use_nodes = True
wnodes = scene.world.node_tree.nodes
wlinks = scene.world.node_tree.links
wnodes.clear()

bg = wnodes.new(type='ShaderNodeBackground')
bg.inputs['Color'].default_value = (0.32, 0.52, 0.88, 1.0) # Radiant alpine sky fill
bg.inputs['Strength'].default_value = 0.42
wout = wnodes.new(type='ShaderNodeOutputWorld')
wlinks.new(bg.outputs['Background'], wout.inputs['Surface'])

# -----------------------------------------------------------------------------
# 2. Render Settings & Color Management
# -----------------------------------------------------------------------------
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.render.film_transparent = True
scene.render.resolution_x = 512
scene.render.resolution_y = 512

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - High Contrast'
scene.view_settings.exposure = 0.02
scene.view_settings.gamma = 1.0

# -----------------------------------------------------------------------------
# 3. Exact Isometric Camera & Radiant Golden-Hour Lighting Rig
# -----------------------------------------------------------------------------
pitch_rad = math.radians(45.0)
cam_dist = 40.0
cam_data = bpy.data.cameras.new("IsometricCamera")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 5.4

cam_obj = bpy.data.objects.new("IsometricCamera", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_center_z = 1.30
cam_obj.location = (0.0, -cam_dist * math.cos(pitch_rad), cam_dist * math.sin(pitch_rad) + cam_center_z)
cam_obj.rotation_euler = (pitch_rad, 0.0, 0.0)

# Lighting
sun_key_data = bpy.data.lights.new(name="SunKey", type='SUN')
sun_key_data.energy = 5.2
sun_key_data.color = (1.0, 0.88, 0.68)
sun_key_data.angle = math.radians(2.2)
sun_key = bpy.data.objects.new("SunKey", sun_key_data)
scene.collection.objects.link(sun_key)
sun_key.rotation_euler = (math.radians(-44.0), math.radians(-30.0), math.radians(12.4))

sun_fill_data = bpy.data.lights.new(name="SunFill", type='SUN')
sun_fill_data.energy = 1.35
sun_fill_data.color = (0.28, 0.48, 0.88)
sun_fill_data.angle = math.radians(18.0)
sun_fill = bpy.data.objects.new("SunFill", sun_fill_data)
scene.collection.objects.link(sun_fill)
sun_fill.rotation_euler = (math.radians(28.8), math.radians(20.5), math.radians(5.3))

sun_bounce_data = bpy.data.lights.new(name="SunBounce", type='SUN')
sun_bounce_data.energy = 0.55
sun_bounce_data.color = (0.35, 0.48, 0.22)
sun_bounce = bpy.data.objects.new("SunBounce", sun_bounce_data)
scene.collection.objects.link(sun_bounce)
sun_bounce.rotation_euler = (math.radians(135.0), 0.0, 0.0)

# Ground Shadow Catcher Plane
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
plane = bpy.context.active_object
plane.name = "ShadowCatcher"
plane.is_shadow_catcher = True

# -----------------------------------------------------------------------------
# 4. Stylized PBR Material Palette
# -----------------------------------------------------------------------------
def create_pbr_shader(name, base_color, roughness=0.65, metallic=0.0, emission=None, emission_strength=1.0, bump_scale=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    out = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    
    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
        
    if bump_scale > 0.0:
        tex = nodes.new(type='ShaderNodeTexCoord')
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 14.0
        bump = nodes.new(type='ShaderNodeBump')
        bump.inputs['Strength'].default_value = bump_scale
        bump.inputs['Distance'].default_value = 0.03
        links.new(tex.outputs['Object'], noise.inputs['Vector'])
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
        
    return mat

mats = {
    'sandstone': create_pbr_shader("Sandstone", (0.56, 0.50, 0.40), roughness=0.68, bump_scale=0.18),
    'sandstone_light': create_pbr_shader("SandstoneLight", (0.68, 0.62, 0.52), roughness=0.62),
    'stone_dark': create_pbr_shader("StoneDark", (0.36, 0.34, 0.32), roughness=0.75, bump_scale=0.20),
    'timber': create_pbr_shader("Timber", (0.34, 0.22, 0.12), roughness=0.75),
    'timber_plank': create_pbr_shader("TimberPlank", (0.50, 0.35, 0.20), roughness=0.70),
    'plaster_cream': create_pbr_shader("PlasterCream", (0.88, 0.84, 0.76), roughness=0.70),
    'roof_blue': create_pbr_shader("RoofBlue", (0.12, 0.28, 0.65), roughness=0.45, bump_scale=0.15),
    'roof_terracotta': create_pbr_shader("RoofTerracotta", (0.70, 0.28, 0.14), roughness=0.55, bump_scale=0.15),
    'roof_slate': create_pbr_shader("RoofSlate", (0.22, 0.23, 0.28), roughness=0.50, bump_scale=0.12),
    'roof_copper': create_pbr_shader("RoofCopper", (0.22, 0.58, 0.52), roughness=0.40),
    'gold': create_pbr_shader("Gold", (1.0, 0.82, 0.18), roughness=0.20, metallic=0.96),
    'iron': create_pbr_shader("Iron", (0.20, 0.20, 0.22), roughness=0.38, metallic=0.85),
    'banner_cobalt': create_pbr_shader("BannerCobalt", (0.12, 0.32, 0.75), roughness=0.65),
    'banner_crimson': create_pbr_shader("BannerCrimson", (0.82, 0.16, 0.16), roughness=0.65),
    'window_glow': create_pbr_shader("WindowGlow", (1.0, 0.80, 0.35), roughness=0.2, emission=(1.0, 0.78, 0.30), emission_strength=3.5),
    'forge_glow': create_pbr_shader("ForgeGlow", (1.0, 0.50, 0.08), roughness=0.1, emission=(1.0, 0.45, 0.05), emission_strength=5.0),
    'water': create_pbr_shader("Water", (0.02, 0.44, 0.58), roughness=0.05),
}

# -----------------------------------------------------------------------------
# 5. Modular Geometric Modeling Primitives
# -----------------------------------------------------------------------------
build_col = bpy.data.collections.new("BuildingModel")
scene.collection.children.link(build_col)

# Root empty for 2.5D isometric orientation
root_empty = bpy.data.objects.new("BuildingRoot", None)
scene.collection.objects.link(root_empty)

def clear_building_collection():
    for obj in list(build_col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    root_empty.rotation_euler = (0, 0, 0)

def add_box(name, size, location, mat_key, rot_z=0.0, parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = (0, 0, rot_z)
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_cylinder(name, radius, height, location, mat_key, segments=16, smooth=True, parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=height)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + height / 2.0)
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_cone(name, radius, height, location, mat_key, segments=16, smooth=False, parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=segments, radius1=radius, radius2=0.0, depth=height)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + height / 2.0)
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_gable_roof(name, width, length, height, location, mat_key, rot_z=0.0, parent=root_empty):
    bm = bmesh.new()
    hw = width * 0.5
    hl = length * 0.5
    v0 = bm.verts.new((-hw, -hl, 0))
    v1 = bm.verts.new((hw, -hl, 0))
    v2 = bm.verts.new((hw, hl, 0))
    v3 = bm.verts.new((-hw, hl, 0))
    v4 = bm.verts.new((0, -hl, height))
    v5 = bm.verts.new((0, hl, height))
    bm.faces.new((v0, v1, v2, v3))
    bm.faces.new((v0, v4, v5, v3))
    bm.faces.new((v1, v2, v5, v4))
    bm.faces.new((v0, v1, v4))
    bm.faces.new((v3, v5, v2))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = (0, 0, rot_z)
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_door(location, width=0.50, height=0.85, rot_z=0.0, parent=root_empty):
    d_x, d_y, d_z = location
    add_box("DoorFrame", (width + 0.12, 0.12, height + 0.08), (d_x, d_y, d_z + (height + 0.08)/2), 'stone_dark', rot_z, parent)
    add_box("DoorWood", (width, 0.08, height), (d_x, d_y + 0.02, d_z + height/2), 'timber', rot_z, parent)
    add_box("DoorHinge1", (width * 0.75, 0.10, 0.04), (d_x, d_y + 0.03, d_z + height * 0.75), 'iron', rot_z, parent)
    add_box("DoorHinge2", (width * 0.75, 0.10, 0.04), (d_x, d_y + 0.03, d_z + height * 0.25), 'iron', rot_z, parent)

def add_window(location, width=0.22, height=0.35, rot_z=0.0, parent=root_empty):
    w_x, w_y, w_z = location
    add_box("WinFrame", (width + 0.08, 0.10, height + 0.08), (w_x, w_y, w_z), 'stone_dark', rot_z, parent)
    add_box("WinGlow", (width, 0.08, height), (w_x, w_y + 0.02, w_z), 'window_glow', rot_z, parent)

def add_chimney(location, width=0.45, height=1.4, parent=root_empty):
    c_x, c_y, c_z = location
    add_box("ChimBody", (width, width, height), (c_x, c_y, c_z + height/2), 'stone_dark', parent=parent)
    add_box("ChimCap", (width + 0.10, width + 0.10, 0.12), (c_x, c_y, c_z + height + 0.06), 'sandstone', parent=parent)
    add_box("ChimPot", (width * 0.5, width * 0.5, 0.20), (c_x, c_y, c_z + height + 0.22), 'roof_terracotta', parent=parent)

def add_banner(location, width=0.38, length=0.90, mat_key='banner_cobalt', emblem_key='gold', rot_z=0.0, parent=root_empty):
    b_x, b_y, b_z = location
    add_box("BanPole", (width + 0.12, 0.05, 0.05), (b_x, b_y, b_z), 'timber', rot_z, parent)
    add_box("BanCloth", (width, 0.02, length), (b_x, b_y - 0.02, b_z - length/2), mat_key, rot_z, parent)
    if emblem_key:
        add_box("BanEmblem", (width * 0.45, 0.03, length * 0.40), (b_x, b_y - 0.025, b_z - length * 0.45), emblem_key, rot_z, parent)

# -----------------------------------------------------------------------------
# 6. Building Implementations (All 9 Types x 5 Tiers)
# -----------------------------------------------------------------------------

def build_castle(tier):
    # Castle: Rotated slightly (-15 deg) so gate faces towards viewer while keeping hexagonal symmetry
    root_empty.rotation_euler = (0, 0, math.radians(-16.0))
    
    base_r = 1.35 + (tier - 1) * 0.14
    keep_r = 1.10 + (tier - 1) * 0.12
    keep_h = 1.85 + (tier - 1) * 0.32
    
    # 1. Base Stepped Stone Plinth
    add_cylinder("CastlePlinth0", base_r + 0.15, 0.22, (0, 0, 0), 'stone_dark', segments=20)
    add_cylinder("CastlePlinth1", base_r, 0.22, (0, 0, 0.22), 'sandstone', segments=20)
    
    # 2. Main Central Keep
    add_cylinder("MainKeep", keep_r, keep_h, (0, 0, 0.44), 'sandstone', segments=20)
    
    # 3. Corbel ring & Battlements
    p_z = 0.44 + keep_h
    add_cylinder("CorbelRing", keep_r + 0.14, 0.16, (0, 0, p_z), 'stone_dark', segments=20)
    add_cylinder("ParapetBase", keep_r + 0.10, 0.10, (0, 0, p_z + 0.16), 'sandstone', segments=20)
    
    num_merlons = 8 + (tier - 1) * 2
    for i in range(num_merlons):
        ang = i * (2 * math.pi / num_merlons)
        mx = (keep_r + 0.05) * math.cos(ang)
        my = (keep_r + 0.05) * math.sin(ang)
        add_box(f"Merlon_{i}", (0.28, 0.16, 0.32), (mx, my, p_z + 0.16 + 0.16), 'sandstone', rot_z=ang)
        
    # 4. Conical Roof
    roof_z = p_z + 0.16
    roof_mat = 'gold' if tier == 5 else 'roof_blue'
    roof_h = 1.35 + (tier - 1) * 0.20
    add_cone("KeepRoof", keep_r + 0.06, roof_h, (0, 0, roof_z), roof_mat, segments=16)
    
    # 5. Finial & Spire Banner
    finial_z = roof_z + roof_h
    add_cylinder("FinialStem", 0.05, 0.35, (0, 0, finial_z), 'gold', segments=8)
    add_cylinder("FinialBall", 0.12, 0.20, (0, 0, finial_z + 0.28), 'gold', segments=12)
    add_banner((0, 0.02, finial_z + 0.32), width=0.45, length=0.85, mat_key='banner_cobalt', emblem_key='gold')
    
    # 6. Arched Gatehouse Entrance
    add_door((0, -keep_r - 0.05, 0.22), width=0.72 + (tier-1)*0.08, height=1.05 + (tier-1)*0.08)
    add_box("EntryStep0", (1.2, 0.35, 0.12), (0, -keep_r - 0.28, 0.06), 'sandstone')
    add_box("EntryStep1", (1.0, 0.30, 0.12), (0, -keep_r - 0.18, 0.18), 'sandstone')
    
    # Windows
    add_window((-keep_r * 0.65, -keep_r * 0.70, 1.45), rot_z=math.radians(40))
    add_window((keep_r * 0.65, -keep_r * 0.70, 1.45), rot_z=math.radians(-40))
    
    # Tier evolutions
    if tier >= 2:
        add_box("Hoarding_L", (0.35, 0.65, 0.38), (-keep_r - 0.08, 0, p_z - 0.22), 'timber')
        add_box("Hoarding_R", (0.35, 0.65, 0.38), (keep_r + 0.08, 0, p_z - 0.22), 'timber')
        
    if tier >= 3:
        for side in [-1.45, 1.45]:
            add_cylinder(f"SideTurret_{side}", 0.55, keep_h * 0.75, (side, -0.30, 0.25), 'sandstone', segments=12)
            add_cone(f"SideRoof_{side}", 0.62, 0.85, (side, -0.30, 0.25 + keep_h * 0.75), 'roof_blue', segments=12)
            add_cylinder(f"SideFinial_{side}", 0.04, 0.25, (side, -0.30, 0.25 + keep_h * 0.75 + 0.85), 'gold', segments=6)
            mid_x = side * 0.5
            add_box(f"Wall_{side}", (abs(side)*0.55, 0.32, keep_h * 0.50), (mid_x, -0.15, 0.25 + keep_h * 0.25), 'sandstone')
            
    if tier >= 4:
        for side in [-1.40, 1.40]:
            add_cylinder(f"RearTurret_{side}", 0.50, keep_h * 0.85, (side, 1.15, 0.25), 'sandstone', segments=12)
            add_cone(f"RearRoof_{side}", 0.56, 0.95, (side, 1.15, 0.25 + keep_h * 0.85), 'roof_blue', segments=12)
            
    if tier >= 5:
        add_cylinder("CentralSovereignSpire", 0.40, 1.15, (0, 0, finial_z + 0.15), 'sandstone_light', segments=12)
        add_cone("GildedApexSpire", 0.46, 1.35, (0, 0, finial_z + 1.30), 'gold', segments=12)
        add_banner((0, -0.08, finial_z + 2.65), width=0.55, length=1.15, mat_key='banner_cobalt', emblem_key='gold')

def build_farm(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    w = 1.80 + (tier - 1) * 0.14
    l = 1.50 + (tier - 1) * 0.12
    h = 1.30 + (tier - 1) * 0.16
    rh = 1.05 + (tier - 1) * 0.14
    
    # 1. Foundation
    add_box("FarmFoundation", (w + 0.12, l + 0.12, 0.25), (0, 0, 0.125), 'stone_dark')
    # 2. Main Wall (Plaster + Timber frame)
    add_box("FarmWalls", (w, l, h), (0, 0, 0.25 + h/2), 'plaster_cream')
    for x in [-w/2, w/2]:
        for y in [-l/2, l/2]:
            add_box(f"CornerPost_{x}_{y}", (0.12, 0.12, h), (x, y, 0.25 + h/2), 'timber')
    add_box("BeltBeam", (w + 0.04, l + 0.04, 0.08), (0, 0, 0.25 + h * 0.55), 'timber')
    # 3. Terracotta Gable Roof
    add_gable_roof("FarmRoof", w + 0.28, l + 0.24, rh, (0, 0, 0.25 + h), 'roof_terracotta')
    # 4. Chimney
    add_chimney((w * 0.35, l * 0.25, 0.25), width=0.42, height=h + rh * 0.85)
    # 5. Door & Windows
    add_door((0, -l/2 - 0.02, 0.25), width=0.50, height=0.85)
    add_window((-w * 0.30, -l/2 - 0.02, 0.25 + h * 0.55))
    add_window((w/2 + 0.02, 0, 0.25 + h * 0.55), rot_z=math.pi/2)
    
    if tier >= 2:
        shed_w = 0.80
        shed_l = l * 0.75
        add_box("ShedPlinth", (shed_w, shed_l, 0.15), (w/2 + shed_w/2, 0, 0.08), 'stone_dark')
        add_box("ShedRoof", (shed_w + 0.08, shed_l + 0.10, 0.06), (w/2 + shed_w/2, 0, 0.25 + h * 0.70), 'timber_plank', rot_z=0.18)
        # Attic dormer
        add_box("Dormer", (0.40, 0.40, 0.32), (0, -l * 0.28, 0.25 + h + 0.38), 'plaster_cream')
        add_window((0, -l * 0.28 - 0.20, 0.25 + h + 0.40), width=0.18, height=0.22)
        
    if tier >= 3:
        wing_w = 0.90
        wing_l = 1.05
        add_box("WingBase", (wing_w + 0.10, wing_l + 0.10, 0.25), (-w/2 - wing_w/2 + 0.15, -l/2 + wing_l/2, 0.125), 'stone_dark')
        add_box("WingWalls", (wing_w, wing_l, h * 1.10), (-w/2 - wing_w/2 + 0.15, -l/2 + wing_l/2, 0.25 + h * 0.55), 'plaster_cream')
        add_gable_roof("WingRoof", wing_l + 0.18, wing_w + 0.18, rh * 0.80, (-w/2 - wing_w/2 + 0.15, -l/2 + wing_l/2, 0.25 + h * 1.10), 'roof_terracotta', rot_z=math.pi/2)
        
    if tier >= 4:
        silo_r = 0.55
        silo_h = h + rh * 0.65
        add_cylinder("GrainSilo", silo_r, silo_h, (w * 0.30, l * 0.45, 0.25), 'stone_dark', segments=16)
        add_cone("SiloRoof", silo_r + 0.06, 0.70, (w * 0.30, l * 0.45, 0.25 + silo_h), 'roof_slate', segments=16)
        add_cylinder("WeatherVane", 0.03, 0.32, (0, 0, 0.25 + h + rh), 'gold', segments=6)
        
    if tier >= 5:
        add_box("GableClockBase", (0.60, 0.30, 0.60), (0, -l * 0.30, 0.25 + h + rh * 0.70), 'sandstone_light')
        add_cylinder("GildedClock", 0.18, 0.06, (0, -l * 0.30 - 0.16, 0.25 + h + rh * 0.70), 'gold', segments=16)

def build_lumber_mill(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    w = 1.90 + (tier - 1) * 0.14
    l = 1.60 + (tier - 1) * 0.12
    h_post = 1.45 + (tier - 1) * 0.16
    
    # 1. Corner Stone Piers
    for x in [-w * 0.42, w * 0.42]:
        for y in [-l * 0.42, l * 0.42]:
            add_cylinder(f"MillPier_{x}_{y}", 0.16, 0.28, (x, y, 0), 'stone_dark', segments=10)
            add_box(f"MillPost_{x}_{y}", (0.15, 0.15, h_post), (x, y, 0.28 + h_post/2), 'timber')
            
    # 2. Beams & Roof
    add_box("LintelF", (w * 0.88, 0.16, 0.16), (0, -l * 0.42, 0.28 + h_post), 'timber')
    add_box("LintelB", (w * 0.88, 0.16, 0.16), (0, l * 0.42, 0.28 + h_post), 'timber')
    add_box("LintelL", (0.16, l * 0.88, 0.16), (-w * 0.42, 0, 0.28 + h_post), 'timber')
    add_box("LintelR", (0.16, l * 0.88, 0.16), (w * 0.42, 0, 0.28 + h_post), 'timber')
    roof_z = 0.28 + h_post + 0.08
    add_gable_roof("MillRoof", w + 0.24, l + 0.24, 0.90 + (tier-1)*0.14, (0, 0, roof_z), 'roof_slate')
    
    # 3. Saw Bench & Blade
    add_box("SawTable", (0.85, 1.15, 0.45), (0, 0, 0.225), 'timber_plank')
    add_cylinder("SawBlade", 0.30, 0.02, (0, 0, 0.52), 'iron', segments=16)
    add_box("LogCutting", (0.22, 1.35, 0.22), (0, 0, 0.48), 'timber')
    
    if tier >= 2:
        crane_x = w * 0.52
        add_box("CraneMast", (0.16, 0.16, h_post * 1.45), (crane_x, 0, h_post * 0.72), 'timber')
        add_box("CraneArm", (0.85, 0.12, 0.12), (crane_x - 0.22, 0, h_post * 1.40), 'timber')
        add_cylinder("CranePulley", 0.12, 0.05, (crane_x - 0.58, 0, h_post * 1.35), 'iron', segments=12)
        
    if tier >= 3:
        add_box("BackWall", (w * 0.84, l * 0.45, h_post), (0, l * 0.20, 0.28 + h_post/2), 'plaster_cream')
        wheel_x = -w * 0.50
        add_cylinder("WheelHub", 0.16, 0.22, (wheel_x, 0, 0.70), 'iron', segments=12)
        add_cylinder("WheelRim", 0.70, 0.10, (wheel_x, 0, 0.70), 'timber', segments=16)
        
    if tier >= 4:
        add_box("HeavyMasonry", (w + 0.18, l + 0.18, 0.35), (0, 0, 0.175), 'sandstone')
        add_gable_roof("DormerGable", l * 0.60, w * 0.60, 0.70, (0, 0, roof_z + 0.40), 'roof_slate', rot_z=math.pi/2)
        
    if tier >= 5:
        add_cylinder("MillCupolaBase", 0.38, 0.45, (0, 0, roof_z + 1.05), 'sandstone_light', segments=8)
        add_cone("MillCupolaDome", 0.44, 0.55, (0, 0, roof_z + 1.50), 'roof_copper', segments=12)
        add_cylinder("MillCupolaFinial", 0.05, 0.28, (0, 0, roof_z + 2.05), 'gold', segments=8)

def build_mine(tier):
    # Cavern portal facing South-Southeast (-18 deg)
    root_empty.rotation_euler = (0, 0, math.radians(-18.0))
    pw = 1.40 + (tier - 1) * 0.12
    ph = 1.60 + (tier - 1) * 0.16
    pd = 0.60 + (tier - 1) * 0.10
    
    # 1. Recessed Tunnel Void
    add_box("CavernVoid", (pw, pd, ph), (0, 0.22, ph/2), 'stone_dark')
    # 2. Heavy Timber Portal Frame
    post_w = 0.20
    add_box("PostL", (post_w, pd + 0.10, ph), (-pw/2 - post_w/2, 0.18, ph/2), 'timber')
    add_box("PostR", (post_w, pd + 0.10, ph), (pw/2 + post_w/2, 0.18, ph/2), 'timber')
    add_box("Lintel", (pw + post_w*2 + 0.20, pd + 0.14, 0.26), (0, 0.18, ph + 0.13), 'timber')
    # 3. Knee Braces
    add_box("BraceL", (0.11, 0.11, 0.42), (-pw/2 + 0.10, 0.18, ph - 0.10), 'timber', rot_z=0.45)
    add_box("BraceR", (0.11, 0.11, 0.42), (pw/2 - 0.10, 0.18, ph - 0.10), 'timber', rot_z=-0.45)
    # 4. Lantern
    add_box("LanArm", (0.04, 0.22, 0.04), (pw/2 + post_w/2, -0.05, ph - 0.18), 'iron')
    add_cylinder("MineLan", 0.07, 0.16, (pw/2 + post_w/2, -0.14, ph - 0.35), 'window_glow', segments=8)
    # 5. Cart & Rails
    add_box("RailL", (0.05, 1.40, 0.05), (-0.30, -0.35, 0.025), 'iron')
    add_box("RailR", (0.05, 1.40, 0.05), (0.30, -0.35, 0.025), 'iron')
    add_box("CartBody", (0.65, 0.80, 0.38), (0, -0.22, 0.26), 'timber_plank')
    add_cylinder("GoldInCart", 0.22, 0.14, (0, -0.22, 0.45), 'gold', segments=8)
    
    if tier >= 2:
        derrick_h = ph * 1.60
        add_box("DerrickL", (0.14, 0.14, derrick_h), (-pw * 0.42, 0.18, derrick_h/2), 'timber')
        add_box("DerrickR", (0.14, 0.14, derrick_h), (pw * 0.42, 0.18, derrick_h/2), 'timber')
        add_box("DerrickBeam", (pw * 0.90, 0.14, 0.14), (0, 0.18, derrick_h - 0.18), 'timber')
        add_cylinder("HoistWheel", 0.38, 0.08, (0, 0.18, derrick_h - 0.05), 'iron', segments=16)
        
    if tier >= 3:
        add_gable_roof("SortingRoof", pw + 1.10, pd + 0.70, 0.65, (0, 0.12, ph + 0.25), 'roof_slate')
        add_cylinder("SideGoldPile", 0.35, 0.28, (pw * 0.70, -0.18, 0), 'gold', segments=10)
        
    if tier >= 4:
        add_box("GraniteArchL", (0.42, pd + 0.18, ph + 0.55), (-pw/2 - 0.22, 0.14, (ph + 0.55)/2), 'stone_dark')
        add_box("GraniteArchR", (0.42, pd + 0.18, ph + 0.55), (pw/2 + 0.22, 0.14, (ph + 0.55)/2), 'stone_dark')
        add_box("GraniteArchTop", (pw + 1.10, pd + 0.18, 0.40), (0, 0.14, ph + 0.60), 'sandstone')
        add_box("MinePortcullis", (pw * 0.90, 0.04, ph * 0.55), (0, 0.04, ph * 0.65), 'iron')
        
    if tier >= 5:
        add_cylinder("GildedCog", 0.60, 0.10, (0, 0.25, ph + 1.05), 'gold', segments=16)
        add_box("GoldBars", (0.42, 0.60, 0.22), (-pw * 0.75, -0.12, 0.11), 'gold')

def build_grand_market(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    w = 2.00 + (tier - 1) * 0.16
    l = 1.70 + (tier - 1) * 0.14
    col_h = 1.40 + (tier - 1) * 0.14
    
    # 1. Base Pad
    add_cylinder("MarketBasePad", w * 0.62, 0.16, (0, 0, 0), 'sandstone', segments=20)
    # 2. Posts
    for x in [-w * 0.36, w * 0.36]:
        for y in [-l * 0.36, l * 0.36]:
            add_cylinder(f"MktCol_{x}_{y}", 0.09, col_h, (x, y, 0.16), 'timber', segments=8)
    # 3. Canopy Roof
    roof_z = 0.16 + col_h
    roof_mat = 'banner_cobalt' if tier % 2 == 1 else 'banner_crimson'
    add_gable_roof("MarketCanopy", w + 0.18, l + 0.18, 0.78 + (tier-1)*0.14, (0, 0, roof_z), roof_mat)
    # 4. Counter & Scales
    add_box("VendorBench", (w * 0.62, 0.50, 0.45), (0, 0, 0.16 + 0.225), 'timber_plank')
    add_box("ScalesBase", (0.20, 0.14, 0.06), (0, 0, 0.16 + 0.48), 'gold')
    add_cylinder("ScalesStem", 0.02, 0.22, (0, 0, 0.16 + 0.51), 'gold', segments=6)
    # Crates
    add_box("MktCrate1", (0.32, 0.32, 0.22), (-w * 0.32, 0, 0.16 + 0.11), 'timber')
    add_box("MktCrate2", (0.32, 0.32, 0.22), (w * 0.32, 0, 0.16 + 0.11), 'timber')
    
    if tier >= 2:
        add_box("SignArm", (0.04, 0.32, 0.04), (0, -l * 0.42, col_h), 'timber')
        add_box("TradeSignPlate", (0.25, 0.03, 0.18), (0, -l * 0.42 - 0.08, col_h - 0.12), 'gold')
        
    if tier >= 3:
        add_box("UpperGuildFloor", (w * 0.82, l * 0.82, col_h * 0.85), (0, 0, roof_z + 0.40), 'plaster_cream')
        add_window((0, -l * 0.38, roof_z + 0.40), width=0.32, height=0.42)
        add_box("BellHousing", (0.50, 0.28, 0.58), (0, -l * 0.32, roof_z + 0.85 + 0.29), 'sandstone')
        add_cylinder("MarketBell", 0.12, 0.18, (0, -l * 0.32, roof_z + 0.85 + 0.18), 'gold', segments=10)
        
    if tier >= 4:
        add_cylinder("DomeDrum", 0.60, 0.40, (0, 0, roof_z + 1.05), 'sandstone_light', segments=12)
        add_cone("CopperDome", 0.68, 0.78, (0, 0, roof_z + 1.45), 'roof_copper', segments=16)
        add_cylinder("DomeSpire", 0.05, 0.32, (0, 0, roof_z + 2.23), 'gold', segments=8)
        
    if tier >= 5:
        add_cylinder("AstroTower", 0.48, 1.30, (0, 0, roof_z + 1.70), 'sandstone', segments=12)
        add_cylinder("AstroClock", 0.30, 0.06, (0, -0.42, roof_z + 2.35), 'gold', segments=16)
        add_cone("AstroApex", 0.54, 1.00, (0, 0, roof_z + 3.00), 'gold', segments=12)

def build_academy(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    w = 1.85 + (tier - 1) * 0.14
    l = 1.55 + (tier - 1) * 0.12
    wall_h = 1.60 + (tier - 1) * 0.20
    roof_h = 1.30 + (tier - 1) * 0.16
    
    # 1. Foundation
    add_box("AcadPlinth", (w + 0.14, l + 0.14, 0.30), (0, 0, 0.15), 'stone_dark')
    # 2. Main Hall Walls
    add_box("AcadWalls", (w, l, wall_h), (0, 0, 0.30 + wall_h/2), 'sandstone')
    # 3. Roof
    roof_z = 0.30 + wall_h
    add_gable_roof("AcadRoof", w + 0.24, l + 0.24, roof_h, (0, 0, roof_z), 'roof_slate')
    # 4. Large Arched Window & Door
    add_window((0, -l/2 - 0.02, 0.30 + wall_h * 0.52), width=0.50, height=0.78)
    add_door((w/2 + 0.02, 0, 0.30), width=0.52, height=0.90, rot_z=math.pi/2)
    
    if tier >= 2:
        wing_w = 0.80
        wing_l = l * 0.75
        add_box("LibraryWing", (wing_w, wing_l, wall_h * 0.78), (-w/2 - wing_w/2, 0, 0.30 + (wall_h * 0.78)/2), 'sandstone')
        add_gable_roof("LibraryRoof", wing_w + 0.14, wing_l + 0.14, roof_h * 0.65, (-w/2 - wing_w/2, 0, 0.30 + wall_h * 0.78), 'roof_slate')
        add_box("Buttress1", (0.16, 0.26, wall_h * 0.70), (-w/2 - wing_w - 0.04, -wing_l * 0.28, 0.30 + wall_h * 0.35), 'stone_dark')
        add_box("Buttress2", (0.16, 0.26, wall_h * 0.70), (-w/2 - wing_w - 0.04, wing_l * 0.28, 0.30 + wall_h * 0.35), 'stone_dark')
        
    if tier >= 3:
        tow_r = 0.60
        tow_h = wall_h * 1.50
        add_cylinder("ObservatoryTower", tow_r, tow_h, (w * 0.32, l * 0.22, 0.30), 'sandstone', segments=16)
        add_cylinder("ObservatoryBalcony", tow_r + 0.16, 0.14, (w * 0.32, l * 0.22, 0.30 + tow_h), 'stone_dark', segments=16)
        add_cone("ObservatoryRoof", tow_r + 0.10, 1.15, (w * 0.32, l * 0.22, 0.30 + tow_h + 0.14), 'roof_blue', segments=16)
        add_cylinder("ArmillaryPedestal", 0.10, 0.28, (0, -l * 0.30, roof_z + 0.35), 'gold', segments=8)
        add_cylinder("ArmillaryRing", 0.22, 0.03, (0, -l * 0.30, roof_z + 0.68), 'gold', segments=12)
        
    if tier >= 4:
        add_cylinder("RoseFrame", 0.42, 0.05, (0, -l/2 - 0.03, 0.30 + wall_h * 0.70), 'gold', segments=16)
        add_cylinder("RoseGlass", 0.38, 0.07, (0, -l/2 - 0.03, 0.30 + wall_h * 0.70), 'window_glow', segments=16)
        
    if tier >= 5:
        add_cylinder("CelestialCupola", 0.80, 0.70, (0, 0, roof_z + roof_h), 'sandstone_light', segments=16)
        add_cone("CelestialDome", 0.86, 0.85, (0, 0, roof_z + roof_h + 0.70), 'gold', segments=16)
        add_cylinder("CelestialPrism", 0.07, 0.55, (0, 0, roof_z + roof_h + 1.55), 'gold', segments=8)

def build_blacksmith(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    w = 1.90 + (tier - 1) * 0.14
    l = 1.65 + (tier - 1) * 0.12
    h_hearth = 1.30 + (tier - 1) * 0.14
    
    # 1. Foundation
    add_box("ForgePlinth", (w + 0.14, l + 0.14, 0.28), (0, 0, 0.14), 'stone_dark')
    # 2. Main Hearth Chimney
    cw = 0.70 + (tier - 1) * 0.08
    ch = 2.30 + (tier - 1) * 0.30
    add_box("FurnaceChimney", (cw, cw, ch), (w * 0.32, 0, ch/2), 'stone_dark')
    add_box("FurnaceEmbers", (cw * 0.65, 0.22, 0.55), (w * 0.32, -cw * 0.38, 0.28 + 0.28), 'forge_glow')
    # 3. Canopy
    add_box("PostL1", (0.15, 0.15, h_hearth), (-w * 0.40, -l * 0.40, 0.28 + h_hearth/2), 'timber')
    add_box("PostL2", (0.15, 0.15, h_hearth), (-w * 0.40, l * 0.40, 0.28 + h_hearth/2), 'timber')
    add_box("PostR", (0.15, 0.15, h_hearth), (w * 0.10, -l * 0.40, 0.28 + h_hearth/2), 'timber')
    roof_z = 0.28 + h_hearth
    add_gable_roof("ForgeRoof", w * 0.92, l + 0.18, 0.80, (-w * 0.15, 0, roof_z), 'roof_slate')
    # 4. Anvil & Water Trough
    add_cylinder("AnvilStump", 0.22, 0.42, (-w * 0.15, -0.15, 0.28), 'timber', segments=12)
    add_box("AnvilIron", (0.25, 0.40, 0.12), (-w * 0.15, -0.15, 0.70 + 0.06), 'iron')
    add_box("WaterTrough", (0.32, 0.70, 0.32), (-w * 0.15, 0.50, 0.28 + 0.16), 'stone_dark')
    add_box("TroughWater", (0.26, 0.64, 0.04), (-w * 0.15, 0.50, 0.28 + 0.30), 'water')
    
    if tier >= 2:
        wing_w = 0.90
        wing_l = l * 0.75
        add_box("ShopWalls", (wing_w, wing_l, h_hearth * 0.85), (-w/2 - wing_w/2 + 0.12, 0, 0.28 + (h_hearth * 0.85)/2), 'plaster_cream')
        add_gable_roof("ShopRoof", wing_w + 0.14, wing_l + 0.14, 0.70, (-w/2 - wing_w/2 + 0.12, 0, 0.28 + h_hearth * 0.85), 'roof_slate')
        add_box("AnvilSignArm", (0.04, 0.28, 0.04), (-w/2, -l * 0.32, h_hearth * 0.75), 'iron')
        add_box("AnvilSignIcon", (0.20, 0.03, 0.12), (-w/2, -l * 0.32 - 0.06, h_hearth * 0.75 - 0.08), 'iron')
        
    if tier >= 3:
        add_box("SecondChimney", (cw * 0.80, cw * 0.80, ch * 0.85), (w * 0.32, l * 0.32, ch * 0.42), 'stone_dark')
        add_box("WeaponRack", (0.42, 0.08, 0.60), (-w * 0.42, -l * 0.18, 0.28 + 0.30), 'timber')
        add_cylinder("Sword1", 0.025, 0.50, (-w * 0.42 - 0.10, -l * 0.18, 0.60), 'iron', segments=6)
        add_cylinder("Sword2", 0.025, 0.50, (-w * 0.42 + 0.10, -l * 0.18, 0.60), 'iron', segments=6)
        
    if tier >= 4:
        wheel_y = l * 0.52
        add_cylinder("BellowsWheel", 0.60, 0.10, (w * 0.32, wheel_y, 0.60), 'timber', segments=16)
        add_box("StoneBattlements", (w, 0.18, 0.40), (0, -l * 0.45, roof_z + 0.20), 'stone_dark')
        
    if tier >= 5:
        add_box("MagmaChannel", (w * 0.70, 0.22, 0.10), (0, -0.40, 0.28 + 0.05), 'forge_glow')
        add_cone("DragonCrown1", 0.50, 0.60, (w * 0.32, 0, ch + 0.30), 'gold', segments=8)
        add_cone("DragonCrown2", 0.44, 0.50, (w * 0.32, l * 0.32, ch * 0.85 + 0.25), 'gold', segments=8)

def build_watchtower(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    tow_w = 1.20 + (tier - 1) * 0.10
    tow_h = 2.30 + (tier - 1) * 0.32
    
    # 1. Base Masonry
    add_box("Plinth0", (tow_w + 0.38, tow_w + 0.38, 0.28), (0, 0, 0.14), 'stone_dark')
    add_box("Plinth1", (tow_w + 0.18, tow_w + 0.18, 0.28), (0, 0, 0.42), 'sandstone')
    # 2. Tower Shaft
    add_box("Shaft", (tow_w, tow_w, tow_h), (0, 0, 0.56 + tow_h/2), 'sandstone')
    # 3. Observation Platform
    plat_z = 0.56 + tow_h
    plat_w = tow_w + 0.42 + (tier-1)*0.08
    add_box("Platform", (plat_w, plat_w, 0.16), (0, 0, plat_z + 0.08), 'stone_dark')
    for x in [-tow_w/2, tow_w/2]:
        for y in [-tow_w/2, tow_w/2]:
            add_box(f"Corbel_{x}_{y}", (0.16, 0.16, 0.32), (x, y, plat_z - 0.14), 'stone_dark')
    # Parapets
    add_box("ParapetF", (plat_w, 0.08, 0.35), (0, -plat_w/2 + 0.04, plat_z + 0.16 + 0.175), 'sandstone')
    add_box("ParapetB", (plat_w, 0.08, 0.35), (0, plat_w/2 - 0.04, plat_z + 0.16 + 0.175), 'sandstone')
    add_box("ParapetL", (0.08, plat_w, 0.35), (-plat_w/2 + 0.04, 0, plat_z + 0.16 + 0.175), 'sandstone')
    add_box("ParapetR", (0.08, plat_w, 0.35), (plat_w/2 - 0.04, 0, plat_z + 0.16 + 0.175), 'sandstone')
    # 4. Roof
    roof_z = plat_z + 0.16 + 0.35
    roof_h = 1.25 + (tier - 1) * 0.18
    add_cone("RoofCone", plat_w * 0.72, roof_h, (0, 0, roof_z), 'roof_slate', segments=4 if tier < 3 else 8)
    add_cylinder("SpireFinial", 0.04, 0.32, (0, 0, roof_z + roof_h), 'gold', segments=8)
    # Door & Arrow slits
    add_door((0, -tow_w/2 - 0.02, 0.56), width=0.42, height=0.78)
    add_window((0, -tow_w/2 - 0.02, 0.56 + tow_h * 0.52), width=0.16, height=0.30)
    add_window((tow_w/2 + 0.02, 0, 0.56 + tow_h * 0.52), width=0.16, height=0.30, rot_z=math.pi/2)
    
    if tier >= 2:
        add_cylinder("BrazierBase", 0.10, 0.32, (plat_w * 0.38, -plat_w * 0.38, plat_z + 0.16), 'iron', segments=8)
        add_cylinder("BrazierBowl", 0.20, 0.10, (plat_w * 0.38, -plat_w * 0.38, plat_z + 0.16 + 0.32), 'iron', segments=12)
        add_cylinder("BrazierFlame", 0.14, 0.14, (plat_w * 0.38, -plat_w * 0.38, plat_z + 0.16 + 0.42), 'forge_glow', segments=8)
        
    if tier >= 3:
        add_banner((plat_w * 0.40, 0, plat_z + 0.50), width=0.32, length=0.80, mat_key='banner_cobalt')
        
    if tier >= 4:
        add_box("BallistaStand", (0.22, 0.32, 0.22), (-plat_w * 0.22, -plat_w * 0.22, plat_z + 0.16 + 0.11), 'timber')
        add_cylinder("BallistaBow", 0.50, 0.05, (-plat_w * 0.22, -plat_w * 0.22 - 0.08, plat_z + 0.16 + 0.25), 'iron', segments=8)
        
    if tier >= 5:
        add_cone("CitadelGoldSpire", plat_w * 0.78, roof_h * 1.30, (0, 0, roof_z), 'gold', segments=8)
        add_cylinder("CrystalLamp", 0.20, 0.35, (0, 0, roof_z + roof_h * 1.30 + 0.30), 'window_glow', segments=8)

def build_workshop(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    w = 1.90 + (tier - 1) * 0.14
    l = 1.60 + (tier - 1) * 0.12
    wall_h = 1.35 + (tier - 1) * 0.16
    roof_h = 1.00 + (tier - 1) * 0.14
    
    # 1. Foundation
    add_box("WorkshopPlinth", (w + 0.12, l + 0.12, 0.24), (0, 0, 0.12), 'stone_dark')
    # 2. Timber Walls
    add_box("WorkshopWalls", (w, l, wall_h), (0, 0, 0.24 + wall_h/2), 'timber_plank')
    for x in [-w/2, w/2]:
        for y in [-l/2, l/2]:
            add_box(f"Post_{x}_{y}", (0.12, 0.12, wall_h), (x, y, 0.24 + wall_h/2), 'timber')
    # 3. Terracotta Gable Roof
    roof_z = 0.24 + wall_h
    add_gable_roof("WorkshopRoof", w + 0.20, l + 0.20, roof_h, (0, 0, roof_z), 'roof_terracotta')
    # 4. Door & Windows
    add_door((0, -l/2 - 0.02, 0.24), width=0.58, height=0.90)
    add_window((-w * 0.30, -l/2 - 0.02, 0.24 + wall_h * 0.52))
    add_window((w/2 + 0.02, 0, 0.24 + wall_h * 0.52), rot_z=math.pi/2)
    # 5. Workbench & Gear
    add_box("WorkBench", (0.80, 0.42, 0.40), (w * 0.30, -l * 0.42 - 0.22, 0.20), 'timber')
    add_cylinder("GearOnBench", 0.11, 0.04, (w * 0.30, -l * 0.42 - 0.22, 0.42), 'iron', segments=8)
    
    if tier >= 2:
        crane_x = -w * 0.50
        add_box("CraneMast", (0.15, 0.15, wall_h * 1.35), (crane_x, 0, wall_h * 0.68), 'timber')
        add_box("CraneBoom", (0.80, 0.11, 0.11), (crane_x + 0.22, 0, wall_h * 1.30), 'timber')
        add_cylinder("CranePulley", 0.12, 0.04, (crane_x + 0.55, 0, wall_h * 1.25), 'iron', segments=12)
        
    if tier >= 3:
        add_box("DraftLoft", (0.60, 0.50, 0.50), (0, -l * 0.22, roof_z + 0.42), 'plaster_cream')
        add_window((0, -l * 0.22 - 0.26, roof_z + 0.42), width=0.32, height=0.32)
        add_cylinder("RoofAxleGear", 0.32, 0.07, (w * 0.32, 0, roof_z + 0.60), 'iron', segments=12)
        
    if tier >= 4:
        add_cylinder("SteamPipe", 0.09, wall_h + roof_h * 0.75, (w * 0.42, l * 0.32, 0.24), 'iron', segments=8)
        add_cone("SteamFunnel", 0.18, 0.22, (w * 0.42, l * 0.32, 0.24 + wall_h + roof_h * 0.75), 'roof_copper', segments=8)
        add_cylinder("BrassGear1", 0.26, 0.05, (-w * 0.28, -l/2 - 0.04, roof_z + 0.14), 'gold', segments=12)
        add_cylinder("BrassGear2", 0.18, 0.05, (-w * 0.10, -l/2 - 0.04, roof_z + 0.28), 'iron', segments=10)
        
    if tier >= 5:
        add_cylinder("CopperBoiler", 0.42, 1.15, (w * 0.38, l * 0.18, 0.24), 'roof_copper', segments=16)
        add_cone("BoilerCap", 0.45, 0.32, (w * 0.38, l * 0.18, 0.24 + 1.15), 'gold', segments=12)
        add_cylinder("MasterGear", 0.45, 0.07, (0, -l/2 - 0.05, roof_z + 0.32), 'gold', segments=16)

BUILDING_BUILDERS = {
    'castle': build_castle,
    'farm': build_farm,
    'lumber-mill': build_lumber_mill,
    'mine': build_mine,
    'grand-market': build_grand_market,
    'academy': build_academy,
    'blacksmith': build_blacksmith,
    'watchtower': build_watchtower,
    'workshop': build_workshop,
}

# -----------------------------------------------------------------------------
# 7. Render Loop
# -----------------------------------------------------------------------------
buildings_to_render = [TARGET_BUILDING] if TARGET_BUILDING else list(BUILDING_BUILDERS.keys())
tiers_to_render = [TARGET_TIER] if TARGET_TIER else [1, 2, 3, 4, 5]

total_count = len(buildings_to_render) * len(tiers_to_render)
current_idx = 0

print(f"=== Starting Artisan 3D Building Generator ({total_count} assets) ===")
print(f"Output Directory: {OUTPUT_DIR}")
print(f"Cycles Samples: {SAMPLES}")

for b_name in buildings_to_render:
    if b_name not in BUILDING_BUILDERS:
        print(f"Unknown building: {b_name}, skipping.")
        continue
        
    b_dir = os.path.join(OUTPUT_DIR, b_name)
    os.makedirs(b_dir, exist_ok=True)
    
    for tier in tiers_to_render:
        current_idx += 1
        print(f"[{current_idx}/{total_count}] Generating {b_name} Tier {tier}...")
        
        clear_building_collection()
        
        # Build model
        BUILDING_BUILDERS[b_name](tier)
        
        # Render
        out_png = os.path.join(b_dir, f"tier-{tier}.png")
        scene.render.filepath = out_png
        bpy.ops.render.render(write_still=True)
        print(f"  -> Saved {out_png}")

print("=== All requested 3D building assets rendered successfully! ===")

import bpy
import bmesh
import math
import os
import sys

# =============================================================================
# CROWN & COIN - ICONIC 3D PROCEDURAL BUILDINGS GENERATOR (BLENDER 5.2.1 LTS)
# =============================================================================
# Generates 3D stylized low-poly building models and renders them in Cycles
# with the EXACT same lighting rig, materials, camera pitch (45 deg ortho),
# and AgX high-contrast color management as the terrain map (kingdom-base-v6).
#
# Every building features an unmistakable, unique silhouette at a glance:
# 1. Farm: Windmill with 4 lattice cross sails + granary tower + silo + barn
# 2. Lumber Mill: Giant rotating waterwheel on right flank + stacked logs + saw
# 3. Mine: Rocky cavern cave mouth + timber portal + rails + gold minecart
# 4. Grand Market: Festive 8-facet striped fabric tent canopy + bazaar stalls
# 5. Academy: Arcane wizard spire + glowing cyan celestial orb & armillary
# 6. Blacksmith: Blazing open-air hearth + tall chimney + anvil on stump
# 7. Watchtower: Extra-tall slender lookout + observation deck + alarm bell
# 8. Workshop: Front-mounted interlocking brass & iron cogs + boiler + crane
# 9. Castle: Royal cylindrical keep + merlons + blue roofs + front turrets + gate
# =============================================================================

argv = sys.argv
args = []
if "--" in argv:
    args = argv[argv.index("--") + 1:]

TARGET_BUILDING = None
TARGET_TIER = None
SAMPLES = 16
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

# Golden-Hour Key Sun (Warm sunlight from South-East)
sun_key_data = bpy.data.lights.new(name="SunKey", type='SUN')
sun_key_data.energy = 5.2
sun_key_data.color = (1.0, 0.88, 0.68)
sun_key_data.angle = math.radians(2.2)
sun_key = bpy.data.objects.new("SunKey", sun_key_data)
scene.collection.objects.link(sun_key)
sun_key.rotation_euler = (math.radians(-44.0), math.radians(-30.0), math.radians(12.4))

# Alpine Sky Fill Sun (Cool ambient sky fill from North-West)
sun_fill_data = bpy.data.lights.new(name="SunFill", type='SUN')
sun_fill_data.energy = 1.35
sun_fill_data.color = (0.28, 0.48, 0.88)
sun_fill_data.angle = math.radians(18.0)
sun_fill = bpy.data.objects.new("SunFill", sun_fill_data)
scene.collection.objects.link(sun_fill)
sun_fill.rotation_euler = (math.radians(28.8), math.radians(20.5), math.radians(5.3))

# Grass Ground Bounce Sun (Soft green bounce from ground)
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
    'sandstone': create_pbr_shader("Sandstone", (0.58, 0.52, 0.42), roughness=0.68, bump_scale=0.18),
    'sandstone_light': create_pbr_shader("SandstoneLight", (0.70, 0.64, 0.54), roughness=0.62),
    'stone_dark': create_pbr_shader("StoneDark", (0.32, 0.30, 0.28), roughness=0.75, bump_scale=0.20),
    'rock_dark': create_pbr_shader("RockDark", (0.26, 0.24, 0.22), roughness=0.85, bump_scale=0.25),
    'timber': create_pbr_shader("Timber", (0.34, 0.22, 0.12), roughness=0.75),
    'timber_plank': create_pbr_shader("TimberPlank", (0.52, 0.36, 0.22), roughness=0.70),
    'log_bark': create_pbr_shader("LogBark", (0.28, 0.18, 0.11), roughness=0.85),
    'log_end': create_pbr_shader("LogEnd", (0.65, 0.52, 0.35), roughness=0.60),
    'plaster_cream': create_pbr_shader("PlasterCream", (0.88, 0.84, 0.76), roughness=0.70),
    'roof_blue': create_pbr_shader("RoofBlue", (0.12, 0.28, 0.65), roughness=0.45, bump_scale=0.15),
    'roof_terracotta': create_pbr_shader("RoofTerracotta", (0.70, 0.28, 0.14), roughness=0.55, bump_scale=0.15),
    'roof_slate': create_pbr_shader("RoofSlate", (0.20, 0.21, 0.26), roughness=0.50, bump_scale=0.12),
    'roof_copper': create_pbr_shader("RoofCopper", (0.22, 0.58, 0.52), roughness=0.40),
    'gold': create_pbr_shader("Gold", (1.0, 0.82, 0.18), roughness=0.20, metallic=0.96),
    'copper': create_pbr_shader("Copper", (0.82, 0.44, 0.28), roughness=0.30, metallic=0.90),
    'iron': create_pbr_shader("Iron", (0.20, 0.20, 0.22), roughness=0.38, metallic=0.85),
    'fabric_red': create_pbr_shader("FabricRed", (0.82, 0.12, 0.12), roughness=0.60),
    'fabric_white': create_pbr_shader("FabricWhite", (0.94, 0.92, 0.86), roughness=0.60),
    'fabric_blue': create_pbr_shader("FabricBlue", (0.12, 0.35, 0.75), roughness=0.60),
    'fabric_gold': create_pbr_shader("FabricGold", (0.95, 0.75, 0.18), roughness=0.60),
    'banner_cobalt': create_pbr_shader("BannerCobalt", (0.12, 0.32, 0.75), roughness=0.65),
    'window_glow': create_pbr_shader("WindowGlow", (1.0, 0.80, 0.35), roughness=0.2, emission=(1.0, 0.78, 0.30), emission_strength=3.5),
    'forge_glow': create_pbr_shader("ForgeGlow", (1.0, 0.50, 0.08), roughness=0.1, emission=(1.0, 0.45, 0.05), emission_strength=6.0),
    'magic_cyan': create_pbr_shader("MagicCyan", (0.15, 0.88, 0.98), roughness=0.1, metallic=0.1, emission=(0.15, 0.88, 0.98), emission_strength=6.5),
    'water': create_pbr_shader("Water", (0.02, 0.44, 0.58), roughness=0.05),
}

# -----------------------------------------------------------------------------
# 5. Modular Geometric Modeling Primitives
# -----------------------------------------------------------------------------
build_col = bpy.data.collections.new("BuildingModel")
scene.collection.children.link(build_col)

root_empty = bpy.data.objects.new("BuildingRoot", None)
scene.collection.objects.link(root_empty)

def clear_building_collection():
    for obj in list(build_col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    root_empty.rotation_euler = (0, 0, 0)

def add_box(name, size, location, mat_key, rot_z=0.0, rot_euler=None, parent=root_empty):
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
    if rot_euler:
        obj.rotation_euler = rot_euler
    else:
        obj.rotation_euler = (0, 0, rot_z)
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_cylinder(name, radius, height, location, mat_key, segments=16, rot_euler=(0,0,0), smooth=True, parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=height)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + height / 2.0 if rot_euler == (0,0,0) else location[2])
    obj.rotation_euler = rot_euler
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_cone(name, radius, height, location, mat_key, segments=16, smooth=False, rot_euler=(0,0,0), parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=segments, radius1=radius, radius2=0.0, depth=height)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + height / 2.0 if rot_euler == (0,0,0) else location[2])
    obj.rotation_euler = rot_euler
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_sphere(name, radius, location, mat_key, segments=16, rings=12, parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
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
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = (0, 0, rot_z)
    obj.data.materials.append(mats[mat_key])
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_striped_tent_roof(name, radius, height, location, mat1_key, mat2_key, segments=8, rot_z=0.0, parent=root_empty):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=segments, radius1=radius, radius2=0.0, depth=height)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + height / 2.0)
    obj.rotation_euler = (0, 0, rot_z)
    obj.data.materials.append(mats[mat1_key])
    obj.data.materials.append(mats[mat2_key])
    side_idx = 0
    for p in obj.data.polygons:
        p.material_index = 0 if (side_idx % 2 == 0) else 1
        side_idx += 1
    build_col.objects.link(obj)
    obj.parent = parent
    return obj

def add_door(location, width=0.50, height=0.85, rot_z=0.0, parent=root_empty):
    d_x, d_y, d_z = location
    add_box("DoorFrame", (width + 0.12, 0.12, height + 0.08), (d_x, d_y, d_z + (height + 0.08)/2), 'stone_dark', rot_z, parent=parent)
    add_box("DoorWood", (width, 0.08, height), (d_x, d_y + 0.02, d_z + height/2), 'timber', rot_z, parent=parent)
    add_box("DoorHinge1", (width * 0.70, 0.10, 0.04), (d_x, d_y + 0.03, d_z + height * 0.75), 'iron', rot_z, parent=parent)
    add_box("DoorHinge2", (width * 0.70, 0.10, 0.04), (d_x, d_y + 0.03, d_z + height * 0.25), 'iron', rot_z, parent=parent)

def add_portcullis_door(location, width=0.75, height=1.10, rot_z=0.0, parent=root_empty):
    d_x, d_y, d_z = location
    add_box("ArchFrame", (width + 0.18, 0.16, height + 0.12), (d_x, d_y, d_z + (height + 0.12)/2), 'stone_dark', rot_z, parent=parent)
    add_box("DarkVoid", (width, 0.14, height), (d_x, d_y + 0.02, d_z + height/2), 'rock_dark', rot_z, parent=parent)
    # Iron Portcullis Grill Bars
    add_box("GrillTop", (width * 0.90, 0.05, 0.06), (d_x, d_y - 0.02, d_z + height * 0.85), 'iron', rot_z, parent=parent)
    for bx in [-width*0.30, 0, width*0.30]:
        add_cylinder("GrillBar", 0.02, height * 0.60, (d_x + bx, d_y - 0.02, d_z + height * 0.60), 'iron', segments=6, parent=parent)

def add_window(location, width=0.22, height=0.35, rot_z=0.0, parent=root_empty):
    w_x, w_y, w_z = location
    add_box("WinFrame", (width + 0.08, 0.10, height + 0.08), (w_x, w_y, w_z), 'stone_dark', rot_z, parent=parent)
    add_box("WinGlow", (width, 0.08, height), (w_x, w_y + 0.02, w_z), 'window_glow', rot_z, parent=parent)

def add_chimney(location, width=0.45, height=1.4, parent=root_empty):
    c_x, c_y, c_z = location
    add_box("ChimBody", (width, width, height), (c_x, c_y, c_z + height/2), 'stone_dark', parent=parent)
    add_box("ChimCap", (width + 0.10, width + 0.10, 0.12), (c_x, c_y, c_z + height + 0.06), 'sandstone', parent=parent)
    add_cylinder("ChimPot", width * 0.25, 0.22, (c_x, c_y, c_z + height + 0.18), 'roof_terracotta', segments=10, parent=parent)

def add_banner(location, width=0.38, length=0.90, mat_key='banner_cobalt', emblem_key='gold', rot_z=0.0, parent=root_empty):
    b_x, b_y, b_z = location
    add_box("BanPole", (width + 0.12, 0.05, 0.05), (b_x, b_y, b_z), 'timber', rot_z, parent=parent)
    add_box("BanCloth", (width, 0.02, length), (b_x, b_y - 0.02, b_z - length/2), mat_key, rot_z, parent=parent)
    if emblem_key:
        add_box("BanEmblem", (width * 0.45, 0.03, length * 0.40), (b_x, b_y - 0.025, b_z - length * 0.45), emblem_key, rot_z, parent=parent)

# -----------------------------------------------------------------------------
# 6. Building Implementations (All 9 Types x 5 Tiers)
# -----------------------------------------------------------------------------

# =============================================================================
# 1. CASTLE (قلعه شاهی)
# =============================================================================
def build_castle(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-16.0))
    base_r = 1.35 + (tier - 1) * 0.12
    keep_r = 1.10 + (tier - 1) * 0.10
    keep_h = 1.85 + (tier - 1) * 0.28
    
    # 1. Stepped Stone Plinth
    add_cylinder("CastlePlinth0", base_r + 0.15, 0.22, (0, 0, 0), 'stone_dark', segments=20)
    add_cylinder("CastlePlinth1", base_r, 0.22, (0, 0, 0.22), 'sandstone', segments=20)
    
    # 2. Main Central Keep
    add_cylinder("MainKeep", keep_r, keep_h, (0, 0, 0.44), 'sandstone_light' if tier == 5 else 'sandstone', segments=20)
    
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
    roof_h = 1.35 + (tier - 1) * 0.18
    add_cone("KeepRoof", keep_r + 0.06, roof_h, (0, 0, roof_z), roof_mat, segments=16)
    
    # 5. Finial & Spire Banner
    finial_z = roof_z + roof_h
    add_cylinder("FinialStem", 0.05, 0.35, (0, 0, finial_z), 'gold', segments=8)
    add_cylinder("FinialBall", 0.12, 0.20, (0, 0, finial_z + 0.28), 'gold', segments=12)
    add_banner((0, 0.02, finial_z + 0.32), width=0.48 + (tier-1)*0.06, length=0.90 + (tier-1)*0.08, mat_key='banner_cobalt', emblem_key='gold')
    
    # 6. Flanking Front Bastion Turrets
    for side, bx in [("L", -base_r * 0.85), ("R", base_r * 0.85)]:
        by = -base_r * 0.35
        turret_h = keep_h * 0.75
        add_cylinder(f"FrontTurret_{side}", 0.45 + (tier-1)*0.04, turret_h, (bx, by, 0.22), 'sandstone', segments=12)
        add_cone(f"FrontRoof_{side}", 0.52 + (tier-1)*0.04, 0.75 + (tier-1)*0.10, (bx, by, 0.22 + turret_h), roof_mat, segments=12)
        add_cylinder(f"FrontFinial_{side}", 0.04, 0.22, (bx, by, 0.22 + turret_h + 0.75), 'gold', segments=6)
        
    # 7. Arched Gatehouse Entrance
    add_portcullis_door((0, -keep_r - 0.06, 0.22), width=0.74 + (tier-1)*0.06, height=1.05 + (tier-1)*0.08)
    add_box("EntryStep0", (1.30, 0.35, 0.12), (0, -keep_r - 0.28, 0.06), 'sandstone')
    add_box("EntryStep1", (1.10, 0.30, 0.12), (0, -keep_r - 0.18, 0.18), 'sandstone')
    
    # Tier Evolutions
    if tier >= 2:
        add_box("HoardL", (0.35, 0.65, 0.38), (-keep_r - 0.08, 0, p_z - 0.18), 'timber')
        add_box("HoardR", (0.35, 0.65, 0.38), (keep_r + 0.08, 0, p_z - 0.18), 'timber')
        
    if tier >= 3:
        for side, rx in [("RL", -base_r * 0.82), ("RR", base_r * 0.82)]:
            ry = base_r * 0.55
            add_cylinder(f"RearTurret_{side}", 0.48, keep_h * 0.80, (rx, ry, 0.22), 'sandstone', segments=12)
            add_cone(f"RearRoof_{side}", 0.55, 0.85, (rx, ry, 0.22 + keep_h * 0.80), roof_mat, segments=12)
            add_box(f"Wall_{side}", (0.28, base_r * 0.90, keep_h * 0.45), (rx, 0, 0.22 + keep_h * 0.22), 'sandstone')
            
    if tier >= 4:
        add_box("ShieldL", (0.20, 0.04, 0.26), (-0.45, -keep_r - 0.12, 1.45), 'banner_cobalt')
        add_box("ShieldR", (0.20, 0.04, 0.26), (0.45, -keep_r - 0.12, 1.45), 'banner_cobalt')
        
    if tier >= 5:
        add_cylinder("ApexSpireTower", 0.38, 1.20, (0, 0, finial_z + 0.15), 'sandstone_light', segments=12)
        add_cone("ApexGoldenCrown", 0.45, 1.40, (0, 0, finial_z + 1.35), 'gold', segments=12)
        add_banner((0, -0.06, finial_z + 2.75), width=0.60, length=1.25, mat_key='banner_cobalt', emblem_key='gold')

# =============================================================================
# 2. FARM (مزرعه)
# =============================================================================
def build_farm(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    wm_x, wm_y = -0.65, 0.0
    wm_r_base = 0.80 + (tier-1)*0.04
    wm_r_top = 0.58 + (tier-1)*0.03
    wm_h = 2.40 + (tier-1)*0.18
    
    # 1. Octagonal Stone Plinth & Windmill Tower
    add_cylinder("FarmPlinth", wm_r_base + 0.12, 0.35, (wm_x, wm_y, 0), 'stone_dark', segments=8)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=wm_r_base, radius2=wm_r_top, depth=wm_h)
    mesh = bpy.data.meshes.new("FarmTowerMesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("FarmTower", mesh)
    obj.location = (wm_x, wm_y, 0.35 + wm_h/2)
    obj.data.materials.append(mats['plaster_cream'])
    build_col.objects.link(obj)
    obj.parent = root_empty
    
    # 2. Windmill Cap
    cap_z = 0.35 + wm_h
    cap_h = 0.90 + (tier-1)*0.10
    add_cone("FarmCap", wm_r_top + 0.12, cap_h, (wm_x, wm_y, cap_z), 'roof_terracotta', segments=8)
    
    # 3. Windmill Rotor Hub
    rotor_z = cap_z + 0.38
    rotor_y = wm_y - wm_r_top - 0.12
    add_cylinder("RotorAxle", 0.10, 0.30, (wm_x, rotor_y, rotor_z), 'iron', segments=8, rot_euler=(math.radians(90), 0, 0))
    add_sphere("RotorNose", 0.14, (wm_x, rotor_y - 0.14, rotor_z), 'gold')
    
    # 4. 4 Cross Lattice Sails
    blade_len = 1.45 + (tier-1)*0.10
    blade_w = 0.32 + (tier-1)*0.03
    cloth_mat = 'fabric_gold' if tier == 5 else 'fabric_white'
    for i in range(4):
        ang = math.radians(45 + i * 90)
        bx = wm_x + math.cos(ang) * (blade_len / 2 + 0.10)
        bz = rotor_z + math.sin(ang) * (blade_len / 2 + 0.10)
        add_box(f"Spar_{i}", (blade_len, 0.06, 0.06), (bx, rotor_y - 0.08, bz), 'timber', rot_euler=(0, -ang, 0))
        add_box(f"SailCloth_{i}", (blade_len * 0.82, 0.02, blade_w), 
                (bx + math.cos(ang + math.pi/2)*blade_w*0.4, rotor_y - 0.07, bz + math.sin(ang + math.pi/2)*blade_w*0.4), 
                cloth_mat, rot_euler=(0, -ang, 0))
    
    # 5. Attached Rustic Barn
    barn_w = 1.50 + (tier-1)*0.10
    barn_l = 1.30
    barn_h = 1.15
    barn_x, barn_y = 0.70, 0.10
    add_box("BarnPlinth", (barn_w + 0.10, barn_l + 0.10, 0.20), (barn_x, barn_y, 0.10), 'stone_dark')
    add_box("BarnWalls", (barn_w, barn_l, barn_h), (barn_x, barn_y, 0.20 + barn_h/2), 'timber_plank')
    add_gable_roof("BarnRoof", barn_w + 0.22, barn_l + 0.20, 0.85, (barn_x, barn_y, 0.20 + barn_h), 'roof_terracotta')
    add_door((barn_x, barn_y - barn_l/2 - 0.02, 0.20), width=0.65, height=0.85)
    
    # Hay Bales in front
    add_box("HayBale1", (0.35, 0.50, 0.32), (barn_x + 0.45, barn_y - barn_l/2 - 0.25, 0.16), 'fabric_gold', rot_z=0.25)
    add_box("HayBale2", (0.32, 0.48, 0.30), (barn_x + 0.35, barn_y - barn_l/2 - 0.22, 0.44), 'fabric_gold', rot_z=-0.15)
    
    # Tier evolutions
    if tier >= 2:
        silo_r = 0.50
        silo_h = 1.95
        silo_x, silo_y = wm_x - 0.85, 0.35
        add_cylinder("SiloStone", silo_r, silo_h, (silo_x, silo_y, 0), 'sandstone', segments=12)
        add_cone("SiloRoof", silo_r + 0.06, 0.75, (silo_x, silo_y, silo_h), 'roof_slate', segments=12)
        
    if tier >= 3:
        add_box("BarnDormer", (0.42, 0.45, 0.35), (barn_x, barn_y - barn_l*0.25, 0.20 + barn_h + 0.38), 'plaster_cream')
        add_window((barn_x, barn_y - barn_l*0.25 - 0.22, 0.20 + barn_h + 0.40), width=0.20, height=0.24)
        add_cylinder("WeatherVaneRod", 0.03, 0.35, (wm_x, wm_y, cap_z + cap_h), 'gold', segments=6)
        
    if tier >= 4:
        silo2_r = 0.45
        silo2_h = 1.65
        add_cylinder("Silo2Stone", silo2_r, silo2_h, (wm_x - 0.70, wm_y + 0.85, 0), 'stone_dark', segments=12)
        add_cone("Silo2Roof", silo2_r + 0.05, 0.65, (wm_x - 0.70, wm_y + 0.85, silo2_h), 'roof_terracotta', segments=12)
        add_box("WagonBox", (0.55, 0.80, 0.30), (barn_x + 0.20, barn_y - barn_l/2 - 0.75, 0.25), 'timber_plank')
        add_cylinder("WagonGrain", 0.22, 0.12, (barn_x + 0.20, barn_y - barn_l/2 - 0.75, 0.42), 'fabric_gold', segments=8)
        
    if tier >= 5:
        add_cylinder("HarvestCrest", 0.30, 0.08, (wm_x, wm_y - wm_r_base*0.85, 1.45), 'gold', segments=16, rot_euler=(math.radians(90), 0, 0))
        add_cone("SiloCopperDome", 0.56, 0.85, (wm_x - 0.85, 0.35, 1.95), 'roof_copper', segments=12)

# =============================================================================
# 3. LUMBER MILL (کارگاه چوب‌بری)
# =============================================================================
def build_lumber_mill(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    sw, sl, sh = 1.70 + (tier-1)*0.10, 1.30, 1.30
    sx, sy = -0.25, 0.15 # Shifted left so giant waterwheel sits prominently on right (+X)
    
    # 1. 4 Heavy Timber Corner Pillars
    for px in [sx - sw*0.40, sx + sw*0.40]:
        for py in [sy - sl*0.40, sy + sl*0.40]:
            add_cylinder(f"Pier_{px}_{py}", 0.14, 0.25, (px, py, 0), 'stone_dark', segments=8)
            add_box(f"Post_{px}_{py}", (0.15, 0.15, sh), (px, py, 0.25 + sh/2), 'timber')
            
    # 2. Beams & Timber Plank Roof
    add_box("BeamF", (sw*0.95, 0.14, 0.14), (sx, sy - sl*0.40, 0.25 + sh), 'timber')
    add_box("BeamB", (sw*0.95, 0.14, 0.14), (sx, sy + sl*0.40, 0.25 + sh), 'timber')
    add_gable_roof("SawRoof", sw + 0.24, sl + 0.22, 0.85, (sx, sy, 0.25 + sh), 'timber_plank')
    
    # 3. Saw Bench & Circular Steel Blade inside
    add_box("SawBench", (0.75, 1.10, 0.45), (sx, sy, 0.225), 'timber_plank')
    add_cylinder("SawBlade", 0.36 + (tier-1)*0.04, 0.02, (sx, sy, 0.52), 'iron', segments=16, rot_euler=(0, math.radians(90), 0))
    add_cylinder("LogOnBench", 0.14, 1.25, (sx, sy, 0.48), 'log_bark', segments=10, rot_euler=(math.radians(90), 0, 0))
    
    # 4. GIANT WATERWHEEL ON RIGHT FLANK (+X) - BATHED IN GOLDEN SUNLIGHT!
    ww_r = 1.15 + (tier-1)*0.08
    ww_x = sx + sw*0.50 + 0.26
    ww_y = sy
    ww_z = 0.95
    ww_thick = 0.32
    
    # Water Flume Trough above wheel
    add_box("FlumeSupport", (0.20, 0.20, ww_z + ww_r * 0.80), (ww_x, ww_y + sl*0.45, (ww_z + ww_r * 0.80)/2), 'timber')
    add_box("FlumeTrough", (0.44, sl * 1.15, 0.22), (ww_x, ww_y, ww_z + ww_r * 0.85), 'timber')
    add_box("FlumeWater", (0.36, sl * 1.10, 0.08), (ww_x, ww_y, ww_z + ww_r * 0.88), 'water')
    
    # Wheel Axle Hub & Dual Rims
    add_cylinder("WheelAxle", 0.14, 0.58, (ww_x, ww_y, ww_z), 'iron', segments=8, rot_euler=(0, math.radians(90), 0))
    rim_mat = 'gold' if tier == 5 else 'timber'
    add_cylinder("Rim1", ww_r, 0.06, (ww_x - ww_thick/2, ww_y, ww_z), rim_mat, segments=16, rot_euler=(0, math.radians(90), 0))
    add_cylinder("Rim2", ww_r, 0.06, (ww_x + ww_thick/2, ww_y, ww_z), rim_mat, segments=16, rot_euler=(0, math.radians(90), 0))
    # 8 Paddles & Spokes
    for i in range(8):
        ang = i * (math.pi / 4)
        py = ww_y + math.cos(ang) * (ww_r - 0.12)
        pz = ww_z + math.sin(ang) * (ww_r - 0.12)
        add_box(f"Paddle_{i}", (ww_thick * 0.95, 0.22, 0.04), (ww_x, py, pz), 'timber', rot_euler=(ang, 0, 0))
        add_box(f"Spoke_{i}", (0.05, 0.06, ww_r * 0.85), (ww_x, ww_y + math.cos(ang)*(ww_r*0.42), ww_z + math.sin(ang)*(ww_r*0.42)), 'timber', rot_euler=(ang, 0, 0))
        
    # 5. STACKED LOG PILES IN FRONT
    pile_x = sx - 0.10
    pile_y = sy - sl*0.50 - 0.38
    log_r = 0.16
    log_l = 1.30
    for idx, lx in enumerate([-0.35, 0.0, 0.35]):
        add_cylinder(f"LogB_{idx}", log_r, log_l, (pile_x + lx, pile_y, log_r), 'log_bark', segments=12, rot_euler=(0, math.radians(90), 0))
        add_cylinder(f"LogCapL_{idx}", log_r * 0.96, 0.02, (pile_x + lx - log_l/2, pile_y, log_r), 'log_end', segments=12, rot_euler=(0, math.radians(90), 0))
        add_cylinder(f"LogCapR_{idx}", log_r * 0.96, 0.02, (pile_x + lx + log_l/2, pile_y, log_r), 'log_end', segments=12, rot_euler=(0, math.radians(90), 0))
    for idx, lx in enumerate([-0.18, 0.18]):
        add_cylinder(f"LogT_{idx}", log_r, log_l, (pile_x + lx, pile_y, log_r * 2.6), 'log_bark', segments=12, rot_euler=(0, math.radians(90), 0))
        add_cylinder(f"LogCapTL_{idx}", log_r * 0.96, 0.02, (pile_x + lx - log_l/2, pile_y, log_r * 2.6), 'log_end', segments=12, rot_euler=(0, math.radians(90), 0))
        
    # Tier evolutions
    if tier >= 2:
        crane_x = sx - sw*0.50 - 0.18
        add_box("CraneMast", (0.14, 0.14, sh * 1.55), (crane_x, sy, sh * 0.75), 'timber')
        add_box("CraneBoom", (0.85, 0.10, 0.10), (crane_x + 0.25, sy - 0.15, sh * 1.50), 'timber', rot_z=0.20)
        add_cylinder("CraneHook", 0.08, 0.08, (crane_x + 0.60, sy - 0.22, sh * 1.10), 'iron', segments=8)
        
    if tier >= 3:
        add_box("BackShop", (sw * 0.90, sl * 0.60, sh), (sx, sy + sl*0.50, 0.25 + sh/2), 'plaster_cream')
        add_gable_roof("BackShopRoof", sw + 0.15, sl * 0.70, 0.70, (sx, sy + sl*0.50, 0.25 + sh), 'roof_slate')
        
    if tier >= 4:
        add_box("StonePierBase", (sw + 0.25, sl + 0.25, 0.35), (sx, sy, 0.175), 'sandstone')
        add_cylinder("SecondSawBlade", 0.42, 0.02, (sx + 0.25, sy, 0.55), 'iron', segments=16, rot_euler=(0, math.radians(90), 0))
        
    if tier >= 5:
        add_cylinder("CupolaBase", 0.40, 0.45, (sx, sy, 0.25 + sh + 0.85), 'sandstone_light', segments=8)
        add_cone("CupolaDome", 0.46, 0.60, (sx, sy, 0.25 + sh + 1.30), 'roof_copper', segments=12)
        add_cylinder("CupolaFinial", 0.05, 0.28, (sx, sy, 0.25 + sh + 1.90), 'gold', segments=8)

# =============================================================================
# 4. MINE (معدن طلا)
# =============================================================================
def build_mine(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-18.0))
    
    # 1. Mountain Rocky Crag - Clustered boulders forming cavern backdrop
    add_box("RockBackdrop", (2.80, 2.00, 1.50), (0, 0.85, 0.75), 'rock_dark')
    add_cylinder("BoulderL", 0.95, 1.80, (-0.95, 0.70, 0), 'rock_dark', segments=7)
    add_cylinder("BoulderR", 0.90, 1.75, (0.95, 0.75, 0), 'stone_dark', segments=7)
    add_cylinder("BoulderTop", 1.15, 0.90, (0, 0.65, 1.45), 'rock_dark', segments=8)
    
    # 2. Dark Cavern Void
    cave_w = 1.35 + (tier-1)*0.08
    cave_h = 1.45 + (tier-1)*0.10
    add_box("CaveVoid", (cave_w, 0.90, cave_h), (0, 0.25, cave_h/2), 'rock_dark')
    
    # 3. PROMINENT TIMBER MINE PORTAL (Out front, framing the cave!)
    portal_y = -0.35
    post_w = 0.22
    add_box("PostL", (post_w, 0.30, cave_h + 0.18), (-cave_w/2 - post_w/2, portal_y, (cave_h + 0.18)/2), 'timber')
    add_box("PostR", (post_w, 0.30, cave_h + 0.18), (cave_w/2 + post_w/2, portal_y, (cave_h + 0.18)/2), 'timber')
    add_box("LintelBeam", (cave_w + post_w*2 + 0.30, 0.34, 0.28), (0, portal_y, cave_h + 0.12), 'timber')
    # Knee braces
    add_box("BraceL", (0.12, 0.26, 0.40), (-cave_w/2 + 0.08, portal_y, cave_h - 0.06), 'timber', rot_z=0.45)
    add_box("BraceR", (0.12, 0.26, 0.40), (cave_w/2 - 0.08, portal_y, cave_h - 0.06), 'timber', rot_z=-0.45)
    # Timber retaining bulkhead above portal holding the rock
    add_box("RetainingBulkhead", (cave_w + 0.45, 0.16, 0.55), (0, portal_y + 0.18, cave_h + 0.42), 'timber_plank')
    
    # 4. Hanging Miner's Lantern
    add_box("LanternArm", (0.04, 0.24, 0.04), (cave_w/2 + post_w/2, portal_y - 0.15, cave_h - 0.06), 'iron')
    add_cylinder("Lantern", 0.09, 0.20, (cave_w/2 + post_w/2, portal_y - 0.24, cave_h - 0.24), 'window_glow', segments=8)
    
    # 5. DUAL IRON RAILROAD TRACKS
    rail_len = 1.90
    rail_y = -0.90
    gauge = 0.58
    add_box("RailL", (0.06, rail_len, 0.06), (-gauge/2, rail_y, 0.03), 'iron')
    add_box("RailR", (0.06, rail_len, 0.06), (gauge/2, rail_y, 0.03), 'iron')
    for idx, sy in enumerate([-0.30, -0.60, -0.90, -1.20, -1.50]):
        add_box(f"Sleeper_{idx}", (gauge + 0.32, 0.13, 0.04), (0, sy, 0.02), 'timber')
        
    # 6. WOODEN MINECART LOADED WITH GOLD ORE NUGGETS!
    cart_y = -0.80
    cart_w = 0.70
    cart_l = 0.90
    cart_h = 0.45
    add_box("CartBucket", (cart_w, cart_l, cart_h), (0, cart_y, 0.12 + cart_h/2), 'timber_plank')
    add_box("CartBand", (cart_w + 0.02, cart_l + 0.02, 0.06), (0, cart_y, 0.12 + cart_h*0.80), 'iron')
    for wx in [-gauge/2, gauge/2]:
        for wy in [cart_y - cart_l*0.30, cart_y + cart_l*0.30]:
            add_cylinder(f"CartWheel_{wx}_{wy}", 0.12, 0.05, (wx, wy, 0.10), 'iron', segments=10, rot_euler=(0, math.radians(90), 0))
    # Glowing Gold Heap in Cart
    add_cylinder("GoldMound", cart_w * 0.38, 0.24, (0, cart_y, 0.12 + cart_h + 0.05), 'gold', segments=10)
    for i in range(5):
        ang = i * (2 * math.pi / 5)
        nx = math.cos(ang) * 0.18
        ny = cart_y + math.sin(ang) * 0.22
        add_sphere(f"GoldNugget_{i}", 0.11, (nx, ny, 0.12 + cart_h + 0.12), 'gold')
    # Spilled Gold Ore on ground
    add_sphere("SpilledGold1", 0.12, (0.55, -0.75, 0.10), 'gold')
    add_sphere("SpilledGold2", 0.09, (0.65, -0.90, 0.08), 'gold')
    
    # Tier evolutions
    if tier >= 2:
        dh = cave_h * 1.65
        add_box("DerrickL", (0.14, 0.14, dh), (-cave_w*0.42, portal_y, dh/2), 'timber')
        add_box("DerrickR", (0.14, 0.14, dh), (cave_w*0.42, portal_y, dh/2), 'timber')
        add_box("DerrickCross", (cave_w*0.95, 0.14, 0.14), (0, portal_y, dh - 0.15), 'timber')
        add_cylinder("HoistWheel", 0.40, 0.08, (0, portal_y, dh - 0.05), 'iron', segments=16)
        
    if tier >= 3:
        add_box("SortingShed", (1.10, 1.20, 1.10), (-cave_w - 0.45, 0, 0.55), 'plaster_cream')
        add_gable_roof("SortingRoof", 1.25, 1.35, 0.70, (-cave_w - 0.45, 0, 1.10), 'roof_slate')
        
    if tier >= 4:
        add_box("GraniteArchL", (0.45, 0.40, cave_h + 0.50), (-cave_w/2 - 0.35, portal_y - 0.05, (cave_h + 0.50)/2), 'stone_dark')
        add_box("GraniteArchR", (0.45, 0.40, cave_h + 0.50), (cave_w/2 + 0.35, portal_y - 0.05, (cave_h + 0.50)/2), 'stone_dark')
        add_box("GraniteArchTop", (cave_w + 1.25, 0.40, 0.40), (0, portal_y - 0.05, cave_h + 0.55), 'sandstone')
        
    if tier >= 5:
        add_cylinder("GildedHoist", 0.55, 0.12, (0, portal_y, dh + 0.15), 'gold', segments=16)
        add_box("GoldBarsStack", (0.45, 0.55, 0.28), (-cave_w * 0.75, -0.65, 0.14), 'gold')
        add_sphere("CrystalTorchL", 0.15, (-cave_w/2 - 0.35, portal_y - 0.25, cave_h), 'magic_cyan')
        add_sphere("CrystalTorchR", 0.15, (cave_w/2 + 0.35, portal_y - 0.25, cave_h), 'magic_cyan')

# =============================================================================
# 5. GRAND MARKET (بازار بزرگ)
# =============================================================================
def build_grand_market(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    mw, ml = 2.10 + (tier-1)*0.10, 1.80 + (tier-1)*0.08
    col_h = 1.35
    
    # 1. Stepped Sandstone Plinth
    add_box("MktPlinth", (mw + 0.20, ml + 0.20, 0.18), (0, 0, 0.09), 'sandstone')
    
    # 2. 4 Carved Timber Posts
    for px in [-mw*0.42, mw*0.42]:
        for py in [-ml*0.42, ml*0.42]:
            add_cylinder(f"MktCol_{px}_{py}", 0.10, col_h, (px, py, 0.18), 'timber', segments=8)
            
    # 3. FESTIVE 8-FACET STRIPED FABRIC TENT CANOPY (No blue conical roof!)
    roof_z = 0.18 + col_h
    roof_h = 0.95 + (tier-1)*0.12
    tent_r = mw * 0.75
    add_striped_tent_roof("MarketTent", tent_r, roof_h, (0, 0, roof_z), 'fabric_red', 'fabric_white', segments=8)
    
    # 4. Scalloped Valance Flaps
    add_box("ValanceF", (mw + 0.20, 0.04, 0.18), (0, -ml*0.42 - 0.10, roof_z - 0.05), 'fabric_red')
    add_box("ValanceTrimF", (mw + 0.20, 0.05, 0.04), (0, -ml*0.42 - 0.10, roof_z - 0.14), 'gold')
    
    # 5. Wooden Vendor Display Counters & Stalls
    add_box("CounterFront", (mw * 0.70, 0.45, 0.45), (0, -ml*0.18, 0.18 + 0.225), 'timber_plank')
    add_box("CounterBack", (mw * 0.70, 0.45, 0.55), (0, ml*0.22, 0.18 + 0.275), 'timber_plank')
    
    # 6. Hanging Brass Balance Scales
    scale_x, scale_y, scale_z = 0.0, -ml*0.18, 0.18 + 0.45
    add_cylinder("ScaleStem", 0.02, 0.26, (scale_x, scale_y, scale_z), 'gold', segments=6)
    add_box("ScaleBeam", (0.32, 0.02, 0.02), (scale_x, scale_y, scale_z + 0.24), 'gold')
    add_cylinder("ScalePanL", 0.07, 0.02, (scale_x - 0.14, scale_y, scale_z + 0.14), 'gold', segments=8)
    add_cylinder("ScalePanR", 0.07, 0.02, (scale_x + 0.14, scale_y, scale_z + 0.14), 'gold', segments=8)
    
    # 7. Crates of Produce & Coins
    add_box("CrateApples", (0.35, 0.35, 0.25), (-mw*0.32, -ml*0.42 - 0.05, 0.18 + 0.125), 'timber')
    add_sphere("ApplesGlow", 0.12, (-mw*0.32, -ml*0.42 - 0.05, 0.18 + 0.26), 'fabric_red')
    add_box("CrateGold", (0.35, 0.35, 0.25), (mw*0.32, -ml*0.42 - 0.05, 0.18 + 0.125), 'timber')
    add_cylinder("CoinsPile", 0.12, 0.06, (mw*0.32, -ml*0.42 - 0.05, 0.18 + 0.27), 'gold', segments=8)
    
    # Tier evolutions
    if tier >= 2:
        stall_x = mw * 0.55
        add_box("SideStallBase", (0.85, 1.10, 0.15), (stall_x, 0, 0.08), 'sandstone')
        add_striped_tent_roof("SideTent", 0.65, 0.70, (stall_x, 0, 0.18 + col_h*0.80), 'fabric_blue', 'fabric_gold', segments=6)
        
    if tier >= 3:
        add_box("GuildFloor", (mw * 0.85, ml * 0.70, 0.85), (0, ml * 0.25, roof_z + 0.35), 'plaster_cream')
        add_window((0, ml * 0.25 - ml*0.35 - 0.02, roof_z + 0.35), width=0.35, height=0.45)
        add_cylinder("TradingBell", 0.14, 0.22, (0, -ml*0.30, roof_z + 0.85), 'gold', segments=10)
        
    if tier >= 4:
        add_cylinder("MktClockDrum", 0.55, 0.50, (0, 0, roof_z + 0.95), 'sandstone_light', segments=12)
        add_cone("MktClockRoof", 0.62, 0.80, (0, 0, roof_z + 1.45), 'roof_copper', segments=12)
        add_cylinder("MktClockSpire", 0.05, 0.32, (0, 0, roof_z + 2.25), 'gold', segments=8)
        
    if tier >= 5:
        add_cylinder("RoyalEagleSpire", 0.45, 1.20, (0, 0, roof_z + 1.65), 'sandstone_light', segments=12)
        add_cone("GildedApexDome", 0.52, 1.00, (0, 0, roof_z + 2.85), 'gold', segments=12)
        add_banner((0, -0.05, roof_z + 3.85), width=0.55, length=1.10, mat_key='banner_cobalt', emblem_key='gold')

# =============================================================================
# 6. ACADEMY (آموزشگاه کهن)
# =============================================================================
def build_academy(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    tw = 1.35 + (tier-1)*0.06
    th = 2.40 + (tier-1)*0.22
    
    # 1. Stepped Octagonal Stone Base
    add_cylinder("AcadBase0", tw * 0.72, 0.25, (0, 0, 0), 'stone_dark', segments=8)
    add_cylinder("AcadBase1", tw * 0.65, 0.20, (0, 0, 0.25), 'sandstone', segments=8)
    
    # 2. Octagonal Wizard Tower Shaft
    add_cylinder("MainSpireShaft", tw * 0.55, th, (0, 0, 0.45), 'sandstone', segments=8)
    
    # 3. 4 Gothic Buttresses
    for i in range(4):
        ang = i * (math.pi / 2) + math.radians(45)
        bx = math.cos(ang) * (tw * 0.60)
        by = math.sin(ang) * (tw * 0.60)
        add_box(f"Buttress_{i}", (0.22, 0.22, th * 0.75), (bx, by, 0.45 + (th*0.75)/2), 'stone_dark', rot_z=ang)
    
    # 4. High Arched Stained-Glass Window
    add_window((0, -tw*0.55 - 0.02, 0.45 + th*0.45), width=0.28, height=0.55)
    
    # 5. Observatory Balcony
    balc_z = 0.45 + th
    balc_r = tw * 0.68
    add_cylinder("BalconyFloor", balc_r, 0.16, (0, 0, balc_z), 'stone_dark', segments=12)
    add_cylinder("BalconyRailing", balc_r + 0.04, 0.24, (0, 0, balc_z + 0.16), 'sandstone', segments=12)
    
    # 6. Conical Slate Roof
    roof_z = balc_z + 0.16
    roof_h = 1.15
    add_cone("AcadConeRoof", balc_r * 0.85, roof_h, (0, 0, roof_z), 'roof_slate', segments=8)
    
    # 7. CROWNING ARCANE CELESTIAL SPHERE / MAGIC CRYSTAL (CYAN EMISSION)
    crystal_z = roof_z + roof_h + 0.35
    add_cylinder("CrystalPedestal", 0.14, 0.28, (0, 0, roof_z + roof_h), 'gold', segments=8)
    add_cone("CrystalCup", 0.28, 0.16, (0, 0, roof_z + roof_h + 0.20), 'gold', segments=8)
    # Radiant Arcane Core
    add_sphere("CelestialOrb", 0.34 + (tier-1)*0.04, (0, 0, crystal_z), 'magic_cyan', segments=16, rings=12)
    # Concentric Brass Armillary Rings
    add_cylinder("ArmillaryRing1", 0.48 + (tier-1)*0.04, 0.03, (0, 0, crystal_z), 'gold', segments=16, rot_euler=(math.radians(35), math.radians(20), 0))
    add_cylinder("ArmillaryRing2", 0.44 + (tier-1)*0.04, 0.03, (0, 0, crystal_z), 'gold', segments=16, rot_euler=(math.radians(-35), math.radians(-25), 0))
    
    # 8. Attached Library Annex Wing
    lib_w, lib_l, lib_h = 1.10, 1.30, 1.20
    lib_x, lib_y = tw * 0.75, 0.10
    add_box("LibraryPlinth", (lib_w + 0.10, lib_l + 0.10, 0.20), (lib_x, lib_y, 0.10), 'stone_dark')
    add_box("LibraryWalls", (lib_w, lib_l, lib_h), (lib_x, lib_y, 0.20 + lib_h/2), 'sandstone')
    add_gable_roof("LibraryRoof", lib_w + 0.18, lib_l + 0.18, 0.75, (lib_x, lib_y, 0.20 + lib_h), 'roof_slate')
    
    # Tier evolutions
    if tier >= 2:
        add_cylinder("TelescopeTube", 0.06, 0.55, (balc_r * 0.40, -balc_r * 0.40, balc_z + 0.45), 'gold', segments=8, rot_euler=(math.radians(-40), math.radians(20), 0))
        
    if tier >= 3:
        add_cylinder("ArmillaryRing3", 0.52, 0.03, (0, 0, crystal_z), 'gold', segments=16, rot_euler=(0, 0, math.radians(45)))
        add_cylinder("RoseWinRim", 0.35, 0.04, (0, -tw*0.55 - 0.03, 0.45 + th*0.75), 'gold', segments=16, rot_euler=(math.radians(90), 0, 0))
        add_cylinder("RoseWinGlass", 0.30, 0.05, (0, -tw*0.55 - 0.03, 0.45 + th*0.75), 'window_glow', segments=16, rot_euler=(math.radians(90), 0, 0))
        
    if tier >= 4:
        for idx, ang_deg in enumerate([30, 150, 270]):
            rad = math.radians(ang_deg)
            sx = math.cos(rad) * (tw + 0.40)
            sy = math.sin(rad) * (tw + 0.40)
            add_cone(f"FloatShard_{idx}", 0.12, 0.35, (sx, sy, crystal_z - 0.20), 'magic_cyan', segments=6)
            
    if tier >= 5:
        add_cylinder("AstralSpire", 0.50, 1.20, (0, 0, crystal_z + 0.50), 'sandstone_light', segments=12)
        add_sphere("SupernovaCore", 0.48, (0, 0, crystal_z + 1.80), 'magic_cyan', segments=16, rings=12)
        add_cylinder("AstralRingGold", 0.72, 0.04, (0, 0, crystal_z + 1.80), 'gold', segments=20, rot_euler=(math.radians(25), math.radians(-35), 0))

# =============================================================================
# 7. BLACKSMITH (هنگر و آهنگری)
# =============================================================================
def build_blacksmith(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    bw, bl = 1.95 + (tier-1)*0.10, 1.65
    
    # 1. Stone Plinth
    add_box("SmithPlinth", (bw + 0.14, bl + 0.14, 0.22), (0, 0, 0.11), 'stone_dark')
    
    # 2. HEAVY STONE FORGE HEARTH & BLAST CHIMNEY (Back-Right)
    chim_w = 0.85 + (tier-1)*0.06
    chim_h = 2.45 + (tier-1)*0.20
    chim_x = bw * 0.25
    chim_y = 0.15
    add_box("BlastChimney", (chim_w, chim_w, chim_h), (chim_x, chim_y, chim_h/2), 'stone_dark')
    add_box("ChimneyCrown", (chim_w + 0.12, chim_w + 0.12, 0.16), (chim_x, chim_y, chim_h + 0.08), 'sandstone')
    add_cylinder("ChimneyPot", 0.18, 0.25, (chim_x, chim_y, chim_h + 0.20), 'roof_terracotta', segments=10)
    
    # 3. WIDE OPEN FORGE FIRE MOUTH FACING CAMERA WITH BLINDING ORANGE COALS!
    hearth_w = chim_w * 0.80
    hearth_h = 0.75
    add_box("HearthArchL", (0.16, 0.38, hearth_h), (chim_x - hearth_w/2, chim_y - chim_w/2 - 0.15, 0.22 + hearth_h/2), 'stone_dark')
    add_box("HearthArchR", (0.16, 0.38, hearth_h), (chim_x + hearth_w/2, chim_y - chim_w/2 - 0.15, 0.22 + hearth_h/2), 'stone_dark')
    add_box("HearthLintel", (hearth_w + 0.32, 0.38, 0.20), (chim_x, chim_y - chim_w/2 - 0.15, 0.22 + hearth_h + 0.10), 'stone_dark')
    add_box("BlazingCoals", (hearth_w * 0.85, 0.32, 0.32), (chim_x, chim_y - chim_w/2 - 0.12, 0.22 + 0.16), 'forge_glow')
    
    # 4. Open Timber Shelter Canopy (Left side)
    can_h = 1.35
    add_box("SmithPost1", (0.15, 0.15, can_h), (-bw*0.42, -bl*0.40, 0.22 + can_h/2), 'timber')
    add_box("SmithPost2", (0.15, 0.15, can_h), (-bw*0.42, bl*0.40, 0.22 + can_h/2), 'timber')
    add_gable_roof("SmithRoof", bw * 0.85, bl + 0.20, 0.85, (-bw*0.12, 0, 0.22 + can_h), 'roof_slate')
    
    # 5. MASSIVE IRON ANVIL ON TIMBER TREE STUMP (RIGHT IN FRONT IN THE SUNLIGHT!)
    stump_x, stump_y = -bw * 0.08, -bl * 0.48
    add_cylinder("AnvilStump", 0.28, 0.44, (stump_x, stump_y, 0.22), 'log_bark', segments=12)
    # Iron Anvil
    add_box("AnvilBase", (0.36, 0.26, 0.09), (stump_x, stump_y, 0.66 + 0.045), 'iron')
    add_box("AnvilWaist", (0.22, 0.18, 0.12), (stump_x, stump_y, 0.75 + 0.06), 'iron')
    add_box("AnvilFace", (0.44, 0.24, 0.10), (stump_x, stump_y, 0.87 + 0.05), 'iron')
    add_cone("AnvilHorn", 0.11, 0.24, (stump_x + 0.26, stump_y, 0.87 + 0.05), 'iron', segments=8, rot_euler=(0, math.radians(90), 0))
    # Hammer resting on anvil
    add_box("HammerHead", (0.12, 0.06, 0.06), (stump_x - 0.05, stump_y, 0.97 + 0.03), 'iron')
    add_box("HammerHandle", (0.03, 0.22, 0.03), (stump_x - 0.05, stump_y - 0.08, 0.97 + 0.03), 'timber')
    
    # 6. Stone Water Quench Trough (Beside anvil)
    trough_x, trough_y = -bw * 0.40, -bl * 0.20
    add_box("WaterTrough", (0.38, 0.75, 0.35), (trough_x, trough_y, 0.22 + 0.175), 'stone_dark')
    add_box("TroughWater", (0.30, 0.67, 0.04), (trough_x, trough_y, 0.22 + 0.32), 'water')
    
    # Tier evolutions
    if tier >= 2:
        add_box("RackBeam", (0.55, 0.08, 0.60), (-bw*0.42, 0.10, 0.22 + 0.30), 'timber')
        add_cylinder("Blade1", 0.025, 0.52, (-bw*0.42, 0.14, 0.55), 'iron', segments=6)
        add_cylinder("Blade2", 0.025, 0.52, (-bw*0.42 + 0.16, 0.14, 0.55), 'iron', segments=6)
        add_box("Bellows", (0.35, 0.45, 0.20), (chim_x - hearth_w - 0.15, chim_y - 0.15, 0.32), 'timber')
        
    if tier >= 3:
        add_box("SecondChimney", (chim_w*0.80, chim_w*0.80, chim_h*0.85), (chim_x, chim_y + chim_w*0.80, chim_h*0.42), 'stone_dark')
        add_box("TripHammerArm", (0.65, 0.10, 0.10), (-0.10, chim_y - 0.10, 0.65), 'iron')
        
    if tier >= 4:
        add_box("ForgeParapet", (bw * 0.95, 0.16, 0.35), (-bw*0.05, -bl*0.42, 0.22 + can_h + 0.18), 'stone_dark')
        add_box("MasterArmorStand", (0.30, 0.30, 0.75), (-bw*0.35, bl*0.30, 0.22 + 0.375), 'gold')
        
    if tier >= 5:
        add_box("LavaChannel", (bw * 0.70, 0.22, 0.10), (0, -0.25, 0.22 + 0.05), 'forge_glow')
        add_cone("DragonFurnaceCrown1", 0.52, 0.65, (chim_x, chim_y, chim_h + 0.30), 'gold', segments=8)
        add_cone("DragonFurnaceCrown2", 0.46, 0.55, (chim_x, chim_y + chim_w*0.80, chim_h*0.85 + 0.28), 'gold', segments=8)

# =============================================================================
# 8. WATCHTOWER (برج دیده‌بانی)
# =============================================================================
def build_watchtower(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    tw_base = 1.40 + (tier-1)*0.08
    tw_top = 1.05 + (tier-1)*0.06
    th = 2.45 + (tier-1)*0.22
    
    # 1. Low Stone Foundation
    add_box("TowerPlinth", (tw_base + 0.30, tw_base + 0.30, 0.25), (0, 0, 0.125), 'stone_dark')
    
    # 2. 4 Flared Timber Corner Posts (Tapered upward)
    for x_sign in [-1, 1]:
        for y_sign in [-1, 1]:
            bx = x_sign * (tw_base * 0.44)
            by = y_sign * (tw_base * 0.44)
            tx = x_sign * (tw_top * 0.44)
            ty = y_sign * (tw_top * 0.44)
            add_box(f"CornerPost_{x_sign}_{y_sign}", (0.14, 0.14, th), 
                    ((bx + tx)/2, (by + ty)/2, 0.25 + th/2), 'timber')
            add_box(f"CrossBrace1_{x_sign}_{y_sign}", (0.08, 0.08, th * 0.70), 
                    ((bx + tx)/2, (by + ty)/2, 0.25 + th * 0.45), 'timber', rot_z=0.78)
            
    # 3. Central Enclosed Sentry Box
    add_box("SentryShaft", (tw_top * 0.82, tw_top * 0.82, th * 0.85), (0, 0, 0.25 + (th*0.85)/2), 'sandstone')
    add_window((0, -tw_top * 0.42, 0.25 + th * 0.45), width=0.20, height=0.35)
    
    # 4. Elevated Observation Platform (Crow's Nest)
    deck_z = 0.25 + th
    deck_w = tw_top + 0.55
    add_box("DeckFloor", (deck_w, deck_w, 0.14), (0, 0, deck_z + 0.07), 'timber_plank')
    
    # 5. Wooden Railing around platform
    for rx in [-deck_w/2, deck_w/2]:
        for ry in [-deck_w/2, deck_w/2]:
            add_box(f"RailPost_{rx}_{ry}", (0.08, 0.08, 0.40), (rx*0.92, ry*0.92, deck_z + 0.14 + 0.20), 'timber')
    add_box("RailF", (deck_w * 0.90, 0.05, 0.05), (0, -deck_w/2 + 0.04, deck_z + 0.14 + 0.36), 'timber')
    add_box("RailL", (0.05, deck_w * 0.90, 0.05), (-deck_w/2 + 0.04, 0, deck_z + 0.14 + 0.36), 'timber')
    add_box("RailR", (0.05, deck_w * 0.90, 0.05), (deck_w/2 - 0.04, 0, deck_z + 0.14 + 0.36), 'timber')
    
    # 6. 4 Posts supporting Pyramid Roof
    post_h = 0.75
    for px in [-deck_w*0.35, deck_w*0.35]:
        for py in [-deck_w*0.35, deck_w*0.35]:
            add_box(f"RoofPost_{px}_{py}", (0.08, 0.08, post_h), (px, py, deck_z + 0.14 + post_h/2), 'timber')
            
    # 7. Pyramidal Slate Roof
    roof_z = deck_z + 0.14 + post_h
    roof_h = 0.95
    roof_mat = 'gold' if tier == 5 else 'roof_slate'
    add_cone("WatchRoof", deck_w * 0.70, roof_h, (0, 0, roof_z), roof_mat, segments=4)
    add_cylinder("SpireTip", 0.04, 0.25, (0, 0, roof_z + roof_h), 'gold', segments=6)
    
    # 8. HANGING BRASS ALARM BELL UNDER ROOF!
    add_cylinder("BellYoke", 0.03, 0.20, (0, 0, roof_z - 0.08), 'timber', segments=6, rot_euler=(0, math.radians(90), 0))
    add_cone("AlarmBell", 0.13, 0.20, (0, 0, roof_z - 0.26), 'gold', segments=12)
    
    # 9. Fiery Signal Brazier Basket on front corner of balcony
    br_x, br_y = deck_w * 0.38, -deck_w * 0.38
    add_cylinder("BrazierStand", 0.07, 0.26, (br_x, br_y, deck_z + 0.14), 'iron', segments=6)
    add_cylinder("BrazierBowl", 0.16, 0.08, (br_x, br_y, deck_z + 0.14 + 0.26), 'iron', segments=10)
    add_sphere("BrazierFlame", 0.10, (br_x, br_y, deck_z + 0.14 + 0.34), 'forge_glow')
    
    # Tier evolutions
    if tier >= 2:
        add_box("StoneSkirt", (tw_base * 0.95, tw_base * 0.95, th * 0.45), (0, 0, 0.25 + th * 0.225), 'stone_dark')
        add_banner((deck_w * 0.42, 0, deck_z + 0.45), width=0.28, length=0.65, mat_key='banner_cobalt')
        
    if tier >= 3:
        add_box("BallistaCross", (0.50, 0.05, 0.05), (-deck_w * 0.20, -deck_w * 0.20, deck_z + 0.35), 'iron')
        add_box("BallistaStand", (0.12, 0.22, 0.25), (-deck_w * 0.20, -deck_w * 0.15, deck_z + 0.22), 'timber')
        
    if tier >= 4:
        upper_deck_z = roof_z + roof_h
        add_box("UpperCrowNest", (deck_w * 0.65, deck_w * 0.65, 0.12), (0, 0, upper_deck_z), 'timber_plank')
        add_cone("UpperRoof", deck_w * 0.50, 0.70, (0, 0, upper_deck_z + 0.50), 'roof_slate', segments=4)
        
    if tier >= 5:
        add_cone("CitadelGildedSpire", deck_w * 0.75, 1.35, (0, 0, roof_z), 'gold', segments=8)
        add_sphere("BeaconCore", 0.26, (0, 0, roof_z + 1.65), 'forge_glow')
        add_cylinder("BeaconLanternFrame", 0.30, 0.45, (0, 0, roof_z + 1.65), 'gold', segments=8)

# =============================================================================
# 9. WORKSHOP (کارگاه اختراعات)
# =============================================================================
def build_workshop(tier):
    root_empty.rotation_euler = (0, 0, math.radians(-32.0))
    ww, wl, wh = 1.90 + (tier-1)*0.10, 1.50, 1.35
    
    # 1. Plinth & Timber Walls
    add_box("WkPlinth", (ww + 0.12, wl + 0.12, 0.24), (0, 0, 0.12), 'stone_dark')
    add_box("WkWalls", (ww, wl, wh), (0, 0, 0.24 + wh/2), 'timber_plank')
    for x in [-ww/2, ww/2]:
        for y in [-wl/2, wl/2]:
            add_box(f"WkPost_{x}_{y}", (0.14, 0.14, wh), (x, y, 0.24 + wh/2), 'timber')
            
    # 2. Terracotta Gable Roof
    roof_z = 0.24 + wh
    roof_h = 1.00 + (tier-1)*0.10
    add_gable_roof("WkRoof", ww + 0.22, wl + 0.22, roof_h, (0, 0, roof_z), 'roof_terracotta')
    
    # 3. PROMINENT INTERLOCKING GEARS MOUNTED DIRECTLY ON FRONT FACADE!
    gear_y = -wl/2 - 0.06
    # Gear 1: Large Gold Brass Gear
    g1_r = 0.42 + (tier-1)*0.04
    g1_x, g1_z = -0.32, 0.24 + wh * 0.65
    add_cylinder("BrassGearHub", g1_r, 0.08, (g1_x, gear_y, g1_z), 'gold', segments=16, rot_euler=(math.radians(90), 0, 0))
    add_cylinder("BrassGearPin", 0.12, 0.12, (g1_x, gear_y, g1_z), 'iron', segments=10, rot_euler=(math.radians(90), 0, 0))
    for i in range(10):
        ang = i * (2 * math.pi / 10)
        tx = g1_x + math.cos(ang) * (g1_r + 0.06)
        tz = g1_z + math.sin(ang) * (g1_r + 0.06)
        add_box(f"G1Tooth_{i}", (0.10, 0.08, 0.12), (tx, gear_y, tz), 'gold', rot_euler=(0, -ang, 0))
        
    # Gear 2: Interlocking Medium Iron Cog
    g2_r = 0.28 + (tier-1)*0.03
    g2_x, g2_z = 0.32, 0.24 + wh * 0.72
    add_cylinder("IronGearHub", g2_r, 0.08, (g2_x, gear_y, g2_z), 'iron', segments=16, rot_euler=(math.radians(90), 0, 0))
    add_cylinder("IronGearPin", 0.09, 0.12, (g2_x, gear_y, g2_z), 'gold', segments=10, rot_euler=(math.radians(90), 0, 0))
    for i in range(8):
        ang = i * (2 * math.pi / 8) + math.radians(22.5)
        tx = g2_x + math.cos(ang) * (g2_r + 0.05)
        tz = g2_z + math.sin(ang) * (g2_r + 0.05)
        add_box(f"G2Tooth_{i}", (0.08, 0.08, 0.10), (tx, gear_y, tz), 'iron', rot_euler=(0, -ang, 0))
        
    # 4. COPPER STEAM BOILER (Right side)
    boiler_x = ww * 0.42
    boiler_y = 0.15
    boiler_r = 0.38 + (tier-1)*0.04
    boiler_h = 1.20
    add_cylinder("CopperBoiler", boiler_r, boiler_h, (boiler_x, boiler_y, 0.24), 'copper', segments=16)
    add_sphere("BoilerDome", boiler_r, (boiler_x, boiler_y, 0.24 + boiler_h), 'copper')
    add_cylinder("SteamFlue", 0.10, 0.90, (boiler_x, boiler_y, 0.24 + boiler_h + 0.35), 'iron', segments=8)
    add_cone("ChimneyFunnel", 0.18, 0.20, (boiler_x, boiler_y, 0.24 + boiler_h + 1.25), 'copper', segments=8)
    
    # 5. TIMBER CRANE DERRICK (Left side, freestanding on ground)
    crane_x = -ww * 0.50
    crane_h = wh * 1.45
    add_box("CraneMast", (0.14, 0.14, crane_h), (crane_x, 0.10, 0.24 + crane_h/2), 'timber')
    add_box("CraneBoom", (0.95, 0.10, 0.10), (crane_x + 0.30, -0.15, 0.24 + crane_h - 0.05), 'timber', rot_z=0.25)
    add_cylinder("PulleyWheel", 0.10, 0.04, (crane_x + 0.70, -0.25, 0.24 + crane_h - 0.12), 'iron', segments=10, rot_euler=(0, math.radians(90), 0))
    add_cylinder("HoistCable", 0.015, 0.55, (crane_x + 0.70, -0.25, 0.24 + crane_h - 0.40), 'iron', segments=6)
    add_box("CargoHook", (0.08, 0.08, 0.12), (crane_x + 0.70, -0.25, 0.24 + crane_h - 0.70), 'iron')
    
    # 6. Door & Front Workbench
    add_door((0, -wl/2 - 0.02, 0.24), width=0.55, height=0.85)
    
    # Tier evolutions
    if tier >= 2:
        add_cylinder("Pipe1", 0.04, 0.85, (boiler_x - boiler_r*0.75, boiler_y - 0.15, 0.24 + 0.42), 'gold', segments=6)
        
    if tier >= 3:
        g3_r = 0.22
        g3_x, g3_z = 0, roof_z + roof_h * 0.50
        add_cylinder("ApexGearHub", g3_r, 0.07, (g3_x, gear_y, g3_z), 'gold', segments=12, rot_euler=(math.radians(90), 0, 0))
        add_box("DraftDormer", (0.50, 0.45, 0.40), (0, wl * 0.15, roof_z + 0.35), 'plaster_cream')
        add_window((0, wl * 0.15 - 0.25, roof_z + 0.35), width=0.28, height=0.28)
        
    if tier >= 4:
        add_cylinder("PistonCylinder", 0.16, 0.75, (boiler_x + 0.25, boiler_y, 0.60), 'iron', segments=10)
        add_cylinder("PistonRod", 0.06, 0.95, (boiler_x + 0.25, boiler_y, 0.85), 'gold', segments=8)
        
    if tier >= 5:
        master_g_r = 0.58
        add_cylinder("MasterGearHub", master_g_r, 0.10, (0, gear_y - 0.04, roof_z + 0.15), 'gold', segments=20, rot_euler=(math.radians(90), 0, 0))
        for i in range(16):
            ang = i * (2 * math.pi / 16)
            tx = math.cos(ang) * (master_g_r + 0.08)
            tz = roof_z + 0.15 + math.sin(ang) * (master_g_r + 0.08)
            add_box(f"MasterTooth_{i}", (0.10, 0.10, 0.12), (tx, gear_y - 0.04, tz), 'gold', rot_euler=(0, -ang, 0))
        add_cylinder("GyroDome", 0.40, 0.45, (0, 0, roof_z + roof_h + 0.25), 'gold', segments=12)

# -----------------------------------------------------------------------------
# 7. Building Registry
# -----------------------------------------------------------------------------
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
# 8. Main Render Loop
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

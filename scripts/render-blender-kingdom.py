import bpy
import bmesh
import math
import os
import random
import numpy as np

# =============================================================================
# CROWN & COIN - ARTISAN 3D 6-LAYER STYLIZED KINGDOM (BLENDER 5.2.1 LTS)
# =============================================================================
# Full High-Fantasy Overhaul matching building art & candidate-848 direction.
# - High-Resolution Procedural Splatting with direct UV mapping
# - Radiant Golden-Hour Sun & Alpine Sky Lighting (AgX, rich saturation & contrast)
# - Organic Cobblestone Roads & Ancient Sandstone Flagstone Courtyard
# - 6 Dedicated Collections matching gameplay districts and expansion stages
# =============================================================================

OUTPUT_PNG = os.path.abspath(os.path.join("art-source", "terrain", "kingdom-blender-master.png"))
BLEND_FILE = os.path.abspath(os.path.join("art-source", "terrain", "kingdom.blend"))
PREVIEW_MODE = os.environ.get("PREVIEW_RENDER", "0") == "1"

os.makedirs(os.path.dirname(OUTPUT_PNG), exist_ok=True)

# -----------------------------------------------------------------------------
# 1. Reset Scene
# -----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

if not scene.world:
    scene.world = bpy.data.worlds.new("KingdomWorld")

scene.world.use_nodes = True
wnodes = scene.world.node_tree.nodes
wlinks = scene.world.node_tree.links
wnodes.clear()

bg = wnodes.new(type='ShaderNodeBackground')
# Radiant alpine sky ambient fill (rich azure)
bg.inputs['Color'].default_value = (0.32, 0.52, 0.88, 1.0)
bg.inputs['Strength'].default_value = 0.42
wout = wnodes.new(type='ShaderNodeOutputWorld')
wlinks.new(bg.outputs['Background'], wout.inputs['Surface'])

# -----------------------------------------------------------------------------
# 2. Render Settings & Color Management
# -----------------------------------------------------------------------------
if PREVIEW_MODE:
    RENDER_WIDTH = 1024
    RENDER_HEIGHT = 1536
    SAMPLES = 20
else:
    RENDER_WIDTH = 2048
    RENDER_HEIGHT = 3072
    SAMPLES = 24

scene.render.resolution_x = RENDER_WIDTH
scene.render.resolution_y = RENDER_HEIGHT
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.render.threads_mode = 'AUTO'

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - High Contrast'
scene.view_settings.exposure = 0.02
scene.view_settings.gamma = 1.0

# -----------------------------------------------------------------------------
# 3. Exact Isometric Coordinate Math
# -----------------------------------------------------------------------------
PITCH_DEG = 45.0
pitch_rad = math.radians(PITCH_DEG)
sin_pitch = math.sin(pitch_rad)

def px_to_b(px_x, px_y):
    bx = (px_x - 1024.0) / 100.0
    by = ((1536.0 - px_y) / 100.0) / sin_pitch
    return bx, by

# Key Landmark Coordinates
c_x, c_y = px_to_b(1024, 1330)           # Castle -> (0.0, 2.913)
m_x, m_y = px_to_b(1024, 2344)           # Market -> (0.0, -11.427)
f_x, f_y = px_to_b(560, 1916)            # Farm -> (-4.64, -5.374)
l_x, l_y = px_to_b(1488, 1916)           # Lumber -> (+4.64, -5.374)
mine_x, mine_y = px_to_b(674, 730)       # Mine -> (-3.50, +11.399)
bridge_x, bridge_y = px_to_b(1024, 2840) # Bridge -> (0.0, -18.441)
tower_x, tower_y = px_to_b(1488, 600)    # Watchtower -> (+4.64, +13.237)
acad_x, acad_y = px_to_b(1204, 840)      # Academy -> (+1.80, +9.843)
blacksmith_x, blacksmith_y = px_to_b(560, 330) # Blacksmith -> (-4.64, +17.055)
workshop_x, workshop_y = px_to_b(1054, 340)   # Workshop -> (+0.30, +16.914)

# Camera Rig
cam_data = bpy.data.cameras.new("IsometricCamera")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 30.72

cam_obj = bpy.data.objects.new("IsometricCamera", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

cam_dist = 60.0
cam_obj.location = (0.0, -cam_dist * math.cos(pitch_rad), cam_dist * math.sin(pitch_rad))
cam_obj.rotation_euler = (math.radians(90.0 - PITCH_DEG), 0.0, 0.0)

# -----------------------------------------------------------------------------
# 4. Radiant Golden-Hour Lighting Rig
# -----------------------------------------------------------------------------
# Key Sunlight: Radiant warm golden amber from northwest (casting deep shadows to southeast)
# Light vector points (+0.50, -0.60, -0.62)
sun_key_data = bpy.data.lights.new(name="SunKey", type='SUN')
sun_key_data.energy = 5.2
sun_key_data.color = (1.0, 0.88, 0.68) # Warm golden sunlight
sun_key_data.angle = math.radians(2.2) # Soft natural penumbra
sun_key_obj = bpy.data.objects.new(name="SunKey", object_data=sun_key_data)
scene.collection.objects.link(sun_key_obj)
sun_key_obj.rotation_euler = (math.radians(-44.0), math.radians(-30.0), math.radians(12.4))

# Cool Sky Fill: Deep alpine blue ambient light from southeast
sun_fill_data = bpy.data.lights.new(name="SunFill", type='SUN')
sun_fill_data.energy = 1.35
sun_fill_data.color = (0.28, 0.48, 0.88)
sun_fill_data.angle = math.radians(18.0)
sun_fill_obj = bpy.data.objects.new(name="SunFill", object_data=sun_fill_data)
scene.collection.objects.link(sun_fill_obj)
sun_fill_obj.rotation_euler = (math.radians(28.8), math.radians(20.5), math.radians(5.3))

# Warm Earth Bounce: Simulates sunlight bouncing off the golden terrain
sun_bounce_data = bpy.data.lights.new(name="SunBounce", type='SUN')
sun_bounce_data.energy = 0.55
sun_bounce_data.color = (0.35, 0.48, 0.22)
sun_bounce_obj = bpy.data.objects.new(name="SunBounce", object_data=sun_bounce_data)
scene.collection.objects.link(sun_bounce_obj)
sun_bounce_obj.rotation_euler = (math.radians(135.0), 0.0, math.radians(0.0))

# -----------------------------------------------------------------------------
# 5. The 6 Dedicated Layer Collections
# -----------------------------------------------------------------------------
layers = {
    "Layer1_BaseTerrainAndRiver": bpy.data.collections.new("Layer1_BaseTerrainAndRiver"),
    "Layer2_MountainQuarryAndMine": bpy.data.collections.new("Layer2_MountainQuarryAndMine"),
    "Layer3_NorthernTerraceAndForest": bpy.data.collections.new("Layer3_NorthernTerraceAndForest"),
    "Layer4_RoyalCastleCourtyard": bpy.data.collections.new("Layer4_RoyalCastleCourtyard"),
    "Layer5_SunfieldFarm": bpy.data.collections.new("Layer5_SunfieldFarm"),
    "Layer6_LumberYardAndMarket": bpy.data.collections.new("Layer6_LumberYardAndMarket"),
}
for col in layers.values():
    scene.collection.children.link(col)

# -----------------------------------------------------------------------------
# 6. High-Resolution NumPy Splat Map Generation
# -----------------------------------------------------------------------------
print("Generating high-resolution procedural splat map in NumPy...")
SPLAT_W = 1024 if PREVIEW_MODE else 2048
SPLAT_H = 1536 if PREVIEW_MODE else 3072

max_by = 15.36 / sin_pitch # ~21.7223

# Coordinate grid: Y goes from -max_by (South) to +max_by (North)
# Row 0 = South (UV v=0.0), Row H-1 = North (UV v=1.0)
xs = np.linspace(-10.24, 10.24, SPLAT_W, dtype=np.float32)
ys = np.linspace(-max_by, max_by, SPLAT_H, dtype=np.float32)
grid_x, grid_y = np.meshgrid(xs, ys)

def segment_dist_np(gx, gy, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0.0:
        return np.hypot(gx - x1, gy - y1)
    t = np.clip(((gx - x1) * dx + (gy - y1) * dy) / l2, 0.0, 1.0)
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return np.hypot(gx - proj_x, gy - proj_y)

# Road network segments matching gameplay paths
road_segs = [
    # 1. Main Royal Avenue: Castle south to Market
    (0.0, 2.2, 0.0, -9.5),
    # 2. Market south to Bridge
    (0.0, -13.0, 0.0, -17.5),
    # 3. Avenue west to Farm
    (0.0, -3.5, f_x + 1.2, f_y),
    # 4. Avenue east to Lumber
    (0.0, -3.5, l_x - 1.2, l_y),
    # 5. Mountain winding path to Watchtower/Academy
    (0.0, 4.2, 0.8, 6.2),
    (0.8, 6.2, 1.8, 8.8),
    (1.8, 8.8, 3.2, 11.0),
    (3.2, 11.0, tower_x, tower_y),
    # 6. Mountain path to Mine
    (0.0, 4.2, -1.2, 6.8),
    (-1.2, 6.8, -2.4, 9.2),
    (-2.4, 9.2, mine_x, mine_y),
]

min_road_d = np.full((SPLAT_H, SPLAT_W), 999.0, dtype=np.float32)
for seg in road_segs:
    d = segment_dist_np(grid_x, grid_y, seg[0], seg[1], seg[2], seg[3])
    min_road_d = np.minimum(min_road_d, d)

# Multi-octave organic edge noise
noise_edge = np.sin(grid_x * 2.8) * np.cos(grid_y * 2.4) * 0.22 + \
             np.sin(grid_x * 5.6 + 1.2) * np.sin(grid_y * 5.2) * 0.12

perturbed_road_d = min_road_d + noise_edge

# A. Cobblestone / Flagstone Channel (R)
# 1. Castle Hexagonal Courtyard with Interlocking Flagstone Pavers
dx_c = np.abs(grid_x - c_x)
dy_c = np.abs(grid_y - c_y)
hex_d = np.maximum(dx_c * 0.866 + dy_c * 0.5, dy_c)
w_hex = np.clip((2.75 - hex_d) / 0.35, 0.0, 1.0)
hex_u = (grid_x - c_x) * 4.4
hex_v = (grid_y - c_y) * 4.4
flag_grooves = (np.abs(np.sin(hex_u)) ** 0.28) * (np.abs(np.sin(hex_v)) ** 0.28)
w_hex_paved = w_hex * np.clip(flag_grooves * 1.25, 0.20, 1.0)

# 2. Market Concentric Circular Stone Paver Rings (Matching candidate-848!)
d_mkt = np.hypot(grid_x - m_x, grid_y - m_y)
w_mkt = np.clip((2.45 - d_mkt) / 0.40, 0.0, 1.0)
theta_mkt = np.arctan2(grid_y - m_y, grid_x - m_x)
# Concentric stone rings
ring_grooves = np.abs(np.sin(d_mkt * 18.84)) ** 0.35
# Radial stone joints (higher frequency on outer rings)
radial_freq = np.clip(np.floor(d_mkt * 5.0) * 4.0, 8.0, 32.0)
radial_grooves = np.abs(np.sin(theta_mkt * radial_freq)) ** 0.35
mkt_pattern = np.clip(ring_grooves * radial_grooves * 1.30, 0.18, 1.0)
w_mkt_paved = w_mkt * mkt_pattern

# 3. Road Core with Crisp Individual Cobblestones
w_road_core = np.clip((0.80 - perturbed_road_d) / 0.30, 0.0, 1.0)
road_stones = (np.abs(np.sin(perturbed_road_d * 10.0)) ** 0.30) * (np.abs(np.cos(grid_x * 6.5 + grid_y * 4.5)) ** 0.30)
w_road_paved = w_road_core * np.clip(road_stones * 1.30, 0.25, 1.0)

splat_r = np.clip(w_hex_paved + w_mkt_paved + w_road_paved, 0.0, 1.0)

# B. Trampled Earth & Fertile Loam Channel (G)
w_road_shoulder = np.clip((1.80 - perturbed_road_d) / 0.55, 0.0, 1.0) * (1.0 - w_road_core)
d_farm = np.hypot(grid_x - f_x, grid_y - f_y)
w_farm = np.clip((2.85 - d_farm) / 0.60, 0.0, 1.0)
d_lumber = np.hypot(grid_x - l_x, grid_y - l_y)
w_lumber = np.clip((2.75 - d_lumber) / 0.60, 0.0, 1.0)
d_mine = np.hypot(grid_x - mine_x, grid_y - mine_y)
w_mine = np.clip((2.50 - d_mine) / 0.60, 0.0, 1.0)
w_hex_shoulder = np.clip((3.30 - hex_d) / 0.50, 0.0, 1.0) * (1.0 - w_hex)
w_mkt_shoulder = np.clip((3.15 - d_mkt) / 0.50, 0.0, 1.0) * (1.0 - w_mkt)

splat_g = np.clip(w_road_shoulder + w_farm + w_lumber + w_mine + w_hex_shoulder + w_mkt_shoulder, 0.0, 1.0)

# C. River Sand & Shallows Channel (B)
river_y_np = bridge_y + 0.95 * np.sin(grid_x * 0.26) - 0.25 * np.cos(grid_x * 0.52)
d_river = np.abs(grid_y - river_y_np)
splat_b = np.clip((3.20 - d_river) / 1.10, 0.0, 1.0)

# D. Mountain Rock & Cliff Strata Channel (A)
splat_a = np.clip((grid_y - 6.0) / 8.0, 0.0, 1.0)

# Pack into RGBA float buffer (Row 0 = South, Row H-1 = North)
splat_rgba = np.stack([splat_r, splat_g, splat_b, np.ones_like(splat_r)], axis=-1).astype(np.float32)

SPLAT_FILE = os.path.abspath(os.path.join("art-source", "terrain", "kingdom-splat.png"))
splat_writer = bpy.data.images.new("SplatWriter", width=SPLAT_W, height=SPLAT_H, alpha=True, float_buffer=False)
splat_writer.pixels.foreach_set(splat_rgba.ravel())
splat_writer.filepath_raw = SPLAT_FILE
splat_writer.file_format = 'PNG'
splat_writer.save()
bpy.data.images.remove(splat_writer)

splat_img = bpy.data.images.load(SPLAT_FILE)
print(f"Artisan splat map saved to {SPLAT_FILE} and loaded into Blender ({SPLAT_W}x{SPLAT_H})!")

# -----------------------------------------------------------------------------
# 7. Master Procedural Shaders
# -----------------------------------------------------------------------------
def create_shader(name):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    out = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat, nodes, links, bsdf

# --- Master Terrain Shader ---
mat_terrain, tm_nodes, tm_links, tm_bsdf = create_shader("MasterSplatTerrain")
tm_bsdf.inputs['Roughness'].default_value = 0.70
tm_bsdf.inputs['Subsurface Weight'].default_value = 0.12
tm_bsdf.inputs['Subsurface Radius'].default_value = (0.24, 0.44, 0.12)

# UV Coordinate Reader for Splat Map
tm_texcoord = tm_nodes.new(type='ShaderNodeTexCoord')

# Splat Texture Sampler (Direct UV map input!)
tm_splat_tex = tm_nodes.new(type='ShaderNodeTexImage')
tm_splat_tex.image = splat_img
tm_splat_tex.interpolation = 'Linear'
tm_splat_tex.extension = 'CLIP'
tm_links.new(tm_texcoord.outputs['UV'], tm_splat_tex.inputs['Vector'])

tm_sep = tm_nodes.new(type='ShaderNodeSeparateColor')
tm_links.new(tm_splat_tex.outputs['Color'], tm_sep.inputs['Color'])

# 1. Grass Material Sub-Network (Deep Emerald Turf & Warm Golden Moss)
grass_noise = tm_nodes.new(type='ShaderNodeTexNoise')
grass_noise.inputs['Scale'].default_value = 4.5
grass_noise.inputs['Detail'].default_value = 3.5
grass_noise.inputs['Roughness'].default_value = 0.60
tm_links.new(tm_texcoord.outputs['Object'], grass_noise.inputs['Vector'])

grass_ramp = tm_nodes.new(type='ShaderNodeValToRGB')
grass_ramp.color_ramp.elements[0].position = 0.05
grass_ramp.color_ramp.elements[0].color = (0.04, 0.11, 0.02, 1.0) # Deep forest moss
grass_ramp.color_ramp.elements[1].position = 0.38
grass_ramp.color_ramp.elements[1].color = (0.12, 0.28, 0.05, 1.0) # Lush emerald turf
elem_crest = grass_ramp.color_ramp.elements.new(0.82)
elem_crest.color = (0.24, 0.40, 0.08, 1.0) # Golden-amber sunlit crest
tm_links.new(grass_noise.outputs['Fac'], grass_ramp.inputs['Fac'])

# 2. Dirt & Fertile Loam Material Sub-Network (Splat G)
dirt_ramp = tm_nodes.new(type='ShaderNodeValToRGB')
dirt_ramp.color_ramp.elements[0].position = 0.10
dirt_ramp.color_ramp.elements[0].color = (0.18, 0.11, 0.06, 1.0) # Rich dark loam
dirt_ramp.color_ramp.elements[1].position = 0.85
dirt_ramp.color_ramp.elements[1].color = (0.42, 0.30, 0.16, 1.0) # Warm dry golden earth
tm_links.new(grass_noise.outputs['Fac'], dirt_ramp.inputs['Fac'])

# 3. Cobblestones & Ancient Sandstone Flagstones (Splat R)
cobble_vor = tm_nodes.new(type='ShaderNodeTexVoronoi')
cobble_vor.feature = 'DISTANCE_TO_EDGE'
cobble_vor.inputs['Scale'].default_value = 6.5
tm_links.new(tm_texcoord.outputs['Object'], cobble_vor.inputs['Vector'])

cobble_ramp = tm_nodes.new(type='ShaderNodeValToRGB')
cobble_ramp.color_ramp.elements[0].position = 0.06
cobble_ramp.color_ramp.elements[0].color = (0.10, 0.07, 0.05, 1.0) # Dark loam mortar
cobble_ramp.color_ramp.elements[1].position = 0.22
cobble_ramp.color_ramp.elements[1].color = (0.48, 0.38, 0.26, 1.0) # Warm golden sandstone paver
elem_c_hi = cobble_ramp.color_ramp.elements.new(0.75)
elem_c_hi.color = (0.60, 0.50, 0.35, 1.0) # Sunlit paver edge
tm_links.new(cobble_vor.outputs['Distance'], cobble_ramp.inputs['Fac'])

# 4. Stratified Mountain Granite & Cliff Rock (Noise-driven natural crags)
rock_noise = tm_nodes.new(type='ShaderNodeTexNoise')
rock_noise.inputs['Scale'].default_value = 3.8
rock_noise.inputs['Detail'].default_value = 4.5
rock_noise.inputs['Roughness'].default_value = 0.65
tm_links.new(tm_texcoord.outputs['Object'], rock_noise.inputs['Vector'])

rock_ramp = tm_nodes.new(type='ShaderNodeValToRGB')
rock_ramp.color_ramp.elements[0].position = 0.20
rock_ramp.color_ramp.elements[0].color = (0.20, 0.19, 0.18, 1.0) # Slate granite
rock_ramp.color_ramp.elements[1].position = 0.75
rock_ramp.color_ramp.elements[1].color = (0.44, 0.38, 0.32, 1.0) # Warm limestone band
tm_links.new(rock_noise.outputs['Fac'], rock_ramp.inputs['Fac'])

# 5. River Sand & Pebbles (Splat B)
sand_ramp = tm_nodes.new(type='ShaderNodeValToRGB')
sand_ramp.color_ramp.elements[0].position = 0.15
sand_ramp.color_ramp.elements[0].color = (0.32, 0.26, 0.18, 1.0) # Wet river gravel
sand_ramp.color_ramp.elements[1].position = 0.85
sand_ramp.color_ramp.elements[1].color = (0.58, 0.48, 0.32, 1.0) # Warm golden river sand
tm_links.new(grass_noise.outputs['Fac'], sand_ramp.inputs['Fac'])

# --- Blending Tree ---
# Grass + Dirt
mix_gd = tm_nodes.new(type='ShaderNodeMix')
mix_gd.data_type = 'RGBA'
tm_links.new(tm_sep.outputs['Green'], mix_gd.inputs['Factor'])
tm_links.new(grass_ramp.outputs['Color'], mix_gd.inputs['A'])
tm_links.new(dirt_ramp.outputs['Color'], mix_gd.inputs['B'])

# + Cobblestones
mix_cobble = tm_nodes.new(type='ShaderNodeMix')
mix_cobble.data_type = 'RGBA'
tm_links.new(tm_sep.outputs['Red'], mix_cobble.inputs['Factor'])
tm_links.new(mix_gd.outputs['Result'], mix_cobble.inputs['A'])
tm_links.new(cobble_ramp.outputs['Color'], mix_cobble.inputs['B'])

# + Sand
mix_sand = tm_nodes.new(type='ShaderNodeMix')
mix_sand.data_type = 'RGBA'
tm_links.new(tm_sep.outputs['Blue'], mix_sand.inputs['Factor'])
tm_links.new(mix_cobble.outputs['Result'], mix_sand.inputs['A'])
tm_links.new(sand_ramp.outputs['Color'], mix_sand.inputs['B'])

# + Mountain Rock (Driven primarily by Slope so terraces remain green)
geom_norm = tm_nodes.new(type='ShaderNodeNewGeometry')
sep_norm = tm_nodes.new(type='ShaderNodeSeparateXYZ')
tm_links.new(geom_norm.outputs['Normal'], sep_norm.inputs['Vector'])

# Perturb slope with rock noise to avoid polygon stepping
slope_pert = tm_nodes.new(type='ShaderNodeMath')
slope_pert.operation = 'ADD'
tm_links.new(sep_norm.outputs['Z'], slope_pert.inputs[0])
slope_n_mult = tm_nodes.new(type='ShaderNodeMath')
slope_n_mult.operation = 'MULTIPLY'
slope_n_mult.inputs[1].default_value = 0.16
tm_links.new(rock_noise.outputs['Fac'], slope_n_mult.inputs[0])
tm_links.new(slope_n_mult.outputs['Value'], slope_pert.inputs[1])

slope_ramp = tm_nodes.new(type='ShaderNodeValToRGB')
slope_ramp.color_ramp.elements[0].position = 0.48 # Steep cliff faces
slope_ramp.color_ramp.elements[0].color = (1.0, 1.0, 1.0, 1.0)
slope_ramp.color_ramp.elements[1].position = 0.78 # Gentle slopes and terraces stay lush turf
slope_ramp.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
tm_links.new(slope_pert.outputs['Value'], slope_ramp.inputs['Fac'])

sep_obj = tm_nodes.new(type='ShaderNodeSeparateXYZ')
tm_links.new(tm_texcoord.outputs['Object'], sep_obj.inputs['Vector'])

# Perturb northern elevation boundary: only highest alpine peaks turn rocky
north_pert = tm_nodes.new(type='ShaderNodeMath')
north_pert.operation = 'ADD'
tm_links.new(sep_obj.outputs['Y'], north_pert.inputs[0])
north_n_mult = tm_nodes.new(type='ShaderNodeMath')
north_n_mult.operation = 'MULTIPLY'
north_n_mult.inputs[1].default_value = 1.4
tm_links.new(rock_noise.outputs['Fac'], north_n_mult.inputs[0])
tm_links.new(north_n_mult.outputs['Value'], north_pert.inputs[1])

north_map = tm_nodes.new(type='ShaderNodeMapRange')
north_map.inputs['From Min'].default_value = 17.5
north_map.inputs['From Max'].default_value = 21.5
north_map.inputs['To Min'].default_value = 0.0
north_map.inputs['To Max'].default_value = 0.65
north_map.clamp = True
tm_links.new(north_pert.outputs['Value'], north_map.inputs['Value'])

rock_comb = tm_nodes.new(type='ShaderNodeMath')
rock_comb.operation = 'MAXIMUM'
tm_links.new(north_map.outputs['Result'], rock_comb.inputs[0])
tm_links.new(slope_ramp.outputs['Color'], rock_comb.inputs[1])

mix_rock = tm_nodes.new(type='ShaderNodeMix')
mix_rock.data_type = 'RGBA'
tm_links.new(rock_comb.outputs['Value'], mix_rock.inputs['Factor'])
tm_links.new(mix_sand.outputs['Result'], mix_rock.inputs['A'])
tm_links.new(rock_ramp.outputs['Color'], mix_rock.inputs['B'])

tm_links.new(mix_rock.outputs['Result'], tm_bsdf.inputs['Base Color'])

# Tactile Cobble & Rock Normal Bump
tm_bump = tm_nodes.new(type='ShaderNodeBump')
tm_bump.inputs['Strength'].default_value = 0.40
tm_bump.inputs['Distance'].default_value = 0.06

bump_scale = tm_nodes.new(type='ShaderNodeMath')
bump_scale.operation = 'MULTIPLY'
tm_links.new(cobble_vor.outputs['Distance'], bump_scale.inputs[0])
tm_links.new(tm_sep.outputs['Red'], bump_scale.inputs[1])

tm_links.new(bump_scale.outputs['Value'], tm_bump.inputs['Height'])
tm_links.new(tm_bump.outputs['Normal'], tm_bsdf.inputs['Normal'])

# --- Props Shaders ---
# Chiseled Warm Sandstone Curb / Balustrade
mat_curb, cb_nodes, cb_links, curb_bsdf = create_shader("StoneCurb")
curb_bsdf.inputs['Base Color'].default_value = (0.55, 0.49, 0.40, 1.0)
curb_bsdf.inputs['Roughness'].default_value = 0.68
cb_tex = cb_nodes.new(type='ShaderNodeTexCoord')
cb_noise = cb_nodes.new(type='ShaderNodeTexNoise')
cb_noise.inputs['Scale'].default_value = 14.0
cb_bump = cb_nodes.new(type='ShaderNodeBump')
cb_bump.inputs['Strength'].default_value = 0.20
cb_bump.inputs['Distance'].default_value = 0.05
cb_links.new(cb_tex.outputs['Object'], cb_noise.inputs['Vector'])
cb_links.new(cb_noise.outputs['Fac'], cb_bump.inputs['Height'])
cb_links.new(cb_bump.outputs['Normal'], curb_bsdf.inputs['Normal'])

# Ancient Stone Bridge Deck Pavers
mat_bridge_deck, bd_nodes, bd_links, bd_bsdf = create_shader("BridgeDeckStone")
bd_bsdf.inputs['Base Color'].default_value = (0.48, 0.40, 0.30, 1.0)
bd_bsdf.inputs['Roughness'].default_value = 0.72
bd_tex = bd_nodes.new(type='ShaderNodeTexCoord')
bd_wave = bd_nodes.new(type='ShaderNodeTexWave')
bd_wave.wave_type = 'BANDS'
bd_wave.inputs['Scale'].default_value = 16.0
bd_bump = bd_nodes.new(type='ShaderNodeBump')
bd_bump.inputs['Strength'].default_value = 0.35
bd_bump.inputs['Distance'].default_value = 0.06
bd_links.new(bd_tex.outputs['Object'], bd_wave.inputs['Vector'])
bd_links.new(bd_wave.outputs['Color'], bd_bump.inputs['Height'])
bd_links.new(bd_bump.outputs['Normal'], bd_bsdf.inputs['Normal'])

# Translucent Alpine River Water
mat_water, w_nodes, w_links, w_bsdf = create_shader("AlpineRiverWater")
w_bsdf.inputs['Base Color'].default_value = (0.02, 0.44, 0.58, 1.0) # Deep crystalline sapphire/turquoise
w_bsdf.inputs['Roughness'].default_value = 0.03
w_bsdf.inputs['Transmission Weight'].default_value = 0.88
w_bsdf.inputs['IOR'].default_value = 1.333
w_noise = w_nodes.new(type='ShaderNodeTexNoise')
w_noise.inputs['Scale'].default_value = 14.0
w_noise.inputs['Detail'].default_value = 2.5
w_bump = w_nodes.new(type='ShaderNodeBump')
w_bump.inputs['Strength'].default_value = 0.18
w_bump.inputs['Distance'].default_value = 0.06
w_links.new(w_noise.outputs['Fac'], w_bump.inputs['Height'])
w_links.new(w_bump.outputs['Normal'], w_bsdf.inputs['Normal'])

# Deep Wet Riverbed
mat_riverbed, _, _, rb_bsdf = create_shader("RiverBed")
rb_bsdf.inputs['Base Color'].default_value = (0.24, 0.20, 0.16, 1.0)
rb_bsdf.inputs['Roughness'].default_value = 0.40

# Rugged Granite Mountain Crag & Boulders
mat_granite, gr_nodes, gr_links, gr_bsdf = create_shader("GraniteCrag")
gr_tex = gr_nodes.new(type='ShaderNodeTexCoord')
gr_noise = gr_nodes.new(type='ShaderNodeTexNoise')
gr_noise.inputs['Scale'].default_value = 5.0
gr_noise.inputs['Detail'].default_value = 4.0
gr_links.new(gr_tex.outputs['Object'], gr_noise.inputs['Vector'])
gr_ramp = gr_nodes.new(type='ShaderNodeValToRGB')
gr_ramp.color_ramp.elements[0].position = 0.20
gr_ramp.color_ramp.elements[0].color = (0.24, 0.22, 0.20, 1.0) # Slate granite
gr_ramp.color_ramp.elements[1].position = 0.80
gr_ramp.color_ramp.elements[1].color = (0.50, 0.44, 0.38, 1.0) # Warm sunlit rock
gr_links.new(gr_noise.outputs['Fac'], gr_ramp.inputs['Fac'])
gr_links.new(gr_ramp.outputs['Color'], gr_bsdf.inputs['Base Color'])
gr_bump = gr_nodes.new(type='ShaderNodeBump')
gr_bump.inputs['Strength'].default_value = 0.35
gr_bump.inputs['Distance'].default_value = 0.12
gr_links.new(gr_noise.outputs['Fac'], gr_bump.inputs['Height'])
gr_links.new(gr_bump.outputs['Normal'], gr_bsdf.inputs['Normal'])
gr_bsdf.inputs['Roughness'].default_value = 0.75

# Aged Cedar Timber
mat_timber, _, _, tb_bsdf = create_shader("WoodTimber")
tb_bsdf.inputs['Base Color'].default_value = (0.35, 0.22, 0.13, 1.0)
tb_bsdf.inputs['Roughness'].default_value = 0.75

# Tree Stump Cut Grain with Rings
mat_stump_top, st_nodes, st_links, st_bsdf = create_shader("TreeStumpTop")
st_wave = st_nodes.new(type='ShaderNodeTexWave')
st_wave.wave_type = 'RINGS'
st_wave.inputs['Scale'].default_value = 24.0
st_ramp = st_nodes.new(type='ShaderNodeValToRGB')
st_ramp.color_ramp.elements[0].position = 0.2
st_ramp.color_ramp.elements[0].color = (0.66, 0.50, 0.32, 1.0)
st_ramp.color_ramp.elements[1].position = 0.6
st_ramp.color_ramp.elements[1].color = (0.42, 0.28, 0.16, 1.0)
st_links.new(st_wave.outputs['Color'], st_ramp.inputs['Fac'])
st_links.new(st_ramp.outputs['Color'], st_bsdf.inputs['Base Color'])
st_bsdf.inputs['Roughness'].default_value = 0.80

# Deep Spruce Pine Needles with Sunlit Tips
mat_pine, p_nodes, p_links, p_bsdf = create_shader("PineFoliage")
p_texcoord = p_nodes.new(type='ShaderNodeTexCoord')
p_sep = p_nodes.new(type='ShaderNodeSeparateXYZ')
p_links.new(p_texcoord.outputs['Object'], p_sep.inputs['Vector'])
p_ramp = p_nodes.new(type='ShaderNodeValToRGB')
p_ramp.color_ramp.elements[0].position = 0.05
p_ramp.color_ramp.elements[0].color = (0.04, 0.12, 0.03, 1.0) # Deep shadow needles
p_ramp.color_ramp.elements[1].position = 0.85
p_ramp.color_ramp.elements[1].color = (0.22, 0.44, 0.09, 1.0) # Sunlit golden emerald needles
p_links.new(p_sep.outputs['Z'], p_ramp.inputs['Fac'])
p_links.new(p_ramp.outputs['Color'], p_bsdf.inputs['Base Color'])
p_bsdf.inputs['Roughness'].default_value = 0.55
p_bsdf.inputs['Subsurface Weight'].default_value = 0.18
p_bsdf.inputs['Subsurface Radius'].default_value = (0.15, 0.35, 0.08)

# Stylized Puffy Broadleaf Foliage (Golden Emerald & Lime)
mat_oak_foliage, ok_nodes, ok_links, ok_bsdf = create_shader("OakFoliage")
ok_tex = ok_nodes.new(type='ShaderNodeTexCoord')
ok_sep = ok_nodes.new(type='ShaderNodeSeparateXYZ')
ok_links.new(ok_tex.outputs['Object'], ok_sep.inputs['Vector'])
ok_ramp = ok_nodes.new(type='ShaderNodeValToRGB')
ok_ramp.color_ramp.elements[0].position = 0.10
ok_ramp.color_ramp.elements[0].color = (0.06, 0.18, 0.03, 1.0) # Forest shadow
ok_ramp.color_ramp.elements[1].position = 0.75
ok_ramp.color_ramp.elements[1].color = (0.36, 0.64, 0.10, 1.0) # Warm sunlit lime/gold
ok_links.new(ok_sep.outputs['Z'], ok_ramp.inputs['Fac'])
ok_links.new(ok_ramp.outputs['Color'], ok_bsdf.inputs['Base Color'])
ok_bsdf.inputs['Roughness'].default_value = 0.50
ok_bsdf.inputs['Subsurface Weight'].default_value = 0.22
ok_bsdf.inputs['Subsurface Radius'].default_value = (0.12, 0.35, 0.06)

# Dark Fertile Plowed Soil
mat_farm_soil, _, _, fs_bsdf = create_shader("FarmTilledSoil")
fs_bsdf.inputs['Base Color'].default_value = (0.11, 0.06, 0.03, 1.0)
fs_bsdf.inputs['Roughness'].default_value = 0.88

# Vibrant Farm Crops
mat_crop, _, _, cr_bsdf = create_shader("FarmCropSprout")
cr_bsdf.inputs['Base Color'].default_value = (0.26, 0.68, 0.08, 1.0)
cr_bsdf.inputs['Roughness'].default_value = 0.40
cr_bsdf.inputs['Subsurface Weight'].default_value = 0.22
cr_bsdf.inputs['Subsurface Radius'].default_value = (0.12, 0.35, 0.06)

# Sparkling Gold Ore
mat_gold_ore, _, _, go_bsdf = create_shader("GoldOre")
go_bsdf.inputs['Base Color'].default_value = (1.0, 0.82, 0.18, 1.0)
go_bsdf.inputs['Metallic'].default_value = 0.98
go_bsdf.inputs['Roughness'].default_value = 0.16

# Golden Hay
mat_hay, _, _, h_bsdf = create_shader("GoldenHay")
h_bsdf.inputs['Base Color'].default_value = (0.84, 0.66, 0.22, 1.0)
h_bsdf.inputs['Roughness'].default_value = 0.85

# Procedural Striped Market Awnings
mat_awning_red, ar_nodes, ar_links, awr_bsdf = create_shader("AwningRed")
ar_tex = ar_nodes.new(type='ShaderNodeTexCoord')
ar_wave = ar_nodes.new(type='ShaderNodeTexWave')
ar_wave.wave_type = 'BANDS'
ar_wave.inputs['Scale'].default_value = 20.0
ar_wave.inputs['Distortion'].default_value = 0.0
ar_ramp = ar_nodes.new(type='ShaderNodeValToRGB')
ar_ramp.color_ramp.interpolation = 'CONSTANT'
ar_ramp.color_ramp.elements[0].position = 0.0
ar_ramp.color_ramp.elements[0].color = (0.86, 0.16, 0.16, 1.0) # Crimson red stripe
ar_ramp.color_ramp.elements[1].position = 0.50
ar_ramp.color_ramp.elements[1].color = (0.96, 0.93, 0.86, 1.0) # Cream linen stripe
ar_links.new(ar_tex.outputs['Object'], ar_wave.inputs['Vector'])
ar_links.new(ar_wave.outputs['Color'], ar_ramp.inputs['Fac'])
ar_links.new(ar_ramp.outputs['Color'], awr_bsdf.inputs['Base Color'])
awr_bsdf.inputs['Roughness'].default_value = 0.65

mat_awning_blue, ab_nodes, ab_links, awb_bsdf = create_shader("AwningBlue")
ab_tex = ab_nodes.new(type='ShaderNodeTexCoord')
ab_wave = ab_nodes.new(type='ShaderNodeTexWave')
ab_wave.wave_type = 'BANDS'
ab_wave.inputs['Scale'].default_value = 20.0
ab_wave.inputs['Distortion'].default_value = 0.0
ab_ramp = ab_nodes.new(type='ShaderNodeValToRGB')
ab_ramp.color_ramp.interpolation = 'CONSTANT'
ab_ramp.color_ramp.elements[0].position = 0.0
ab_ramp.color_ramp.elements[0].color = (0.12, 0.36, 0.78, 1.0) # Royal cobalt blue stripe
ab_ramp.color_ramp.elements[1].position = 0.50
ab_ramp.color_ramp.elements[1].color = (0.96, 0.93, 0.86, 1.0) # Cream linen stripe
ab_links.new(ab_tex.outputs['Object'], ab_wave.inputs['Vector'])
ab_links.new(ab_wave.outputs['Color'], ab_ramp.inputs['Fac'])
ab_links.new(ab_ramp.outputs['Color'], awb_bsdf.inputs['Base Color'])
awb_bsdf.inputs['Roughness'].default_value = 0.65

# Market Produce
mat_produce_red, _, _, pr_bsdf = create_shader("ProduceRed")
pr_bsdf.inputs['Base Color'].default_value = (0.88, 0.14, 0.10, 1.0)
mat_produce_gold, _, _, pg_bsdf = create_shader("ProduceGold")
pg_bsdf.inputs['Base Color'].default_value = (0.95, 0.70, 0.12, 1.0)

# Meadow Wildflowers
mat_flower_white, _, _, fw_bsdf = create_shader("FlowerWhite")
fw_bsdf.inputs['Base Color'].default_value = (0.98, 0.98, 0.92, 1.0)
fw_bsdf.inputs['Roughness'].default_value = 0.45
mat_flower_gold, _, _, fg_bsdf = create_shader("FlowerGold")
fg_bsdf.inputs['Base Color'].default_value = (1.0, 0.80, 0.12, 1.0)
fg_bsdf.inputs['Roughness'].default_value = 0.45
mat_flower_blue, _, _, fb_bsdf = create_shader("FlowerBlue")
fb_bsdf.inputs['Base Color'].default_value = (0.24, 0.52, 0.95, 1.0)
fb_bsdf.inputs['Roughness'].default_value = 0.45

# Flowering Shrubs
mat_shrub, _, _, sh_bsdf = create_shader("ShrubFoliage")
sh_bsdf.inputs['Base Color'].default_value = (0.18, 0.45, 0.08, 1.0)
sh_bsdf.inputs['Roughness'].default_value = 0.55
sh_bsdf.inputs['Subsurface Weight'].default_value = 0.18

# River Water Lilies
mat_lilypad, _, _, lp_bsdf = create_shader("LilyPad")
lp_bsdf.inputs['Base Color'].default_value = (0.10, 0.42, 0.08, 1.0)
lp_bsdf.inputs['Roughness'].default_value = 0.35
mat_lotus, _, _, lt_bsdf = create_shader("LotusFlower")
lt_bsdf.inputs['Base Color'].default_value = (0.96, 0.45, 0.68, 1.0)
lt_bsdf.inputs['Roughness'].default_value = 0.40

# -----------------------------------------------------------------------------
# 8. Helper Modeling Utilities
# -----------------------------------------------------------------------------
def add_cylinder(name, radius, height, location, material, collection, segments=20):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=height
    )
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (location[0], location[1], location[2] + height / 2.0)
    obj.data.materials.append(material)
    collection.objects.link(obj)
    return obj

def add_box(name, size, location, material, collection, rot_z=0.0):
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
    obj.data.materials.append(material)
    collection.objects.link(obj)
    return obj

def add_boulder(name, radius, location, material, collection, seed=0, subdivisions=2, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    rng = random.Random(seed)
    for v in bm.verts:
        disp = 1.0 + (rng.random() - 0.5) * 0.38
        v.co.x *= disp * 1.25
        v.co.y *= disp * 0.95
        v.co.z *= disp * 0.72
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth # Sharp chiseled crystalline facets for rocks!
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = (rng.random() * 0.6, rng.random() * 0.6, rng.random() * 6.28)
    obj.data.materials.append(material)
    collection.objects.link(obj)
    return obj

def add_stylized_pine(location, height_scale, collection, seed=0):
    rng = random.Random(seed)
    trunk_h = 0.70 * height_scale
    trunk_r = 0.11 * height_scale
    add_cylinder("PineTrunk", trunk_r, trunk_h, location, mat_timber, collection, segments=8)
    
    tier_radii = [1.10 * height_scale, 0.85 * height_scale, 0.60 * height_scale, 0.35 * height_scale]
    tier_heights = [0.55 * height_scale, 0.50 * height_scale, 0.44 * height_scale, 0.38 * height_scale]
    tier_base_z = location[2] + trunk_h * 0.45
    branch_counts = [7, 6, 5, 4]
    
    for i in range(4):
        bm = bmesh.new()
        nb = branch_counts[i]
        r_outer = tier_radii[i]
        r_inner = r_outer * 0.52 # Deep cutout between branch fronds
        h = tier_heights[i]
        
        v_top = bm.verts.new((0, 0, h * 0.65))
        v_bot = bm.verts.new((0, 0, -h * 0.15))
        
        star_verts = []
        for b in range(nb * 2):
            ang = (b / (nb * 2)) * math.tau + rng.random() * 0.05
            if b % 2 == 0:
                r = r_outer * (1.0 + (rng.random() - 0.5) * 0.12)
                z = -h * 0.38 - (rng.random() * 0.10 * h) # Drooping branch tip
            else:
                r = r_inner * (1.0 + (rng.random() - 0.5) * 0.12)
                z = -h * 0.08 # Inner valley between branches
            vx = r * math.cos(ang)
            vy = r * math.sin(ang)
            star_verts.append(bm.verts.new((vx, vy, z)))
            
        for b in range(nb * 2):
            b_next = (b + 1) % (nb * 2)
            bm.faces.new((v_top, star_verts[b], star_verts[b_next]))
            bm.faces.new((v_bot, star_verts[b_next], star_verts[b]))
            
        mesh = bpy.data.meshes.new(f"PineTier_{i}")
        bm.to_mesh(mesh)
        bm.free()
        
        for p in mesh.polygons:
            p.use_smooth = False # Crisp stylized faceted planes, not smooth mush!
            
        obj = bpy.data.objects.new(f"PineTier_{i}", mesh)
        rot_z = (i * 0.95) + rng.random() * 0.6
        obj.location = (
            location[0] + (rng.random() - 0.5) * 0.04 * height_scale,
            location[1] + (rng.random() - 0.5) * 0.04 * height_scale,
            tier_base_z + i * 0.35 * height_scale
        )
        obj.rotation_euler = ((rng.random() - 0.5) * 0.06, ((rng.random() - 0.5) * 0.06), rot_z)
        obj.data.materials.append(mat_pine)
        collection.objects.link(obj)

def add_stylized_broadleaf(location, scale, collection, seed=0):
    rng = random.Random(seed)
    trunk_h = 0.85 * scale
    trunk_r = 0.13 * scale
    add_cylinder("OakTrunk", trunk_r, trunk_h, location, mat_timber, collection, segments=8)
    
    clump_offsets = [
        (0.0, 0.0, trunk_h + 0.35 * scale, 0.60 * scale),
        (-0.35 * scale, -0.20 * scale, trunk_h + 0.25 * scale, 0.46 * scale),
        (0.35 * scale, -0.15 * scale, trunk_h + 0.28 * scale, 0.48 * scale),
        (-0.15 * scale, 0.30 * scale, trunk_h + 0.36 * scale, 0.46 * scale),
        (0.18 * scale, 0.26 * scale, trunk_h + 0.40 * scale, 0.44 * scale),
    ]
    for c_idx, (cx, cy, cz, cr) in enumerate(clump_offsets):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=cr)
        c_rng = random.Random(seed * 17 + c_idx)
        for v in bm.verts:
            disp = 1.0 + (c_rng.random() - 0.5) * 0.28
            v.co.x *= disp * 1.05
            v.co.y *= disp * 1.05
            v.co.z *= disp * 0.80
        mesh = bpy.data.meshes.new(f"OakClump_{c_idx}")
        bm.to_mesh(mesh)
        bm.free()
        for p in mesh.polygons:
            p.use_smooth = False # Stylized faceted puffy leaf clumps!
        obj = bpy.data.objects.new(f"OakClump_{c_idx}", mesh)
        obj.location = (location[0] + cx, location[1] + cy, location[2] + cz)
        obj.rotation_euler = (c_rng.random() * 0.5, c_rng.random() * 0.5, c_rng.random() * 6.28)
        obj.data.materials.append(mat_oak_foliage)
        collection.objects.link(obj)

# -----------------------------------------------------------------------------
# 9. Layer 1: Base Terrain Mesh with Direct UV Coordinates
# -----------------------------------------------------------------------------
col_l1 = layers["Layer1_BaseTerrainAndRiver"]

GRID_X = 180
GRID_Y = 250

bm_t = bmesh.new()
bmesh.ops.create_grid(bm_t, x_segments=GRID_X, y_segments=GRID_Y, size=1.0)

for v in bm_t.verts:
    v.co.x *= 10.24
    v.co.y *= max_by
    x, y = v.co.x, v.co.y
    z = 0.0
    
    # Northern Mountain Slope & Craggy Ridges (Y > 5.2)
    if y > 5.2:
        prog = (y - 5.2) / (max_by - 5.2)
        z += (prog ** 1.35) * 4.8 + math.sin(x * 0.70) * 0.45 * prog
        if y > 13.5:
            z += (y - 13.5) * 0.45
            
    # Northeastern Watchtower / Academy Hill Terrace
    d_hill = math.hypot(x - 3.2, y - 10.5)
    if d_hill < 4.2:
        z += (1.0 - (d_hill / 4.2)) * 1.35
        
    # Southern Winding Alpine River Canyon
    river_y = bridge_y + 0.95 * math.sin(x * 0.26) - 0.25 * math.cos(x * 0.52)
    dist_river = abs(y - river_y)
    if dist_river < 3.8:
        t = dist_river / 3.8
        canyon_drop = (1.0 - t * t) * 1.35
        z -= canyon_drop

    # Gentle Rolling Undulation
    z += math.sin(x * 0.35) * math.cos(y * 0.28) * 0.14

    # Core Gameplay Leveled Pads
    if math.hypot(x - c_x, y - c_y) < 3.5:
        z = min(z, 0.05)
    if math.hypot(x - m_x, y - m_y) < 3.2:
        z = min(z, 0.0)
    if math.hypot(x - f_x, y - f_y) < 2.9:
        z = min(z, 0.0)
    if math.hypot(x - l_x, y - l_y) < 2.9:
        z = min(z, 0.0)
    if math.hypot(x - mine_x, y - mine_y) < 2.2:
        z = min(z, 1.45)
        
    v.co.z = z

mesh_terrain = bpy.data.meshes.new("TerrainMesh")
bm_t.to_mesh(mesh_terrain)
bm_t.free()

for p in mesh_terrain.polygons:
    p.use_smooth = True

# Assign Direct UV Coordinates to Mesh Loops
uv_layer = mesh_terrain.uv_layers.new(name="UVMap")
for loop in mesh_terrain.loops:
    v = mesh_terrain.vertices[loop.vertex_index]
    u = (v.co.x + 10.24) / 20.48
    v_coord = (v.co.y + max_by) / (2.0 * max_by)
    uv_layer.data[loop.index].uv = (u, v_coord)

obj_terrain = bpy.data.objects.new("BaseTerrain", mesh_terrain)
obj_terrain.data.materials.append(mat_terrain)
col_l1.objects.link(obj_terrain)

# River Water Mesh
bm_water = bmesh.new()
bmesh.ops.create_grid(bm_water, x_segments=90, y_segments=24, size=1.0)
for v in bm_water.verts:
    v.co.x *= 10.24
    v.co.y *= 2.5
    x = v.co.x
    river_y = bridge_y + 0.95 * math.sin(x * 0.26) - 0.25 * math.cos(x * 0.52)
    v.co.y += river_y
    v.co.z = -0.36

mesh_water = bpy.data.meshes.new("RiverWaterMesh")
bm_water.to_mesh(mesh_water)
bm_water.free()
for p in mesh_water.polygons:
    p.use_smooth = True
obj_water = bpy.data.objects.new("RiverWater", mesh_water)
obj_water.data.materials.append(mat_water)
col_l1.objects.link(obj_water)

# Riverbed Bottom
bm_rbed = bmesh.new()
bmesh.ops.create_grid(bm_rbed, x_segments=50, y_segments=14, size=1.0)
for v in bm_rbed.verts:
    v.co.x *= 10.24
    v.co.y *= 2.3
    x = v.co.x
    river_y = bridge_y + 0.95 * math.sin(x * 0.26) - 0.25 * math.cos(x * 0.52)
    v.co.y += river_y
    v.co.z = -1.25
mesh_rbed = bpy.data.meshes.new("RiverBedMesh")
bm_rbed.to_mesh(mesh_rbed)
bm_rbed.free()
obj_rbed = bpy.data.objects.new("RiverBed", mesh_rbed)
obj_rbed.data.materials.append(mat_riverbed)
col_l1.objects.link(obj_rbed)

# River Boulders and Rocks in the Water & on Banks
river_rock_coords = [
    (-8.2, bridge_y + 1.2, -0.25, 0.65),
    (-6.5, bridge_y - 0.8, -0.28, 0.52),
    (-4.2, bridge_y + 0.9, -0.32, 0.58),
    (-2.1, bridge_y - 0.5, -0.30, 0.48),
    (1.8, bridge_y + 0.6, -0.28, 0.55),
    (3.6, bridge_y - 0.7, -0.30, 0.62),
    (6.2, bridge_y + 1.1, -0.26, 0.70),
    (8.5, bridge_y - 0.9, -0.22, 0.58),
]
for idx, (rx, ry, rz, rs) in enumerate(river_rock_coords):
    add_boulder(f"RiverBoulder_{idx}", rs, (rx, ry, rz), mat_granite, col_l1, seed=idx * 17)

# Floating River Lily Pads & Lotus Blossoms
lily_coords = [
    (-6.8, bridge_y + 0.4), (-6.0, bridge_y + 0.7), (-5.2, bridge_y - 0.5),
    (-3.8, bridge_y - 0.6), (-2.8, bridge_y + 0.5),
    (2.6, bridge_y + 0.5), (3.4, bridge_y - 0.5), (5.0, bridge_y - 0.7),
    (5.8, bridge_y + 0.4), (7.0, bridge_y - 0.5)
]
for l_idx, (lx, ly) in enumerate(lily_coords):
    add_cylinder(f"LilyPad_{l_idx}", 0.16, 0.02, (lx, ly, -0.34), mat_lilypad, col_l1, segments=8)
    if l_idx % 2 == 0:
        add_cylinder(f"Lotus_{l_idx}", 0.05, 0.05, (lx, ly, -0.31), mat_lotus, col_l1, segments=6)

# -----------------------------------------------------------------------------
# 10. Layer 4: Royal Castle Courtyard & Dais
# -----------------------------------------------------------------------------
col_l4 = layers["Layer4_RoyalCastleCourtyard"]

# Hexagonal Carved Stone Curb Border & 6 Corner Pillars
for i in range(6):
    ang1 = math.radians(30.0 + i * 60.0)
    ang2 = math.radians(30.0 + (i + 1) * 60.0)
    p1 = (c_x + 2.75 * math.cos(ang1), c_y + 2.75 * math.sin(ang1), 0.10)
    p2 = (c_x + 2.75 * math.cos(ang2), c_y + 2.75 * math.sin(ang2), 0.10)
    mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0.12)
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.hypot(dx, dy)
    rot = math.atan2(dy, dx)
    if i != 4: # Leave south opening clear for avenue
        add_box(f"CastleCurb_{i}", (length, 0.24, 0.16), mid, mat_curb, col_l4, rot_z=rot)
    add_box(f"CastleCornerBollard_{i}", (0.38, 0.38, 0.44), (p1[0], p1[1], 0.22), mat_curb, col_l4)
    add_box(f"CastleBollardCap_{i}", (0.44, 0.44, 0.08), (p1[0], p1[1], 0.46), mat_curb, col_l4)

# Grand South Entrance Stone Steps (3 tiered carved steps)
for s in range(3):
    step_y = c_y - 2.65 - s * 0.35
    add_box(f"CastleSouthStep_{s}", (2.4 - s * 0.2, 0.38, 0.08), (c_x, step_y, 0.08 - s * 0.025), mat_curb, col_l4)

# Two carved stone braziers flanking the courtyard south entrance
for side in [-1.45, 1.45]:
    add_cylinder(f"CastleBrazier_{side}", 0.22, 0.50, (c_x + side, c_y - 2.85, 0.0), mat_curb, col_l4, segments=12)
    add_cylinder(f"CastleBrazierBowl_{side}", 0.30, 0.14, (c_x + side, c_y - 2.85, 0.50), mat_curb, col_l4, segments=12)
    add_cylinder(f"CastleEmber_{side}", 0.18, 0.08, (c_x + side, c_y - 2.85, 0.60), mat_gold_ore, col_l4, segments=8)

# -----------------------------------------------------------------------------
# 11. Layer 5: Sunfield Farm District
# -----------------------------------------------------------------------------
col_l5 = layers["Layer5_SunfieldFarm"]

for plot_idx in range(3):
    plot_x = f_x + (plot_idx - 1) * 1.15
    plot_y = f_y
    # Rustic timber perimeter beams
    add_box(f"FarmBorder_N_{plot_idx}", (1.10, 0.08, 0.12), (plot_x, plot_y + 1.12, 0.06), mat_timber, col_l5)
    add_box(f"FarmBorder_S_{plot_idx}", (1.10, 0.08, 0.12), (plot_x, plot_y - 1.12, 0.06), mat_timber, col_l5)
    add_box(f"FarmBorder_W_{plot_idx}", (0.08, 2.32, 0.12), (plot_x - 0.51, plot_y, 0.06), mat_timber, col_l5)
    add_box(f"FarmBorder_E_{plot_idx}", (0.08, 2.32, 0.12), (plot_x + 0.51, plot_y, 0.06), mat_timber, col_l5)
    
    # Interior dark fertile soil bed
    add_box(f"FarmSoilBase_{plot_idx}", (0.96, 2.18, 0.08), (plot_x, plot_y, 0.04), mat_farm_soil, col_l5)
    
    bm_furrow = bmesh.new()
    bmesh.ops.create_grid(bm_furrow, x_segments=8, y_segments=28, size=1.0)
    for v in bm_furrow.verts:
        v.co.x *= 0.46
        v.co.y *= 1.05
        v.co.z = math.sin(v.co.y * 12.0) * 0.05
    mesh_furrow = bpy.data.meshes.new(f"FurrowMesh_{plot_idx}")
    bm_furrow.to_mesh(mesh_furrow)
    bm_furrow.free()
    for p in mesh_furrow.polygons:
        p.use_smooth = True
    obj_furrow = bpy.data.objects.new(f"FarmFurrow_{plot_idx}", mesh_furrow)
    obj_furrow.location = (plot_x, plot_y, 0.10)
    obj_furrow.data.materials.append(mat_farm_soil)
    col_l5.objects.link(obj_furrow)
    
    for row in range(6):
        sprout_y = plot_y - 0.88 + row * 0.35
        add_cylinder(f"Crop_{plot_idx}_{row}", 0.075, 0.12, (plot_x - 0.18, sprout_y, 0.15), mat_crop, col_l5, segments=8)
        add_cylinder(f"Crop_{plot_idx}_{row}_b", 0.075, 0.12, (plot_x + 0.18, sprout_y, 0.15), mat_crop, col_l5, segments=8)

for f_step in range(7):
    fence_post_y = f_y - 1.5 + f_step * 0.50
    add_cylinder(f"FencePost_{f_step}", 0.05, 0.42, (f_x - 1.85, fence_post_y, 0.0), mat_timber, col_l5, segments=8)
add_box("FenceRail_Top", (0.04, 3.2, 0.04), (f_x - 1.85, f_y, 0.32), mat_timber, col_l5)
add_box("FenceRail_Bottom", (0.04, 3.2, 0.04), (f_x - 1.85, f_y, 0.16), mat_timber, col_l5)

add_cylinder("HayBale_Roll1", 0.32, 0.48, (f_x + 1.55, f_y - 0.8, 0.0), mat_hay, col_l5, segments=16)
add_cylinder("HayBale_Roll2", 0.32, 0.48, (f_x + 1.95, f_y - 0.4, 0.0), mat_hay, col_l5, segments=16)
add_box("HayBale_Stack1", (0.50, 0.34, 0.28), (f_x + 1.70, f_y - 0.6, 0.46), mat_hay, col_l5, rot_z=0.25)

# Farm Handcart
add_box("FarmCart_Bed", (0.80, 1.20, 0.10), (f_x + 1.6, f_y + 0.8, 0.28), mat_timber, col_l5, rot_z=0.20)
add_box("FarmCart_SideL", (0.06, 1.20, 0.22), (f_x + 1.22, f_y + 0.8, 0.42), mat_timber, col_l5, rot_z=0.20)
add_box("FarmCart_SideR", (0.06, 1.20, 0.22), (f_x + 1.98, f_y + 0.8, 0.42), mat_timber, col_l5, rot_z=0.20)
add_cylinder("FarmCart_WheelL", 0.24, 0.08, (f_x + 1.18, f_y + 0.8, 0.24), mat_timber, col_l5, segments=12)
add_cylinder("FarmCart_WheelR", 0.24, 0.08, (f_x + 2.02, f_y + 0.8, 0.24), mat_timber, col_l5, segments=12)

# -----------------------------------------------------------------------------
# 12. Layer 6: Lumber Yard, Grand Market & Arched Bridge
# -----------------------------------------------------------------------------
col_l6 = layers["Layer6_LumberYardAndMarket"]

# Lumber Yard
stump_offsets = [(-0.9, -0.6), (0.8, 0.8), (-0.7, 0.9)]
for idx, (sx, sy) in enumerate(stump_offsets):
    obj_stump = add_cylinder(f"TreeStump_{idx}", 0.36, 0.32, (l_x + sx, l_y + sy, 0.0), mat_timber, col_l6, segments=16)
    obj_stump.data.materials.append(mat_stump_top)
    for p in obj_stump.data.polygons:
        if p.normal.z > 0.5:
            p.material_index = 1

add_cylinder("WoodChoppingBlock", 0.44, 0.38, (l_x - 0.4, l_y - 0.8, 0.0), mat_timber, col_l6, segments=16)
for p in range(4):
    add_box(f"WoodPlankStack_{p}", (0.35, 1.8, 0.08), (l_x - 1.2, l_y + 0.2, 0.04 + p * 0.08), mat_timber, col_l6, rot_z=-0.15)

log_base_x = l_x + 0.9
log_base_y = l_y - 0.7
for i in range(3):
    add_box(f"TimberLog_B_{i}", (0.26, 1.4, 0.26), (log_base_x + (i - 1) * 0.30, log_base_y, 0.13), mat_timber, col_l6)
for i in range(2):
    add_box(f"TimberLog_M_{i}", (0.26, 1.4, 0.26), (log_base_x + (i - 0.5) * 0.30, log_base_y, 0.36), mat_timber, col_l6)
add_box("TimberLog_Top", (0.26, 1.4, 0.26), (log_base_x, log_base_y, 0.58), mat_timber, col_l6)

# Grand Market Plaza
stall_configs = [
    (math.radians(45.0), mat_awning_red),
    (math.radians(135.0), mat_awning_blue),
    (math.radians(225.0), mat_awning_red),
    (math.radians(315.0), mat_awning_blue),
]
for idx, (angle, awning_mat) in enumerate(stall_configs):
    stall_x = m_x + 1.85 * math.cos(angle)
    stall_y = m_y + 1.85 * math.sin(angle)
    add_box(f"StallCounter_{idx}", (0.50, 0.85, 0.36), (stall_x, stall_y, 0.18), mat_timber, col_l6, rot_z=angle)
    for p_off_x in [-0.22, 0.22]:
        for p_off_y in [-0.38, 0.38]:
            pole_mid = (
                stall_x + p_off_x * math.cos(angle) - p_off_y * math.sin(angle),
                stall_y + p_off_x * math.sin(angle) + p_off_y * math.cos(angle),
                0.42
            )
            add_cylinder(f"StallPole_{idx}", 0.025, 0.85, pole_mid, mat_timber, col_l6, segments=6)
    add_box(f"StallAwning_{idx}", (0.58, 0.95, 0.03), (stall_x, stall_y, 0.84), awning_mat, col_l6, rot_z=angle)

crate_positions = [
    (m_x + 1.1, m_y + 1.1),
    (m_x - 1.2, m_y + 1.0),
    (m_x + 1.0, m_y - 1.2),
]
for idx, (cx, cy) in enumerate(crate_positions):
    add_box(f"MerchantCrate_{idx}", (0.34, 0.34, 0.34), (cx, cy, 0.17), mat_timber, col_l6, rot_z=idx * 0.45)
    p_mat = mat_produce_red if idx % 2 == 0 else mat_produce_gold
    add_cylinder(f"CrateProduce_{idx}", 0.13, 0.08, (cx, cy, 0.34), p_mat, col_l6, segments=8)
    add_cylinder(f"MerchantBarrel_{idx}", 0.18, 0.40, (cx + 0.30, cy - 0.22, 0.05), mat_timber, col_l6, segments=12)

# Two-tiered Stepped Stone Fountain
add_cylinder("MarketFountain_BasePad", 1.05, 0.08, (m_x, m_y, 0.0), mat_curb, col_l6, segments=24)
add_cylinder("MarketFountain_LowerWater", 0.90, 0.05, (m_x, m_y, 0.07), mat_water, col_l6, segments=24)
add_cylinder("MarketFountain_Pillar", 0.22, 0.65, (m_x, m_y, 0.08), mat_curb, col_l6, segments=12)
add_cylinder("MarketFountain_UpperBowl", 0.48, 0.12, (m_x, m_y, 0.52), mat_curb, col_l6, segments=16)
add_cylinder("MarketFountain_UpperWater", 0.42, 0.04, (m_x, m_y, 0.60), mat_water, col_l6, segments=16)
add_cylinder("MarketFountain_Finial", 0.08, 0.16, (m_x, m_y, 0.64), mat_curb, col_l6, segments=8)

# Medieval Double-Arched Stone Bridge
add_box("BridgeDeck", (1.60, 3.6, 0.24), (bridge_x, bridge_y, -0.06), mat_bridge_deck, col_l6)
add_box("BridgeParapet_Left", (0.22, 3.8, 0.44), (bridge_x - 0.86, bridge_y, 0.18), mat_curb, col_l6)
add_box("BridgeParapet_Right", (0.22, 3.8, 0.44), (bridge_x + 0.86, bridge_y, 0.18), mat_curb, col_l6)
for px in [-0.86, 0.86]:
    for py in [bridge_y - 1.9, bridge_y + 1.9]:
        add_box(f"BridgePedestal_{px}_{py}", (0.34, 0.34, 0.58), (bridge_x + px, py, 0.24), mat_curb, col_l6)
add_box("BridgePier_Central", (1.8, 0.70, 1.2), (bridge_x, bridge_y, -0.72), mat_curb, col_l6)
add_box("BridgePier_North", (1.8, 0.60, 1.2), (bridge_x, bridge_y + 1.1, -0.72), mat_curb, col_l6)
add_box("BridgePier_South", (1.8, 0.60, 1.2), (bridge_x, bridge_y - 1.1, -0.72), mat_curb, col_l6)

# -----------------------------------------------------------------------------
# 13. Layer 2: Mountain Quarry & Mine District
# -----------------------------------------------------------------------------
col_l2 = layers["Layer2_MountainQuarryAndMine"]

cliff_x = mine_x
cliff_y = mine_y + 1.3
# Sculpted Rocky Formations
add_boulder("MineCrag_Main", 2.2, (cliff_x, cliff_y, 2.0), mat_granite, col_l2, seed=101, subdivisions=3)
add_boulder("MineCrag_Left", 1.8, (cliff_x - 1.4, cliff_y + 0.8, 2.4), mat_granite, col_l2, seed=102, subdivisions=3)
add_boulder("MineCrag_Right", 1.9, (cliff_x + 1.5, cliff_y + 0.6, 2.3), mat_granite, col_l2, seed=103, subdivisions=3)

mat_void, _, _, v_bsdf = create_shader("CavernVoid")
v_bsdf.inputs['Base Color'].default_value = (0.01, 0.01, 0.01, 1.0)
v_bsdf.inputs['Roughness'].default_value = 0.95
add_box("MineCavernVoid", (1.15, 0.7, 1.45), (mine_x, mine_y + 0.45, 1.22), mat_void, col_l2)

add_box("MineTimberPost_L", (0.20, 0.20, 1.50), (mine_x - 0.65, mine_y + 0.50, 1.25), mat_timber, col_l2)
add_box("MineTimberPost_R", (0.20, 0.20, 1.50), (mine_x + 0.65, mine_y + 0.50, 1.25), mat_timber, col_l2)
add_box("MineTimberLintel", (1.60, 0.24, 0.24), (mine_x, mine_y + 0.50, 2.00), mat_timber, col_l2)

for r in range(6):
    rail_y = mine_y + 0.3 - r * 0.35
    add_box(f"RailTie_{r}", (0.80, 0.11, 0.06), (mine_x, rail_y, 0.88 - r * 0.08), mat_timber, col_l2)
add_box("TrackRail_L", (0.05, 2.1, 0.06), (mine_x - 0.30, mine_y - 0.6, 0.74), mat_curb, col_l2)
add_box("TrackRail_R", (0.05, 2.1, 0.06), (mine_x + 0.30, mine_y - 0.6, 0.74), mat_curb, col_l2)

ore_coords = [
    (mine_x + 1.25, mine_y - 0.35, 0.85, 0.42),
    (mine_x + 1.70, mine_y - 0.10, 0.95, 0.52),
    (mine_x - 1.25, mine_y - 0.20, 0.90, 0.45),
    (mine_x - 1.60, mine_y - 0.65, 0.80, 0.35),
]
for idx, (ox, oy, oz, sz) in enumerate(ore_coords):
    add_boulder(f"OreRock_{idx}", sz, (ox, oy, oz), mat_granite, col_l2, seed=idx * 23)
    add_box(f"GoldVein_{idx}", (sz * 0.45, sz * 0.45, sz * 0.35), (ox, oy, oz + sz * 0.35), mat_gold_ore, col_l2, rot_z=idx * 1.3)

# -----------------------------------------------------------------------------
# 14. Layer 3: Northern Terrace & Stylized Forest Groves
# -----------------------------------------------------------------------------
col_l3 = layers["Layer3_NorthernTerraceAndForest"]

add_box("WatchtowerTerrace", (2.3, 2.3, 0.36), (tower_x, tower_y, 1.62), mat_curb, col_l3)
add_box("AcademyTerrace", (2.1, 2.1, 0.26), (acad_x, acad_y, 1.15), mat_curb, col_l3)

for s in range(7):
    step_x = 0.5 + s * 0.42
    step_y = 5.2 + s * 0.70
    step_z = 0.15 + s * 0.18
    add_box(f"HillStep_{s}", (1.25, 0.48, 0.15), (step_x, step_y, step_z), mat_curb, col_l3, rot_z=0.35)

# Dense Stylized Pine Forest Framing Realm (West, East, North Ridges)
pine_groves = [
    # West Forest Ridge (Dense organic clusters)
    (-8.8, -16.0, 1.1), (-7.6, -15.2, 0.9), (-8.2, -14.0, 1.2), (-7.4, -12.8, 1.0),
    (-8.6, -11.5, 1.3), (-7.7, -10.0, 1.1), (-8.5, -8.5, 1.4), (-7.5, -7.2, 1.0),
    (-8.7, -5.8, 1.3), (-7.8, -4.5, 1.2), (-8.6, -3.0, 1.4), (-7.6, -1.8, 1.1),
    (-8.5, -0.5, 1.3), (-7.7, 0.8, 1.0), (-8.8, 2.2, 1.4), (-7.6, 3.5, 1.2),
    (-8.5, 5.0, 1.3), (-7.4, 6.2, 1.1), (-8.7, 7.8, 1.4), (-7.6, 9.2, 1.2),
    (-8.5, 10.8, 1.3), (-7.5, 12.2, 1.1), (-8.6, 13.8, 1.4), (-7.2, 15.2, 1.5),
    (-6.5, 16.8, 1.4), (-5.2, 18.2, 1.5), (-3.8, 19.5, 1.6),
    # East Forest Ridge (Dense organic clusters)
    (8.8, -16.0, 1.1), (7.6, -15.2, 0.9), (8.2, -14.0, 1.2), (7.4, -12.8, 1.0),
    (8.6, -11.5, 1.3), (7.7, -10.0, 1.1), (8.5, -8.5, 1.4), (7.5, -7.2, 1.0),
    (8.7, -5.8, 1.3), (7.8, -4.5, 1.2), (8.6, -3.0, 1.4), (7.6, -1.8, 1.1),
    (8.5, -0.5, 1.3), (7.7, 0.8, 1.0), (8.8, 2.2, 1.4), (7.6, 3.5, 1.2),
    (8.5, 5.0, 1.3), (7.4, 6.2, 1.1), (8.7, 7.8, 1.4), (7.6, 9.2, 1.2),
    (8.5, 10.8, 1.3), (7.5, 12.2, 1.1), (8.6, 13.8, 1.4), (7.2, 15.2, 1.5),
    (6.5, 16.8, 1.4), (5.2, 18.2, 1.5), (3.8, 19.5, 1.6),
    # North Alpine Ridge
    (-2.0, 20.2, 1.6), (0.0, 20.8, 1.7), (2.0, 20.2, 1.6),
    # Riverbank Forest Accents
    (-6.2, bridge_y + 1.8, 1.0), (6.2, bridge_y + 1.8, 1.0),
    (-5.5, bridge_y - 1.8, 0.9), (5.5, bridge_y - 1.8, 0.9),
    (-3.8, bridge_y - 2.2, 0.8), (3.8, bridge_y - 2.2, 0.8),
    # Interior Natural Accents
    (-3.0, 3.5, 0.90), (3.0, 3.5, 0.90),
    (-3.4, -8.5, 0.95), (3.4, -8.5, 0.95),
    # Northern Foothills & Alpine Groves
    (2.4, 7.5, 0.95), (4.5, 6.8, 1.10), (5.2, 8.8, 1.25),
    (-5.8, 8.2, 1.15), (-6.4, 10.5, 1.30), (-1.8, 13.5, 1.35), (2.2, 14.5, 1.40),
]

for idx, (px, py, scale) in enumerate(pine_groves):
    gz = 0.0
    if py > 5.2:
        prog = (py - 5.2) / (max_by - 5.2)
        gz = (prog ** 1.35) * 4.8 + math.sin(px * 0.70) * 0.45 * prog
        if py > 13.5:
            gz += (py - 13.5) * 0.45
    # Alpine heights (>10.0) are spruce pines; valley & riverbanks mix in lush puffy oaks:
    if py < 10.0 and (idx % 3 == 1):
        add_stylized_broadleaf((px, py, gz), scale * 0.95, col_l3, seed=idx * 29)
    else:
        add_stylized_pine((px, py, gz), scale, col_l3, seed=idx * 31)

boulder_coords = [
    (-7.5, -3.0, 0.15, 0.55), (7.5, -3.0, 0.15, 0.55),
    (-7.8, 2.5, 0.20, 0.65), (7.8, 2.5, 0.20, 0.65),
    (-2.2, 4.5, 0.15, 0.48), (2.2, 4.5, 0.15, 0.48),
    (3.8, 9.5, 1.10, 0.70), (0.5, 8.5, 0.85, 0.58),
]
for idx, (bx, by, bz, bs) in enumerate(boulder_coords):
    add_boulder(f"GroveBoulder_{idx}", bs, (bx, by, bz), mat_granite, col_l3, seed=idx * 43, smooth=False)

# Flowering Shrubs along forest edges
shrub_coords = [
    (-6.0, -10.0, 0.42), (6.0, -10.0, 0.42),
    (-5.2, -2.5, 0.38), (5.2, -2.5, 0.38),
    (-2.8, 0.6, 0.35), (2.8, 0.6, 0.35),
    (-6.4, 3.5, 0.42), (6.4, 3.5, 0.42),
    (-4.5, 9.2, 0.46), (4.2, 10.2, 0.46),
]
for s_idx, (sx, sy, sz) in enumerate(shrub_coords):
    s_rng = random.Random(s_idx * 79)
    sgz = 0.0
    if sy > 5.2:
        prog = (sy - 5.2) / (max_by - 5.2)
        sgz = (prog ** 1.35) * 4.8 + math.sin(sx * 0.70) * 0.45 * prog
    for c in range(2):
        bm_s = bmesh.new()
        bmesh.ops.create_icosphere(bm_s, subdivisions=2, radius=sz * (0.85 + c * 0.22))
        for v in bm_s.verts:
            v.co.z *= 0.75
        mesh_s = bpy.data.meshes.new(f"Shrub_{s_idx}_{c}")
        bm_s.to_mesh(mesh_s)
        bm_s.free()
        for p in mesh_s.polygons:
            p.use_smooth = False
        obj_s = bpy.data.objects.new(f"Shrub_{s_idx}_{c}", mesh_s)
        obj_s.location = (sx + (c - 0.5) * 0.22, sy + (s_rng.random() - 0.5) * 0.22, sgz + sz * 0.4)
        obj_s.data.materials.append(mat_shrub)
        col_l3.objects.link(obj_s)

# Meadow Wildflower Clusters
flower_patches = [
    (-1.8, 1.2, 8), (1.8, 1.2, 8),
    (-2.2, -1.0, 7), (2.2, -1.0, 7),
    (-2.4, -4.2, 9), (-3.2, -6.8, 9),
    (2.4, -4.2, 9), (3.2, -6.8, 9),
    (-2.2, -9.8, 8), (2.2, -9.8, 8),
    (-1.8, -13.8, 8), (1.8, -13.8, 8),
    (-4.5, bridge_y + 1.6, 9), (4.5, bridge_y + 1.6, 9),
    (-2.4, bridge_y + 1.4, 8), (2.4, bridge_y + 1.4, 8),
    (1.2, 8.2, 8), (3.5, 7.8, 8), (-1.2, 8.2, 8),
]
for p_idx, (fx, fy, cnt) in enumerate(flower_patches):
    p_rng = random.Random(p_idx * 53)
    f_mat = [mat_flower_white, mat_flower_gold, mat_flower_blue][p_idx % 3]
    fgz = 0.0
    if fy > 5.2:
        prog = (fy - 5.2) / (max_by - 5.2)
        fgz = (prog ** 1.35) * 4.8 + math.sin(fx * 0.70) * 0.45 * prog
    for i in range(cnt):
        ox = (p_rng.random() - 0.5) * 1.5
        oy = (p_rng.random() - 0.5) * 1.5
        add_cylinder(f"Flw_{p_idx}_{i}", 0.045, 0.08, (fx + ox, fy + oy, fgz + 0.02), f_mat, col_l3, segments=6)

# -----------------------------------------------------------------------------
# 15. Save .blend Main File & Render
# -----------------------------------------------------------------------------
bpy.ops.wm.save_as_mainfile(filepath=BLEND_FILE)
print(f"Scene saved successfully to: {BLEND_FILE}")

scene.render.filepath = OUTPUT_PNG
print(f"Starting CYCLES render to {OUTPUT_PNG} ({RENDER_WIDTH}x{RENDER_HEIGHT}, {scene.cycles.samples} samples)...")
bpy.ops.render.render(write_still=True)
print("SUCCESS: Artisan 3D Kingdom render complete!")

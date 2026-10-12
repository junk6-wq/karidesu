"""plan/plan.json から平屋の3Dモデルを組み立てて描画する。

使い方:
    pip install -r requirements.txt
    python blender/build_house.py [aerial|cutaway|front ...]   # 省略時は全部
出力: renders/<view>.png と blender/house.blend
"""
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "plan" / "plan.json").read_text(encoding="utf-8"))
VIEWS = sys.argv[1:] or ["aerial", "cutaway", "front"]

WALL_H, WALL_T = 2.7, 0.12
ROOF_T = 0.3
GLASS_H = 2.5

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, rough=0.7, metal=0.0, alpha=None):
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
    return m


M = {
    "wall": mat("wall", (0.86, 0.84, 0.80), 0.9),
    "roof": mat("roof", (0.10, 0.10, 0.11), 0.5, 0.2),
    "glass": mat("glass", (0.45, 0.62, 0.72), 0.05, alpha=0.35),
    "frame": mat("frame", (0.05, 0.05, 0.05), 0.4, 0.6),
    "wood": mat("wood", (0.45, 0.30, 0.17), 0.5),
    "door_g": mat("door_g", (0.18, 0.18, 0.20), 0.4, 0.4),
    "ground": mat("ground", (0.30, 0.42, 0.22), 0.95),
    "road": mat("road", (0.16, 0.16, 0.17), 0.9),
    "apron": mat("apron", (0.55, 0.55, 0.53), 0.9),
    "tile": mat("tile", (0.72, 0.70, 0.66), 0.5),
    "leaf": mat("leaf", (0.12, 0.34, 0.12), 0.8),
    "label": mat("label", (0.02, 0.02, 0.02), 0.9),
}
FLOOR = {
    "garage": (0.50, 0.50, 0.50), "ldk": (0.82, 0.68, 0.48), "entry": (0.60, 0.62, 0.66),
    "store": (0.78, 0.74, 0.60), "wet": (0.55, 0.74, 0.82), "private": (0.90, 0.80, 0.80),
    "courtyard": (0.72, 0.70, 0.66),
}
for k, c in FLOOR.items():
    M["floor_" + k] = mat("floor_" + k, c, 0.8)

objs = {"roof": [], "wall": []}


def box(name, x0, y0, z0, x1, y1, z1, material, group=None):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.materials.append(material)
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    if group:
        objs[group].append(o)
    return o


rooms = PLAN["rooms"]
by_id = {r["id"]: r for r in rooms}


def rect(r):
    x, y, w, d = r["rect"]
    return x, y, x + w, y + d


cx0, cy0, cx1, cy1 = rect(by_id["courtyard"])
X0 = min(rect(r)[0] for r in rooms); X1 = max(rect(r)[2] for r in rooms)
Y0 = min(rect(r)[1] for r in rooms); Y1 = max(rect(r)[3] for r in rooms)

# --- 地面・道路・アプローチ ---
box("ground", X0 - 25, Y0 - 25, -0.3, X1 + 25, Y1 + 3.2, -0.01, M["ground"])
box("road", X0 - 25, Y1 + 3.2, -0.3, X1 + 25, Y1 + 9.2, -0.01, M["road"])
gx0, gy0, gx1, gy1 = rect(by_id["garage"])
box("apron", gx0, gy1, -0.3, gx1, Y1 + 3.2, 0.0, M["apron"])

# --- 床 ---
for r in rooms:
    x0, y0, x1, y1 = rect(r)
    if r["kind"] == "courtyard":
        continue
    box("floor_" + r["id"], x0, y0, -0.3, x1, y1, 0.02, M["floor_" + r["kind"]])
# 中庭: ウッドデッキ + タイルテラス
box("deck", cx0, cy0, -0.3, cx0 + 4.0, cy1, 0.15, M["wood"])
box("terrace", cx0 + 4.0, cy0, -0.3, cx1, cy1, 0.03, M["tile"])
# シンボルツリー
tx, ty = cx1 - 1.3, (cy0 + cy1) / 2
box("trunk", tx - 0.1, ty - 0.1, 0, tx + 0.1, ty + 0.1, 1.8, M["wood"])
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.1, location=(tx, ty, 2.5))
bpy.context.object.data.materials.append(M["leaf"])
bpy.ops.object.shade_smooth()

# --- 壁 ---
def wall_seg(name, axis, fixed, a, b, kind="wall"):
    """axis='x': y=fixed の東西方向の壁 (x: a..b)。axis='y': x=fixed の南北方向の壁 (y: a..b)。"""
    if b - a < 0.05:
        return
    t = WALL_T / 2
    h = WALL_H if kind != "fence" else 2.4
    m = M["wall"] if kind != "fence" else M["wood"]
    if axis == "x":
        box(name, a - t, fixed - t, 0, b + t, fixed + t, h, m, "wall")
    else:
        box(name, fixed - t, a - t, 0, fixed + t, b + t, h, m, "wall")


def glass_seg(name, axis, fixed, a, b):
    n = max(1, round((b - a) / 1.7))
    t = 0.03
    for i in range(n):
        s, e = a + (b - a) * i / n, a + (b - a) * (i + 1) / n
        if axis == "x":
            box(f"{name}_g{i}", s, fixed - t, 0.02, e, fixed + t, GLASS_H, M["glass"])
        else:
            box(f"{name}_g{i}", fixed - t, s, 0.02, fixed + t, e, GLASS_H, M["glass"])
    for i in range(n + 1):
        p = a + (b - a) * i / n
        w = 0.05
        if axis == "x":
            box(f"{name}_m{i}", p - w, fixed - 0.06, 0.02, p + w, fixed + 0.06, GLASS_H + 0.1, M["frame"])
        else:
            box(f"{name}_m{i}", fixed - 0.06, p - w, 0.02, fixed + 0.06, p + w, GLASS_H + 0.1, M["frame"])
    # 上枠・下枠 + 垂れ壁
    if axis == "x":
        box(f"{name}_top", a, fixed - 0.06, GLASS_H, b, fixed + 0.06, GLASS_H + 0.1, M["frame"])
        box(f"{name}_hdr", a, fixed - WALL_T / 2, GLASS_H + 0.1, b, fixed + WALL_T / 2, WALL_H, M["wall"], "wall")
    else:
        box(f"{name}_top", fixed - 0.06, a, GLASS_H, fixed + 0.06, b, GLASS_H + 0.1, M["frame"])
        box(f"{name}_hdr", fixed - WALL_T / 2, a, GLASS_H + 0.1, fixed + WALL_T / 2, b, WALL_H, M["wall"], "wall")


# 中庭に面する辺: (axis, fixed, a, b)
court_edges = {
    ("x", cy1): (cx0, cx1),   # 北辺 = ガレージ南面
    ("x", cy0): (cx0, cx1),   # 南辺 = LDK北面
    ("y", cx1): (cy0, cy1),   # 東辺 = 玄関ホール西面(ピクチャーウィンドウ)
}

for r in rooms:
    if r["kind"] == "courtyard":
        continue
    x0, y0, x1, y1 = rect(r)
    for axis, fixed, a, b in (("x", y0, x0, x1), ("x", y1, x0, x1), ("y", x0, y0, y1), ("y", x1, y0, y1)):
        gl = court_edges.get((axis, fixed))
        nm = f"w_{r['id']}_{axis}{fixed:.1f}"
        if gl:
            ga, gb = max(a, gl[0]), min(b, gl[1])
            if gb - ga > 0.05:
                wall_seg(nm + "_pre", axis, fixed, a, ga)
                glass_seg(nm, axis, fixed, ga, gb)
                wall_seg(nm + "_post", axis, fixed, gb, b)
                continue
        wall_seg(nm, axis, fixed, a, b)
# 中庭の西側は高塀で閉じる
wall_seg("fence_west", "y", cx0, cy0, cy1, "fence")

# --- 玄関ドア・ガレージ扉 ---
for d in PLAN["exterior_doors"]:
    x0, y0, x1, y1 = d["edge"]
    m = M["door_g"] if d["id"] == "garage_door" else M["wood"]
    box(d["id"], x0, y0 - 0.02, 0, x1, y1 + 0.06, d["h"], m)

# --- 屋根(陸屋根) ---
for i, r in enumerate([r for r in rooms if r["kind"] != "courtyard"]):
    x0, y0, x1, y1 = rect(r)
    box("roof_" + r["id"], x0 - 0.06, y0 - 0.06, WALL_H, x1 + 0.06, y1 + 0.06, WALL_H + ROOF_T + i * 0.0005, M["roof"], "roof")

# --- 光 ---
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), 0, math.radians(-35)))
sun = bpy.context.object
sun.data.angle = math.radians(3)
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.62, 0.76, 0.92, 1)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.use_denoising = True

center = Vector(((X0 + X1) / 2, (Y0 + Y1) / 2, 1.0))


def look(cam, target):
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()


def render(view):
    for o in objs["roof"]:
        o.hide_render = view == "cutaway"
    old = [c for c in bpy.data.objects if c.type == "CAMERA"]
    for c in old:
        bpy.data.objects.remove(c)
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    scene.camera = cam
    scene.cycles.samples = 32
    scene.render.resolution_x, scene.render.resolution_y = 1400, 880
    scene.view_settings.view_transform = "AgX"
    sun.data.energy = 3.0
    bg.inputs[1].default_value = 0.8
    if view == "aerial":
        cam.data.lens = 28
        cam.location = (X0 - 16, Y0 - 14, 15)
        look(cam, (center.x, center.y, 0.5))
    elif view == "cutaway":
        cam.data.lens = 30
        cam.location = (X0 - 4, Y0 - 17, 21)
        look(cam, (center.x + 1.0, center.y, 0))
    elif view == "front":
        cam.data.lens = 24
        cam.location = (X0 + 10, Y1 + 12.0, 1.7)
        look(cam, (center.x - 1.0, Y1, 1.4))
    path = ROOT / "renders" / f"{view}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("rendered", path)


for v in VIEWS:
    render(v)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender" / "house.blend"))

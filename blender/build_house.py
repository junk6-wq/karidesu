"""plan/plan.json から平屋の3Dモデルを組み立て、建築パース風に描画する。

使い方:
    pip install -r requirements.txt
    python blender/build_house.py                      # 全視点を本番品質で
    python blender/build_house.py courtyard_dusk       # 1視点だけ
    python blender/build_house.py --draft              # 低解像度で構図だけ確認
出力: renders/<view>.png と blender/house.blend
視点: courtyard_dusk / living_day / aerial_day / dollhouse / street_dusk
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "plan" / "plan.json").read_text(encoding="utf-8"))
ALL_VIEWS = ["courtyard_dusk", "living_day", "aerial_day", "dollhouse", "street_dusk"]
VIEWS = [a for a in sys.argv[1:] if not a.startswith("--")] or ALL_VIEWS
DRAFT = "--draft" in sys.argv

GL = -0.35          # 地盤面（室内床 = 0）
CEIL = 2.6          # 天井高
TOP = 3.0           # パラペット天端
T_EXT = 0.22        # 外壁厚
T_PART = 0.1        # 間仕切り厚
GLASS_H = 2.4       # 中庭側サッシの高さ
EAVE = 0.6          # 中庭側の軒の出

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
groups = {k: [] for k in ("roof", "ceiling", "eave", "light_in", "light_out")}

# ---------------------------------------------------------------- 素材
def new_mat(name):
    m = bpy.data.materials.new(name)
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes["Principled BSDF"]


def solid(name, color, rough=0.5, metal=0.0, **inputs):
    m, _, _, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for k, v in inputs.items():
        b.inputs[k].default_value = v
    return m


def obj_coords(N, L, scale=(1, 1, 1), rot=0.0):
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    mp.inputs["Rotation"].default_value = (0, 0, rot)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def planks(name, c1, c2, gap, w, h, rough=0.45, rot=0.0, grain=0.35, bump=0.25, offset=0.5):
    """木の床・デッキ・石張り。brick テクスチャで目地、noise で木目。"""
    m, N, L, b = new_mat(name)
    vec = obj_coords(N, L, rot=rot)
    br = N.new("ShaderNodeTexBrick")
    br.offset = offset
    br.inputs["Color1"].default_value = (*c1, 1)
    br.inputs["Color2"].default_value = (*c2, 1)
    br.inputs["Mortar"].default_value = (*gap, 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.004
    br.inputs["Brick Width"].default_value = w
    br.inputs["Row Height"].default_value = h
    L.new(vec, br.inputs["Vector"])
    gvec = obj_coords(N, L, scale=(1.5, 40, 1.5), rot=rot)
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 2.0
    nz.inputs["Detail"].default_value = 6
    L.new(gvec, nz.inputs["Vector"])
    mix = N.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs[0].default_value = grain
    L.new(br.outputs["Color"], mix.inputs[6])
    L.new(nz.outputs["Color"], mix.inputs[7])
    L.new(mix.outputs[2], b.inputs["Base Color"])
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.invert = True
    L.new(br.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough
    return m


def plaster(name, color, scale=60, bump=0.04):
    m, N, L, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = 0.9
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 8
    L.new(obj_coords(N, L), nz.inputs["Vector"])
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    L.new(nz.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def slats(name, color, pitch=0.105, axis_rot=0.0, rough=0.7, metal=0.0):
    """縦張りの焼杉・ガレージ扉のスリット。wave テクスチャで凹凸。"""
    m, N, L, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    wv = N.new("ShaderNodeTexWave")
    wv.wave_profile = "SAW"
    wv.inputs["Scale"].default_value = 1.0 / pitch / 6.28 * 6.28
    wv.inputs["Distortion"].default_value = 0
    L.new(obj_coords(N, L, scale=(1 / pitch / 10, 1 / pitch / 10, 1 / pitch / 10), rot=axis_rot), wv.inputs["Vector"])
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.5
    L.new(wv.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def glass(name="glass", tint=(0.9, 0.96, 0.95)):
    """影はそのまま通す板ガラス(室内が暗く潰れないように)。"""
    m = bpy.data.materials.new(name)
    N, L = m.node_tree.nodes, m.node_tree.links
    N.remove(N["Principled BSDF"])
    g = N.new("ShaderNodeBsdfGlass")
    g.inputs["Color"].default_value = (*tint, 1)
    g.inputs["Roughness"].default_value = 0.0
    g.inputs["IOR"].default_value = 1.45
    t = N.new("ShaderNodeBsdfTransparent")
    lp = N.new("ShaderNodeLightPath")
    mx = N.new("ShaderNodeMixShader")
    L.new(lp.outputs["Is Shadow Ray"], mx.inputs[0])
    L.new(g.outputs[0], mx.inputs[1])
    L.new(t.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], N["Material Output"].inputs["Surface"])
    return m


def emissive(name, color, strength):
    m = bpy.data.materials.new(name)
    N, L = m.node_tree.nodes, m.node_tree.links
    N.remove(N["Principled BSDF"])
    e = N.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    L.new(e.outputs[0], N["Material Output"].inputs["Surface"])
    return m


M = {
    "plaster": plaster("plaster", (0.88, 0.87, 0.84)),
    "plaster_in": plaster("plaster_in", (0.93, 0.92, 0.89), bump=0.015),
    "yakisugi": slats("yakisugi", (0.035, 0.032, 0.03), pitch=0.105, rough=0.75),
    "garage_door": slats("garage_door", (0.11, 0.115, 0.12), pitch=0.15, axis_rot=math.pi / 2, rough=0.35, metal=0.7),
    "oak": planks("oak", (0.60, 0.43, 0.27), (0.52, 0.36, 0.22), (0.30, 0.20, 0.12), 1.2, 0.15),
    "deck": planks("deck", (0.42, 0.30, 0.20), (0.36, 0.25, 0.17), (0.08, 0.06, 0.05), 2.4, 0.14, rough=0.6, rot=math.pi / 2, bump=0.6),
    "stone": planks("stone", (0.50, 0.49, 0.46), (0.44, 0.43, 0.41), (0.32, 0.31, 0.30), 0.6, 0.6, rough=0.6, grain=0.1, offset=0.0),
    "stone_dark": planks("stone_dark", (0.20, 0.20, 0.20), (0.17, 0.17, 0.18), (0.12, 0.12, 0.12), 0.6, 0.3, rough=0.5, grain=0.05),
    "tile_wet": planks("tile_wet", (0.80, 0.79, 0.76), (0.76, 0.75, 0.72), (0.6, 0.6, 0.58), 0.3, 0.6, rough=0.3, grain=0.05, offset=0.0),
    "concrete": plaster("concrete", (0.46, 0.46, 0.45), scale=20, bump=0.08),
    "roof": plaster("roof", (0.24, 0.24, 0.25), scale=200, bump=0.15),
    "pv": planks("pv", (0.02, 0.03, 0.06), (0.025, 0.035, 0.07), (0.5, 0.5, 0.52), 0.33, 0.33, rough=0.15, grain=0.0, bump=0.05, offset=0.0),
    "frame": solid("frame", (0.03, 0.03, 0.035), 0.35, 0.8),
    "glass": glass(),
    "lawn": plaster("lawn", (0.16, 0.26, 0.08), scale=300, bump=0.3),
    "asphalt": plaster("asphalt", (0.07, 0.07, 0.075), scale=150, bump=0.1),
    "gravel": plaster("gravel", (0.45, 0.43, 0.40), scale=400, bump=0.5),
    "soil": solid("soil", (0.10, 0.07, 0.05), 0.95),
    "bark": solid("bark", (0.16, 0.12, 0.09), 0.9),
    "leaf": solid("leaf", (0.10, 0.25, 0.06), 0.6, **{"Subsurface Weight": 0.2}),
    "leaf2": solid("leaf2", (0.18, 0.30, 0.08), 0.6, **{"Subsurface Weight": 0.2}),
    "white": solid("white", (0.85, 0.85, 0.83), 0.25),
    "walnut": planks("walnut", (0.20, 0.12, 0.07), (0.17, 0.10, 0.06), (0.15, 0.09, 0.05), 3.0, 0.3, rough=0.4, grain=0.4, bump=0.0),
    "oak_furn": planks("oak_furn", (0.62, 0.46, 0.30), (0.58, 0.42, 0.27), (0.5, 0.36, 0.22), 3.0, 0.3, rough=0.4, grain=0.35, bump=0.0),
    "quartz": solid("quartz", (0.88, 0.88, 0.86), 0.15),
    "fabric": plaster("fabric", (0.55, 0.53, 0.49), scale=400, bump=0.1),
    "fabric_dark": plaster("fabric_dark", (0.16, 0.17, 0.18), scale=400, bump=0.1),
    "linen": plaster("linen", (0.86, 0.84, 0.80), scale=300, bump=0.05),
    "rug": plaster("rug", (0.62, 0.57, 0.49), scale=500, bump=0.2),
    "black": solid("black", (0.02, 0.02, 0.02), 0.4, 0.5),
    "paint_white": solid("paint_white", (0.82, 0.82, 0.80), 0.25, 0.0, **{"Coat Weight": 1.0}),
    "paint_dark": solid("paint_dark", (0.05, 0.06, 0.07), 0.25, 0.6, **{"Coat Weight": 1.0}),
    "car_glass": solid("car_glass", (0.01, 0.012, 0.015), 0.05, 0.0, **{"Coat Weight": 1.0}),
    "tire": solid("tire", (0.015, 0.015, 0.015), 0.8),
    "rim": solid("rim", (0.6, 0.6, 0.62), 0.25, 1.0),
    "lamp": emissive("lamp", (1.0, 0.72, 0.45), 30.0),
    "mirror": solid("mirror", (0.9, 0.9, 0.9), 0.02, 1.0),
    "ceramic": solid("ceramic", (0.92, 0.92, 0.90), 0.1),
    "pot": solid("pot", (0.30, 0.28, 0.26), 0.7),
    "neighbor": plaster("neighbor", (0.70, 0.69, 0.66)),
}

# ---------------------------------------------------------------- 形状の部品
_jit = [0]


def box(name, x0, y0, z0, x1, y1, z1, mat, group=None, bevel=0.0, jitter=True):
    """直方体。同じ面が重なると黒く潰れるので、天端を僅かにずらす。"""
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    if jitter:
        _jit[0] = (_jit[0] + 1) % 37
        z1 += _jit[0] * 0.0003
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 3
        bv.limit_method = "ANGLE"
        me.shade_smooth()
        bv.harden_normals = False
    if group:
        groups[group].append(o)
    return o


def cyl(name, x, y, z0, z1, r, mat, verts=32, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    if rot:
        o.rotation_euler = rot
    o.data.materials.append(mat)
    return o


def blob(name, x, y, z, r, mat, seed=0, squash=1.0):
    """葉の塊。icosphere を雲テクスチャで崩す。"""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=r, location=(x, y, z))
    o = bpy.context.object
    o.name = name
    o.scale = (1, 1, squash)
    tex = bpy.data.textures.new(f"{name}_tex", "CLOUDS")
    tex.noise_scale = 0.35 * r
    tex.noise_depth = 2
    d = o.modifiers.new("displace", "DISPLACE")
    d.texture = tex
    d.strength = 0.45 * r
    d.mid_level = 0.5
    d.texture_coords = "GLOBAL"
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def area_light(name, x, y, z, sx, sy, watts, color=(1.0, 0.78, 0.56), group="light_in"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = sx, sy
    ld.energy = watts
    ld.color = color
    o = bpy.data.objects.new(name, ld)
    o.location = (x, y, z)
    o.visible_camera = False
    scene.collection.objects.link(o)
    groups[group].append(o)
    return o


def point_light(name, x, y, z, watts, color=(1.0, 0.75, 0.5), radius=0.05, group="light_out", spot=None):
    ld = bpy.data.lights.new(name, "SPOT" if spot else "POINT")
    ld.energy = watts
    ld.color = color
    ld.shadow_soft_size = radius
    if spot:
        ld.spot_size = spot
        ld.spot_blend = 0.6
    o = bpy.data.objects.new(name, ld)
    o.location = (x, y, z)
    o.visible_camera = False
    scene.collection.objects.link(o)
    groups[group].append(o)
    return o


# ---------------------------------------------------------------- 間取りの読み込み
rooms = PLAN["rooms"]
by_id = {r["id"]: r for r in rooms}


def rect(rid):
    x, y, w, d = by_id[rid]["rect"]
    return x, y, x + w, y + d


INDOOR = [r["id"] for r in rooms if r["kind"] != "courtyard"]
xs = sorted({v for r in rooms for v in (r["rect"][0], r["rect"][0] + r["rect"][2])})
ys = sorted({v for r in rooms for v in (r["rect"][1], r["rect"][1] + r["rect"][3])})


def owner(x, y):
    for r in rooms:
        x0, y0, x1, y1 = rect(r["id"])
        if x0 < x < x1 and y0 < y < y1:
            return r["id"]
    return None


def indoor(rid):
    return rid is not None and rid != "courtyard"


X0, X1, Y0, Y1 = xs[0], xs[-1], ys[0], ys[-1]
CX0, CY0, CX1, CY1 = rect("courtyard")

# 線ごとに境界の種類を判定 (外壁 / 中庭ガラス / 間仕切り / 塀)
segs = {}
for axis, lines, cross in (("y", xs, ys), ("x", ys, xs)):
    for f in lines:
        for a, b in zip(cross, cross[1:]):
            m = (a + b) / 2
            neg = owner(f - 1e-3, m) if axis == "y" else owner(m, f - 1e-3)
            pos = owner(f + 1e-3, m) if axis == "y" else owner(m, f + 1e-3)
            if neg == pos:
                continue
            if indoor(neg) and indoor(pos):
                key = ("part", tuple(sorted((neg, pos))))
            elif indoor(neg) or indoor(pos):
                other = pos if indoor(neg) else neg
                out = 1 if indoor(neg) else -1
                key = ("glass" if other == "courtyard" else "ext", out)
            else:
                key = ("fence", 1 if neg == "courtyard" else -1)
            segs.setdefault((axis, f, key), []).append((a, b))


def merged(ivs):
    out = []
    for a, b in sorted(ivs):
        if out and a <= out[-1][1] + 1e-6:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def inside(x, y):
    return indoor(owner(x, y))


def strip(axis, f, out, a, b, z0, z1, mat, name, group=None, ext_a=0.0, ext_b=0.0, t=T_EXT):
    """境界線 f の外側 (out=±1) に厚さ t の帯を立てる。"""
    if axis == "y":   # x = f の南北方向の壁
        return box(name, f, a - ext_a, z0, f + out * t, b + ext_b, z1, mat, group)
    return box(name, a - ext_a, f, z0, b + ext_b, f + out * t, z1, mat, group)


doors = [d for d in PLAN["exterior_doors"]]

for (axis, f, (kind, info)), ivs in segs.items():
    for i, (a, b) in enumerate(merged(ivs)):
        nm = f"{kind}_{axis}{f:.2f}_{i}"
        if kind == "ext":
            out = info
            # 東西方向の外壁だけ、出隅で端を延ばして角を塞ぐ
            ea = eb = 0.0
            if axis == "x":
                ea = T_EXT if not inside(a - 0.01, f - out * 0.01) else 0.0
                eb = T_EXT if not inside(b + 0.01, f - out * 0.01) else 0.0
            mat = M["yakisugi"] if (axis == "x" and out == 1) else M["plaster"]
            pieces = [(a, b, ea, eb)]
            for d in doors:
                dx0, dy0, dx1, dy1 = d["edge"]
                if axis == "x" and abs(dy0 - f) < 1e-6 and a <= dx0 and dx1 <= b:
                    new = []
                    for (pa, pb, pea, peb) in pieces:
                        if pa <= dx0 and dx1 <= pb:
                            new += [(pa, dx0, pea, 0.0), (dx1, pb, 0.0, peb)]
                        else:
                            new.append((pa, pb, pea, peb))
                    pieces = new
                    strip(axis, f, out, dx0, dx1, d["h"], TOP, mat, nm + "_hdr_" + d["id"])
                    dm = M["garage_door"] if d["id"] == "garage_door" else M["walnut"]
                    box(d["id"], dx0, f + out * 0.08, 0, dx1, f + out * 0.13, d["h"], dm)
                    if d["id"] != "garage_door":
                        box(d["id"] + "_handle", dx1 - 0.12, f + out * 0.13, 0.4, dx1 - 0.09, f + out * 0.17, 1.8, M["black"])
            for k, (pa, pb, pea, peb) in enumerate(pieces):
                if pb - pa > 0.01:
                    if mat is M["yakisugi"]:
                        strip(axis, f, out, pa, pb, GL, TOP, M["plaster"], f"{nm}_{k}", ext_a=pea, ext_b=peb, t=T_EXT - 0.03)
                        strip(axis, f + out * (T_EXT - 0.03), out, pa, pb, GL, TOP, mat, f"{nm}_{k}_clad", ext_a=pea, ext_b=peb, t=0.03)
                    else:
                        strip(axis, f, out, pa, pb, GL, TOP, mat, f"{nm}_{k}", ext_a=pea, ext_b=peb)
        elif kind == "glass":
            out = info
            n = max(2, round((b - a) / 1.75))
            strip(axis, f, out, a, b, GLASS_H, TOP, M["plaster"], nm + "_hdr")
            strip(axis, f, out, a, b, GL, 0.0, M["plaster"], nm + "_base")
            mid = f + out * T_EXT / 2
            for k in range(n):
                s, e = a + (b - a) * k / n, a + (b - a) * (k + 1) / n
                off = 0.03 * (1 if k % 2 else -1)   # 引き違いの前後
                if axis == "x":
                    box(f"{nm}_g{k}", s + 0.03, mid + off - 0.01, 0.02, e - 0.03, mid + off + 0.01, GLASS_H - 0.03, M["glass"])
                else:
                    box(f"{nm}_g{k}", mid + off - 0.01, s + 0.03, 0.02, mid + off + 0.01, e - 0.03, GLASS_H - 0.03, M["glass"])
            for k in range(n + 1):
                p = a + (b - a) * k / n
                w = 0.035
                if axis == "x":
                    box(f"{nm}_m{k}", p - w, mid - 0.05, 0, p + w, mid + 0.05, GLASS_H, M["frame"])
                else:
                    box(f"{nm}_m{k}", mid - 0.05, p - w, 0, mid + 0.05, p + w, GLASS_H, M["frame"])
            strip(axis, f, out, a, b, GLASS_H - 0.04, GLASS_H, M["frame"], nm + "_top")
            # 軒
            if axis == "x":
                box(nm + "_eave", a, f, CEIL + 0.18, b, f + out * (T_EXT + EAVE), CEIL + 0.3, M["plaster"], "eave")
            else:
                box(nm + "_eave", f, a + EAVE, CEIL + 0.18, f + out * (T_EXT + EAVE), b - EAVE, CEIL + 0.3, M["plaster"], "eave")
        elif kind == "fence":
            out = info
            k = 0
            p = a
            while p < b - 0.01:
                q = min(b, p + 0.06)
                if axis == "y":
                    box(f"{nm}_s{k}", f + out * 0.02, p, GL, f + out * 0.12, q, 2.4, M["walnut"])
                else:
                    box(f"{nm}_s{k}", p, f + out * 0.02, GL, q, f + out * 0.12, 2.4, M["walnut"])
                p += 0.1
                k += 1
            if axis == "y":
                box(nm + "_rail", f + out * 0.12, a, 2.35, f + out * 0.16, b, 2.4, M["frame"])
        else:   # 間仕切り(隣接要件の組には開口を空ける)
            pair = info
            lo, hi = a - T_PART / 2, b + T_PART / 2
            opening = None
            for p, q, _ in PLAN["adjacency"]:
                if tuple(sorted((p, q))) == pair and pair != ("kidsA", "kidsB"):
                    c = (a + b) / 2
                    hw = min(0.45, (b - a) / 2 - 0.15)
                    opening = (c - hw, c + hw)
            mat = M["oak_furn"] if pair == ("kidsA", "kidsB") else M["plaster_in"]
            parts = [(lo, hi)] if not opening else [(lo, opening[0]), (opening[1], hi)]
            for k, (pa, pb) in enumerate(parts):
                if axis == "y":
                    box(f"{nm}_{k}", f - T_PART / 2, pa, 0, f + T_PART / 2, pb, CEIL - 0.001, mat)
                else:
                    box(f"{nm}_{k}", pa, f - T_PART / 2, 0, pb, f + T_PART / 2, CEIL - 0.001, mat)
            if opening:
                if axis == "y":
                    box(nm + "_hdr", f - T_PART / 2, opening[0], 2.2, f + T_PART / 2, opening[1], CEIL - 0.001, M["plaster_in"])
                else:
                    box(nm + "_hdr", opening[0], f - T_PART / 2, 2.2, opening[1], f + T_PART / 2, CEIL - 0.001, M["plaster_in"])
            if pair == ("doma", "garage"):
                # 土間ホールからガレージの車を眺める FIX 窓
                gx = f
                box(nm + "_fix", gx - 0.01, 9.8, 0.9, gx + 0.01, 10.5, 2.1, M["glass"])

# 床・天井・屋根
FLOOR = {"ldk": "oak", "private": "oak", "store": "oak", "wet": "tile_wet", "entry": "stone_dark", "garage": "concrete"}
for rid in INDOOR:
    x0, y0, x1, y1 = rect(rid)
    kind = by_id[rid]["kind"]
    mat = M["oak"] if rid == "hall" else M[FLOOR[kind]]
    box("floor_" + rid, x0, y0, GL, x1, y1, 0.0, mat, jitter=False)
    box("ceil_" + rid, x0, y0, CEIL, x1, y1, CEIL + 0.04, M["plaster_in"], "ceiling", jitter=False)
    box("roof_" + rid, x0, y0, CEIL + 0.04, x1, y1, TOP - 0.12, M["roof"], "roof", jitter=False)

# 太陽光パネル(東棟の屋根)
for row in range(4):
    y = 0.5 + row * 1.9
    for col in range(6):
        x = 10.1 + col * 1.07
        box(f"pv_{row}_{col}", x, y, TOP - 0.12, x + 1.03, y + 1.6, TOP - 0.02, M["pv"], "roof")

# ---------------------------------------------------------------- 中庭
box("deck", CX0, CY0, GL, CX0 + 4.2, CY1, 0.0, M["deck"], jitter=False)
box("terrace", CX0 + 4.2, CY0, GL, CX1, CY1, 0.0, M["stone"], jitter=False)
TX, TY = CX0 + 5.3, CY0 + 2.0
cyl("planter", TX, TY, -0.05, 0.005, 0.75, M["gravel"], 48)
trunk = cyl("trunk", TX, TY, 0, 2.4, 0.07, M["bark"], 12, rot=(0.06, -0.04, 0))
for k, (dx, dy, ang) in enumerate([(0.3, 0.1, 0.5), (-0.25, 0.15, -0.6), (0.05, -0.3, 0.4)]):
    cyl(f"branch{k}", TX + dx / 2, TY + dy / 2, 1.5, 2.7, 0.03, M["bark"], 8, rot=(ang * dy * 2, ang, 0))
for k, (dx, dy, dz, r) in enumerate([(0, 0, 3.0, 0.75), (0.5, 0.2, 2.6, 0.55), (-0.45, 0.25, 2.7, 0.55),
                                     (0.1, -0.45, 2.75, 0.5), (-0.2, -0.1, 3.4, 0.5), (0.35, -0.2, 3.25, 0.45)]):
    blob(f"leaf{k}", TX + dx, TY + dy, dz, r, M["leaf"] if k % 2 else M["leaf2"], squash=0.85)
for k, y in enumerate([CY0 + 0.4, CY0 + 1.2, CY0 + 2.2, CY0 + 3.0]):
    blob(f"shrub{k}", CX0 + 0.35, y, 0.25, 0.32, M["leaf2"], squash=0.7)
box("bench_court", CX0 + 1.2, CY1 - 0.75, 0, CX0 + 3.2, CY1 - 0.35, 0.42, M["oak_furn"], bevel=0.01)

# ---------------------------------------------------------------- 外構
box("lawn", X0 - 400, Y0 - 400, GL - 0.3, X1 + 400, Y1 + 5.5, GL, M["lawn"], jitter=False)
box("lawn_far", X0 - 400, Y1 + 12, GL - 0.3, X1 + 400, Y1 + 400, GL, M["lawn"], jitter=False)
box("road", X0 - 400, Y1 + 5.5, GL - 0.3, X1 + 400, Y1 + 12, GL - 0.02, M["asphalt"], jitter=False)
gx0, gy0, gx1, gy1 = rect("garage")
box("drive", gx0 - 0.4, gy1, GL - 0.3, gx1 + 0.4, Y1 + 5.5, GL + 0.02, M["concrete"], jitter=False)
for k in range(5):     # 玄関へのアプローチ(飛び石)
    y = Y1 + 0.5 + k * 1.0
    box(f"step{k}", 7.5, y, GL, 8.9, y + 0.6, GL + 0.04, M["stone"], jitter=False)
box("porch_family", 6.8, Y1, GL, 9.8, Y1 + 0.4, -0.18, M["stone_dark"], jitter=False)
box("approach_guest", 10.4, 11.8, GL, 12.4, Y1 + 5.5, GL + 0.03, M["stone"], jitter=False)
box("porch_guest", 9.8, 11.8, GL, 13.0, 12.3, -0.18, M["stone_dark"], jitter=False)
for k, (x, y, r) in enumerate([(-4, -3, 1.6), (19.5, 1, 1.3), (18.5, 12.5, 1.8), (-3.5, 13.5, 1.4), (14.5, 16.5, 1.1),
                               (-5, 4, 1.2), (21, 7, 1.5)]):
    cyl(f"ttrunk{k}", x, y, GL, GL + 2.4 * r, 0.09 * r, M["bark"], 10)
    blob(f"tree{k}", x, y, GL + 2.6 * r, 1.3 * r, M["leaf"] if k % 2 else M["leaf2"])

# ---------------------------------------------------------------- 家具
def furniture():
    B = box
    # LDK: キッチンとダイニングを横並び(ポポラート配置)
    B("island_base", 6.4, 2.6, 0, 9.0, 3.45, 0.86, M["walnut"], bevel=0.005)
    B("island_top", 6.35, 2.55, 0.86, 9.05, 3.5, 0.9, M["quartz"], bevel=0.004)
    B("sink", 7.9, 3.0, 0.86, 8.5, 3.35, 0.905, M["frame"])
    B("table_top", 3.9, 2.65, 0.70, 6.3, 3.4, 0.74, M["oak_furn"], bevel=0.004)
    for k, x in enumerate([4.05, 6.1]):
        B(f"table_leg{k}", x, 2.85, 0, x + 0.05, 3.2, 0.70, M["black"])
    for k, x in enumerate([4.3, 5.1, 5.9]):
        for s, (y0, y1, by0, by1) in enumerate([(2.05, 2.5, 2.0, 2.05), (3.55, 4.0, 4.0, 4.05)]):
            B(f"chair{k}{s}", x - 0.22, y0, 0.42, x + 0.22, y1, 0.46, M["oak_furn"], bevel=0.01)
            B(f"chairback{k}{s}", x - 0.22, by0, 0.46, x + 0.22, by1, 0.82, M["oak_furn"], bevel=0.01)
            for lx in (x - 0.2, x + 0.17):
                for ly in (y0 + 0.02, y1 - 0.05):
                    B(f"chairleg{k}{s}{lx:.2f}{ly:.2f}", lx, ly, 0, lx + 0.03, ly + 0.03, 0.42, M["black"], jitter=False)
    for k, x in enumerate([4.6, 5.6, 6.9, 7.7, 8.5]):
        cyl(f"pend_wire{k}", x, 3.03, 1.75, CEIL, 0.004, M["black"], 6)
        cyl(f"pend{k}", x, 3.03, 1.62, 1.78, 0.11, M["black"], 32)
        cyl(f"pend_bulb{k}", x, 3.03, 1.6, 1.63, 0.09, M["lamp"], 32)
    # リビング(中庭を向くソファ)
    B("rug", 0.4, 0.3, 0.0, 3.7, 2.7, 0.012, M["rug"], jitter=False)
    B("sofa_base", 0.6, 0.3, 0.06, 3.4, 1.25, 0.42, M["fabric"], bevel=0.04)
    B("sofa_back", 0.6, 0.3, 0.42, 3.4, 0.55, 0.8, M["fabric"], bevel=0.06)
    for k, x in enumerate([0.6, 3.2]):
        B(f"sofa_arm{k}", x, 0.3, 0.42, x + 0.2, 1.25, 0.6, M["fabric"], bevel=0.05)
    for k, x in enumerate([0.85, 1.75, 2.65]):
        B(f"cushion{k}", x, 0.6, 0.42, x + 0.8, 1.2, 0.52, M["fabric"], bevel=0.05)
    B("coffee", 1.4, 1.6, 0.3, 2.6, 2.2, 0.34, M["walnut"], bevel=0.01)
    B("coffee_leg", 1.9, 1.8, 0, 2.1, 2.0, 0.3, M["black"])
    B("lounge", 0.3, 3.2, 0.05, 1.0, 3.9, 0.42, M["fabric_dark"], bevel=0.06)
    B("lounge_back", 0.3, 3.2, 0.42, 0.45, 3.9, 0.85, M["fabric_dark"], bevel=0.05)
    # ベンチヌック + 半個室ワークスペース(南壁)
    B("nook_seat", 4.0, 0.05, 0, 6.4, 0.55, 0.43, M["oak_furn"], bevel=0.01)
    B("nook_cushion", 4.05, 0.1, 0.43, 6.35, 0.5, 0.5, M["linen"], bevel=0.03)
    B("work_desk", 6.6, 0.05, 0.70, 9.7, 0.65, 0.73, M["oak_furn"], bevel=0.004)
    B("work_panel", 6.5, 0.05, 0, 6.55, 0.9, 1.6, M["oak_furn"])
    B("work_chair", 7.8, 0.8, 0.42, 8.25, 1.25, 0.47, M["fabric_dark"], bevel=0.03)
    cyl("plant_pot", 0.4, 4.5, 0, 0.45, 0.2, M["pot"])
    blob("plant", 0.4, 4.5, 0.95, 0.38, M["leaf2"], squash=1.3)
    # パントリー・玄関・SIC の棚
    B("pantry_shelf_w", 8.33, 5.05, 0, 8.7, 8.35, 2.2, M["oak_furn"])
    B("pantry_shelf_e", 9.4, 5.05, 0, 9.77, 8.35, 2.2, M["oak_furn"])
    B("sic_shelf", 6.85, 10.65, 0, 7.25, 12.35, 2.2, M["oak_furn"])
    B("shoe_cab", 9.4, 12.45, 0.3, 9.77, 14.65, 1.2, M["oak_furn"])
    B("guest_cab", 12.55, 8.65, 0.25, 12.97, 11.75, 1.0, M["walnut"])
    B("hall_bench", 7.6, 5.4, 0, 8.25, 7.0, 0.42, M["oak_furn"], bevel=0.01)
    # ガレージ: EV 充電器
    B("ev_charger", 0.02, 12.2, 1.0, 0.12, 12.5, 1.45, M["white"], bevel=0.01)
    # 子ども部屋・主寝室
    for k, (y0, y1) in enumerate([(0.15, 2.2), (2.75, 4.8)]):
        B(f"kbed{k}", 11.85, y0, 0, 12.9, y1, 0.35, M["oak_furn"], bevel=0.01)
        B(f"kmat{k}", 11.88, y0 + 0.03, 0.35, 12.87, y1 - 0.03, 0.5, M["linen"], bevel=0.04)
        B(f"kdesk{k}", 9.9, y0 + 0.4 if k else 0.05, 0.7, 10.5, (y0 + 1.6) if k else 1.3, 0.73, M["oak_furn"])
    B("mbed", 14.0, 0.2, 0, 15.65, 2.35, 0.32, M["walnut"], bevel=0.01)
    B("mmat", 14.03, 0.25, 0.32, 15.62, 2.3, 0.52, M["linen"], bevel=0.05)
    B("mhead", 13.9, 0.05, 0, 15.75, 0.2, 1.0, M["walnut"], bevel=0.01)
    for k, x in enumerate([13.45, 15.8]):
        B(f"nstand{k}", x, 0.05, 0, x + 0.45, 0.45, 0.45, M["walnut"], bevel=0.01)
    B("wic_shelf", 13.05, 4.55, 0, 16.55, 4.95, 2.2, M["oak_furn"])
    B("fcl_shelf", 9.85, 5.05, 0, 13.95, 5.45, 2.2, M["oak_furn"])
    # 水回り
    B("washer", 9.9, 7.95, 0, 10.55, 8.55, 0.9, M["white"], bevel=0.02)
    B("dryer", 9.9, 7.95, 0.95, 10.55, 8.55, 1.75, M["white"], bevel=0.02)
    B("slop", 10.7, 8.05, 0, 11.4, 8.55, 0.85, M["ceramic"], bevel=0.02)
    B("dry_pipe", 10.0, 7.2, 2.15, 12.9, 7.23, 2.18, M["frame"])
    B("vanity", 13.05, 7.95, 0.2, 14.75, 8.55, 0.85, M["quartz"], bevel=0.005)
    B("mirror", 13.1, 8.56, 1.0, 14.7, 8.58, 2.1, M["mirror"])
    B("tub", 14.9, 6.5, 0, 16.5, 7.3, 0.55, M["ceramic"], bevel=0.08)
    for k, (x, y) in enumerate([(9.0, 11.9), (14.55, 5.9)]):
        B(f"toilet{k}", x, y, 0, x + 0.4, y + 0.45, 0.42, M["ceramic"], bevel=0.08)


furniture()


# ---------------------------------------------------------------- 車
def car(name, cx, cy, paint):
    L, W = 4.8, 1.88
    box(name + "_body", cx - W / 2, cy - L / 2, 0.3, cx + W / 2, cy + L / 2, 0.98, paint, bevel=0.14)
    box(name + "_cabin", cx - 0.78, cy - 1.45, 0.95, cx + 0.78, cy + 1.05, 1.52, M["car_glass"], bevel=0.2)
    box(name + "_roof", cx - 0.74, cy - 1.2, 1.46, cx + 0.74, cy + 0.85, 1.55, paint, bevel=0.06)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx * (W / 2 - 0.12), cy + sy * 1.45
            cyl(f"{name}_tire{sx}{sy}", x, y, 0.0, 0.24, 0.36, M["tire"], 32, rot=(0, math.pi / 2, 0)).location = (x, y, 0.36)
            cyl(f"{name}_rim{sx}{sy}", x, y, 0.0, 0.26, 0.22, M["rim"], 24, rot=(0, math.pi / 2, 0)).location = (x, y, 0.36)
    for sx in (-1, 1):
        box(f"{name}_lamp{sx}", cx + sx * 0.75 - 0.2, cy + L / 2 - 0.02, 0.72, cx + sx * 0.75 + 0.2, cy + L / 2 + 0.01, 0.78, M["white"])


car("car1", 1.75, 11.55, M["paint_white"])
car("car2", 5.0, 11.55, M["paint_dark"])

# ---------------------------------------------------------------- 照明
WARM = (1.0, 0.68, 0.40)
for rid in INDOOR:
    x0, y0, x1, y1 = rect(rid)
    w, d = x1 - x0, y1 - y0
    k = 5 if rid != "garage" else 4
    area_light("L_" + rid, (x0 + x1) / 2, (y0 + y1) / 2, CEIL - 0.02, w * 0.6, d * 0.6, k * w * d, WARM)
point_light("tree_up", TX + 0.6, TY - 0.6, 0.05, 120, WARM, spot=math.radians(50)).rotation_euler = (math.radians(25), 0, math.radians(-135))
for k, (x, y) in enumerate([(8.1, Y1 + 0.5), (11.4, 12.2), (3.4, Y1 + 0.5)]):
    point_light(f"door_light{k}", x, y, 2.2, 35, WARM, 0.05)
for k, (x, y) in enumerate([(1.0, CY0 + 0.4), (1.0, CY1 - 0.4), (3.2, CY0 + 0.3)]):
    point_light(f"court_light{k}", x, y, 0.15, 15, WARM, 0.03)

sun_obj = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
scene.collection.objects.link(sun_obj)
sun_obj.data.angle = math.radians(1.5)

world = bpy.data.worlds.new("world")
scene.world = world
WN, WL = world.node_tree.nodes, world.node_tree.links
bg = WN["Background"]
sky = WN.new("ShaderNodeTexSky")
sky.sky_type = "MULTIPLE_SCATTERING"
sky.sun_disc = False
WL.new(sky.outputs[0], bg.inputs[0])

# ---------------------------------------------------------------- 描画
scene.render.engine = "CYCLES"
c = scene.cycles
c.device = "CPU"
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.02
c.use_denoising = True
c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 10, 4, 4
c.transmission_bounces = c.transparent_max_bounces = 10
c.caustics_reflective = c.caustics_refractive = False
c.sample_clamp_indirect = 8
scene.view_settings.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        pass


def set_time(kind):
    dusk = kind == "dusk"
    elev, azim = (4, -100) if dusk else (52, -25)
    # ライトの -Z が光の進む向き。X 回転で仰角、Z 回転で方位(0=南から北へ)
    sun_obj.rotation_euler = (math.radians(90 - elev), 0, math.radians(azim))
    sun_obj.data.energy = 0.5 if dusk else 4.5
    sun_obj.data.color = (1.0, 0.55, 0.32) if dusk else (1.0, 0.96, 0.9)
    sky.sun_elevation = math.radians(elev)
    sky.sun_rotation = math.radians(-azim - 90)
    bg.inputs[1].default_value = 0.035 if dusk else 0.35
    for o in groups["light_in"] + groups["light_out"]:
        o.hide_render = not dusk and o in groups["light_out"]
    for o in groups["light_in"]:
        o.data.energy = o.get("base", o.data.energy)
        o["base"] = o.data.energy
        if not dusk:
            o.data.energy = o["base"] * 0.15
    M["lamp"].node_tree.nodes["Emission"].inputs["Strength"].default_value = 30 if dusk else 6


VIEWDEF = {
    "courtyard_dusk": dict(cam=(0.5, 8.05, 1.45), target=(7.4, 4.3, 1.2), lens=17, time="dusk", ev=0.4),
    "living_day": dict(cam=(9.35, 0.75, 1.35), target=(2.6, 10.2, 1.25), lens=19, time="day", ev=1.0),
    "aerial_day": dict(cam=(-11.0, 14.0, 21.0), target=(7.8, 5.6, 0.0), lens=30, time="day", ev=0.0),
    "dollhouse": dict(cam=(-3.5, -14.0, 26.0), target=(8.3, 6.8, 0.0), lens=34, time="day", cut=True, ev=0.3),
    "street_dusk": dict(cam=(15.5, 27.5, 1.55), target=(6.0, 14.7, 1.7), lens=21, time="dusk", ev=0.6),
}

cam_obj = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_obj.data.sensor_width = 36

for v in VIEWS:
    d = VIEWDEF[v]
    set_time(d["time"])
    scene.view_settings.exposure = d.get("ev", 0.0)
    cut = d.get("cut", False)
    for o in groups["roof"] + groups["ceiling"] + groups["eave"]:
        o.hide_render = cut
    cam_obj.location = d["cam"]
    cam_obj.rotation_euler = (Vector(d["target"]) - Vector(d["cam"])).to_track_quat("-Z", "Y").to_euler()
    cam_obj.data.lens = d["lens"]
    if DRAFT:
        scene.render.resolution_x, scene.render.resolution_y = 640, 400
        c.samples = 16
    else:
        scene.render.resolution_x, scene.render.resolution_y = 1440, 900
        c.samples = 96 if d["time"] == "dusk" else 64
    out = ROOT / "renders" / (f"draft_{v}.png" if DRAFT else f"{v}.png")
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    print("rendered", out, flush=True)

if not DRAFT:
    set_time("day")
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender" / "house.blend"))

"""plan/plan.json の検証: 重なり・面積・要件との差・隣接(動線)を表示する。標準ライブラリのみ。"""
import json
import sys
from itertools import combinations
from pathlib import Path

JO = 1.62          # 1畳(m²)
TSUBO = 3.3058     # 1坪(m²)
EPS = 1e-6

plan = json.loads((Path(__file__).parent.parent / "plan" / "plan.json").read_text(encoding="utf-8"))
rooms = {r["id"]: r for r in plan["rooms"]}


def rect(r):
    x, y, w, d = r["rect"]
    return x, y, x + w, y + d


def overlap(a, b):
    ax0, ay0, ax1, ay1 = rect(a)
    bx0, by0, bx1, by1 = rect(b)
    w = min(ax1, bx1) - max(ax0, bx0)
    d = min(ay1, by1) - max(ay0, by0)
    return w, d


def shared_edge(a, b):
    """壁を共有する長さ(m)。重なりや点接触は 0。"""
    w, d = overlap(a, b)
    if w > EPS and d > EPS:
        return 0.0
    if abs(w) <= EPS and d > EPS or abs(d) <= EPS and w > EPS:
        return max(w, d)
    return 0.0


def area(r):
    return r["rect"][2] * r["rect"][3]


errors = 0
print("== 重なり ==")
for a, b in combinations(plan["rooms"], 2):
    w, d = overlap(a, b)
    if w > EPS and d > EPS:
        errors += 1
        print(f"  NG {a['id']} と {b['id']} が {w:.2f}×{d:.2f}m 重なっている")
if not errors:
    print("  なし")

print("\n== 面積 ==")
for r in plan["rooms"]:
    a = area(r)
    print(f"  {r['name']:<22} {a:6.1f} m²  {a / JO:5.1f}畳")
living = sum(area(r) for r in plan["rooms"] if r["kind"] not in ("garage", "courtyard"))
garage = area(rooms["garage"])
court = area(rooms["courtyard"])
t = plan["targets"]
print(f"\n  居住部分 {living:6.1f} m² = {living / TSUBO:5.1f}坪  (目標 {t['living_tsubo']}坪, 差 {living / TSUBO - t['living_tsubo']:+.1f})")
print(f"  ガレージ {garage:6.1f} m² = {garage / TSUBO:5.1f}坪  (目標 {t['garage_tsubo']}坪, 差 {garage / TSUBO - t['garage_tsubo']:+.1f})")
print(f"  中庭     {court:6.1f} m² = {court / JO:5.1f}畳  (目標 {t['courtyard_jo']}畳, 差 {court / JO - t['courtyard_jo']:+.1f})")
print(f"  延床(居住+ガレージ) {(living + garage) / TSUBO:5.1f}坪  (目標 58坪)")
gw, gd = rooms["garage"]["rect"][2:]
if (gw, gd) != tuple(t["garage_size"]):
    errors += 1
    print(f"  NG ガレージ寸法 {gw}×{gd} (要件 {t['garage_size'][0]}×{t['garage_size'][1]})")

print("\n== 動線・隣接(壁を0.8m以上共有) ==")
for a, b, why in plan["adjacency"]:
    L = shared_edge(rooms[a], rooms[b])
    ok = L >= 0.8
    errors += not ok
    print(f"  {'OK' if ok else 'NG'} {rooms[a]['name']} - {rooms[b]['name']} ({L:.1f}m): {why}")

x0 = min(rect(r)[0] for r in plan["rooms"]); y0 = min(rect(r)[1] for r in plan["rooms"])
x1 = max(rect(r)[2] for r in plan["rooms"]); y1 = max(rect(r)[3] for r in plan["rooms"])
print(f"\n敷地に必要な最小範囲(建物のみ): {x1 - x0:.1f} × {y1 - y0:.1f} m")
sys.exit(1 if errors else 0)

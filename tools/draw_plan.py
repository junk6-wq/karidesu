"""plan/plan.json から間取り図 docs/plan.svg を描く。標準ライブラリのみ。"""
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
plan = json.loads((ROOT / "plan" / "plan.json").read_text(encoding="utf-8"))
S = 56            # px / m
MX, MY = 70, 90   # 余白
JO = 1.62
COLORS = {
    "garage": "#cfd2d6", "courtyard": "#cfe3c4", "ldk": "#f1dfbd", "entry": "#d5dbe6",
    "store": "#eadfc0", "wet": "#c4e1ee", "private": "#f2d6d6",
}
rooms = plan["rooms"]
X1 = max(r["rect"][0] + r["rect"][2] for r in rooms)
Y1 = max(r["rect"][1] + r["rect"][3] for r in rooms)
W, H = int(X1 * S + MX * 2), int(Y1 * S + MY * 2)


def px(x, y):
    return MX + x * S, MY + (Y1 - y) * S      # 北が上


out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
       'font-family="\'Noto Sans CJK JP\',\'Hiragino Sans\',\'Yu Gothic\',\'WenQuanYi Zen Hei\',sans-serif">',
       f'<rect width="{W}" height="{H}" fill="#fbfaf7"/>']

# 道路
rx, ry = px(-1.2, Y1 + 1.0)
out.append(f'<rect x="{rx}" y="{ry - 26}" width="{(X1 + 2.4) * S}" height="26" fill="#9a9a9a"/>')
out.append(f'<text x="{rx + 10}" y="{ry - 9}" font-size="13" fill="#fff">道路（北側）</text>')

for r in rooms:
    x, y, w, d = r["rect"]
    sx, sy = px(x, y + d)
    fill = COLORS[r["kind"]]
    dash = ' stroke-dasharray="6 4"' if r["kind"] == "courtyard" else ""
    out.append(f'<rect x="{sx:.1f}" y="{sy:.1f}" width="{w * S:.1f}" height="{d * S:.1f}" fill="{fill}" '
               f'stroke="#333" stroke-width="{1.2 if r["kind"] == "courtyard" else 2.2}"{dash}/>')
    name = r["name"].split("(")[0].replace("・ただいま手洗い", "\n(手洗い)")
    lines = name.split("\n")
    fs = max(9, min(15, w * S / (max(len(l) for l in lines) + 0.8)))
    cx, cy = sx + w * S / 2, sy + d * S / 2
    if r["kind"] != "courtyard":
        lines.append(f"{w * d / JO:.1f}畳")
    top = cy - (len(lines) - 1) * fs * 0.6
    for i, l in enumerate(lines):
        col = "#555" if l.endswith("畳") else "#111"
        size = fs * 0.85 if l.endswith("畳") else fs
        out.append(f'<text x="{cx:.1f}" y="{top + i * fs * 1.2:.1f}" font-size="{size:.1f}" '
                   f'text-anchor="middle" fill="{col}">{escape(l)}</text>')

# 中庭の西側 = 高塀
x, y, w, d = next(r for r in rooms if r["id"] == "courtyard")["rect"]
fx, fy1 = px(x, y + d); _, fy2 = px(x, y)
out.append(f'<line x1="{fx}" y1="{fy1}" x2="{fx}" y2="{fy2}" stroke="#6b4a2b" stroke-width="7"/>')
out.append(f'<text x="{fx - 8}" y="{(fy1 + fy2) / 2}" font-size="12" fill="#6b4a2b" text-anchor="end" '
           f'transform="rotate(-90 {fx - 8} {(fy1 + fy2) / 2})">高塀（外に閉じる）</text>')

# 出入口
for dr in plan["exterior_doors"]:
    x0, y0, x1, y1 = dr["edge"]
    a, b = px(x0, y0), px(x1, y1)
    out.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="#c0392b" stroke-width="6"/>')
    out.append(f'<text x="{(a[0] + b[0]) / 2}" y="{a[1] - 8}" font-size="11" fill="#c0392b" '
               f'text-anchor="middle">{escape(dr["name"])}</text>')

# 寸法
ax, ay = px(0, 0)
bx, by = px(X1, 0)
out.append(f'<line x1="{ax}" y1="{ay + 28}" x2="{bx}" y2="{by + 28}" stroke="#333"/>')
out.append(f'<text x="{(ax + bx) / 2}" y="{ay + 46}" font-size="13" text-anchor="middle">{X1:.1f} m</text>')
g = next(r for r in rooms if r["id"] == "garage")["rect"]
gx, gy = px(g[0], g[1] + g[3])
out.append(f'<text x="{gx + 6}" y="{gy + 16}" font-size="11" fill="#555">{g[2]} × {g[3]} m</text>')
tx, ty = px(-0.7, Y1 / 2)
out.append(f'<text x="{tx - 8}" y="{ty}" font-size="13" text-anchor="middle" transform="rotate(-90 {tx - 8} {ty})">'
           f'{Y1:.1f} m</text>')

# 方位
nx, ny = W - 50, 60
out.append(f'<polygon points="{nx},{ny - 26} {nx - 9},{ny + 4} {nx + 9},{ny + 4}" fill="#333"/>'
           f'<text x="{nx}" y="{ny + 22}" font-size="14" text-anchor="middle">N</text>')
out.append(f'<text x="{MX}" y="{H - 14}" font-size="12" fill="#666">{plan["_note"].split("。")[0]}（約 {X1:.1f} × {Y1:.1f} m）／ 赤線 = 出入口</text>')
out.append("</svg>")
(ROOT / "docs" / "plan.svg").write_text("\n".join(out), encoding="utf-8")
print("wrote docs/plan.svg")

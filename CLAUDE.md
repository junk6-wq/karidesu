# CLAUDE.md

平屋の計画リポジトリ。要件の正本は `docs/requirements.md`、間取りの正本は `plan/plan.json`。

- 間取りを変えたら `python tools/check_plan.py`（重なり・面積・動線）→ `python tools/draw_plan.py` の順に実行する。
- 3D は `blender/build_house.py`（`pip install -r requirements.txt` の bpy が必要）。描画は1枚数分かかるので、必要な視点だけ指定する。
- 要件とずれる変更をしたら `docs/open-questions.md` に理由を書く。
- 日本語で書く。旧旅行アプリは `claude/passage-final-archive` ブランチにある。

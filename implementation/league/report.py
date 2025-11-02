
import os, re, json, base64
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple

from .elo import compute_elo, rating_ci

LEAGUE_DIR = Path("logs/league")

def _latest(pattern: str) -> Path | None:
    cand = sorted(LEAGUE_DIR.glob(pattern), key=lambda p: p.stat().st_mtime)
    return cand[-1] if cand else None

def _read_jsonl(path: Path) -> List[dict]:
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            out.append(json.loads(line))
    return out

def _b64(path: Path) -> str | None:
    if not path or not path.exists():
        return None
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")

def _standings_table(results: List[dict]) -> List[Tuple[str,float,float,Tuple[float,float]]]:
    # recompute points, Elo and CI for robust single-source
    names = set()
    for r in results:
        names.add(r["white"]); names.add(r["black"])
    points = {n: 0.0 for n in names}
    for r in results:
        if r["winner"] is None:
            points[r["white"]] += 0.5; points[r["black"]] += 0.5
        elif r["winner"] == "north":
            points[r["white"]] += 1.0
        else:
            points[r["black"]] += 1.0
    elo = compute_elo(results)
    ci = rating_ci(results, elo)
    rows = []
    for n in names:
        rows.append((n, points.get(n,0.0), elo.get(n,1500.0), ci.get(n, (elo.get(n,1500.0), elo.get(n,1500.0)))))
    rows.sort(key=lambda x: (x[1], x[2]), reverse=True)
    return rows

def generate(out_path: Path | None = None) -> Path:
    out_path = out_path or LEAGUE_DIR / "report_latest.html"
    league_jsonl = _latest("league_*.jsonl")
    standings_md = _latest("standings_*.md")
    heatmap_png = _latest("heatmap_*.png")
    timeline_png = _latest("elo_timeline.png")
    timeline_csv = _latest("elo_timeline.csv")

    if not league_jsonl:
        raise FileNotFoundError("No league_*.jsonl found in logs/league/. Run a league first.")

    results = _read_jsonl(league_jsonl)
    rows = _standings_table(results)

    # Inline images
    heatmap_b64 = _b64(heatmap_png)
    timeline_b64 = _b64(timeline_png)

    # Read standings_md if present
    md_html = ""
    if standings_md and standings_md.exists():
        # quick and dirty: convert pipe-table to HTML
        text = standings_md.read_text(encoding="utf-8")
        lines = [ln for ln in text.splitlines() if ln.strip()]
        table_lines = [ln for ln in lines if "|" in ln]
        if table_lines:
            header = [h.strip() for h in table_lines[0].strip("|").split("|")]
            body = table_lines[2:] if len(table_lines) >= 3 else []
            md_html = "<table>\n<thead><tr>" + "".join(f"<th>{h}</th>" for h in header) + "</tr></thead>\n<tbody>\n"
            for ln in body:
                cells = [c.strip() for c in ln.strip("|").split("|")]
                md_html += "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>\n"
            md_html += "</tbody></table>"
    # Build HTML
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    def esc(x): return x.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

    # Recreate standings from rows
    table_html = "<table><thead><tr><th>Agent</th><th>Points</th><th>Elo</th><th>95% CI</th></tr></thead><tbody>"
    for name, pts, elo, (lo, hi) in rows:
        table_html += f"<tr><td>{esc(name)}</td><td style='text-align:right'>{pts:.2f}</td><td style='text-align:right'>{elo:.0f}</td><td style='text-align:right'>{lo:.0f}–{hi:.0f}</td></tr>"
    table_html += "</tbody></table>"

    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Age of Chess — League Report</title>
<style>
body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 2rem; color: #222; }}
h1, h2 {{ margin: 0.2rem 0 0.6rem 0; }}
.section {{ margin-bottom: 2rem; }}
table {{ border-collapse: collapse; width: 100%; max-width: 900px; background: #fff; }}
th, td {{ border: 1px solid #ddd; padding: 6px 8px; }}
th {{ background: #f5f5f5; text-align: left; }}
.figure {{ margin: 1rem 0; }}
.figure img {{ max-width: 100%; height: auto; border: 1px solid #ddd; }}
.meta {{ color: #555; font-size: 0.9em; }}
code {{ background: #f6f8fa; padding: 2px 4px; border-radius: 4px; }}
</style>
</head>
<body>
<h1>Age of Chess — League Report</h1>
<div class="meta">Generated: {ts}</div>

<div class="section">
  <h2>Standings (latest run)</h2>
  {table_html}
</div>

<div class="section">
  <h2>Standings (Markdown from run)</h2>
  {'<em>No standings_*.md found.</em>' if not md_html else md_html}
</div>

<div class="section">
  <h2>Head-to-head Heatmap</h2>
  {"<em>No heatmap found.</em>" if heatmap_b64 is None else f'<div class="figure"><img src="data:image/png;base64,{heatmap_b64}" alt="Heatmap"/></div>'}
</div>

<div class="section">
  <h2>Elo Timeline</h2>
  {"<em>No timeline found. Generate with <code>python implementation/league/elo_timeline.py</code>.</em>" if timeline_b64 is None else f'<div class="figure"><img src="data:image/png;base64,{timeline_b64}" alt="Elo timeline"/></div>'}
</div>

<div class="section">
  <h2>Files</h2>
  <ul>
    <li>Latest raw results: <code>{league_jsonl.as_posix()}</code></li>
    {f"<li>Latest standings markdown: <code>{standings_md.as_posix()}</code></li>" if standings_md else ""}
    {f"<li>Latest heatmap: <code>{heatmap_png.as_posix()}</code></li>" if heatmap_png else ""}
    {f"<li>Timeline CSV: <code>{timeline_csv.as_posix()}</code></li>" if timeline_csv else ""}
  </ul>
</div>
</body>
</html>"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("Wrote report:", out_path)
    return out_path

if __name__ == "__main__":
    try:
        generate()
    except FileNotFoundError as e:
        print(str(e))

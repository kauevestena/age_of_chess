#!/usr/bin/env python3
"""
Scaffold a new agent under implementation/agents/<agent_slug>/

Usage:
    python implementation/scripts/new_agent.py MyAgent
"""
import os, sys, re
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]

def slugify(name: str) -> str:
    s = re.sub(r"[\W_]+", "_", name.strip())
    s = re.sub(r"_{2,}", "_", s)
    return s.strip("_").lower() or "agent"

def main():
    if len(sys.argv) < 2:
        print("Usage: python implementation/scripts/new_agent.py MyAgent")
        sys.exit(1)
    agent_name = sys.argv[1].strip()
    agent_slug = slugify(agent_name)
    pkg_dir = ROOT / "implementation" / "agents" / agent_slug
    if pkg_dir.exists():
        print(f"Folder already exists: {pkg_dir}")
        sys.exit(1)

    # Create folder structure
    (pkg_dir).mkdir(parents=True, exist_ok=True)
    (pkg_dir / "checkpoints").mkdir(parents=True, exist_ok=True)

    # __init__.py
    (pkg_dir / "__init__.py").write_text(dedent(f"""
from .agent import {agent_name}  # noqa:F401
"""), encoding="utf-8")

    # agent.py
    agent_py = dedent("""
from __future__ import annotations

class {AgentName}:
    \"\"\"
    Minimal agent template.

    Contract:
    - Implement .select(env) -> int | None
    - Use env.infos[env.agent_selection][\"action_mask\"] to avoid illegal actions.
    \"\"\"
    def __init__(self):
        self.name = \"{AgentName}\"

    def select(self, env) -> int | None:
        mask = env.infos[env.agent_selection].get(\"action_mask\")
        legal = [i for i, m in enumerate(mask) if m == 1] if mask is not None else []
        if not legal:
            return None
        # TODO: replace with your own policy
        return legal[0]
""").replace("{AgentName}", agent_name)
    (pkg_dir / "agent.py").write_text(agent_py, encoding="utf-8")

    # train.py
    train_py = dedent("""
\"\"\"Training entrypoint for {AgentName}.

Recommended: create and activate a local venv first.
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
\"\"\"
from __future__ import annotations

try:
    from sb3_contrib import MaskablePPO
    from sb3_contrib.common.wrappers import ActionMasker
    from gymnasium.wrappers import FlattenObservation
except Exception as e:
    raise SystemExit(\"This script requires sb3-contrib. Install with: pip install sb3-contrib stable-baselines3\") from e

from implementation.age_of_chess.sb3_env import AOCSingleAgentSelfPlayEnv

def mask_fn(env):
    return env.get_action_mask()

def main():
    env = AOCSingleAgentSelfPlayEnv(\"rulesets/default.yaml\")
    env = FlattenObservation(env)
    env = ActionMasker(env, mask_fn)
    model = MaskablePPO(\"MlpPolicy\", env, verbose=1, tensorboard_log=f\"tb_logs/{agent_slug}\")
    model.learn(total_timesteps=10_000)
    out = \"implementation/agents/{agent_slug}/checkpoints/mppo_{slug}.zip\"
    model.save(out)
    print(\"Saved model to\", out)
    print(\"Tip: copy it to ./models/ for league evaluation.\")

if __name__ == \"__main__\":
    main()
""").replace("{AgentName}", agent_name).replace("{agent_slug}", agent_slug).replace("{slug}", agent_slug)
    (pkg_dir / "train.py").write_text(train_py, encoding="utf-8")

    # README.md for the agent
    md = dedent("""
# {AgentName}

Scaffolding for a custom agent.

## Quickstart

1) Create and activate a local venv (do NOT use global python):
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Train (requires sb3-contrib):
```bash
python implementation/agents/{agent_slug}/train.py
```

3) Evaluate in the league:
```bash
# copy or link your checkpoint into models/
cp implementation/agents/{agent_slug}/checkpoints/*.zip models/
python implementation/league/round_robin.py --games 6
```

## Notes
- Keep all files under `implementation/agents/{agent_slug}/` (no loose files at repo root).
- Use the action mask to avoid illegal actions.
""").replace("{AgentName}", agent_name).replace("{agent_slug}", agent_slug)
    (pkg_dir / "README.md").write_text(md, encoding="utf-8")

    # .gitkeep in checkpoints
    (pkg_dir / "checkpoints" / ".gitkeep").write_text("", encoding="utf-8")

    print(f"Scaffold created at: {pkg_dir}")

if __name__ == "__main__":
    main()

"""Utilities to make example scripts runnable without installing the package."""

from pathlib import Path
import sys


def ensure_repo_root_on_path() -> None:
    """Prepend the repository root to sys.path if missing."""
    repo_root = Path(__file__).resolve().parents[2]
    repo_str = str(repo_root)
    if repo_str not in sys.path:
        sys.path.insert(0, repo_str)


ensure_repo_root_on_path()

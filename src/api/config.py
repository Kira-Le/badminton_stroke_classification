import os
import warnings
from pathlib import Path


# Branch-lifetime only: removed in the Step 9b cleanup commit before merge.
# Maps each renamed BST_X_* env var to its pre-rebrand legacy name so HPC
# .env files keep working through the staged rename. Stdlib-only twin of the
# pipeline.data_access mapping; no pipeline import here.
ENV_VAR_RENAMES = {
    'BST_X_LOCAL_CLIPS_DIR': 'BST_LOCAL_CLIPS_DIR',
    'BST_X_REPO_ROOT': 'BST_REPO_ROOT',
    'BST_X_REGISTRY_PATH': 'BST_REGISTRY_PATH',
    'BST_X_CLIPS_DIR': 'BST_CLIPS_DIR',
    'BST_X_INPUTS_DIR': 'BST_INPUTS_DIR',
}


def _resolve_env(name, default=None):
    """Read an env var, falling back to its pre-rebrand name with a deprecation
    warning. Returns the value or ``default`` when neither name is set."""
    val = os.environ.get(name)
    if val is not None:
        return val
    legacy = ENV_VAR_RENAMES.get(name)
    if legacy is not None:
        legacy_val = os.environ.get(legacy)
        if legacy_val is not None:
            warnings.warn(
                f'{legacy} is deprecated; use {name}',
                DeprecationWarning,
                stacklevel=2,
            )
            return legacy_val
    return default


# Repo root resolves the same in Docker (`/app`) and native dev (the working
# tree). Used by registry.py to anchor relative paths in models_registry.yaml.
REPO_ROOT = Path(_resolve_env("BST_X_REPO_ROOT", str(Path(__file__).resolve().parents[2])))
REGISTRY_PATH = Path(
    _resolve_env("BST_X_REGISTRY_PATH", str(REPO_ROOT / "docs" / "models_registry.yaml"))
)

# Optional: directory holding the clip mp4s, with layout
# <split>/<Side>_<class>/<stem>.mp4. On UNE HPC this resolves to
# /scratch/comp320a/ShuttleSet/clips. Unset locally; video endpoint
# returns a helpful 404 when missing.
_clips_dir = _resolve_env("BST_X_CLIPS_DIR")
BST_X_CLIPS_DIR: Path | None = Path(_clips_dir) if _clips_dir else None

# Optional: a flat, stem-keyed directory of sample clips for the Model Results
# per-clip player — files are named "<clip_stem>.mp4" directly (e.g.
# clips_local/24_3_8_2.mp4). Lets you play a handful of real clips locally
# without recreating the full ShuttleSet tree or setting BST_X_CLIPS_DIR, and
# is keyed by the stable clip_stem rather than clip_index's placeholder
# video_path. Defaults to <repo>/clips_local; its contents are gitignored.
LOCAL_CLIPS_DIR = Path(
    _resolve_env("BST_X_LOCAL_CLIPS_DIR", str(REPO_ROOT / "clips_local"))
)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))

MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "1024"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

# Minimum side length (pixels) the model pipeline needs from a cropped region:
# X3D wants 224x224, and pose estimation needs comparable resolution. Below this
# we warn rather than silently feed a degraded crop. Env-overridable.
MIN_MODEL_INPUT_PX = int(os.getenv("MIN_MODEL_INPUT_PX", "224"))

EXPERIMENTS_DIR = Path(
    os.getenv(
        "EXPERIMENTS_DIR",
        "/app/src/bst_refactor/stroke_classification/main_on_shuttleset/experiments",
    )
)

JOB_TTL_SECONDS = int(os.getenv("JOB_TTL_HOURS", "24")) * 3600
CLEANUP_INTERVAL_SECONDS = int(os.getenv("CLEANUP_INTERVAL_HOURS", "1")) * 3600

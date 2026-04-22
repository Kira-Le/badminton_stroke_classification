"""``sticky_anchor`` heuristic: primary variant (stub).

Full implementation lands after the ``current`` variant passes the
byte-identity gate on engelbart. Spec: see the "Sticky_anchor design,
finalised (2026-04-22)" section of
``scratch/architecture_notes/mmpose_heuristic/mmpose_heuristic_investigation.md``.
"""
from __future__ import annotations

from .base import ClipContext, HeuristicOutput, RawClip


def apply(raw: RawClip, ctx: ClipContext, **_hyperparams) -> HeuristicOutput:
    raise NotImplementedError(
        "sticky_anchor body not yet implemented; blocked on byte-identity "
        "gate via the 'current' variant. See the 'Sticky_anchor design, "
        "finalised (2026-04-22)' section in "
        "scratch/architecture_notes/mmpose_heuristic/mmpose_heuristic_investigation.md "
        "for the per-frame spec."
    )

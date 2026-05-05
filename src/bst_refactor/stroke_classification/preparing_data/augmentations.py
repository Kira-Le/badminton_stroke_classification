"""Train-time augmentations for BST: coupled centreline flip + constrained pos+shuttle jitter.

Replaces the inherited ``RandomTranslation_batch`` (joints-only, decoupled,
body-deforming) with the locked Task-2 set described in
``scratch/architecture_notes/augmentation_framework.md``.

Two independent ops, each with its own per-clip Bernoulli roll:

- ``CoupledFlip``: mirrors across the court centreline. Couples the flip
  across all three streams in their own coord frames (``pos.x -> 1 - x``
  in court frame; ``shuttle.x -> 1 - x`` in camera frame; joints
  ``x -> -x`` around each player's bbox centre). Applies the COCO-17
  bilateral joint-index swap so per-channel TCN semantics stay consistent
  across orientations. Bones are recomputed from the post-flip+post-swap
  joints via the same ``bone_pairs`` source of truth used at collation,
  so the X-component sign flip and the bilateral bone-slot swap fall
  out automatically.

- ``ConstrainedJitter``: per-clip uniform ``(dx, dy)`` applied to ``pos``
  (court frame) and ``shuttle`` (camera frame, coarse approximation;
  see doc for the off-axis-camera caveat). Joints and bones untouched.
  Bounds are layered conditionally: a per-axis constraint only counts
  for a clip when the corresponding player respects it pre-shift, so
  the aug never *introduces* a centreline-crossing or band-exceeding
  artefact. Pre-existing zeroed frames (sticky_anchor rally-presence
  drop on pos; TrackNet failure on shuttle) are restored to zero
  post-shift; shuttle that lands outside ``[0, 1]^2`` post-shift gets
  ``(0, 0)`` to mirror TrackNet's off-screen sentinel.

Per-clip rolls vectorised across the batch on whichever device the
input tensors live on. Both ops are train-only.
"""

from __future__ import annotations

import torch
from torch import Tensor

from preparing_data.shuttleset_dataset import get_bone_pairs


# COCO-17 bilateral joint pairs. Slot 0 (nose) has no mirror partner; mirroring
# its x is the only transform it needs. Eyes (1,2), ears (3,4), shoulders (5,6),
# elbows (7,8), wrists (9,10), hips (11,12), knees (13,14), ankles (15,16).
BILATERAL_JOINT_PAIRS: tuple[tuple[int, int], ...] = (
    (1, 2), (3, 4), (5, 6), (7, 8),
    (9, 10), (11, 12), (13, 14), (15, 16),
)


def _coco_swap_index(n_joints: int, device: torch.device) -> Tensor:
    """Build the permutation index that swaps bilateral joint pairs in-place.

    ``joints[..., swap_idx, :]`` returns the swapped tensor. For un-paired
    indices (just the nose at slot 0) the index is identity.
    """
    swap_idx = torch.arange(n_joints, device=device)
    for a, b in BILATERAL_JOINT_PAIRS:
        if a < n_joints and b < n_joints:
            swap_idx[a] = b
            swap_idx[b] = a
    return swap_idx


def recompute_bones_torch(joints: Tensor, pairs: list[tuple[int, int]]) -> Tensor:
    """Torch port of ``shuttleset_dataset.create_bones``.

    Matches the original numpy implementation exactly, including the
    elementwise per-component zero-suppression (a bone xy gets zeroed
    when the corresponding xy of either endpoint is zero).

    :param joints: tensor of shape ``(..., J, 2)``.
    :param pairs: list of ``(start_idx, end_idx)`` joint-pair tuples
                  defining each bone, in the same order ``create_bones``
                  walks them.
    :return: bones tensor of shape ``(..., B, 2)`` where ``B = len(pairs)``.
    """
    start_indices = torch.tensor(
        [p[0] for p in pairs], dtype=torch.long, device=joints.device,
    )
    end_indices = torch.tensor(
        [p[1] for p in pairs], dtype=torch.long, device=joints.device,
    )
    starts = joints.index_select(dim=-2, index=start_indices)
    ends = joints.index_select(dim=-2, index=end_indices)
    both_present = (starts != 0.0) & (ends != 0.0)
    return torch.where(both_present, ends - starts, torch.zeros_like(ends))


class CoupledFlip:
    """Centreline flip across pos + shuttle + joints + bones.

    Per-clip independent Bernoulli roll at probability ``p``. When fired,
    the clip's three streams flip together in their own coord origins,
    the COCO bilateral joint slots swap, and bones are recomputed from
    the post-flip+post-swap joints.

    :param p: per-clip flip probability. Defaults to 0.5 (literature norm
              for skeleton-AR; effectively doubles the training set).
    :param n_joints: count of joint slots along the pose-feature axis
                     before bones. 17 for COCO-17.
    :param n_bones: count of bone slots after the joints. ``human_pose[..., -n_bones:, :]``
                    is the bone slice; ``human_pose[..., :-n_bones, :]`` is joints.
                    Required for ``pose_style='JnB_bone'``; the asserting caller
                    enforces ``n_bones > 0``.
    :param bone_pairs: list of joint-pair indices defining each bone,
                       matching the source-of-truth used at collation.
                       Defaults to ``get_bone_pairs('coco')``.
    """

    def __init__(
        self,
        p: float = 0.5,
        n_joints: int = 17,
        n_bones: int = 19,
        bone_pairs: list[tuple[int, int]] | None = None,
    ) -> None:
        self.p = p
        self.n_joints = n_joints
        self.n_bones = n_bones
        self.bone_pairs = bone_pairs if bone_pairs is not None else get_bone_pairs('coco')
        if len(self.bone_pairs) != n_bones:
            raise ValueError(
                f'bone_pairs length ({len(self.bone_pairs)}) does not match '
                f'n_bones ({n_bones}); the bone-recompute path needs the same '
                f'pair-table the collation used.'
            )

    def __call__(
        self, human_pose: Tensor, pos: Tensor, shuttle: Tensor,
    ) -> tuple[Tensor, Tensor, Tensor]:
        """Apply per-clip coupled flip to all three streams.

        :param human_pose: ``(n, t, m, J+B, 2)``. Joints occupy the first
                           ``J`` slots; bones the last ``B``.
        :param pos: ``(n, t, m, 2)`` court-relative xy.
        :param shuttle: ``(n, t, 2)`` camera-resolution-relative xy.
        :return: same three tensors with flipped clips updated in-place
                 of the returned views (originals not mutated).
        """
        n = human_pose.shape[0]
        device = human_pose.device

        if self.p <= 0.0:
            return human_pose, pos, shuttle

        flip_mask = torch.rand(n, device=device) < self.p
        if not flip_mask.any():
            return human_pose, pos, shuttle

        joints = human_pose[..., :-self.n_bones, :]
        # Select-and-replace pattern: build the fully-flipped tensor, then
        # use torch.where with a broadcasted mask to keep unflipped clips
        # untouched. Cheaper than indexing for typical batch sizes since
        # the underlying ops are vectorised.

        # pos: x -> 1 - x in court frame
        pos_flipped = pos.clone()
        pos_flipped[..., 0] = 1.0 - pos_flipped[..., 0]
        pos_mask = flip_mask.view(n, 1, 1, 1).expand_as(pos)
        pos_out = torch.where(pos_mask, pos_flipped, pos)

        # shuttle: x -> 1 - x in camera frame
        shuttle_flipped = shuttle.clone()
        shuttle_flipped[..., 0] = 1.0 - shuttle_flipped[..., 0]
        shuttle_mask = flip_mask.view(n, 1, 1).expand_as(shuttle)
        shuttle_out = torch.where(shuttle_mask, shuttle_flipped, shuttle)

        # joints: x -> -x around each player's bbox centre, then bilateral slot swap
        swap_idx = _coco_swap_index(self.n_joints, device)
        joints_xflipped = joints.clone()
        joints_xflipped[..., 0] = -joints_xflipped[..., 0]
        joints_swapped = joints_xflipped.index_select(dim=-2, index=swap_idx)
        joints_mask = flip_mask.view(n, 1, 1, 1, 1).expand_as(joints)
        joints_out = torch.where(joints_mask, joints_swapped, joints)

        # bones: recompute from post-flip+post-swap joints. Same recompute
        # is done unconditionally on the full batch; for unflipped clips the
        # recomputed bones equal the originals by construction (deterministic
        # function of joints), so the where-broadcast restores the originals.
        # For flipped clips the recompute carries both the X-component sign
        # flip and the bilateral bone-slot swap automatically.
        bones_recomputed = recompute_bones_torch(joints_out, self.bone_pairs)
        human_pose_out = torch.cat([joints_out, bones_recomputed], dim=-2)

        return human_pose_out, pos_out, shuttle_out


class ConstrainedJitter:
    """Layered-bound pos+shuttle jitter. Joints and bones untouched.

    Per-clip independent Bernoulli roll at probability ``p_roll``. When
    the roll fires, per-clip layered bounds are computed from the clip's
    own pos extremes (so a player who is already out-of-band pre-shift
    drops their constraint, and we never *introduce* a band violation).
    A single ``(dx, dy)`` is drawn uniformly from the per-axis envelope
    intersected with the magnitude cap, applied to every frame of pos
    and shuttle, with zero-frame preservation and shuttle off-screen
    mirroring on top.

    :param p_roll: per-clip nominal roll probability. Effective
                   augmentation rate is ``p_roll * P(at least one
                   non-degenerate axis)``; logged via the
                   ``Aug/jitter_effective_rate`` TB scalar.
    :param cap_y: magnitude cap on dy. Tight (0.05 default) to preserve
                  back/front court-zone class signal.
    :param cap_x: magnitude cap on dx. Looser (0.10 default) since x
                  carries less direct class info than trajectory shape.
    :param eps: rally-presence acceptance margin matching
                ``sticky_anchor.generous_margin = 0.15``.
    """

    def __init__(
        self,
        p_roll: float = 0.2,
        cap_y: float = 0.05,
        cap_x: float = 0.10,
        eps: float = 0.15,
    ) -> None:
        self.p_roll = p_roll
        self.cap_y = cap_y
        self.cap_x = cap_x
        self.eps = eps

    def __call__(
        self, human_pose: Tensor, pos: Tensor, shuttle: Tensor,
    ) -> tuple[Tensor, Tensor, Tensor, int]:
        """Apply per-clip layered-bound jitter to pos + shuttle.

        :return: ``(human_pose, pos_out, shuttle_out, n_effective)``.
                 ``n_effective`` is the count of clips in this batch
                 that actually received a non-zero shift (rolled yes
                 AND at least one axis non-degenerate); used for the
                 epoch-level effective-rate TB scalar.
        """
        n = pos.shape[0]
        device = pos.device

        if self.p_roll <= 0.0:
            return human_pose, pos, shuttle, 0

        roll_mask = torch.rand(n, device=device) < self.p_roll
        if not roll_mask.any():
            return human_pose, pos, shuttle, 0

        # Per-clip extremes used for the layered-conditional bounds.
        # pos: (n, t, m=2, 2), m=0 top, m=1 bot. Last dim is xy.
        y_top = pos[:, :, 0, 1]  # (n, t)
        y_bot = pos[:, :, 1, 1]  # (n, t)
        y_top_max = y_top.amax(dim=1)  # (n,)
        y_top_min = y_top.amin(dim=1)
        y_bot_max = y_bot.amax(dim=1)
        y_bot_min = y_bot.amin(dim=1)

        x_all = pos[..., 0]              # (n, t, m)
        x_max = x_all.amax(dim=(1, 2))   # (n,)
        x_min = x_all.amin(dim=(1, 2))

        eps = self.eps
        large = torch.full_like(y_top_max, float('inf'))

        # dy_max: layered upper bound. Top respects centreline (y_top_max <= 0.5)
        # contributes 0.5 - y_top_max; bot respects far-baseline
        # (y_bot_max <= 1+eps) contributes 1+eps - y_bot_max. Where neither
        # respects, no constraint applies and the axis is degenerate.
        top_max_bound = torch.where(y_top_max <= 0.5, 0.5 - y_top_max, large)
        bot_max_bound = torch.where(y_bot_max <= 1.0 + eps, 1.0 + eps - y_bot_max, large)
        dy_max = torch.minimum(top_max_bound, bot_max_bound)

        # dy_min: symmetric layered lower bound.
        top_min_bound = torch.where(y_top_min >= -eps, -eps - y_top_min, -large)
        bot_min_bound = torch.where(y_bot_min >= 0.5, 0.5 - y_bot_min, -large)
        dy_min = torch.maximum(top_min_bound, bot_min_bound)

        # x-axis has no centreline constraint, just the [-eps, 1+eps] band
        # applied jointly across both players.
        dx_max = torch.where(x_max <= 1.0 + eps, 1.0 + eps - x_max, large)
        dx_min = torch.where(x_min >= -eps, -eps - x_min, -large)

        # Replace inf sentinels with 0 to mark fully-degenerate axes.
        dy_max = torch.where(torch.isinf(dy_max), torch.zeros_like(dy_max), dy_max)
        dy_min = torch.where(torch.isinf(dy_min), torch.zeros_like(dy_min), dy_min)
        dx_max = torch.where(torch.isinf(dx_max), torch.zeros_like(dx_max), dx_max)
        dx_min = torch.where(torch.isinf(dx_min), torch.zeros_like(dx_min), dx_min)

        # Intersect the per-clip envelope with the magnitude cap. Cap binds
        # in either direction independently, so a clip with dy_max = 0.30
        # and cap_y = 0.05 ends up with dy_hi = 0.05 (cap binds) and
        # dy_lo = -0.05 (cap binds on the other side too if dy_min permits).
        cap_y_t = torch.full_like(dy_max, self.cap_y)
        cap_x_t = torch.full_like(dx_max, self.cap_x)
        dy_hi = torch.minimum(dy_max, cap_y_t)
        dy_lo = torch.maximum(dy_min, -cap_y_t)
        dx_hi = torch.minimum(dx_max, cap_x_t)
        dx_lo = torch.maximum(dx_min, -cap_x_t)

        # Per-axis degeneracy: clamp the sample range to a single point at 0
        # when the layered constraints leave no room. Floats: dy_hi <= dy_lo.
        dy_degenerate = dy_hi <= dy_lo
        dx_degenerate = dx_hi <= dx_lo
        dy_hi = torch.where(dy_degenerate, torch.zeros_like(dy_hi), dy_hi)
        dy_lo = torch.where(dy_degenerate, torch.zeros_like(dy_lo), dy_lo)
        dx_hi = torch.where(dx_degenerate, torch.zeros_like(dx_hi), dx_hi)
        dx_lo = torch.where(dx_degenerate, torch.zeros_like(dx_lo), dx_lo)

        # Sample uniform in the per-axis envelope.
        u_y = torch.rand(n, device=device)
        u_x = torch.rand(n, device=device)
        dy = dy_lo + (dy_hi - dy_lo) * u_y
        dx = dx_lo + (dx_hi - dx_lo) * u_x

        # Suppress shifts on clips where the roll missed.
        dx = torch.where(roll_mask, dx, torch.zeros_like(dx))
        dy = torch.where(roll_mask, dy, torch.zeros_like(dy))

        # Build pre-shift zero masks for stream-aware sentinel preservation.
        # pos_zero: any frame whose xy entries are both zero. Shape (n, t, m).
        # shuttle_zero: same on (n, t).
        pos_zero = (pos == 0.0).all(dim=-1)
        shuttle_zero = (shuttle == 0.0).all(dim=-1)

        # Apply shift. Broadcast dx/dy across (t, m) for pos and (t,) for shuttle.
        shift_pos = torch.stack([dx, dy], dim=-1)        # (n, 2)
        shift_pos = shift_pos.view(n, 1, 1, 2)
        pos_shifted = pos + shift_pos

        shift_shuttle = torch.stack([dx, dy], dim=-1).view(n, 1, 2)
        shuttle_shifted = shuttle + shift_shuttle

        # Restore pre-existing zeros.
        pos_shifted = torch.where(
            pos_zero.unsqueeze(-1).expand_as(pos_shifted),
            torch.zeros_like(pos_shifted),
            pos_shifted,
        )
        shuttle_shifted = torch.where(
            shuttle_zero.unsqueeze(-1).expand_as(shuttle_shifted),
            torch.zeros_like(shuttle_shifted),
            shuttle_shifted,
        )

        # Shuttle out-of-bounds post-shift -> zero, mirroring TrackNet's
        # off-screen sentinel so the model recognises induced off-screen
        # the same way it handles natural off-screen.
        shuttle_oob = (
            (shuttle_shifted < 0.0).any(dim=-1)
            | (shuttle_shifted > 1.0).any(dim=-1)
        )
        shuttle_shifted = torch.where(
            shuttle_oob.unsqueeze(-1).expand_as(shuttle_shifted),
            torch.zeros_like(shuttle_shifted),
            shuttle_shifted,
        )

        # Effective-fired count: clip rolled yes AND at least one axis non-degenerate.
        non_degenerate = ~(dy_degenerate & dx_degenerate)
        effective = roll_mask & non_degenerate
        n_effective = int(effective.sum().item())

        return human_pose, pos_shifted, shuttle_shifted, n_effective

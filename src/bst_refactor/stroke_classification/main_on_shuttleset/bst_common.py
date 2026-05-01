"""Shared scaffolding between bst_train.py and bst_infer.py.

Lifted pre-X3D-S so a third entry point (the X3D-S training script) does
not triplicate the orchestration glue. The BST model graph itself is not
refactored here; this module owns the variant table, the tee'er, the
network builder, and the data-provenance manifest helper only.
"""

import hashlib
from pathlib import Path

import numpy as np
from torch import nn

from pipeline.config import Taxonomy
from preparing_data.shuttleset_dataset import POSE_BONE_MULTIPLIER, get_bone_pairs
from model.bst import BST_0, BST_PPF, BST_CG, BST_AP, BST_CG_AP


# BST variant name -> pre-configured constructor (partials defined in bst.py).
# Both bst_train and bst_infer dispatch through this single mapping.
MODELS = {
    'BST_0':     BST_0,
    'BST':       BST_PPF,
    'BST_CG':    BST_CG,
    'BST_AP':    BST_AP,
    'BST_CG_AP': BST_CG_AP,
}


class Tee:
    """Mirror writes across multiple streams (terminal + file)."""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for s in self.streams:
            s.write(data)

    def flush(self):
        for s in self.streams:
            s.flush()


def build_bst_network(
    model_name: str,
    *,
    n_joints: int,
    pose_style: str,
    in_channels: int,
    n_class: int,
    seq_len: int = 100,
    depth_tem: int = 2,
    depth_inter: int = 1,
    device: str = 'cuda',
) -> tuple[nn.Module, int]:
    """Construct a BST variant with feature-dim wiring shared between train and infer.

    Returns ``(net, n_bones)``. ``n_bones`` is the count of bone tokens
    appended after the joint tokens along the pose axis of ``human_pose``
    (``len(get_bone_pairs()) * POSE_BONE_MULTIPLIER[pose_style]``). The
    training loop slices ``human_pose[..., -n_bones:, :]`` to keep
    random-translation off the bone rows; inference can ignore it.

    :param in_channels: 2 for 2D (xy) keypoints, 3 for 3D (xyz).
    """
    n_bones = len(get_bone_pairs()) * POSE_BONE_MULTIPLIER[pose_style]
    in_dim = (n_joints + n_bones) * in_channels
    net = MODELS[model_name](
        in_dim=in_dim,
        n_class=n_class,
        seq_len=seq_len,
        depth_tem=depth_tem,
        depth_inter=depth_inter,
    ).to(device)
    return net, n_bones


def derive_active_classes_from_labels(
    taxonomy: Taxonomy,
    train_labels: np.ndarray,
    validation_label_arrays: dict[str, np.ndarray] | None = None,
) -> tuple[list[str], list[int], dict[str, np.ndarray]]:
    """Derive the active class list, full->active remap, and remapped labels.

    The active class list is sized to whatever ``train_labels`` actually
    contains. A class can only land in the model's head if train can teach
    it; classes seen only in val/test would otherwise produce a label-
    smoothed ghost on every train step. Architecture is therefore a
    function of the training data, not of any drop flag.

    :param taxonomy: Taxonomy whose ``class_list()`` defines the full
        index space the on-disk labels were written against.
    :param train_labels: int64 array of full-taxonomy labels for the
        train split. The set of unique values here defines the active
        head.
    :param validation_label_arrays: optional ``{'val': arr, 'test': arr}``
        mapping. Each array is asserted to be a subset of train's
        present indices and is remapped alongside the train labels. Any
        rogue (val/test only) class index raises ``ValueError`` naming
        the offending split and class.
    :return: ``(active_class_list, full_to_active_remap_list,
        labels_remapped_per_split)``. The third return mirrors the
        per-split keys of ``validation_label_arrays`` plus ``'train'``.
    :raises ValueError: on empty train, rogue val/test class, or
        post-remap label outside ``[0, n_active)``.
    """
    if train_labels is None or len(train_labels) == 0:
        raise ValueError('train_labels is empty.')

    train_present = {int(x) for x in np.unique(train_labels).tolist()}

    val_arrays = validation_label_arrays or {}
    for split_name, labels in val_arrays.items():
        split_present = {int(x) for x in np.unique(labels).tolist()}
        rogue = split_present - train_present
        if rogue:
            full = taxonomy.class_list()
            rogue_named = sorted(
                (idx, full[idx] if 0 <= idx < len(full) else f'<oob:{idx}>')
                for idx in rogue
            )
            raise ValueError(
                f'[{split_name}] contains class indices absent from train: '
                f'{rogue_named}. Either retrain on a dir whose train split '
                f'covers these classes, or fix the split assignment in '
                f'clips_master.csv.'
            )

    active = taxonomy.active_class_list(train_present)
    remap_list = taxonomy.full_to_active_remap(train_present)
    remap = np.asarray(remap_list, dtype=np.int64)
    n_active = len(active)

    out: dict[str, np.ndarray] = {
        'train': remap[train_labels].astype(np.int64),
    }
    for split_name, labels in val_arrays.items():
        out[split_name] = remap[labels].astype(np.int64)

    for set_name, arr in out.items():
        if (arr < 0).any() or not (arr < n_active).all():
            raise ValueError(
                f'[{set_name}] post-remap label out of [0, {n_active}); '
                f'investigate label corruption.'
            )

    return active, remap_list, out


def compute_data_provenance(
    clips_csv_path: Path,
    effective_ablation_id: str,
    npy_collated_dir: str,
) -> dict:
    """Manifest ``extra.data_provenance`` for ``track_run``.

    Hashes the clips CSV so the manifest pins the source-of-truth that
    produced this run's collated arrays. Fail fast if missing.
    """
    if not clips_csv_path.exists():
        raise FileNotFoundError(
            f'clips_csv does not exist: {clips_csv_path}\n'
            f'  (Run preparing_data.prepare_train_on_shuttleset to generate '
            f'the collated arrays first.)'
        )
    clips_csv_sha = hashlib.sha256(clips_csv_path.read_bytes()).hexdigest()
    return {
        'data_provenance': {
            'clips_csv_path': str(clips_csv_path),
            'clips_csv_sha256': clips_csv_sha,
            'effective_ablation_id': effective_ablation_id,
            'npy_collated_dir': npy_collated_dir,
        },
    }

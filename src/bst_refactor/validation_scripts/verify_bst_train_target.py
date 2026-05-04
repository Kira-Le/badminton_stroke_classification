"""Pre-flight check for ``bst_train.py``: confirm the hyp config resolves
to a collated dir that actually exists on disk.

Reads ``bst_train.py``'s active ``hyp`` namedtuple, derives the collated dir
basename via the same helper the script uses, and checks that the resulting
path exists under the expected scratch root.

Run from the repo root::

    PYTHONPATH=src/bst_refactor:src/bst_refactor/stroke_classification \\
        python src/bst_refactor/validation_scripts/verify_bst_train_target.py

Override the scratch root with ``--root /some/other/path`` if needed.
Exits 0 if the hyp-resolved dir exists, 1 otherwise.
"""
from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path

from pipeline.config import derive_ablation_id, derive_npy_collated_dir_basename


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument(
        '--root', type=Path, default=Path('/scratch/comp320a'),
        help='Scratch root holding ShuttleSet_data_<tax>/ trees '
             '(default: /scratch/comp320a).',
    )
    args = parser.parse_args()

    # Pull the live hyp namedtuple from bst_train.py without running its
    # if __name__ == '__main__': block.
    bst_train = importlib.import_module('main_on_shuttleset.bst_train')
    hyp = bst_train.hyp

    print('hyp config:')
    print(f'  taxonomy:        {hyp.taxonomy}')
    print(f'  split_column:    {hyp.split_column}')
    print(f'  drop_unknown:    {hyp.drop_unknown}')
    print(f'  ablation_id:     {hyp.ablation_id}')
    print(f'  seq_len:         {hyp.seq_len}')
    print(f'  use_3d_pose:     {hyp.use_3d_pose}')
    print(f'  pose_style:      {hyp.pose_style}')
    print(f'  n_epochs:        {hyp.n_epochs}')
    print(f'  batch_size:      {hyp.batch_size}')

    eff_ablation = derive_ablation_id(
        hyp.taxonomy, hyp.split_column, hyp.drop_unknown, hyp.ablation_id,
    )
    basename = derive_npy_collated_dir_basename(
        taxonomy_name=hyp.taxonomy,
        split_column=hyp.split_column,
        drop_unknown=hyp.drop_unknown,
        use_3d_pose=hyp.use_3d_pose,
        seq_len=hyp.seq_len,
        ablation_id=hyp.ablation_id,
    )

    expected_dir = args.root / f'ShuttleSet_data_{hyp.taxonomy}' / basename
    print()
    print(f'Effective ablation_id: {eff_ablation}')
    print(f'Resolved collated basename: {basename}')
    print(f'Expected collated path: {expected_dir}')
    print()

    if not expected_dir.is_dir():
        print(f'  MISSING: collated dir does not exist at the expected path.')
        print(f'  Either re-run prepare_train_on_shuttleset.py for this combo,')
        print(f'  or fix hyp to point at an existing combo.')
        return 1

    splits = ('train', 'val', 'test')
    for s in splits:
        sd = expected_dir / s
        if not sd.is_dir():
            print(f'  MISSING split dir: {sd}')
            return 1
        files = sorted(p.name for p in sd.glob('*.npy'))
        print(f'  {s}/: {len(files)} files  {files}')

    print()
    print('OK -- bst_train.py is aimed at an existing collated dir.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

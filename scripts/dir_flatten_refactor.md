# Directory Flatten Refactor — Comprehensive Plan

Status as of 2026-04-20: copy + verify steps complete, originals still on disk for safety. Master CSV at `notebooks/clips_master.csv` (33,481 rows, 12 cols, includes `split_bst_baseline` and `split_v2`). This doc enumerates every code, test, and doc surface that touches the nested layout, and stages the refactor to land cleanly without breaking the existing baseline runs.

## Goals

1. **Decouple labels and split assignment from physical directory layout.** Per-clip `.npy` files live flat (`{root}/{clip_stem}_*.npy`); split + label come from `clips_master.csv` at collation time.
2. **Run the 2 new BST ablations** (`une_merge_v1` × {BST baseline split, v2 split}, unknown dropped) using the same flat per-clip data.
3. **Make future re-extractions write flat** so the pipeline is internally consistent and we never recreate the legacy nested layout.
4. **Preserve the existing `merged_25` baseline** — the refactored `collate_npy()` must produce arrays bit-identical (modulo clip ordering) to the existing baseline collated arrays before any ablation runs.

## Out of scope

- Flattening the upstream `.mp4` clips directory (`CLIPS_OUTPUT_DIR / {split} / {class} / *.mp4`). That's a related cleanup but pose extraction already reads it recursively via `glob('**/*.mp4')`, so it doesn't block anything. Defer to a follow-up.
- Any model architecture changes (Arch 1 / Arch 2 work is downstream).
- Any taxonomy changes beyond what already exists in `pipeline/config.py:184-214` (`merged_25`, `une_merge_v1`, `raw_35`).

## File inventory

Every file that reads or writes the per-clip npy or shuttle_npy layout, with line citations. Grouped by role.

### Producers — write into the nested `{split}/{class}/` tree

| File | Lines | What it writes | Refactor needed |
|---|---|---|---|
| `src/bst_refactor/stroke_classification/preparing_data/prepare_train_on_shuttleset.py` | 495-505 (`mk_same_dir_structure`), 540-606 (`prepare_2d_dataset_npy_from_raw_video`), 609-665 (`prepare_3d_dataset_npy_from_raw_video`) | `_pos.npy`, `_joints.npy`, `_failed.npy` per clip into `{save_root}/{set_split_dir.name}/{ball_type_dir.name}/{clip_stem}_*.npy` | Yes, drop the `{split}/{class}/` parents and write to `{save_root}/{clip_stem}_*.npy`. Remove or no-op `mk_same_dir_structure`. |
| `src/bst_refactor/pipeline/shuttle_extractor.py` | 246-312 (`shuttle_csvs_to_npy`), specifically 273-274 mirrors clip path | `{SHUTTLE_OUTPUT_DIR}/{split}/{class}/{clip_stem}.npy` from flat shuttle_csv inputs | Yes, write to `{SHUTTLE_OUTPUT_DIR}/{clip_stem}.npy`. Drop the `rel.with_suffix('.npy')` mirror logic. |
| `src/bst_refactor/pipeline/clip_generator.py` | 127-189 (`_write_clips_for_video`), 151-156 mkdirs class folders | `.mp4` clips into `{CLIPS_OUTPUT_DIR}/{split}/{Top,Bottom}_{class}/{clip_stem}.mp4` | Out of scope (clips dir stays nested for now). |

### Producers — write flat artifacts (already correct)

| File | Lines | What it writes |
|---|---|---|
| `src/bst_refactor/pipeline/shuttle_extractor.py` | 58-156 (`extract_shuttle_trajectory`, `extract_all_shuttles`) | TrackNetV3 CSVs to flat `{shuttle_csv_dir}/{clip_stem}_ball.csv`. No change. |

### Consumers — read the nested per-clip tree

| File | Lines | What it reads | Refactor needed |
|---|---|---|---|
| `src/bst_refactor/stroke_classification/preparing_data/prepare_train_on_shuttleset.py` | 704-867 (`collate_npy`); specifically 740-749 walks `{root_dir}/{set_name}/iterdir() → glob('*_pos.npy')` and uses folder name as class label | Per-clip `_joints.npy`, `_pos.npy`, `_failed.npy` plus shuttle CSVs (already flat) | **Primary refactor target.** Becomes CSV-driven (read clips_master.csv, filter by split column, look up `{clip_npy_dir}/{clip_stem}_*.npy` directly, derive label via taxonomy). |
| `src/bst_refactor/stroke_classification/preparing_data/shuttleset_dataset.py` | 142-224 (`Dataset_npy`); 167-175 walks `{root_dir}/{set_name}/{class}/` and globs `*_pos.npy` | Lazy per-clip load at sample-get time | Either refactor to CSV-driven (mirroring collate's pattern) or deprecate. **Action: deprecate** — the BST training path uses `Dataset_npy_collated`, not `Dataset_npy`. The only call site is `bst_train.py:640` (`compare_pred_gt_on_specific_type`, a debug helper). Mark deprecated; don't bother refactoring unless that helper is needed. |
| `src/bst_refactor/validation_scripts/validate_zeroed_frames.py` | 140-162 (`_load_shuttle_vis`), 165-310 (`scan_clips`) | `{shuttle_npy_dir}/{split}/{folder_name}/{clip_name}.npy` and `{dataset_npy_dir}/{split}/{class_dir}/*_failed.npy` | Yes, replace dir walk with master-CSV-driven iteration; resolve files at `{shuttle_npy_dir}/{clip_stem}.npy` and `{dataset_npy_dir}/{clip_stem}_failed.npy`. |
| `src/bst_refactor/pipeline/verify.py` | 90-180 (`verify_class_merge`, `verify_splits_present`, `warn_orphan_files`), 200-246 (`verify_shuttle_sync`), 248-280 (`print_dataset_summary`) | `{clips_dir}/**/*.mp4` and `{shuttle_dir}/{rel_path}.npy` (mirror of clips) | Split decision: clips dir stays nested → these functions still work for clips. But `verify_shuttle_sync` (200-246) compares clip mp4 paths to shuttle npy paths via mirror; needs to switch to flat `{shuttle_dir}/{clip_stem}.npy` after Step 2 refactor. Update accordingly. |

### Consumers — collated stacked arrays (already flat-within-split)

These read `{root_dir}/{train,val,test}/{J_only.npy, JnB_bone.npy, pos.npy, shuttle.npy, labels.npy, videos_len.npy}`. The `{train,val,test}/` layer is semantic (what each split contains), not organizational. **No layout change needed**, only configuration plumbing.

| File | Lines | Role |
|---|---|---|
| `src/bst_refactor/stroke_classification/preparing_data/shuttleset_dataset.py` | 227-326 (`Dataset_npy_collated`), 329-398 (`Dataset_npy_collated_one_side`), 401-475 (`Dataset_npy_collated_single_pose`) | Loads stacked arrays per split. No change. |
| `src/bst_refactor/stroke_classification/preparing_data/shuttleset_dataset.py` | 512-543 (`prepare_npy_collated_loaders`), 546-577 (`*_one_side_loaders`), 580-603 (`*_single_pose_loaders`) | Wrap dataset classes into DataLoaders. No change. |
| `src/bst_refactor/stroke_classification/main_on_shuttleset/bst_train.py` | 33, 514-530 (`prepare_dataloaders`), 738-746 (root_dir construction) | Calls `prepare_npy_collated_loaders`. Needs new config knobs threaded through (see §Phase 1.2). |
| `src/bst_refactor/stroke_classification/main_on_shuttleset/bst_infer.py` | 26, 75-87 (`prepare_loader`), 121-127 (CLI example) | Same as bst_train. Needs the same plumbing if we want inference to track ablation provenance. |
| `src/bst_refactor/stroke_classification/main_on_shuttleset/tmp/test_fwd.py` | 8-11 | Hardcoded paths to old collated dir. Update to point to a current ablation's collated dir. |
| `src/bst_refactor/stroke_classification/main_on_shuttleset/tmp/test_train_step.py` | 9-15 | Same. Update. |
| `tests/test_integration.py` | 8-88 | Uses `BST_DATA_DIR` env var pointing at a collated dir root. No change to layout; just point at any collated ablation dir. |
| `tests/test_dataset.py` | 1-end | Synthetic `.npy` files mimic real layout. No external data; works as-is. |

### Documentation references

These describe the current nested layout and need a 1-line update + a forward pointer to this refactor doc.

| File | Lines | Notes |
|---|---|---|
| `src/bst_refactor/pipeline/README.md` | 106-217, 302-313 | Examples of `shuttle_npy/{train,val,test}/{Player}_{stroke_type}/...` need updating. |
| `src/bst_refactor/data_pipeline_to_model_train.md` | 98-177, 262-271, 437-443 | Directory layout diagrams. |
| `src/bst_refactor/stroke_classification/preparing_data/mmpose_changes.md` | 15-159 | Per-clip layout description. |
| `src/bst_refactor/stroke_classification/preparing_data/keypoints_schema.md` | 77-81 | Per-frame zeroing on failed detection. |
| `tests/testing_guide.md` | 21-44 | `BST_DATA_DIR` env var. |
| `notebooks/03_build_clips_master.ipynb` | (entire notebook) | Already documents the new master-CSV approach. |

### Migration tooling (already written)

| File | Role |
|---|---|
| `scripts/flatten_copy.sh` | Copies nested → flat staging dirs. Run on engelbart. |
| `scripts/verify_flatten.py` | Confirms flat copies match original content + every clip correlates to master CSV under `merged_25`. |
| `notebooks/03_build_clips_master.ipynb` | Builds `clips_master.csv` (33,481 rows) from production `pipeline.player_mapping.collect_shots`, `pipeline.config.SPLITS`, `EXCLUDED_VIDEOS`, `REMOVED_SHOTS`, joined to `shuttleset_splits_v2.csv`. |

## Refactor stages

Three phases, ordered for safety. Each phase is independently committable.

### Phase 1 — minimum viable for the 2 ablation runs

**Scope**: just enough code change to run `collate_npy()` against the flat per-clip dir + a master CSV, and to wire the knobs through `bst_train.py`. After this phase, you can run baseline reproduction + the 2 ablations without touching anything else.

#### 1.1 Refactor `collate_npy()` — `preparing_data/prepare_train_on_shuttleset.py:704-867`

New signature (keep backward-compat by leaving `taxonomy` parameter; add new ones):

```python
def collate_npy(
    root_dir: Path,                      # now: FLAT per-clip dir (no {split}/{class}/)
    save_dir: Path,                      # output for stacked arrays per split
    set_name: str,                       # 'train' | 'val' | 'test'
    seq_len: int,
    clips_csv: Path,                     # NEW: master CSV path
    split_column: str,                   # NEW: 'split_bst_baseline' or 'split_v2'
    taxonomy: Taxonomy = TAXONOMY_UNE_MERGE_V1,
    drop_unknown: bool = False,          # NEW
    shuttle_csv_dir: Path | None = None,
    resolution_df: pd.DataFrame | None = None,
):
```

Replace lines 740-749 (the `target_dir.iterdir()` block) with:

```python
clips_df = pd.read_csv(clips_csv)
clips_df = clips_df[clips_df[split_column] == set_name].copy()
if drop_unknown:
    clips_df = clips_df[clips_df['raw_type_en'] != 'unknown']

# Apply taxonomy to derive folder-style label string per clip.
class_ls = taxonomy.class_list()
def _label_str(row):
    merged = (taxonomy.merge_map.get(row.raw_type_en, row.raw_type_en)
              if taxonomy.merge_map else row.raw_type_en)
    if merged in taxonomy.standalone_set:
        return merged
    return f'{row.player_side}_{merged}'

label_strings = clips_df.apply(_label_str, axis=1)
labels = label_strings.map(class_ls.index).to_numpy(dtype=np.int64)
data_branches = [str(root_dir / stem) for stem in clips_df['clip_stem']]

# Warn-and-skip clips whose flat per-clip files are absent (shouldn't
# happen post-flatten + verify, but cheap to check).
present = [(b + '_pos.npy').rsplit('/', 1)[0]  # placeholder; use pathlib
           for b in data_branches]
# (proper implementation: filter data_branches and labels in lockstep)
```

Everything downstream (parallel `np.load`, shuttle merge at 768-804, padding/bones at 808-849, save at 852-866) is unchanged.

**Backward compatibility**: don't try to support the old `iterdir()` path alongside the new one. The old layout is being deleted after baseline reproduction passes; one branch is enough.

#### 1.2 Wire config knobs through `bst_train.py`

Add to `Hyp` dataclass (around line 124):

```python
clips_csv: Path = REPO_ROOT / 'notebooks' / 'clips_master.csv'
split_column: str = 'split_bst_baseline'      # or 'split_v2'
drop_unknown: bool = False
ablation_id: str = 'baseline_merged25_bstsplit_keepunknown'
```

`Task.prepare_dataloaders` (514-530) and the call site at 740-746: thread `clips_csv`, `split_column`, `drop_unknown`, `taxonomy` through to `collate_npy`. The `root_dir` path also needs rethinking — see §1.3.

#### 1.3 Per-ablation collated dir naming

Today (`bst_train.py:683`):
```python
npy_collated_dir = f'dataset{str_3d}_npy_collated_between_2_hits_with_max_limits_seq_100'
```

Hardcoded. Tomorrow, encode the ablation in the path so multiple ablations don't collide:
```python
npy_collated_dir = (
    f'dataset{str_3d}_npy_collated_between_2_hits_with_max_limits_seq_100'
    f'_{hyp.ablation_id}'
)
```

And the per-clip flat dir (single source of truth across all ablations):
```python
flat_per_clip_dir = Path('/scratch/comp320a/ShuttleSet_data_merged_25'
                         '/dataset_npy_between_2_hits_with_max_limits_flat')
```

For the existing baseline run, the old collated dir (`...seq_100/`) stays untouched on disk; the refactored code regenerates it under a new name (`..._baseline_merged25_bstsplit_keepunknown/`) for the reproduction comparison (see §Verification).

#### 1.4 Manifest provenance

`scripts/run_tracker.py` (or wherever `track_run` writes the manifest) — add the new fields to manifest.yaml so each run records:
- `clips_csv` (path + sha256 of file)
- `split_column`
- `drop_unknown`
- `ablation_id`
- `taxonomy` name

This is non-negotiable. Without provenance per run, future-you can't tell what produced any given results dir.

### Phase 2 — full end-state cleanup, before deleting nested originals

**Scope**: refactor the writers + the validation script + tmp test scripts so future re-extractions are flat-native and no code in the repo expects the nested layout. Doc updates land here too.

#### 2.1 `prepare_2d_dataset_npy_from_raw_video` — `prepare_train_on_shuttleset.py:540-606`

Replace lines 562 (`mk_same_dir_structure(...)`) with `save_root_dir.mkdir(parents=True, exist_ok=True)`.

Replace lines 571-574:
```python
ball_type_dir = video_path.parent
set_split_dir = ball_type_dir.parent
save_branch = str(
    save_root_dir / set_split_dir.name / ball_type_dir.name / video_path.stem
)
```
with:
```python
save_branch = str(save_root_dir / video_path.stem)
```

The clip extraction reads `**/*.mp4` recursively (line 564) — no input-side change needed.

Same edits for `prepare_3d_dataset_npy_from_raw_video` lines 626, 636-639.

Delete `mk_same_dir_structure` (495-504) — no callers remain.

#### 2.2 `shuttle_csvs_to_npy()` — `pipeline/shuttle_extractor.py:246-312`

Replace lines 273-274:
```python
rel = clip_path.relative_to(clips_dir)
npy_path = npy_output_dir / rel.with_suffix('.npy')
```
with:
```python
npy_path = npy_output_dir / (clip_path.stem + '.npy')
```

Drop line 308 (`npy_path.parent.mkdir(...)`) and replace with a single `npy_output_dir.mkdir(parents=True, exist_ok=True)` at function entry.

#### 2.3 `validate_zeroed_frames.py` refactor

`_load_shuttle_vis` (140-162): change `shuttle_path = shuttle_npy_dir / split / folder_name / f"{clip_name}.npy"` → `shuttle_npy_dir / f"{clip_name}.npy"`. Drop the `split` and `folder_name` parameters from the function signature; update call site at 240-243 accordingly.

`scan_clips` (165-310): the current implementation walks `dataset_npy_dir/split/class_dir/*_failed.npy`. Refactor to iterate the master CSV instead:
```python
master_df = pd.read_csv(clips_csv)
for row in master_df.itertuples():
    failed_path = dataset_npy_dir / f'{row.clip_stem}_failed.npy'
    # ... rest of the per-clip logic
```

Add `--clips-csv` CLI arg pointing at `clips_master.csv`.

The `player`/`stroke_type` parsing at 197-203 (which derives them from folder name) becomes a direct read of `row.player_side` and `row.raw_type_en` from the CSV. Cleaner.

#### 2.4 `pipeline/verify.py` refactor

`verify_shuttle_sync` (200-246): currently expects a 1:1 mirror of clip mp4 paths to shuttle npy paths. After 2.2, shuttle npy is flat, but clip mp4 is still nested. Change the comparison to:
```python
expected_shuttle = shuttle_dir / (mp4.stem + '.npy')
```

`verify_class_merge` (90+), `verify_splits_present`, `warn_orphan_files`, `print_dataset_summary` — all operate on the clips dir which stays nested. **No change.**

#### 2.5 `tmp/test_*.py` — hardcoded paths

`main_on_shuttleset/tmp/test_fwd.py` (8-11): update the three `np.load('/scratch/.../dataset_npy_collated_..._seq_100/train/...')` paths to whichever ablation collated dir is current. Add a comment that these are smoke-test scripts, not invariant.

`main_on_shuttleset/tmp/test_train_step.py` (9-15): same.

#### 2.6 `Dataset_npy` (the lazy-loading class) — `shuttleset_dataset.py:142-224`

Used only by `bst_train.py:640` (`compare_pred_gt_on_specific_type`, a debug helper). Two options:
- **Deprecate**: leave the class with a `DeprecationWarning` and docstring noting it expects the legacy nested layout. Don't refactor.
- **Refactor**: switch to CSV-driven the same way as `collate_npy`.

Recommend **deprecate** unless the debug helper is actively useful. Less surface to maintain.

#### 2.7 Documentation updates

For each doc in §File inventory → Documentation references:
- Replace nested-layout examples with flat examples.
- Add a one-line note: "see `scripts/dir_flatten_refactor.md` for the migration plan and historical context."

`pipeline/README.md` (106-217, 302-313) is the most user-facing — prioritize.

### Phase 3 (deferred) — flatten the `.mp4` clips dir

Leave for later. Affects `clip_generator.py` writer + `shuttle_extractor.py` input scanner + `verify.py` clip-side scanners + downstream pose-extraction `**/*.mp4` glob. Self-contained but touches more files. Not blocking the ablations.

## Verification (end-to-end)

Each step gates the next. Don't skip.

### V1 — collate_npy refactor reproduces the existing baseline

Run the refactored `collate_npy` against the flat per-clip dir with:
- `clips_csv = notebooks/clips_master.csv`
- `split_column = 'split_bst_baseline'`
- `taxonomy = merged_25`
- `drop_unknown = False`

Compare resulting `J_only.npy`, `JnB_bone.npy`, `pos.npy`, `shuttle.npy`, `videos_len.npy`, `labels.npy` shapes and label histograms to the existing collated baseline arrays at `dataset_npy_collated_between_2_hits_with_max_limits_seq_100/{train,val,test}/`.

**Expected**: identical shapes, identical label histograms (per-class counts), identical `videos_len` distribution. Per-element values may differ if clip ordering changes within a split — that's fine for training but the histograms must match.

If they don't match: stop. Diff the (split, folder, clip_stem) triples between the old `iterdir()` walk and the new CSV-driven path to find any clip that's in one but not the other.

### V2 — smoke-train baseline

One short BST run (5 epochs, 1 serial) on the freshly collated baseline arrays. Expected val acc within noise of the existing 0.85 / 0.831 F1 benchmark from commit 59f2239.

If the metric drifts more than a few points: stop. Investigate whether label or videos_len arrays disagree silently.

### V3 — ablation run 1 (taxonomy only)

`une_merge_v1` + `split_bst_baseline`, `drop_unknown=True`. Should produce a collated dir with 32,203 total clips (same total as the v2 join) but partitioned by the BST baseline split.

### V4 — ablation run 2 (taxonomy + new split)

`une_merge_v1` + `split_v2`, `drop_unknown=True`. 32,203 clips, partitioned per Isiah's player-overlap-minimised split.

Both V3 and V4 should land manifest entries with the new provenance fields populated.

### V5 — only after V1-V4 pass

Delete the nested originals on engelbart:
```bash
rm -r /scratch/comp320a/ShuttleSet_data_merged_25/dataset_npy_between_2_hits_with_max_limits
rm -r /scratch/comp320a/ShuttleSet/shuttle_npy
```

After this, the flat dirs become the only on-disk source. Phase 2.1 and 2.2 refactors mean any future re-extraction will write flat directly.

## Risks and rollback

| Risk | Mitigation |
|---|---|
| Refactored `collate_npy` produces silently-wrong labels (e.g. taxonomy mapping bug) | V1 histogram check catches it. Per-class label counts must match the existing baseline collated `labels.npy`. |
| Some clip stem in master CSV doesn't have a corresponding flat file | Pre-flight: `verify_flatten.py` already passed 100%. `collate_npy` should warn-and-skip (with count) but not crash. |
| Some clip on disk isn't in master CSV | Same — verify_flatten already ruled this out. |
| Existing ablation tests in `tmp/test_*.py` break after path changes | These are smoke-test scripts, not part of CI. Acceptable to update or delete. |
| Manifest provenance not loud enough — future-you forgets which CSV produced which run | Add CSV sha256 to manifest. Fail loudly at runtime if `clips_csv` is missing. |
| Originals deleted before everything's verified | V5 is the last step. Verify scripts exit non-zero on any mismatch. |

Rollback for any phase: `git revert` and re-run. The flat dirs and master CSV are inputs that don't move. Phase 1 reverts cleanly because old `collate_npy` still works on the legacy nested layout, which is preserved until V5.

## Open questions to resolve before Phase 1

1. **Should `collate_npy` accept `clip_npy_dir` separately from the existing `root_dir` parameter?** The semantics change (flat vs nested) — better to introduce a new parameter than overload.
2. **Should the per-clip dir path live in `pipeline.config`?** Currently the scratch path is implicit. Adding `FLAT_CLIP_NPY_DIR` constant would centralize it.
3. **Do we want a runtime sanity check that the chosen `split_column` exists in the CSV?** Yes — fail fast with a clear error, not a silent KeyError.
4. **Does `Dataset_npy` get deprecated or refactored?** Default: deprecate (only one debug-helper call site).

## Order of operations checklist

```
[done] Phase 0: master CSV, copy script, verify script, v1/v2 patch
[ ]   Phase 1.1: collate_npy refactor (~80 LOC change in one function)
[ ]   Phase 1.2: bst_train.py knobs + manifest fields (~40 LOC)
[ ]   Phase 1.3: per-ablation collated dir naming
[ ]   V1: baseline collation reproduces histograms
[ ]   V2: smoke-train baseline matches benchmark
[ ]   V3: ablation 1 (une_merge_v1 + bst split, drop unknown)
[ ]   V4: ablation 2 (une_merge_v1 + v2 split, drop unknown)
[ ]   Phase 2.1: pose extraction writes flat
[ ]   Phase 2.2: shuttle_csvs_to_npy writes flat
[ ]   Phase 2.3: validate_zeroed_frames.py refactor
[ ]   Phase 2.4: verify.py shuttle_sync refactor
[ ]   Phase 2.5: tmp test path updates
[ ]   Phase 2.6: Dataset_npy deprecation
[ ]   Phase 2.7: doc updates
[ ]   V5: rm -r the nested originals on engelbart
[deferred] Phase 3: flatten .mp4 clips dir
```

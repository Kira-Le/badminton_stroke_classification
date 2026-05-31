# Handover — alpha over-allocation analysis done, val-improvability gate built

Updated 2026-05-31, branch `feat/taxon-pinned-w-preds`. The per-class arc analysis the previous handover set up is done, and the val-improvability gate it pointed to is built (off by default, not yet run). This covers what's done and what's left.

## Done this session

1. **Per-class arc analysis** over all six cells of the taxon_pinned_w_preds batch. Everything lives in `scratch/architecture_notes/alpha_arc_analysis/`: `findings.md` (the verdict), `tables.md` (full per-class tables), `parse_arcs.py` / `analyse_arcs.py` / `plot_arcs.py` (regenerate the data + the eight figures), `arcs.pkl` / `summaries.pkl` (parsed data). The parser reproduces the handover's shuttleset_18 anchors exactly, so it's trusted on the rest.

   Verdict: the over-allocation thesis holds in every taxonomy. Alpha tracks inverse val performance (alpha-vs-best-val-F1 correlation -0.91 to -0.98), and 53-84% of the above-mean alpha budget sits on classes already plateaued by the macro-plateau epoch. Only shuttleset_18 has a genuine floor (driven_flight); the merges remove it. drive and push (and their sided variants) are over-allocated everywhere.

2. **Val-improvability gate**, built in `loss/adaptive_focal.py` (`apply_val_gate`) and wired through `bst_train.py`. Off by default. It decays a plateaued class's alpha back toward the renorm mean of 1.0 (best-so-far on smoothed val F1 plus patience), one-sided, with reverted classes pinned at exactly 1.0 and the freed budget going to the still-climbing classes, and the gate frozen in the anneal tail. Full rationale and the as-built decisions are in `hp_and_aug_speculations_30_05_2026.md` Q4 ("Built 2026-05-31"). Two independent opus reviews (ship); 50 tests in `tests/test_adaptive_focal.py` (section 9 is the gate).

   How to turn it on: `use_val_improvability_gate: true` on a `collation_runner` cell, or `--val-improvability-gate` on a manual `bst_train` call (requires adaptive_focal). The defaults (smoothing 0.9, margin 0.015, patience 15, min-before-gating 10, revert step 0.2, freeze at 0.75 of the run) sit in the visible `val_improvability_gate` dict in the bst_train Hyp block. TB now logs `Revert/{c}` per class so you can watch it fire, and `Alpha/{c}` shows the gated alpha.

## Open next actions

1. **Run the gate experiment.** Single cells on une_v1_14 (production) and shuttleset_18 (worst case, and the only taxonomy with real late blooms, so the adversarial test for the tail freeze). Compare macro and min-F1 against the gate-off serials from this batch. Watch `Revert/{c}` to confirm it decays drive/push/wrist_smash and leaves cross_court_net_shot alone. Honest ceiling from the analysis: expect a point or two, not more; the rest is inputs (wrist crop) and taxonomy.
2. **WD sweep** — still pending, unchanged. Plan in `bst_x_wd_sweep.md`. It also edits `bst_train.py`, so sequence it against the branch merge (see 4).
3. **Oversampling** — the weakest lever per the analysis; candidates in the speculations doc Q3. Only if pursued, mild and as a replacement for those classes' alpha, not stacked.
4. **Branch merge** — `feat/taxon-pinned-w-preds` to main still pending and expects conflicts. The gate (landed) and the WD sweep (pending) both touch `bst_train.py`, so merge before stacking more bst_train edits or the conflict surface compounds.

## Reference

- The six gate-off cells (the baseline to compare the gate against): shuttleset_18_v2 `run_20260530_161525_131279`, bst_24_v2 `...174818_410060`, bst_12_v2 `...192738_970644`, bst_25_baseline `...210600_435552`, bst_24_baseline `...225714_593038`, une_v1_14_v2 `run_20260531_005535_005154`. Run dir layout: `experiments/<run_id>/{manifest.yaml, weights/, tb/serial_N/, predictions/}`.
- Venvs: `/home/ariel/.venvs/tb-viewer` (tensorboard, for parsing TB), `/home/ariel/.venvs/badminton-cicd` (full model stack + pytest, CPU). On bourbaki use venv-bst.
- Model variant trained: `BST_CG_AP`.

## Cleanup note

This file is untracked at the repo root for discoverability. Refresh or delete once the next session has picked it up.

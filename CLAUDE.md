# Project conventions

## Commit messages

Prose theme, not comma-chained sub-feature enumeration. Lead with what was built or done in plain language, then headline numbers, then cost / what didn't work, then what's next. Casual voice is welcome; a light pun on a class name when it's natural ("smash gets smashed", "push surprisingly grabs") is in voice. Avoid AI-flavoured ceremony ("comprehensive", "robust", "leverages").

`%` in commit prose is acceptable shorthand for percentage points; don't pedant pp vs %. AU spelling otherwise (mislabelled, normalised, behaviour).

Reference example, in voice:

> Min-F1 focal loss (CDB-F1) built and tested. Run on nosides taxonomy. Mean wrist_smash lifts 4%; push surprisingly grabs +6.7% too. Overall range tightens. Smash gets...smashed (-5.5%). Macro at 0.75 / min 0.49 (wrist smash, still). Next trying dropping gamma to see if loss is getting swung too hard by single hard samples that might be mislabelled.

What that pattern carries:
- one-sentence "what was built / run" opener
- two or three sentences of headline result (lift, surprise, cost)
- one short clause for the closing-state metrics
- one sentence on what comes next and why

Do not enumerate every file touched, every test added, every flag flipped. The diff shows the what; the message carries the why and the result.

## Run notes (manifest.yaml notes / best_model_id.txt / .gitignore one-liners)

Same voice as commit messages. Plain language, direct sentences, light casualness welcome (the smash pun, "didn't expect that", "stops hogging recall"). No academic-paper register — drop "cell 1", "doubly-suppression hypothesis", "load-bearing", "regresses", "erodes", "Read of the cell:", "Headline:", "Apples-to-apples", structured "Up: / Down: / ~Flat:" movement lists, "broadly recover", "doing real work". No narrative-jargon scaffolding either: don't call a thread of related runs an "arc", a "journey", a "story", a "chapter". Just call them experiments, runs, questions, or describe them directly. Refer to past runs by what they were ("the first CDB-F1 run", "the class-weighted run") plus the run_id in parens, not invented labels.

Use `%` for per-class shifts in prose; structured comparison blocks can stay numerical (`0.7432 / 0.4621 / ...`). AU spelling. Em-dashes avoided per global style; if essential, write them unspaced.

Notes are notes — best_model_id.txt should keep its hparams block, per-serial table, and comparison blocks (those are data, not prose). It's the surrounding paragraphs that need to sound like the commit message, not a research abstract.

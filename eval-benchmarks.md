# Eval Benchmarks — Kimi K2.5 on Together AI

## 2026-03-31: No guardrails (raw model output, `validateCode` flags markdown_fence as failure)

5 batches × 80 runs = 400 total

| Batch | Pass Rate | Failures |
|-------|-----------|----------|
| 1     | 79/80 (98.8%) | Screenshot 15.56.47: compile_error |
| 2     | 73/80 (91.3%) | Screenshot 15.56.47: 6 failures |
| 3     | 80/80 (100%) | — |
| 4     | 78/80 (97.5%) | Screenshot 18.17.46: 2 failures |
| 5     | 79/80 (98.8%) | Screenshot 18.37.49: 1 failure |

**Total: 389/400 (97.3%)**

---

## 2026-03-31: No guardrails, second run (markdown_fence still flagged)

5 batches × 80 runs = 400 total

| Batch | Pass Rate | Failures |
|-------|-----------|----------|
| 1     | 79/80 (98.8%) | compile_error: Expected ">" but found "1" |
| 2     | 80/80 (100%) | — |
| 3     | 80/80 (100%) | — |
| 4     | 79/80 (98.8%) | markdown_fence (false negative — code compiles after stripFences) |
| 5     | 80/80 (100%) | — |

**Total: 398/400 (99.5%)**

---

## 2026-03-31: stripFences applied before validation

5 batches × 80 runs = 400 total

| Batch | Pass Rate | Failures |
|-------|-----------|----------|
| 1     | 80/80 (100%) | — |
| 2     | 80/80 (100%) | — |
| 3     | 80/80 (100%) | — |
| 4     | 80/80 (100%) | — |
| 5     | 80/80 (100%) | — |

**Total: 400/400 (100%)**

`stripFences` alone is sufficient — strips markdown fences + preamble text before first import/export.

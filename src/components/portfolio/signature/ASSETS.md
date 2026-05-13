# Signature theme assets (`FORMULA_ONE` — F1 cinematic)

## Optional mark in hero

Hero watermark: **`public/f1-logo.svg`** (vector; scales cleanly via CSS `background` on the F1 hero). The telemetry row uses an abstract **PREC** chip only.

## Car reveal (intro)

The intro raster is **[`public/f1-car.png`](../../../../public/f1-car.png)** (duplicate of `f1 car.png` for stable URLs). The lazy component **[`FormulaOneIntro.tsx`](../signature/intros/FormulaOneIntro.tsx)** pans it across the HUD with streak blur and telemetry chrome.

Swap the file to your approved master asset anytime (keep wide side profile + dark surround for bleed).

## Fonts

[`src/styles/portfolio-themes.css`](../../../styles/portfolio-themes.css): **Chakra Petch** + **Orbitron** (`.pf-telemetry-numeric`). SIL Open Font License.

## DB enum

Production theme id: **`FORMULA_ONE`**. Migrations migrate legacy `PIT_WALL` / `NIGHT_CIRCUIT` rows → `FORMULA_ONE`.

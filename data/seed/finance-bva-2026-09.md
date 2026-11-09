# MountainSeed Leadership Command Center — Finance BvA load (Sep 2026)

Prepared for ingest into the Command Center Finance tab. **Does not modify the app repo.**

## Files

| File | Purpose |
|------|---------|
| `finance_bva_2026-09.json` | Clean BvA payload (`period_end` 2026-09-30) |
| `README.md` | This provenance note |

## Source workbook

- **File:** `LT_BvA_Sep2026.xlsx`
- **Box path:** `/workspace/sfdc-revenue/2026-11-08/2027-consolidated-bridge/src/LT_BvA_Sep2026.xlsx`
- **Origin:** Max DiPlotti email *Budget vs Actual - September 2026* (Oct 16 2026)
- **Primary sheet:** `P&L` (title: Profit & Loss Budget vs. Actual, Jul–Sep 2026 / Q3 2026 Budget)
- **Supporting sheets for monthly Jan–Jun:** `Q1 2026`, `Q2 2026`
- **Not loaded:** `P&L - Reforecast`, `Reforecast Overview`, hiring/historical tabs

## Schema (JSON)

```
{
  source, period_end: "2026-09-30", currency: "USD", units,
  monthly: [{ month: "YYYY-MM", sheet, lines: { metric: {actual, budget, variance, variance_pct} } }],
  september: { … },
  q3: { … },
  ytd: { … },
  quarters: { q1, q2, q3 },   // authoritative from P&L columns
  full_year_budget: { … },    // budget only; actual=null
  provenance: { … },
  notes: [ … ]
}
```

- Money in USD; **margins as decimals** (0.69298 = 69.298%).
- `variance` = actual − budget; `variance_pct` = variance / budget.
- Workbook row labeled **Gross Margin** ($) → `gross_profit`; **Gross Margin %** → `gross_margin`.
- **EBITDA** is as reported. **No adjusted EBITDA** line exists on this workbook.

## Column map (P&L sheet)

| Period | Actual col | Budget col | Notes |
|--------|------------|------------|-------|
| Jul 2026 | P | Q | Budget header: "Q3 2026 Budget" (scenario name) |
| Aug 2026 | U | V | |
| Sep 2026 | Z | AA | |
| Q3 total | AE (≡ AM) | AF (≡ AR) | |
| Q1 | AK | AP | |
| Q2 | AL | AQ | |
| Q3 | AM | AR | AR row-6 says "9 QTD" but values = Q3-only |
| YTD / "Full Year" actual | AO | — | Q4 AN=0 → AO = Jan–Sep YTD |
| YTD budget | — | AT | AT = AP+AQ+AR |
| Full-year budget | — | AZ | Row 6 "Full Year"; row 7 oddly "Q1 2026 Budget" |

### Key P&L rows

| Metric | Row | Sep actual | Sep budget |
|--------|-----|------------|------------|
| Marketplace | 18 | Z18 | AA18 |
| MP Appraisal Revenue | 19 | Z19 | AA19 |
| Other MarketPlace Revenue | 20 | Z20 | AA20 |
| Augur | 28 | Z28 | AA28 |
| Market Data Reports | 29 | Z29 | AA29 |
| MountainSeed Analytics | 30 | Z30 | AA30 |
| NBP | 31 | Z31 | AA31 |
| Capital Markets | 32 | Z32 | AA32 |
| Quaint Oak | 36 | Z36 | AA36 |
| **Total Revenue** | **38** | **Z38** | **AA38** |
| Total Cost of Sales | 46 | Z46 | AA46 |
| Gross profit ("Gross Margin") | 48 | Z48 | AA48 |
| Gross margin % | 49 | Z49 | AA49 |
| Total Operating Expenses | 63 | Z63 | AA63 |
| **EBITDA** | **65** | **Z65** | **AA65** |
| EBITDA % | 66 | Z66 | AA66 |
| Net Income | 82 | Z82 | AA82 |

YTD headlines: actual `AO{row}`, budget `AT{row}`. FY budget: `AZ{row}`.

## Headline numbers (exact from workbook, rounded to cents / 8dp margins)

### September 2026

| Metric | Actual | Budget | Variance |
|--------|--------|--------|----------|
| Total revenue | $2,554,001.28 | $2,650,295.09 | −$96,293.81 (−3.6%) |
| Gross profit | $1,769,860.87 | $1,882,936.44 | −$113,075.57 |
| Gross margin | 69.30% | 71.05% | −1.75 pp |
| OpEx | $1,044,132.79 | $1,070,625.90 | −$26,493.11 |
| EBITDA | $725,728.08 | $812,310.54 | −$86,582.46 (−10.7%) |
| EBITDA margin | 28.42% | 30.65% | −2.23 pp |

### Q3 2026

| Metric | Actual | Budget |
|--------|--------|--------|
| Total revenue | $7,129,976.88 | $7,307,272.01 |
| Gross profit | $4,901,948.16 | $5,080,686.76 |
| Gross margin | 68.75% | 69.53% |
| EBITDA | $1,937,604.61 | $1,978,975.64 |
| EBITDA margin | 27.18% | 27.08% |

### YTD through Sep 2026

| Metric | Actual | Budget | Variance |
|--------|--------|--------|----------|
| Total revenue | $19,357,378.11 | $21,705,711.51 | −$2,348,333.40 (−10.8%) |
| Gross profit | $13,176,970.72 | $14,285,026.54 | −$1,108,055.82 |
| Gross margin | 68.07% | 65.81% | +2.26 pp (ahead on margin) |
| OpEx | $8,658,542.62 | $8,915,316.57 | −$256,773.95 |
| EBITDA | $4,518,428.10 | $5,369,709.97 | −$851,281.87 (−15.9%) |
| EBITDA margin | 23.34% | 24.74% | −1.40 pp |

### Full-year 2026 budget (AZ; no FY actual yet)

| Metric | Budget |
|--------|--------|
| Total revenue | $30,661,707.65 |
| Gross profit | $19,455,347.39 |
| Gross margin | 63.45% |
| EBITDA | $7,020,249.88 |
| EBITDA margin | 22.90% |

## Monthly Jan–Sep

| Month | Sheet | Actual cols | Budget cols |
|-------|-------|-------------|-------------|
| 2026-01..03 | Q1 2026 | P / U / Z | Q / V / AA |
| 2026-04..06 | Q2 2026 | P / U / Z | Q / V / AA |
| 2026-07..09 | P&L | P / U / Z | Q / V / AA |

Sum of monthly **total_revenue** actuals = YTD AO38 ($19,357,378.11) ✓.

### Ambiguity / reconciliation break (important)

**Q2 sheet OpEx/EBITDA ≠ P&L Q2 column.**

- P&L `AL63` OpEx $3,120,836.31 vs Q2 sheet `AL62` $3,770,826.32 → **−$649,990**
- Gap is entirely **G&A Staff**: P&L `AL53` $1,392,155.07 vs Q2 `AL52` $2,042,155.07 → **exact −$650,000**
- June G&A Staff on Q2 sheet (`Z52` = $1,179,192.60) is the inflated month relative to the later Sep P&L package

**Guidance for the app:** use `quarters.q2` (from P&L) for OpEx/EBITDA charts; treat Apr–Jun monthly `ga_staff` / `total_operating_expenses` / `ebitda` as Q2-sheet snapshots that are **stale vs the Sep P&L**. Revenue and gross profit **do** reconcile across sheets.

Q1 sheet vs P&L Q1 EBITDA differs by ~$31 (immaterial).

## Other caveats

1. **No adjusted EBITDA** — only reported EBITDA.
2. **Cost of Sales** has Direct Staff, Other Direct, Capital Markets Direct only (no vendor/appraiser pass-through). Prior `AUDIT.md` inferred Marketplace may be net of vendor cost; not re-verified here.
3. Revenue line taxonomy differs by quarter sheet (NVV / Loan Sales on Q1; Fund SLB carried interest on Q2/P&L; Other Revenue under Other MP on P&L). Missing lines are `null`.
4. Below-EBITDA items (interest, other inc/exp, D&A, due diligence, sublease) are on `september` / `q3` / `ytd` from P&L; not on every monthly block.
5. Reforecast tabs were inspected only; this extract is original budget vs actual.

## Suggested ingest

Point `POST /api/ingest` (or `data/seed`) at `finance_bva_2026-09.json`. Prefer `september`, `ytd`, `quarters`, and `full_year_budget` for Finance-tab headlines; use `monthly` for trend charts with the Q2 OpEx caveat above.

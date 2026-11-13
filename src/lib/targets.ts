export type TargetDef = {
  key: string;
  label: string;
  unit: "usd" | "percent";
  defaultValue: number;
  notes: string;
};

export const TARGET_DEFS: TargetDef[] = [
  {
    key: "revenue_run_rate_2027_upside",
    label: "2027 year-end revenue run rate, upside case",
    unit: "usd",
    defaultValue: 53_000_000,
    notes: "Admin-editable. Compared with an official run rate once monthly actuals or a finance run-rate field is loaded.",
  },
  {
    key: "gross_margin_blended",
    label: "Gross margin (blended)",
    unit: "percent",
    defaultValue: 69.5,
    notes: "Scorecard QTD goal. Weekly scorecard also carries this goal.",
  },
  {
    key: "ebitda_margin",
    label: "EBITDA margin (Long Ridge)",
    unit: "percent",
    defaultValue: 35,
    notes: "Long Ridge target. Not on the weekly scorecard; filled from the monthly budget vs actual workbook.",
  },
  {
    key: "non_appraisal_revenue_2027",
    label: "Non-appraisal / client upsell revenue, 2027",
    unit: "usd",
    defaultValue: 2_500_000,
    notes: "2027 target. Dollar actuals are awaiting a finance or order source.",
  },
  {
    key: "non_appraisal_revenue_stretch",
    label: "Non-appraisal / client upsell revenue, 2027 stretch",
    unit: "usd",
    defaultValue: 3_000_000,
    notes: "Stretch case.",
  },
  {
    key: "ma_acquired_annual_revenue",
    label: "M&A acquired annual revenue assumption",
    unit: "usd",
    defaultValue: 10_000_000,
    notes: "Closed acquired revenue is awaiting data. The weekly scorecard tracks the funnel, not closed revenue.",
  },
  {
    key: "logo_churn_ceiling",
    label: "MP client logo churn ceiling",
    unit: "percent",
    defaultValue: 10,
    notes: "Lower is better.",
  },
  {
    key: "yoy_net_retention",
    label: "Year-over-year net retention",
    unit: "percent",
    defaultValue: 100,
    notes: "Higher is better.",
  },
];

export const DEFAULT_BUDGET_MAPPING = {
  rowLabels: {
    revenue: ["Total Revenue", "Net Revenue", "Revenue"],
    gross_profit: ["Gross Profit", "Gross Margin $"],
    gross_margin: ["Gross Margin %", "Gross Margin (Blended)", "Gross Margin"],
    gross_margin_appraisal: ["Appraisal Gross Margin", "Appraisal GM", "Appraisal Gross Margin %"],
    gross_margin_non_appraisal: [
      "Non-Appraisal Gross Margin",
      "Non Appraisal Gross Margin",
      "Non-Appraisal GM",
    ],
    ebitda: ["Adjusted EBITDA", "EBITDA"],
    ebitda_margin: ["EBITDA Margin", "EBITDA %", "Adjusted EBITDA Margin"],
    expenses: ["Total Expenses", "Operating Expenses", "Expenses", "Total Operating Expenses"],
  },
};

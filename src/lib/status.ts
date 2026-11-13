export type Status = "green" | "yellow" | "red" | "none";
export type Direction = "higher" | "lower";

const LOWER_EXACT = new Set([
  "MP Client Logo Churn",
  "ADJ % of Appraisals Received After Appraiser Due Date (>1BD)",
  "Commercial % of Reviews > 5 BD Total Turn (Reviewer Receives Assignment to Complete)",
  "Residential % of Reviews > 5 BD Total Turn (Reviewer Receives Assignment to Complete)",
  "AI + Infrastructure Cost per Transaction",
  "MTTR - Mean Time to Resolve",
  "Expense Budget to Actual %",
  "Voluntary Employee Turnover",
  "# of Clients > $5k with 0 Orders (Closed during or after Dec 2024; in system >28 days)",
  "Opportunities without activity in last 14 days - AMC",
]);

const LOWER_PATTERN =
  /churn|turnover|cost per|mean time|after appraiser due|reviews > 5|expense budget|0 orders|without activity|revision rate|turn time|late appraisal/i;

export function directionFor(label: string): Direction {
  if (LOWER_EXACT.has(label) || LOWER_PATTERN.test(label)) return "lower";
  return "higher";
}

export function rate(value: number | null, goal: number | null, direction: Direction): Status {
  if (value == null || goal == null || Number.isNaN(value) || Number.isNaN(goal)) return "none";
  if (direction === "lower") {
    if (goal === 0) return value <= 0 ? "green" : "red";
    if (value <= goal) return "green";
    if (value <= goal * 1.1) return "yellow";
    return "red";
  }
  if (goal === 0) return value > 0 ? "green" : "red";
  const ratio = value / goal;
  if (ratio >= 1) return "green";
  if (ratio >= 0.9) return "yellow";
  return "red";
}

const RANK: Record<Status, number> = { none: 0, green: 1, yellow: 2, red: 3 };

export function worstStatus(statuses: Status[]): Status {
  let worst: Status = "none";
  for (const status of statuses) {
    if (RANK[status] > RANK[worst]) worst = status;
  }
  return worst;
}

export function statusWord(status: Status): string {
  if (status === "green") return "On track";
  if (status === "yellow") return "Watch";
  if (status === "red") return "Off track";
  return "Awaiting data";
}

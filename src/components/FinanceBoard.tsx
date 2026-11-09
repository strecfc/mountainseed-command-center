import type { FinanceBoard, TrendPoint } from "@/lib/importers/bva";

function Chart({ title, points, footnote }: { title: string; points: TrendPoint[]; footnote?: string }) {
  const width = 680;
  const height = 230;
  const pad = { left: 72, right: 16, top: 18, bottom: 32 };
  const values = points.flatMap((point) => [point.actual, point.budget].filter((value): value is number => value != null));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const inner = width - pad.left - pad.right;
  const plot = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (index * inner) / Math.max(points.length - 1, 1);
  const y = (value: number) => pad.top + ((max - value) / span) * plot;
  const path = (key: "actual" | "budget") =>
    points
      .map((point, index) => {
        const value = point[key];
        if (value == null) return null;
        return `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const ticks = [max, min < 0 ? 0 : max / 2, min].filter((value, index, all) => all.indexOf(value) === index);
  return (
    <figure className="panel">
      <figcaption><b>{title}</b></figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="chart">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#e3d9cc" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fill="#6d655c" fontSize="11">
              {Math.abs(tick) >= 1_000_000 ? `${(tick / 1_000_000).toFixed(1)}M` : `${Math.round(tick / 1000)}k`}
            </text>
          </g>
        ))}
        <path d={path("budget")} fill="none" stroke="#8d6b2f" strokeWidth="2" />
        <path d={path("actual")} fill="none" stroke="#1e3a2f" strokeWidth="2.4" />
        {points.map((point, index) => (
          <g key={point.label}>
            {point.budget != null ? <circle cx={x(index)} cy={y(point.budget)} r="3" fill="#8d6b2f" /> : null}
            {point.actual != null ? (
              point.stale ? (
                <rect x={x(index) - 3.5} y={y(point.actual) - 3.5} width="7" height="7" fill="#8e2f2f" />
              ) : (
                <circle cx={x(index)} cy={y(point.actual)} r="3.5" fill="#1e3a2f" />
              )
            ) : null}
            <text x={x(index)} y={height - 10} textAnchor="middle" fill="#6d655c" fontSize="11">{point.label}</text>
          </g>
        ))}
      </svg>
      <p className="meta">Forest is actual. Gold is budget.{footnote ? ` ${footnote}` : ""}</p>
    </figure>
  );
}

export function FinanceBoardView({ board }: { board: FinanceBoard }) {
  return (
    <>
      <section className="section" id="revenue">
        <h2 className="section-title">September and year to date</h2>
        <p className="lede">
          {board.ebitdaLabel}. This workbook has no adjusted EBITDA line. As of {board.periodLabel}. {board.source}.
        </p>
        <div className="panel scroll">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Sep actual</th>
                <th>Sep budget</th>
                <th>Sep variance</th>
                <th>YTD actual</th>
                <th>YTD budget</th>
                <th>YTD variance</th>
                <th>FY 2026 budget</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr key={row.label} id={row.label === "Gross margin" ? "margin" : row.label === "Reported EBITDA margin" ? "ebitda" : undefined}>
                  <td>{row.label}</td>
                  <td className="num">{row.septemberActual}</td>
                  <td className="num">{row.septemberBudget}</td>
                  <td className="num">{row.septemberVariance}</td>
                  <td className="num">{row.ytdActual}</td>
                  <td className="num">{row.ytdBudget}</td>
                  <td className="num">{row.ytdVariance}</td>
                  <td className="num">{row.fyBudget}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="footer-meta">{board.ytdBudgetNote} {board.fyNote}</p>
        </div>
      </section>
      <section className="section">
        <h2 className="section-title">January through September</h2>
        <div className="stack">
          <Chart title="Total revenue" points={board.revenueTrend} />
          <Chart title="Reported EBITDA" points={board.ebitdaTrend} footnote="Red squares are April–June from the Q2 tab." />
        </div>
        <p className="note">{board.q2Note}</p>
      </section>
      <section className="section">
        <h2 className="section-title">Revenue lines</h2>
        <div className="panel scroll">
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Sep actual</th>
                <th>Sep budget</th>
                <th>Sep variance</th>
                <th>YTD actual</th>
                <th>YTD budget</th>
                <th>YTD variance</th>
              </tr>
            </thead>
            <tbody>
              {board.revenueLines.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{row.septemberActual}</td>
                  <td className="num">{row.septemberBudget}</td>
                  <td className="num">{row.septemberVariance}</td>
                  <td className="num">{row.ytdActual}</td>
                  <td className="num">{row.ytdBudget}</td>
                  <td className="num">{row.ytdVariance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="footer-meta">Updated {board.updated} · {board.source}</p>
        </div>
      </section>
    </>
  );
}

import type { Hero, Readout } from "@/lib/dashboard";
import { statusWord } from "@/lib/status";

export function Counts({ counts }: { counts: { onTrack: number; watch: number; offTrack: number; awaiting: number } }) {
  return (
    <div className="counts">
      <span className="pill" data-status="red">{counts.offTrack} off track</span>
      <span className="pill" data-status="yellow">{counts.watch} watch</span>
      <span className="pill" data-status="green">{counts.onTrack} on track</span>
      <span className="pill" data-status="none">{counts.awaiting} awaiting</span>
    </div>
  );
}

export function HeroGrid({ heroes }: { heroes: Hero[] }) {
  return (
    <section className="hero-grid">
      {heroes.map((hero) => (
        <article key={hero.id} className="hero" data-status={hero.overall}>
          <p className="kicker">{hero.kicker}</p>
          <h2>{hero.title}</h2>
          <p className="headline">{hero.headline}</p>
          <p className="caption">{hero.caption}</p>
          <p className="goal-line">{hero.goal}</p>
          <div className="windows">
            {hero.windows.map((window) => (
              <div key={window.label} className="window">
                <b>{window.label}</b>
                <em>{window.value}</em>
                <span className="status" data-status={window.status}>{statusWord(window.status)}</span>
                {window.goal ? <span className="meta"> Goal {window.goal}</span> : null}
              </div>
            ))}
          </div>
          <ul className="lines">
            {hero.lines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </li>
            ))}
          </ul>
          <p className="footer-meta">
            Updated {hero.updated || "Awaiting data"} · {hero.source}
          </p>
        </article>
      ))}
    </section>
  );
}

export function ReadoutList({ items }: { items: Readout[] }) {
  return (
    <div className="stack">
      {items.map((item) => (
        <article key={item.label} className="readout">
          <div className="readout-top">
            <h3>{item.label}</h3>
            <span className="status" data-status={item.overall}>{statusWord(item.overall)}</span>
          </div>
          <p className="headline" style={{ fontSize: 28 }}>{item.headline}</p>
          {item.headlineGoal ? <p className="goal-line">Goal {item.headlineGoal}</p> : null}
          <div className="windows">
            {item.windows.map((window) => (
              <div key={window.label} className="window">
                <b>{window.label}</b>
                <em>{window.value}</em>
                <span className="status" data-status={window.status}>{statusWord(window.status)}</span>
                {window.goal ? <span className="meta"> Goal {window.goal}</span> : null}
              </div>
            ))}
          </div>
          {item.history.length ? (
            <div className="history">
              {item.history.map((point) => (
                <span key={point.week}>
                  {point.week} <strong>{point.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
          {item.note ? <p className="note">{item.note}</p> : null}
          <p className="footer-meta">
            Updated {item.updated || "Awaiting data"} · {item.source}
          </p>
        </article>
      ))}
    </div>
  );
}

export function SectionBlock({ title, lede, items }: { title: string; lede?: string; items: Readout[] }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {lede ? <p className="lede">{lede}</p> : null}
      <ReadoutList items={items} />
    </section>
  );
}

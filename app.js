const app = document.querySelector("#app");

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
});

function money(value) {
  return gbp.format(Number(value || 0));
}

function signedMoney(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : "-"}${money(Math.abs(number))}`;
}

function signedPoints(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : "-"}${plain.format(Math.abs(number))} pts`;
}

function percent(value) {
  return pct.format(Number(value || 0));
}

function fractionalOdds(decimalOdds, betType = "") {
  const decimal = Number(decimalOdds);
  if (!Number.isFinite(decimal) || decimal <= 1) return "-";

  const fractional = decimal - 1;
  if (/forecast|tricast/i.test(betType)) {
    return `${fractional.toFixed(2).replace(/\.00$/, "")}/1`;
  }

  const racingDenominators = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20];
  let best = { numerator: Math.round(fractional), denominator: 1, error: Math.abs(fractional - Math.round(fractional)) };
  for (const denominator of racingDenominators) {
    const numerator = Math.round(fractional * denominator);
    const value = numerator / denominator;
    const error = Math.abs(fractional - value);
    if (error < best.error) best = { numerator, denominator, error };
  }

  if (best.denominator === 1 || best.error <= 0.015) {
    return `${best.numerator}/${best.denominator}`;
  }

  return `${fractional.toFixed(2).replace(/\.00$/, "")}/1`;
}

function shortDayLabel(label) {
  return String(label || "").replace(/\s+[A-Za-z]{3}$/, "");
}

function statusClass(result) {
  return String(result || "").toLowerCase().replace(/\s+/g, "-");
}

function normalisePayload(data) {
  if (Array.isArray(data.periods)) return data;
  return {
    brand: data.brand,
    title: data.title,
    subtitle: data.subtitle,
    bankSize: data.bankSize,
    pointValue: data.pointValue,
    updatedAt: data.updatedAt,
    cumulative: {
      period: data.period,
      updatedAt: data.updatedAt,
      stats: data.stats,
      daily: data.daily,
      bestMonth: data,
    },
    periods: [data],
  };
}

function emptyPanel(message = "Awaiting the first settled August card.") {
  return `<div class="empty-panel">${message}</div>`;
}

function lineChart(daily, pointValue = 1) {
  if (!daily.length) return emptyPanel("No daily P/L points yet.");

  const compactChart = window.matchMedia?.("(max-width: 520px)").matches;
  const width = compactChart ? 420 : 840;
  const height = 286;
  const pad = compactChart ? 42 : 54;
  const axisY = height - pad;
  const values = daily.map((item) => Number(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue)));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const rangeUnit = max <= 60 && min >= 0 ? 10 : max <= 400 && min >= 0 ? 20 : 50;
  const chartMin = min >= 0 ? 0 : Math.floor(min / rangeUnit) * rangeUnit;
  const paddedMax = daily.length === 1 && max > 0 ? max * 1.25 : max;
  let chartMax = Math.ceil(paddedMax / rangeUnit) * rangeUnit;
  if (chartMax === chartMin) chartMax += rangeUnit;
  const span = chartMax - chartMin;
  const tickStep = span <= 40 ? 10 : span <= 120 ? 20 : span <= 240 ? 40 : span <= 360 ? 80 : Math.ceil(span / 4 / 50) * 50;
  const singlePoint = daily.length === 1;
  const xStep = (width - pad * 2) / Math.max(daily.length - 1, 1);
  const yFor = (value) => height - pad - ((value - chartMin) / span) * (height - pad * 2);
  const xFor = (idx) => (singlePoint ? width - pad : pad + idx * xStep);
  const points = singlePoint
    ? `${pad},${yFor(values[0])} ${width - pad},${yFor(values[0])}`
    : daily.map((item, idx) => `${xFor(idx)},${yFor(Number(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue)))}`).join(" ");
  const area = singlePoint
    ? `${pad},${axisY} ${pad},${yFor(values[0])} ${width - pad},${yFor(values[0])} ${width - pad},${axisY}`
    : `${pad},${axisY} ${points} ${width - pad},${axisY}`;
  const zeroY = yFor(0);
  const yTicks = [];

  for (let tick = chartMin; tick <= chartMax + tickStep / 2; tick += tickStep) {
    const y = yFor(tick);
    yTicks.push(`<g>
      <line x1="${pad}" y1="${y.toFixed(2)}" x2="${width - pad}" y2="${y.toFixed(2)}" stroke="rgba(255,255,255,0.075)" />
      <text x="${pad - 9}" y="${(y + 5).toFixed(2)}" fill="rgba(255,255,255,0.56)" font-size="${compactChart ? 11 : 15}" text-anchor="end">${tick > 0 ? "+" : ""}${plain.format(tick)}</text>
    </g>`);
  }

  const labelStep = Math.max(1, Math.ceil(daily.length / 7));
  const xTicks = daily
    .map((item, idx) => {
      const x = xFor(idx);
      const showLabel = idx === 0 || idx === daily.length - 1 || idx % labelStep === 0;
      return `<g>
        <circle cx="${x.toFixed(2)}" cy="${axisY}" r="3" fill="rgba(255,255,255,0.2)" stroke="rgba(0,217,255,0.42)" stroke-width="1.5">
          <title>${item.label}: ${signedPoints(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue))} / ${signedMoney(item.runningGbp)}</title>
        </circle>
        ${showLabel ? `<text x="${x.toFixed(2)}" y="${height - 7}" fill="rgba(255,255,255,0.42)" font-size="${compactChart ? 9 : 11}" text-anchor="${idx === 0 ? "start" : idx === daily.length - 1 ? "end" : "middle"}">${shortDayLabel(item.label)}</text>` : ""}
      </g>`;
    })
    .join("");
  const dots = daily
    .map((item, idx) => {
      const runningPts = Number(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue));
      const x = xFor(idx);
      const y = yFor(runningPts);
      const cls = item.plGbp >= 0 ? "var(--green)" : "var(--red)";
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.2" fill="${cls}" stroke="#020202" stroke-width="2">
        <title>${item.label}: ${signedPoints(runningPts)} / ${signedMoney(item.runningGbp)} running P/L</title>
      </circle>`;
    })
    .join("");

  return `
    <svg class="pl-chart ${daily.length <= 7 ? "is-short-series" : "is-long-series"}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cumulative profit and loss chart">
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop stop-color="var(--red)" offset="0%" />
          <stop stop-color="var(--gold)" offset="46%" />
          <stop stop-color="var(--cyan)" offset="100%" />
        </linearGradient>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="rgba(0,217,255,0.28)" offset="0%" />
          <stop stop-color="rgba(255,20,61,0.05)" offset="100%" />
        </linearGradient>
      </defs>
      <line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="5 8" />
      <polygon points="${area}" fill="url(#areaGradient)" opacity="0.75"></polygon>
      <text x="${pad - 9}" y="${pad - 18}" fill="rgba(0,217,255,0.68)" font-size="${compactChart ? 10 : 13}" text-anchor="end">PTS</text>
      ${yTicks.join("")}
      ${xTicks}
      <polyline points="${points}" fill="none" stroke="url(#lineGradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
    </svg>
  `;
}

function kpi(label, value, note, accent = "var(--cyan)", cls = "") {
  return `
    <article class="kpi-card" style="--accent:${accent}">
      <span>${label}</span>
      <strong class="${cls}">${value}</strong>
      <small>${note}</small>
    </article>
  `;
}

function rankRows(items) {
  if (!items.length) return emptyPanel("Breakdowns will populate when August data is added.");

  const max = Math.max(...items.map((item) => Math.abs(item.plGbp)), 1);
  return items
    .map((item) => {
      const hasPnl = Number(item.calculable || 0) > 0;
      const plPts = Number(item.plPts ?? (Number(item.plGbp || 0) / 10));
      return `
      <div class="rank-row">
        <div class="rank-name">
          <strong>${item.name}</strong>
          <span>${item.bets} bets · ${item.wins}W ${item.places}P ${item.losses}L${item.calculable !== item.bets ? ` · ${item.calculable} priced` : ""}</span>
        </div>
        <div class="rank-value">
          <strong class="${!hasPnl ? "neutral" : item.plGbp >= 0 ? "positive" : "negative"}">${hasPnl ? signedPoints(plPts) : "TBC"}</strong>
          <span>${hasPnl ? `${signedMoney(item.plGbp)} · ${percent(item.roi)} ROI` : "Awaiting returns"}</span>
        </div>
        <div class="bar"><i style="--w:${Math.max(6, (Math.abs(item.plGbp) / max) * 100)}%"></i></div>
      </div>
    `;
    })
    .join("");
}

function betRows(items) {
  if (!items.length) {
    return `<tr><td colspan="8">No settled bets in this section yet.</td></tr>`;
  }

  return items
    .map((bet) => {
      const hasPnl = bet.calculable !== false && bet.plGbp !== null && bet.plGbp !== undefined;
      const plPts = Number(bet.plPts ?? (Number(bet.plGbp || 0) / 10));
      return `
      <tr>
        <td>${bet.date.slice(5)}</td>
        <td>${bet.time}</td>
        <td>${bet.horse}</td>
        <td>${bet.course}</td>
        <td>${bet.betType}</td>
        <td>${fractionalOdds(bet.odds, bet.betType)}</td>
        <td><span class="result-badge ${statusClass(bet.result)}">${bet.result}</span></td>
        <td>
          <span class="pnl-stack ${!hasPnl ? "neutral" : bet.plGbp >= 0 ? "positive" : "negative"}">
            <strong>${hasPnl ? signedPoints(plPts) : "TBC"}</strong>
            ${hasPnl ? `<small>${signedMoney(bet.plGbp)}</small>` : ""}
          </span>
        </td>
      </tr>
    `;
    })
    .join("");
}

function monthCards(period) {
  const stats = period.stats;
  return `
    <section class="kpi-grid compact">
      ${kpi("Month P/L", signedPoints(stats.plPts), `${signedMoney(stats.plGbp)} net`, "var(--green)", stats.plGbp >= 0 ? "positive" : "negative")}
      ${kpi("ROI", percent(stats.roi), `${money(stats.stakeGbp)} staked`, "var(--cyan)", stats.roi >= 0 ? "positive" : "negative")}
      ${kpi("Bets", plain.format(stats.bets), `${stats.calculable} priced for P/L`, "var(--gold)")}
      ${kpi("Win / Place", percent(stats.placeRate), `${stats.wins + stats.places} returns`, "var(--red)")}
    </section>
  `;
}

function proofCards(period) {
  const stats = period.stats;
  if (!period.bestDay || !period.worstDay) {
    return `
      <section class="proof-grid single">
        <article class="proof-card">
          <span>Monthly Status</span>
          <strong class="neutral">Ready</strong>
          <p>${period.period} is set up as a separate monthly tracker. The first August selections will populate the tables, curve, and breakdowns here.</p>
        </article>
      </section>
    `;
  }

  return `
    <section class="proof-grid">
      <article class="proof-card">
        <span>Best Day</span>
        <strong class="positive">${signedPoints(period.bestDay.plPts ?? (period.bestDay.plGbp / period.pointValue))}</strong>
        <p>${signedMoney(period.bestDay.plGbp)} · ${period.bestDay.label}, ${period.bestDay.bets} bets, ${percent(period.bestDay.roi)} ROI.</p>
      </article>
      <article class="proof-card">
        <span>Worst Day</span>
        <strong class="negative">${signedPoints(period.worstDay.plPts ?? (period.worstDay.plGbp / period.pointValue))}</strong>
        <p>${signedMoney(period.worstDay.plGbp)} · ${period.worstDay.label}, useful context for variance and drawdowns.</p>
      </article>
      <article class="proof-card">
        <span>Returns</span>
        <strong>${money(stats.returnGbp)}</strong>
        <p>From ${money(stats.stakeGbp)} calculable stake across ${period.period}.</p>
      </article>
    </section>
  `;
}

function festivalSparkline(daily = []) {
  if (!daily.length) return `<div class="festival-spark empty">Awaiting imported festival bets</div>`;

  const width = 280;
  const height = 78;
  const pad = 10;
  const values = daily.map((item) => Number(item.runningPts || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max === min ? 1 : max - min;
  const xStep = (width - pad * 2) / Math.max(daily.length - 1, 1);
  const xFor = (idx) => (daily.length === 1 ? width - pad : pad + idx * xStep);
  const yFor = (value) => height - pad - ((value - min) / span) * (height - pad * 2);
  const points = daily.length === 1
    ? `${pad},${yFor(values[0])} ${width - pad},${yFor(values[0])}`
    : values.map((value, idx) => `${xFor(idx).toFixed(2)},${yFor(value).toFixed(2)}`).join(" ");
  const area = `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;

  return `
    <svg class="festival-spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="Festival running profit and loss">
      <polygon points="${area}" fill="rgba(0,217,255,0.14)"></polygon>
      <polyline points="${points}" fill="none" stroke="var(--gold)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      ${values.map((value, idx) => `<circle cx="${xFor(idx).toFixed(2)}" cy="${yFor(value).toFixed(2)}" r="3.4" fill="${value >= 0 ? "var(--green)" : "var(--red)"}"></circle>`).join("")}
    </svg>
  `;
}

function festivalCard(festival, index) {
  const stats = festival.stats || {};
  const best = festival.bestReturn;
  const hasData = festival.hasData && Number(stats.bets || 0) > 0;
  const featured = index === 0 ? "is-featured" : "";
  const resultLine = hasData
    ? `${stats.wins}W ${stats.places}P ${stats.losses}L · ${percent(stats.placeRate)} win/place`
    : "Ready to populate when festival tips are imported";

  return `
    <article class="festival-card ${featured} ${hasData ? "" : "is-empty"}">
      <div class="festival-card-top">
        <div>
          <span class="festival-status">${festival.status}</span>
          <h3>${festival.name}</h3>
          <p>${festival.dateLabel} · ${festival.venue}</p>
        </div>
        <span class="festival-index">${String(index + 1).padStart(2, "0")}</span>
      </div>

      <div class="festival-score">
        <strong class="${hasData ? stats.plGbp >= 0 ? "positive" : "negative" : "neutral"}">${hasData ? signedPoints(stats.plPts) : "TBC"}</strong>
        <span>${hasData ? `${signedMoney(stats.plGbp)} · ${percent(stats.roi)} ROI` : festival.angle}</span>
      </div>

      <div class="festival-metrics">
        <span><strong>${plain.format(stats.bets || 0)}</strong>Bets</span>
        <span><strong>${plain.format(stats.wins || 0)}</strong>Wins</span>
        <span><strong>${plain.format(stats.places || 0)}</strong>Places</span>
        <span><strong>${hasData ? money(stats.stakeGbp) : "-"}</strong>Staked</span>
      </div>

      <div class="festival-chart">${festivalSparkline(festival.daily || [])}</div>

      <div class="festival-highlight">
        <span>${hasData && best ? "Best Return" : "Marketing Slot"}</span>
        <strong>${hasData && best ? `${best.horse} · ${signedPoints(best.plPts)}` : festival.angle}</strong>
        <small>${hasData && best ? `${best.betType} at ${fractionalOdds(best.odds, best.betType)} · ${best.date.slice(5)}` : resultLine}</small>
      </div>

      ${hasData ? `
        <details class="festival-proof">
          <summary>View festival bets</summary>
          <div class="festival-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Horse</th>
                  <th>Bet</th>
                  <th>Odds</th>
                  <th>Result</th>
                  <th>P/L</th>
                </tr>
              </thead>
              <tbody>${(festival.recentBets || []).map((bet) => `
                <tr>
                  <td>${bet.date.slice(5)}</td>
                  <td>${bet.horse}</td>
                  <td>${bet.betType}</td>
                  <td>${fractionalOdds(bet.odds, bet.betType)}</td>
                  <td><span class="result-badge ${statusClass(bet.result)}">${bet.result}</span></td>
                  <td><span class="${bet.plGbp >= 0 ? "positive" : "negative"}">${signedPoints(bet.plPts)}</span></td>
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        </details>
      ` : ""}
    </article>
  `;
}

function festivalsSection(festivals = []) {
  if (!festivals.length) return "";

  const live = festivals.find((festival) => festival.hasData) || festivals[0];
  const stats = live.stats || {};

  return `
    <section class="section-heading festival-heading" id="festivals">
      <div>
        <h2>Festival Form</h2>
        <span>Course windows built for proof-led marketing</span>
      </div>
      <span class="pill gold">${live.name}: ${stats.bets || 0} bets</span>
    </section>

    <section class="festival-hero-band">
      <div>
        <span>Latest Festival Spotlight</span>
        <h3>${live.name}</h3>
        <p>${live.angle}. ${live.hasData ? `${signedPoints(stats.plPts)} from ${stats.bets} tracked selections.` : "This slot will fill from the same workbook source as soon as tips are logged."}</p>
      </div>
      <div class="festival-summary">
        <span>
          <strong class="${live.hasData && stats.plGbp >= 0 ? "positive" : "neutral"}">${live.hasData ? signedPoints(stats.plPts) : "TBC"}</strong>
          Net P/L
        </span>
        <span>
          <strong>${live.hasData ? percent(stats.roi) : "-"}</strong>
          ROI
        </span>
        <span>
          <strong>${plain.format(stats.bets || 0)}</strong>
          Bets
        </span>
      </div>
    </section>

    <section class="festival-grid">
      ${festivals.map(festivalCard).join("")}
    </section>
  `;
}

function monthSection(period, index) {
  const stats = period.stats;
  const periodMonth = String(period.period || "").split(" ")[0] || "Current";
  const wonDeg = stats.settled ? (stats.wins / stats.settled) * 360 : 0;
  const placeDeg = stats.settled ? ((stats.wins + stats.places) / stats.settled) * 360 : 0;
  const lostDeg = stats.settled ? ((stats.wins + stats.places + stats.losses) / stats.settled) * 360 : 0;

  return `
    <section class="month-block ${index === 0 ? "is-current" : ""}" ${index === 0 ? 'id="months"' : ""}>
      <div class="section-heading">
        <h2>${period.period}</h2>
        <span>${index === 0 ? "Current month" : "Archived month"} · values-only export</span>
      </div>

      ${monthCards(period)}

      <section class="visual-grid">
        <article class="chart-panel">
          <div class="panel-top">
            <div>
              <h3>${periodMonth} P/L Curve</h3>
              <p>${stats.bets ? `${period.period} is ${signedPoints(stats.plPts)} (${signedMoney(stats.plGbp)}) from ${stats.calculable} priced selections.` : "Awaiting the first August results."}</p>
            </div>
            <span class="pill cyan">${signedPoints(stats.plPts)}</span>
          </div>
          <div class="chart-wrap">${lineChart(period.daily || [], period.pointValue)}</div>
          <div class="axis-labels">
            <span>${period.daily?.[0]?.label || ""}</span>
            <span>${period.daily?.[period.daily.length - 1]?.label || ""}</span>
          </div>
        </article>

        <article class="split-panel" style="--won-deg:${wonDeg}deg;--place-deg:${placeDeg}deg;--lost-deg:${lostDeg}deg">
          <div class="panel-top">
            <div>
              <h3>Result Split</h3>
              <p>Settled selections by outcome.</p>
            </div>
          </div>
          <div class="result-ring">
            <div class="ring-core">
              <div>
                <strong>${stats.settled}</strong>
                <span>settled</span>
              </div>
            </div>
          </div>
          <div class="legend">
            <div class="legend-row"><span><i style="--dot:var(--green)"></i>Won</span><strong>${stats.wins}</strong></div>
            <div class="legend-row"><span><i style="--dot:var(--cyan)"></i>Placed</span><strong>${stats.places}</strong></div>
            <div class="legend-row"><span><i style="--dot:var(--red)"></i>Lost</span><strong>${stats.losses}</strong></div>
            <div class="legend-row"><span><i style="--dot:rgba(255,255,255,0.35)"></i>Void</span><strong>${stats.voids}</strong></div>
          </div>
        </article>
      </section>

      ${proofCards(period)}

      <section class="rank-grid">
        <article class="rank-panel">
          <div class="panel-top">
            <div>
              <h3>Top Courses</h3>
              <p>Ranked by ${periodMonth} P/L.</p>
            </div>
          </div>
          <div class="rank-list">${rankRows(period.courses || [])}</div>
        </article>
        <article class="rank-panel">
          <div class="panel-top">
            <div>
              <h3>Bet Type</h3>
              <p>Win vs each-way performance.</p>
            </div>
          </div>
          <div class="rank-list">${rankRows(period.betTypes || [])}</div>
        </article>
      </section>

      <section class="table-panel">
        <div class="table-title">
          <h3>${stats.bets ? "Top Winners" : "Bet Log"}</h3>
          <span>${periodMonth} proof table</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Horse</th>
                <th>Course</th>
                <th>Bet</th>
                <th>Odds</th>
                <th>Result</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>${betRows(stats.bets ? period.topWinners : period.recentBets)}</tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

function render(data) {
  const payload = normalisePayload(data);
  const stats = payload.cumulative.stats;
  const currentPeriod = payload.periods[0] || payload.cumulative;
  const archivedPeriods = payload.periods.slice(1);
  const currentStats = currentPeriod.stats;

  app.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <div class="brand-row">
          <img class="brand-mark" src="https://nexus-tips.com/wp-content/uploads/2023/04/TTS-Website-Logo-300x300.png" alt="" />
          <div>
            <p class="eyebrow">Welcome to</p>
            <p class="brand-name">${payload.brand}</p>
          </div>
        </div>
        <div class="hero-title">
          <h1>PNL<br />Dashboard</h1>
          <p>Month by month tracked tips. Fully transparent. Scroll down to the bottom to see cumulative PNL.</p>
        </div>
        <div class="hero-meta">
          <span class="pill cyan">${currentStats.bets} August bets</span>
          <span class="pill gold">${money(payload.bankSize)} bank</span>
          <span class="pill">1pt = ${money(payload.pointValue)}</span>
          <span class="pill">${currentStats.calculable} priced for P/L</span>
          <span class="pill">Updated ${payload.updatedAt}</span>
        </div>
      </div>
    </section>

    <nav class="section-switcher" aria-label="Dashboard sections">
      <a href="#app">Overview</a>
      <a href="#months">Current Month</a>
      <a href="#festivals">Festival Form</a>
      <a href="#cumulative">Cumulative</a>
    </nav>

    ${monthSection(currentPeriod, 0)}

    ${festivalsSection(payload.festivals || [])}

    ${archivedPeriods.map((period, index) => monthSection(period, index + 1)).join("")}

    <section class="section-heading" id="cumulative">
      <h2>Cumulative P/L</h2>
      <span>All months combined</span>
    </section>

    <section class="kpi-grid">
      ${kpi("Total P/L", signedPoints(stats.plPts), `${signedMoney(stats.plGbp)} net`, "var(--green)", stats.plGbp >= 0 ? "positive" : "negative")}
      ${kpi("ROI", percent(stats.roi), `${money(stats.stakeGbp)} calculable stake`, "var(--cyan)", stats.roi >= 0 ? "positive" : "negative")}
      ${kpi("Strike Rate", percent(stats.strikeRate), `${stats.wins} winners`, "var(--gold)")}
      ${kpi("Win / Place", percent(stats.placeRate), `${stats.wins + stats.places} returns`, "var(--red)")}
    </section>

    <section class="chart-panel cumulative-panel">
      <div class="panel-top">
        <div>
          <h3>Running P/L Across Months</h3>
          <p>July remains intact underneath. August starts above it and will extend the same public proof flow.</p>
        </div>
        <span class="pill cyan">${signedPoints(stats.plPts)}</span>
      </div>
      <div class="chart-wrap">${lineChart(payload.cumulative.daily || [], payload.pointValue)}</div>
    </section>
  `;
}

fetch("./dashboard-data.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    return response.json();
  })
  .then(render)
  .catch((error) => {
    app.innerHTML = `<section class="loading-panel"><p>${error.message}</p></section>`;
  });

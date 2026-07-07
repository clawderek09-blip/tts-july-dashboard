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

function shortDayLabel(label) {
  return String(label || "").replace(/\s+[A-Za-z]{3}$/, "");
}

function statusClass(result) {
  return String(result || "").toLowerCase().replace(/\s+/g, "-");
}

function lineChart(daily, pointValue = 1) {
  const width = 840;
  const height = 286;
  const pad = 54;
  const axisY = height - pad;
  const values = daily.map((item) => Number(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue)));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const rawSpan = max - min || 1;
  const stepBase = 10 ** Math.floor(Math.log10(rawSpan / 4));
  const stepRatio = rawSpan / 4 / stepBase;
  const tickStep = stepBase * (stepRatio <= 1 ? 1 : stepRatio <= 2 ? 2 : stepRatio <= 5 ? 5 : 10);
  const chartMin = Math.floor(min / tickStep) * tickStep;
  let chartMax = Math.ceil(max / tickStep) * tickStep;
  if (chartMax === chartMin) chartMax += tickStep;
  const span = chartMax - chartMin;
  const xStep = (width - pad * 2) / Math.max(daily.length - 1, 1);
  const yFor = (value) => height - pad - ((value - chartMin) / span) * (height - pad * 2);
  const xFor = (idx) => pad + idx * xStep;
  const points = daily.map((item, idx) => `${xFor(idx)},${yFor(Number(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue)))}`).join(" ");
  const area = `${pad},${axisY} ${points} ${width - pad},${axisY}`;
  const zeroY = yFor(0);
  const yTicks = [];
  for (let tick = chartMin; tick <= chartMax + tickStep / 2; tick += tickStep) {
    const y = yFor(tick);
    yTicks.push(`<g>
      <line x1="${pad}" y1="${y.toFixed(2)}" x2="${width - pad}" y2="${y.toFixed(2)}" stroke="rgba(255,255,255,0.075)" />
      <text x="${pad - 11}" y="${(y + 5).toFixed(2)}" fill="rgba(255,255,255,0.56)" font-size="15" text-anchor="end">${tick > 0 ? "+" : ""}${plain.format(tick)}</text>
    </g>`);
  }
  const labelStep = Math.max(1, Math.ceil(daily.length / 6));
  const xTicks = daily
    .map((item, idx) => {
      const x = xFor(idx);
      const showLabel = idx === 0 || idx === daily.length - 1 || idx % labelStep === 0;
      return `<g>
        <circle cx="${x.toFixed(2)}" cy="${axisY}" r="3" fill="rgba(255,255,255,0.2)" stroke="rgba(0,217,255,0.42)" stroke-width="1.5">
          <title>${item.label}: ${signedPoints(item.runningPts ?? (Number(item.runningGbp || 0) / pointValue))} / ${signedMoney(item.runningGbp)}</title>
        </circle>
        ${showLabel ? `<text x="${x.toFixed(2)}" y="${height - 7}" fill="rgba(255,255,255,0.42)" font-size="11" text-anchor="${idx === 0 ? "start" : idx === daily.length - 1 ? "end" : "middle"}">${shortDayLabel(item.label)}</text>` : ""}
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
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Cumulative profit and loss chart">
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
      <text x="${pad - 11}" y="${pad - 18}" fill="rgba(0,217,255,0.68)" font-size="13" text-anchor="end">PTS</text>
      ${yTicks.join("")}
      ${xTicks}
      <polyline points="${points}" fill="none" stroke="url(#lineGradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
    </svg>
  `;
}

function dailyBars(daily) {
  const maxAbs = Math.max(...daily.map((item) => Math.abs(item.plGbp)), 1);
  return daily
    .map((item) => {
      const h = Math.max(8, (Math.abs(item.plGbp) / maxAbs) * 120);
      const positive = item.plGbp >= 0;
      return `
        <div class="day-bar" title="${item.label}: ${signedMoney(item.plGbp)}">
          <span class="${positive ? "up" : "down"}" style="height:${h}px"></span>
          <small>${shortDayLabel(item.label)}</small>
        </div>
      `;
    })
    .join("");
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
  const max = Math.max(...items.map((item) => Math.abs(item.plGbp)), 1);
  return items
    .map((item) => {
      const hasPnl = Number(item.calculable || 0) > 0;
      const plPts = Number(item.plPts ?? (Number(item.plGbp || 0) / 5));
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
  return items
    .map((bet) => {
      const hasPnl = bet.calculable !== false && bet.plGbp !== null && bet.plGbp !== undefined;
      const plPts = Number(bet.plPts ?? (Number(bet.plGbp || 0) / 5));
      return `
      <tr>
        <td>${bet.date.slice(5)}</td>
        <td>${bet.time}</td>
        <td>${bet.horse}</td>
        <td>${bet.course}</td>
        <td>${bet.betType}</td>
        <td>${bet.odds ? plain.format(bet.odds) : "-"}</td>
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

function render(data) {
  const { stats } = data;
  const periodMonth = String(data.period || "").split(" ")[0] || "Current";
  const wonDeg = (stats.wins / stats.settled) * 360;
  const placeDeg = ((stats.wins + stats.places) / stats.settled) * 360;
  const lostDeg = ((stats.wins + stats.places + stats.losses) / stats.settled) * 360;

  app.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <div class="brand-row">
          <img class="brand-mark" src="https://nexus-tips.com/wp-content/uploads/2023/04/TTS-Website-Logo-300x300.png" alt="" />
          <div>
            <p class="eyebrow">Welcome to</p>
            <p class="brand-name">${data.brand}</p>
          </div>
        </div>
        <div class="hero-title">
          <h1>${data.period}<br />Results dashboard</h1>
          <p>£ figures tracked to a ${money(data.bankSize)} bank.</p>
        </div>
        <div class="hero-meta">
          <span class="pill cyan">${stats.bets} tracked bets</span>
          <span class="pill gold">${money(data.bankSize)} bank</span>
          <span class="pill">1pt = ${money(data.pointValue)}</span>
          <span class="pill">${stats.calculable} priced for P/L</span>
          <span class="pill">Updated ${data.updatedAt}</span>
        </div>
      </div>
    </section>

    <section class="section-heading">
      <h2>${periodMonth} Performance</h2>
      <span>Proof dashboard · values-only export</span>
    </section>

    <section class="kpi-grid">
      ${kpi("Total P/L", signedPoints(stats.plPts), `${signedMoney(stats.plGbp)} · ${stats.calculable} priced`, "var(--green)", stats.plGbp >= 0 ? "positive" : "negative")}
      ${kpi("ROI", percent(stats.roi), `${money(stats.stakeGbp)} calculable stake`, "var(--cyan)", stats.roi >= 0 ? "positive" : "negative")}
      ${kpi("Strike Rate", percent(stats.strikeRate), `${stats.wins} winners`, "var(--gold)")}
      ${kpi("Win / Place", percent(stats.placeRate), `${stats.wins + stats.places} returns`, "var(--red)")}
    </section>

    <section class="section-heading">
      <h2>Profit Curve</h2>
      <span>Daily running P/L</span>
    </section>

    <section class="visual-grid">
      <article class="chart-panel">
        <div class="panel-top">
          <div>
            <h3>Cumulative P/L</h3>
            <p>${data.period} is currently ${signedPoints(stats.plPts)} (${signedMoney(stats.plGbp)}) from ${stats.calculable} priced Tipping Station selections.</p>
          </div>
          <span class="pill cyan">${signedPoints(stats.plPts)}</span>
        </div>
        <div class="chart-wrap">${lineChart(data.daily, data.pointValue)}</div>
        <div class="axis-labels">
          <span>${data.daily[0]?.label || ""}</span>
          <span>${data.daily[data.daily.length - 1]?.label || ""}</span>
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

    <section class="section-heading">
      <h2>Sharpest Spots</h2>
      <span>Best and worst markers</span>
    </section>

    <section class="proof-grid">
      <article class="proof-card">
        <span>Best Day</span>
        <strong class="positive">${signedPoints(data.bestDay.plPts ?? (data.bestDay.plGbp / data.pointValue))}</strong>
        <p>${signedMoney(data.bestDay.plGbp)} · ${data.bestDay.label}, ${data.bestDay.bets} bets, ${percent(data.bestDay.roi)} ROI.</p>
      </article>
      <article class="proof-card">
        <span>Worst Day</span>
        <strong class="negative">${signedPoints(data.worstDay.plPts ?? (data.worstDay.plGbp / data.pointValue))}</strong>
        <p>${signedMoney(data.worstDay.plGbp)} · ${data.worstDay.label}, useful context for variance and drawdowns.</p>
      </article>
      <article class="proof-card">
        <span>Returns</span>
        <strong>${money(stats.returnGbp)}</strong>
        <p>From ${money(stats.stakeGbp)} calculable stake across ${data.period}.</p>
      </article>
    </section>

    <section class="section-heading">
      <h2>Breakdowns</h2>
      <span>Courses and bet types</span>
    </section>

    <section class="rank-grid">
      <article class="rank-panel">
        <div class="panel-top">
          <div>
            <h3>Top Courses</h3>
            <p>Ranked by ${periodMonth} P/L.</p>
          </div>
        </div>
        <div class="rank-list">${rankRows(data.courses)}</div>
      </article>
      <article class="rank-panel">
        <div class="panel-top">
          <div>
            <h3>Bet Type</h3>
            <p>Win vs each-way performance.</p>
          </div>
        </div>
        <div class="rank-list">${rankRows(data.betTypes)}</div>
      </article>
    </section>

    <section class="section-heading">
      <h2>Top Winners</h2>
      <span>Public proof table</span>
    </section>

    <section class="table-panel">
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
          <tbody>${betRows(data.topWinners)}</tbody>
        </table>
      </div>
    </section>

    <section class="section-heading">
      <h2>Recent Settled</h2>
      <span>Latest ${periodMonth} entries</span>
    </section>

    <section class="table-panel">
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
          <tbody>${betRows(data.recentBets)}</tbody>
        </table>
      </div>
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

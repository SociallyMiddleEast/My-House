(function hcEnergyPage() {

  function fmtKw(v) { return (Math.round(v * 10) / 10).toFixed(1) + ' kW'; }

  function buildChart(history) {
    const W = 680, base = 140, top = 15;
    const xMin = 6, xMax = 18;
    const maxKw = Math.max(1, ...history.map(p => p.kw)) * 1.15;
    const pts = history
      .filter(p => p.t >= xMin - 0.01 && p.t <= xMax + 0.01)
      .map(p => {
        const x = Math.max(0, Math.min(W, ((p.t - xMin) / (xMax - xMin)) * W));
        const y = base - (p.kw / maxKw) * (base - top);
        return [x, y];
      });
    if (pts.length < 2) return;
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${pts[pts.length - 1][0].toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z`;
    document.getElementById('chart-line').setAttribute('d', line);
    document.getElementById('chart-area').setAttribute('d', area);
  }

  function setFlow(id, active, reverse) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', !!active);
    el.classList.toggle('reverse', !!reverse);
  }

  function render(data) {
    document.getElementById('m-pv').textContent = fmtKw(data.pvPower);
    document.getElementById('m-soc').textContent = data.batterySoc + '%';
    document.getElementById('m-soc-ctx').textContent =
      data.batteryPower > 0.05 ? 'Charging at ' + fmtKw(data.batteryPower) :
      data.batteryPower < -0.05 ? 'Discharging at ' + fmtKw(-data.batteryPower) : 'Idle';

    const grid = data.gridPower;
    document.getElementById('m-grid').textContent =
      grid > 0.05 ? fmtKw(grid) : grid < -0.05 ? fmtKw(-grid) : '0.0 kW';
    document.getElementById('m-grid-ctx').textContent =
      grid > 0.05 ? 'importing' : grid < -0.05 ? 'exporting' : 'balanced';

    document.getElementById('m-load').textContent = fmtKw(data.loadPower);

    document.getElementById('node-solar-val').textContent = fmtKw(data.pvPower);
    document.getElementById('node-house-val').textContent = fmtKw(data.loadPower);
    document.getElementById('node-batt-val').textContent = fmtKw(Math.abs(data.batteryPower));
    document.getElementById('node-grid-val').textContent = fmtKw(Math.abs(grid));

    document.getElementById('node-solar').classList.toggle('active', data.pvPower > 0.05);
    document.getElementById('node-batt').classList.toggle('active', Math.abs(data.batteryPower) > 0.05);
    document.getElementById('node-grid').classList.toggle('active', Math.abs(grid) > 0.05);
    document.getElementById('node-house').classList.toggle('active', data.loadPower > 0.05);

    setFlow('line-solar', data.pvPower > 0.05, false);
    setFlow('line-house', data.loadPower > 0.05, false);
    setFlow('line-batt', Math.abs(data.batteryPower) > 0.05, data.batteryPower < 0);
    setFlow('line-grid', Math.abs(grid) > 0.05, grid < 0);

    document.getElementById('st-name').textContent = data.stationName || '—';
    document.getElementById('st-today').textContent = data.todayKwh + ' kWh';
    document.getElementById('st-month').textContent = data.monthKwh + ' kWh';
    document.getElementById('st-total').textContent = data.totalKwh.toLocaleString() + ' kWh';
    document.getElementById('st-sync').textContent = new Date(data.updatedAt).toLocaleTimeString();

    document.getElementById('nrg-sub').textContent =
      'Last updated ' + new Date(data.updatedAt).toLocaleTimeString();

    buildChart(data.history);

    const callout = document.getElementById('nrg-callout');
    if (data.error) {
      callout.className = 'callout';
      callout.style.borderLeftColor = 'var(--bad)';
      callout.innerHTML = `<strong>Live fetch failed</strong> — showing demo data instead. ${data.error}`;
      callout.classList.remove('hidden');
    } else if (!hcIsLive() || !hcServiceEnabled('deye')) {
      callout.className = 'callout';
      callout.innerHTML = `Showing <strong>demo data</strong>. Add your DeyeCloud credentials to the backend proxy and connect it on the <a href="connections.html">Connections</a> page for live readings.`;
      callout.classList.remove('hidden');
    } else {
      callout.classList.add('hidden');
    }

    const connectBtn = document.getElementById('nrg-connect-btn');
    if (hcIsLive() && hcServiceEnabled('deye')) {
      connectBtn.textContent = 'Manage connection';
      connectBtn.classList.remove('primary');
    }
  }

  async function refresh() {
    const data = await hcGetEnergy();
    render(data);
  }

  document.getElementById('nrg-refresh').addEventListener('click', refresh);
  refresh();
  setInterval(refresh, hcIsLive() ? 30000 : 6000);
})();

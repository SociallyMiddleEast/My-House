(async function hcOverview() {
  const clock = document.getElementById('ov-clock');
  function tickClock() {
    clock.textContent = new Date().toLocaleString(undefined, {
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
  }
  tickClock();
  setInterval(tickClock, 30000);

  if (!hcIsLive()) {
    document.getElementById('ov-demo-callout').classList.remove('hidden');
  }

  // Energy summary
  const energy = await hcGetEnergy();
  document.getElementById('ov-pv').textContent = energy.pvPower.toFixed(1);
  document.getElementById('ov-soc').textContent = energy.batterySoc + '%';
  document.getElementById('ov-grid').textContent =
    (energy.gridPower > 0.1 ? 'Import ' : energy.gridPower < -0.1 ? 'Export ' : 'Idle ') +
    (Math.abs(energy.gridPower) > 0.1 ? Math.abs(energy.gridPower).toFixed(1) + ' kW' : '');
  document.getElementById('ov-today').textContent = energy.todayKwh + ' kWh';

  // House control summary
  const devices = window.HC_DEVICES;
  const on = devices.filter(d => d.state.on).length;
  document.getElementById('ov-devices-on').textContent = on;
  document.getElementById('ov-devices-total').textContent = devices.length;
  document.getElementById('ov-floor1').textContent =
    devices.filter(d => d.floor === 1 && d.state.on).length + ' / ' + devices.filter(d => d.floor === 1).length + ' on';
  document.getElementById('ov-floor2').textContent =
    devices.filter(d => d.floor === 2 && d.state.on).length + ' / ' + devices.filter(d => d.floor === 2).length + ' on';

  // Platform badges
  const settings = hcLoadSettings();
  const wrap = document.getElementById('ov-platform-badges');
  wrap.innerHTML = Object.entries(window.HC_PLATFORMS).map(([key, p]) => {
    const enabled = settings.services[key];
    const status = p.manual ? 'no public API' : (hcIsLive() && enabled ? 'live' : 'demo');
    const dotClass = p.manual ? 'neutral' : (hcIsLive() && enabled ? 'good' : 'neutral');
    return `<span class="badge"><span class="dot ${dotClass}" style="background:${p.manual ? '' : p.color}"></span>${p.label} (${status})</span>`;
  }).join('');

  // Home conditions
  function climateTile(reading) {
    const delta = +(reading.trend[reading.trend.length - 1] - reading.trend[0]).toFixed(1);
    const arrow = delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '–';
    const path = hcSparklinePath(reading.trend);
    return `
      <div class="climate-tile">
        <div class="climate-head"><svg><use href="#${reading.icon}"/></svg>${reading.label}</div>
        <div class="climate-value">${reading.value.toFixed(1)}<span class="climate-unit">°C</span></div>
        <div class="climate-foot">
          <svg class="spark" viewBox="0 0 56 18"><path d="${path}"/></svg>
          <span class="climate-delta">${arrow} ${Math.abs(delta).toFixed(1)}°</span>
        </div>
      </div>`;
  }

  function vacuumTile(minutesLeft) {
    const h = Math.floor(minutesLeft / 60), m = minutesLeft % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m} min`;
    const pct = Math.max(4, Math.min(100, 100 - (minutesLeft / 1440) * 100));
    return `
      <div class="climate-tile vacuum-tile">
        <div class="climate-head"><svg><use href="#i-vacuum"/></svg>Robot vacuum</div>
        <div class="climate-value">${timeStr}<span class="climate-unit"> left</span></div>
        <div class="vacuum-bar"><div class="vacuum-bar-fill" style="width:${pct}%"></div></div>
        <div class="vacuum-note">No public API — schedule is set in the eureka robot app; this mirrors it.</div>
      </div>`;
  }

  async function renderClimate() {
    const c = await hcGetClimate();
    document.getElementById('climate-mount').innerHTML = [
      climateTile(c.outdoor),
      climateTile(c.livingArea),
      climateTile(c.parentsBedroom),
      climateTile(c.kidsBedroom),
      climateTile(c.hotWater),
      vacuumTile(c.vacuumMinutesToClean)
    ].join('');
  }

  await renderClimate();
  setInterval(renderClimate, 30000);
})();

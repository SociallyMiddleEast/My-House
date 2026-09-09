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
  const badgeWrap = document.getElementById('ov-platform-badges');
  badgeWrap.innerHTML = Object.entries(window.HC_PLATFORMS).map(([key, p]) => {
    const enabled = settings.services[key];
    const status = p.manual ? 'no public API' : (hcIsLive() && enabled ? 'live' : 'demo');
    const dotClass = p.manual ? 'neutral' : (hcIsLive() && enabled ? 'good' : 'neutral');
    return `<span class="badge"><span class="dot ${dotClass}" style="background:${p.manual ? '' : p.color}"></span>${p.label} (${status})</span>`;
  }).join('');

  // ---- Quick scenes ----
  function renderScenes() {
    document.getElementById('scenes-mount').innerHTML = window.HC_SCENES.map(s => `
      <button class="scene-card" data-scene="${s.id}">
        <span class="scene-icon"><svg><use href="#${s.icon}"/></svg></span>
        <span>
          <span class="scene-name">${s.label}</span>
          <div class="scene-blurb">${s.blurb}</div>
        </span>
      </button>`).join('');
  }
  renderScenes();

  document.getElementById('scenes-mount').addEventListener('click', async (e) => {
    const btn = e.target.closest('.scene-card');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.style.opacity = '0.6';
    const changed = await hcApplyScene(btn.dataset.scene);
    btn.style.opacity = '';
    const nameEl = btn.querySelector('.scene-name');
    if (nameEl) {
      const prevText = nameEl.textContent;
      nameEl.textContent = `Applied — ${changed} changed`;
      setTimeout(() => { nameEl.textContent = prevText; }, 1600);
    }
    document.getElementById('ov-devices-on').textContent = window.HC_DEVICES.filter(d => d.state.on).length;
    renderActivity();
  });

  // ---- Climate (weather + sensor readings) ----
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

  function weatherTile(w) {
    if (!w.ok) {
      return `<div class="climate-tile weather-tile"><div class="climate-head"><svg><use href="#i-cloud"/></svg>Weather</div><div class="climate-note">Couldn't reach the weather service — ${w.message}</div></div>`;
    }
    return `
      <div class="climate-tile weather-tile">
        <div class="climate-head"><svg><use href="#${w.icon}"/></svg>Weather · Beirut</div>
        <div style="display:flex; align-items:baseline; gap:10px; flex-wrap:wrap;">
          <div class="climate-value">${w.temp}<span class="climate-unit">°C</span></div>
          <div class="muted" style="font-size:13px;">${w.label} · H:${w.high}° L:${w.low}°</div>
        </div>
        <div class="weather-outlook">${w.outlook}</div>
      </div>`;
  }

  async function renderClimate() {
    const [c, w] = await Promise.all([hcGetClimate(), hcGetWeather()]);
    document.getElementById('climate-mount').innerHTML = [
      weatherTile(w),
      climateTile(c.outdoor),
      climateTile(c.livingArea),
      climateTile(c.parentsBedroom),
      climateTile(c.kidsBedroom),
      climateTile(c.hotWater)
    ].join('');
    return c;
  }

  // ---- Utilities & backup ----
  function vacuumTile(minutesLeft) {
    const h = Math.floor(minutesLeft / 60), m = minutesLeft % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m} min`;
    const pct = Math.max(4, Math.min(100, 100 - (minutesLeft / 1440) * 100));
    return `
      <div class="climate-tile vacuum-tile">
        <div class="climate-head"><svg><use href="#i-vacuum"/></svg>Robot vacuum</div>
        <div class="climate-value">${timeStr}<span class="climate-unit"> left</span></div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${pct}%"></div></div>
        <div class="climate-note">No public API — schedule is set in the eureka robot app; this mirrors it.</div>
      </div>`;
  }

  function generatorTile(gen) {
    const h = Math.floor(gen.runtimeTodayMin / 60), m = gen.runtimeTodayMin % 60;
    return `
      <div class="climate-tile generator-tile">
        <div class="climate-head"><svg><use href="#i-generator"/></svg>Generator</div>
        <div class="climate-value" style="font-size:20px;">${gen.running ? 'Running' : 'Standby'}</div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${gen.fuelPct}%"></div></div>
        <div class="climate-note">Fuel ${gen.fuelPct}% · ${h}h ${m}m runtime today</div>
      </div>`;
  }

  function waterTankTile(tank) {
    return `
      <div class="climate-tile water-tile">
        <div class="climate-head"><svg><use href="#i-droplet"/></svg>Water tank</div>
        <div class="climate-value">${tank.pct}<span class="climate-unit">%</span></div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${tank.pct}%"></div></div>
        <div class="climate-note">Demo reading — wire to a real level sensor when you have one.</div>
      </div>`;
  }

  function fuelNote(pct, daysLeft) {
    const low = pct < 20;
    return `<div class="climate-note${low ? ' low' : ''}">${low ? 'Low — ' : '~'}${daysLeft} days left at current use</div>`;
  }

  function gasTile(gas) {
    return `
      <div class="climate-tile gas-tile">
        <div class="climate-head"><svg><use href="#i-gas"/></svg>Gas tank</div>
        <div class="climate-value">${gas.pct}<span class="climate-unit">%</span></div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${gas.pct}%"></div></div>
        ${fuelNote(gas.pct, gas.daysLeft)}
      </div>`;
  }

  function fuelOilTile(oil) {
    return `
      <div class="climate-tile oil-tile">
        <div class="climate-head"><svg><use href="#i-barrel"/></svg>Fuel oil</div>
        <div class="climate-value">${oil.pct}<span class="climate-unit">%</span></div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${oil.pct}%"></div></div>
        ${fuelNote(oil.pct, oil.daysLeft)}
      </div>`;
  }

  async function renderUtilities(vacuumMinutes) {
    const u = hcDemoUtilities();
    document.getElementById('utilities-mount').innerHTML = [
      waterTankTile(u.waterTank),
      gasTile(u.gasTank),
      fuelOilTile(u.fuelOil),
      generatorTile(u.generator),
      vacuumTile(vacuumMinutes)
    ].join('');
  }

  // ---- Recent activity ----
  function renderActivity() {
    const items = hcGetActivity();
    document.getElementById('activity-mount').innerHTML = items.map(a => `
      <div class="activity-row">
        <span class="activity-time">${hcRelativeTime(a.at)}</span>
        <span class="activity-msg">${a.message}</span>
      </div>`).join('') || '<div class="muted" style="font-size:13px;">Nothing yet — actions you take will show up here.</div>';
  }
  renderActivity();

  async function refreshClimateAndUtilities() {
    const c = await renderClimate();
    await renderUtilities(c.vacuumMinutesToClean);
  }
  await refreshClimateAndUtilities();
  setInterval(refreshClimateAndUtilities, 60000);
})();

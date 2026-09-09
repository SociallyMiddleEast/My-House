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
})();

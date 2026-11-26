// Turns stored records into the kernel input. Pure: same records => same result.
const K = require('./kernel');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));

function toggle(b) {
  return {
    ...b,
    set(k, v) {
      this[k] = v;
    },
  };
}

function buildInput(vehicle, charges = [], readings = [], nowISO) {
  const v = vehicle || {};
  const ch = charges.filter((c) => c && c.vehicleId === v.id).slice().sort(byDate);
  const rd = readings.filter((r) => r && r.vehicleId === v.id).slice().sort(byDate);

  const dc = ch.filter((c) => c.current === 'DC');
  const peaks = dc.map((c) => (isNum(c.peakKw) ? c.peakKw : null)).filter(isNum);
  const recent = peaks.slice(-5);
  const history = peaks.length > 5 ? peaks.slice(0, -5) : peaks;

  const lastEnergy = ch
    .slice()
    .reverse()
    .find((c) => isNum(c.billedKwh) && isNum(c.distanceKm) && c.distanceKm > 0);

  const rangeReadings = rd.filter((r) => r.type === 'range' && isNum(r.value));
  const winter = rd.filter((r) => r.type === 'winter' && isNum(r.value)).slice(-1)[0];
  const warm = rd.filter((r) => r.type === 'warm' && isNum(r.value)).slice(-1)[0];
  const aux = rd.filter((r) => r.type === 'aux' && isNum(r.value)).slice(-1)[0];
  const connector = rd.filter((r) => r.type === 'connector' && isNum(r.value)).slice(-1)[0];

  const withinYear = ch.filter((c) => {
    const t = Date.parse(c.date);
    const now = Date.parse(nowISO || new Date().toISOString());
    return Number.isFinite(t) && Number.isFinite(now) && now - t <= 365 * 86400000 && t <= now;
  });

  return {
    vin: v.vin,
    registeredYear: isNum(v.registeredYear) ? v.registeredYear : null,
    openRecalls: isNum(v.openRecalls) ? v.openRecalls : null,
    safetyRecalls: isNum(v.safetyRecalls) ? v.safetyRecalls : null,
    warrantyEnd: v.warrantyEnd || null,
    now: nowISO || new Date().toISOString().slice(0, 10),
    samples: rangeReadings.map((r) => ({ rangeKm: r.value, tempC: r.tempC })),
    epaRangeKm: isNum(v.epaRangeKm) ? v.epaRangeKm : null,
    recentPeaksKw: recent,
    historyPeaksKw: history,
    dcSessions: dc.length,
    abnormalDcSessions: dc.filter((c) => c.interrupted === true).length,
    billedKwh: lastEnergy ? lastEnergy.billedKwh : null,
    distanceKm: lastEnergy ? lastEnergy.distanceKm : null,
    current: lastEnergy ? lastEnergy.current : null,
    dashKwhPer100km: lastEnergy && isNum(lastEnergy.dashKwhPer100) ? lastEnergy.dashKwhPer100 : null,
    winterRangeKm: winter ? winter.value : null,
    warmRangeKm: warm ? warm.value : null,
    chemistry: v.chemistry || null,
    dcCharges: dc.length,
    totalCharges: ch.length,
    annualDcCharges: withinYear.filter((c) => c.current === 'DC').length,
    deepDischargeCount: ch.filter((c) => isNum(c.startSoc) && c.startSoc < 10).length,
    auxBatteryV: aux ? aux.value : null,
    connectorTempC: connector ? connector.value : null,
  };
}

const BAD = new Set([K.WARN, K.FAIL]);

function narrative(result, vehicle) {
  const name = (vehicle && vehicle.name) || 'This car';
  const bad = result.items.filter((i) => BAD.has(i.status));
  const un = result.items.filter((i) => i.status === K.NE);
  const lines = [];

  if (result.overall === K.NE) {
    lines.push(`Nothing has been measured yet, so there is no verdict. ${name} needs a few charges or readings first.`);
    return lines;
  }

  if (result.overall === K.PASS) {
    lines.push(`All ${result.counts.pass} measured checks are inside range. Nothing here says \"go to the shop\" — but that is not the same as a clean bill of health.`);
  } else {
    lines.push(`${bad.length} of ${result.items.length} checks need a look. Everything else is inside range or not evaluated.`);
    const first = bad[0];
    lines.push(`${first.label} is the one to start with: ${describe(first)}.`);
  }

  if (un.length) {
    lines.push(`${un.length} checks were skipped because there is no data — they are not passes.`);
  }
  const fails = result.items.filter((i) => i.status === K.FAIL);
  if (fails.length) {
    lines.push(`Stop driving and get it looked at: ${fails.map((f) => f.label).join(', ')}.`);
  } else {
    lines.push('No safety-level flag was raised. A yellow item is a reason to keep watching, not to panic.');
  }
  return lines;
}

function describe(item) {
  switch (item.id) {
    case 4: return `range is ${Math.round((item.value || 0) * 100)}% of the EPA figure`;
    case 5: return `DC peak power is ${Math.round((item.value || 0) * 100)}% of its own history`;
    case 6: return `${Math.round((item.value || 0) * 100)}% of DC sessions ended early`;
    case 7: return `the ledger uses ${Math.round((item.value || 0) * 100)}% more energy than the dash shows`;
    case 8: return `winter range holds ${Math.round((item.value || 0) * 100)}% of the warm-weather figure`;
    case 9: return `${Math.round((item.value || 0) * 100)}% of charging is DC`;
    case 10: return `${Math.round((item.value || 0) * 100)}% of charges start below 10%`;
    case 11: return `the 12V battery rests at ${item.value} V`;
    case 12: return `the connector reached ${item.value} C`;
    case 1: return `the VIN says ${item.value}, the registration says otherwise`;
    case 2: return `${item.value} open recall(s)`;
    case 3: return `${item.value} months of warranty left`;
    default: return item.detail || 'outside the expected range';
  }
}

module.exports = { buildInput, narrative, describe };

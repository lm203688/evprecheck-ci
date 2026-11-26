// EVPrecheck core — deterministic EV pre-check math only.
// No I/O, no randomness, no network. Every function returns a number or null;
// callers decide how to present it. Thresholds live in one frozen table so a
// report can be replayed against the version that produced it.
// See docs/公式与来源.md for every constant and its source status.

const THRESHOLDS = Object.freeze({
  version: 'ev-1.0.0',
  effective: '2026-11-26',
  rangeIndex: Object.freeze({ warn: 0.85, fail: 0.75, minSamples: 3, tempMinC: 15, tempMaxC: 30 }),
  fastCharge: Object.freeze({ warn: 0.75, fail: 0.60, minHistory: 8, recentWindow: 5 }),
  interrupt: Object.freeze({ warn: 0.20, minSessions: 5 }),
  energy: Object.freeze({ warn: 0.15, acEfficiency: 0.90, dcEfficiency: 0.95 }),
  winter: Object.freeze({ warn: 0.65, warnLFP: 0.60 }),
  dcShare: Object.freeze({ warn: 0.80, minAnnualDc: 150, minSessions: 10 }),
  deepDischarge: Object.freeze({ warn: 0.10, minSessions: 10 }),
  auxBattery: Object.freeze({ warnV: 12.0, failV: 11.6 }),
  connector: Object.freeze({ failC: 60 }),
  warranty: Object.freeze({ warnMonths: 12 }),
});

const PASS = 'pass';
const WARN = 'warn';
const FAIL = 'fail';
const NE = 'notEvaluated';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const finiteArr = (a) => (Array.isArray(a) ? a.filter(isNum) : []);

function median(values) {
  const a = finiteArr(values).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// PERCENTILE.INC style linear interpolation; documented so results are replayable.
function percentile(values, p) {
  const a = finiteArr(values).slice().sort((x, y) => x - y);
  if (!a.length || !(p >= 0 && p <= 1)) return null;
  const pos = (a.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

// NHTSA 30-year VIN cycle: A..Y => 2010..2030, 1..9 => 2031..2039.
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTUVWXY123456789';
const LETTER_COUNT = 21;

function vinModelYear(vin) {
  if (typeof vin !== 'string' || vin.length !== 17) return null;
  const ch = vin[9].toUpperCase();
  const idx = YEAR_CODES.indexOf(ch);
  if (idx < 0) return null;
  return idx < LETTER_COUNT ? 2010 + idx : 2031 + (idx - LETTER_COUNT);
}

function monthsBetween(fromISO, toISO) {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return (to - from) / (1000 * 60 * 60 * 24 * 30.4375);
}

function item(id, label, status, value, unit, detail) {
  return { id, label, status, value: isNum(value) ? value : null, unit: unit || null, detail: detail || null };
}

// ---------------- 1 VIN consistency ----------------
function checkVin({ vin, registeredYear }) {
  const my = vinModelYear(vin);
  if (my === null || !isNum(registeredYear)) {
    return item(1, 'VIN model year', NE, null, null, 'VIN or registered year missing');
  }
  const status = my === registeredYear ? PASS : FAIL;
  return item(1, 'VIN model year', status, my, 'year', `VIN says ${my}, registered ${registeredYear}`);
}

// ---------------- 2 recalls ----------------
function checkRecalls({ openRecalls, safetyRecalls }) {
  if (!isNum(openRecalls) || !isNum(safetyRecalls)) {
    return item(2, 'Open recalls', NE, null, 'count', 'Recall lookup not run');
  }
  if (safetyRecalls > 0) return item(2, 'Open recalls', FAIL, safetyRecalls, 'count', 'Safety recall outstanding');
  if (openRecalls > 0) return item(2, 'Open recalls', WARN, openRecalls, 'count', 'Non-safety recall outstanding');
  return item(2, 'Open recalls', PASS, 0, 'count', 'No open recalls');
}

// ---------------- 3 warranty ----------------
function checkWarranty({ warrantyEnd, now }) {
  const months = monthsBetween(now, warrantyEnd);
  if (months === null) return item(3, 'Warranty left', NE, null, 'months', 'No warranty end date');
  const status = months <= THRESHOLDS.warranty.warnMonths ? WARN : PASS;
  return item(3, 'Warranty left', status, Math.round(months), 'months', months <= 0 ? 'Expired' : `Ends ${warrantyEnd}`);
}

// ---------------- 4 range index ----------------
function rangeIndex({ samples, epaRangeKm }) {
  if (!isNum(epaRangeKm) || epaRangeKm <= 0) return null;
  const inBand = (samples || []).filter(
    (s) => isNum(s?.rangeKm) && isNum(s?.tempC) && s.tempC >= THRESHOLDS.rangeIndex.tempMinC && s.tempC <= THRESHOLDS.rangeIndex.tempMaxC,
  );
  if (inBand.length < THRESHOLDS.rangeIndex.minSamples) return null;
  return median(inBand.map((s) => s.rangeKm)) / epaRangeKm;
}

function checkRange({ samples, epaRangeKm }) {
  const r = rangeIndex({ samples, epaRangeKm });
  if (r === null) {
    return item(4, 'Range index', NE, null, 'ratio', 'Need 3 full-charge samples between 15 and 30 C');
  }
  let status = PASS;
  if (r < THRESHOLDS.rangeIndex.fail) status = FAIL;
  else if (r < THRESHOLDS.rangeIndex.warn) status = WARN;
  return item(4, 'Range index', status, round(r, 3), 'ratio', `Measured vs EPA (${epaRangeKm} km)`);
}

// ---------------- 5 fast-charge peak ratio ----------------
function fastChargeRatio({ recentPeaksKw, historyPeaksKw }) {
  const recent = finiteArr(recentPeaksKw);
  const history = finiteArr(historyPeaksKw);
  if (!recent.length || history.length < 2) return null;
  const base = percentile(history, 0.9);
  if (!base || base <= 0) return null;
  return { ratio: median(recent) / base, baselineStable: history.length >= THRESHOLDS.fastCharge.minHistory };
}

function checkFastCharge({ recentPeaksKw, historyPeaksKw }) {
  const res = fastChargeRatio({ recentPeaksKw, historyPeaksKw });
  if (!res) return item(5, 'DC peak power', NE, null, 'ratio', 'Need one recent and two historical DC sessions');
  let status = PASS;
  if (res.ratio < THRESHOLDS.fastCharge.fail) status = FAIL;
  else if (res.ratio < THRESHOLDS.fastCharge.warn) status = WARN;
  const note = res.baselineStable ? null : 'Baseline unstable (<8 sessions)';
  return item(5, 'DC peak power', status, round(res.ratio, 3), 'ratio', note);
}

// ---------------- 6 interruption rate ----------------
function checkInterrupt({ dcSessions, abnormalDcSessions }) {
  if (!isNum(dcSessions) || !isNum(abnormalDcSessions) || dcSessions < THRESHOLDS.interrupt.minSessions) {
    return item(6, 'Charge interruptions', NE, null, 'ratio', `Need ${THRESHOLDS.interrupt.minSessions}+ DC sessions`);
  }
  const rate = abnormalDcSessions / dcSessions;
  const status = rate > THRESHOLDS.interrupt.warn ? WARN : PASS;
  return item(6, 'Charge interruptions', status, round(rate, 3), 'ratio', `${abnormalDcSessions}/${dcSessions} sessions`);
}

// ---------------- 7 energy deviation ----------------
function energyPer100({ billedKwh, distanceKm, current, efficiency }) {
  if (!isNum(billedKwh) || !isNum(distanceKm) || distanceKm <= 0 || billedKwh <= 0) return null;
  const eta = current === 'AC' ? THRESHOLDS.energy.acEfficiency : THRESHOLDS.energy.dcEfficiency;
  const etaUsed = isNum(efficiency) ? efficiency : eta;
  return (billedKwh * etaUsed / distanceKm) * 100;
}

function checkEnergy({ billedKwh, distanceKm, current, dashKwhPer100km, efficiency }) {
  const e = energyPer100({ billedKwh, distanceKm, current, efficiency });
  if (e === null || !isNum(dashKwhPer100km) || dashKwhPer100km <= 0) {
    return item(7, 'Energy vs dash', NE, null, 'kWh/100km', 'Need a billed session, distance and dash reading');
  }
  const dev = Math.abs(e - dashKwhPer100km) / dashKwhPer100km;
  const status = dev > THRESHOLDS.energy.warn ? WARN : PASS;
  return item(7, 'Energy vs dash', status, round(dev, 3), 'ratio', `Ledger ${round(e, 1)} vs dash ${dashKwhPer100km}`);
}

// ---------------- 8 winter retention ----------------
function checkWinter({ winterRangeKm, warmRangeKm, chemistry }) {
  if (!isNum(winterRangeKm) || !isNum(warmRangeKm) || warmRangeKm <= 0) {
    return item(8, 'Winter retention', NE, null, 'ratio', 'No matched winter/warm samples');
  }
  const r = winterRangeKm / warmRangeKm;
  const limit = chemistry === 'LFP' ? THRESHOLDS.winter.warnLFP : THRESHOLDS.winter.warn;
  const status = r < limit ? WARN : PASS;
  return item(8, 'Winter retention', status, round(r, 3), 'ratio', chemistry === 'LFP' ? 'LFP limit 0.60' : 'NMC limit 0.65');
}

// ---------------- 9 DC share ----------------
function checkDcShare({ dcCharges, totalCharges, annualDcCharges }) {
  if (!isNum(dcCharges) || !isNum(totalCharges) || totalCharges < THRESHOLDS.dcShare.minSessions) {
    return item(9, 'DC share', NE, null, 'ratio', `Need ${THRESHOLDS.dcShare.minSessions}+ sessions`);
  }
  const share = dcCharges / totalCharges;
  const heavy = share > THRESHOLDS.dcShare.warn && isNum(annualDcCharges) && annualDcCharges > THRESHOLDS.dcShare.minAnnualDc;
  return item(9, 'DC share', heavy ? WARN : PASS, round(share, 3), 'ratio', `Heavy use threshold: >80% and >150 DC/yr`);
}

// ---------------- 10 deep discharge ----------------
function checkDeepDischarge({ deepDischargeCount, totalCharges }) {
  if (!isNum(deepDischargeCount) || !isNum(totalCharges) || totalCharges < THRESHOLDS.deepDischarge.minSessions) {
    return item(10, 'Deep discharges', NE, null, 'ratio', `Need ${THRESHOLDS.deepDischarge.minSessions}+ sessions`);
  }
  const share = deepDischargeCount / totalCharges;
  const status = share > THRESHOLDS.deepDischarge.warn ? WARN : PASS;
  return item(10, 'Deep discharges', status, round(share, 3), 'ratio', 'Below 10% SOC');
}

// ---------------- 11 aux battery ----------------
function checkAuxBattery({ auxBatteryV }) {
  if (!isNum(auxBatteryV)) return item(11, '12V battery', NE, null, 'V', 'No resting voltage reading');
  let status = PASS;
  if (auxBatteryV < THRESHOLDS.auxBattery.failV) status = FAIL;
  else if (auxBatteryV < THRESHOLDS.auxBattery.warnV) status = WARN;
  return item(11, '12V battery', status, auxBatteryV, 'V', 'Resting voltage');
}

// ---------------- 12 connector temperature ----------------
function checkConnector({ connectorTempC }) {
  if (!isNum(connectorTempC)) return item(12, 'Connector temp', NE, null, 'C', 'Skipped (optional)');
  const status = connectorTempC > THRESHOLDS.connector.failC ? FAIL : PASS;
  return item(12, 'Connector temp', status, connectorTempC, 'C', 'After charging');
}

function round(v, digits) {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

// ---------------- aggregate ----------------
function evaluateVehicle(input = {}) {
  const items = [
    checkVin(input),
    checkRecalls(input),
    checkWarranty(input),
    checkRange(input),
    checkFastCharge(input),
    checkInterrupt(input),
    checkEnergy(input),
    checkWinter(input),
    checkDcShare(input),
    checkDeepDischarge(input),
    checkAuxBattery(input),
    checkConnector(input),
  ];
  const fails = items.filter((i) => i.status === FAIL).length;
  const warns = items.filter((i) => i.status === WARN).length;
  const evaluated = items.filter((i) => i.status !== NE).length;
  let overall = NE;
  if (fails > 0) overall = FAIL;
  else if (warns > 0) overall = WARN;
  else if (evaluated > 0) overall = PASS;
  return {
    thresholdVersion: THRESHOLDS.version,
    overall,
    counts: { fail: fails, warn: warns, pass: items.filter((i) => i.status === PASS).length, notEvaluated: items.filter((i) => i.status === NE).length },
    items,
  };
}

module.exports = {
  THRESHOLDS, PASS, WARN, FAIL, NE,
  median, percentile, vinModelYear, monthsBetween,
  rangeIndex, fastChargeRatio, energyPer100,
  checkVin, checkRecalls, checkWarranty, checkRange, checkFastCharge,
  checkInterrupt, checkEnergy, checkWinter, checkDcShare, checkDeepDischarge,
  checkAuxBattery, checkConnector, evaluateVehicle,
};

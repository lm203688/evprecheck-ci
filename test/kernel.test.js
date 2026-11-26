// Golden-value tests for the EVPrecheck kernel.
// Every expected number below is hand-computed from the formula in docs/公式与来源.md
// and must stay reproducible: same input => same bytes.
const test = require('node:test');
const assert = require('node:assert/strict');
const k = require('../src/kernel');

const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

const GOOD = {
  vin: '5YJ3E1EA7KF123456',
  registeredYear: 2019,
  openRecalls: 0,
  safetyRecalls: 0,
  warrantyEnd: '2030-01-01',
  now: '2026-11-26',
  samples: [{ rangeKm: 470, tempC: 22 }, { rangeKm: 468, tempC: 20 }, { rangeKm: 472, tempC: 25 }],
  epaRangeKm: 480,
  recentPeaksKw: [150, 149, 151, 150, 148],
  historyPeaksKw: [150, 148, 152, 149, 151, 147, 153, 150],
  dcSessions: 20,
  abnormalDcSessions: 1,
  billedKwh: 48.9,
  distanceKm: 210,
  current: 'DC',
  dashKwhPer100km: 22.5,
  winterRangeKm: 400,
  warmRangeKm: 470,
  dcCharges: 5,
  totalCharges: 40,
  annualDcCharges: 60,
  deepDischargeCount: 1,
  auxBatteryV: 12.6,
  connectorTempC: 42,
};

// ---------- helpers ----------
test('median handles odd and even samples', () => {
  assert.equal(k.median([405, 408, 402]), 405);
  assert.equal(k.median([1, 2, 3, 4]), 2.5);
  assert.equal(k.median([]), null);
  assert.equal(k.median([NaN, 5, Infinity]), 5);
});

test('percentile uses linear interpolation (Excel INC)', () => {
  near(k.percentile([147, 148, 149, 150, 150, 151, 152, 153], 0.9), 152.3, 1e-9);
  near(k.percentile([1, 2, 3, 4, 5], 0.5), 3, 1e-9);
  assert.equal(k.percentile([], 0.9), null);
});

test('threshold table is frozen with a version', () => {
  assert.equal(Object.isFrozen(k.THRESHOLDS), true);
  assert.equal(k.THRESHOLDS.version, 'ev-1.0.0');
});

// ---------- 1 VIN ----------
test('VIN model year decodes 2019 from position 10 K', () => {
  assert.equal(k.vinModelYear('5YJ3E1EA7KF123456'), 2019);
});

test('VIN model year decodes 2026 from T', () => {
  assert.equal(k.vinModelYear('5YJ3E1EA7TF123456'), 2026);
});

test('VIN mismatch fails', () => {
  const r = k.checkVin({ vin: '5YJ3E1EA7KF123456', registeredYear: 2021 });
  assert.equal(r.status, k.FAIL);
  assert.equal(r.value, 2019);
});

test('VIN match passes', () => {
  assert.equal(k.checkVin({ vin: '5YJ3E1EA7KF123456', registeredYear: 2019 }).status, k.PASS);
});

test('VIN too short is not evaluated', () => {
  assert.equal(k.checkVin({ vin: '5YJ3E1EA7K', registeredYear: 2019 }).status, k.NE);
});

// ---------- 2 recalls ----------
test('safety recall fails', () => {
  assert.equal(k.checkRecalls({ openRecalls: 2, safetyRecalls: 1 }).status, k.FAIL);
});

test('non-safety recall warns', () => {
  assert.equal(k.checkRecalls({ openRecalls: 2, safetyRecalls: 0 }).status, k.WARN);
});

test('no recall passes', () => {
  assert.equal(k.checkRecalls({ openRecalls: 0, safetyRecalls: 0 }).status, k.PASS);
});

test('missing recall lookup is not evaluated', () => {
  assert.equal(k.checkRecalls({}).status, k.NE);
});

// ---------- 3 warranty ----------
test('warranty under 12 months warns', () => {
  const r = k.checkWarranty({ now: '2026-11-26', warrantyEnd: '2027-10-26' });
  assert.equal(r.status, k.WARN);
  assert.equal(r.value, 11);
});

test('long warranty passes', () => {
  assert.equal(k.checkWarranty({ now: '2026-11-26', warrantyEnd: '2030-11-26' }).status, k.PASS);
});

test('expired warranty still only warns', () => {
  assert.equal(k.checkWarranty({ now: '2026-11-26', warrantyEnd: '2025-01-01' }).status, k.WARN);
});

test('missing warranty date is not evaluated', () => {
  assert.equal(k.checkWarranty({ now: '2026-11-26' }).status, k.NE);
});

// ---------- 4 range ----------
test('range index matches hand calc 0.844', () => {
  const r = k.checkRange({ samples: [{ rangeKm: 405, tempC: 22 }, { rangeKm: 408, tempC: 20 }, { rangeKm: 402, tempC: 25 }], epaRangeKm: 480 });
  assert.equal(r.status, k.WARN);
  assert.equal(r.value, 0.844);
});

test('range index below 0.75 fails', () => {
  const r = k.checkRange({ samples: [{ rangeKm: 350, tempC: 22 }, { rangeKm: 352, tempC: 20 }, { rangeKm: 348, tempC: 25 }], epaRangeKm: 480 });
  assert.equal(r.status, k.FAIL);
});

test('range samples outside the temperature band are ignored', () => {
  const r = k.checkRange({ samples: [{ rangeKm: 300, tempC: 2 }, { rangeKm: 310, tempC: 5 }, { rangeKm: 470, tempC: 22 }], epaRangeKm: 480 });
  assert.equal(r.status, k.NE);
});

test('two samples are not enough', () => {
  assert.equal(k.checkRange({ samples: [{ rangeKm: 470, tempC: 22 }, { rangeKm: 468, tempC: 24 }], epaRangeKm: 480 }).status, k.NE);
});

// ---------- 5 fast charge ----------
test('fast-charge ratio passes at 0.781', () => {
  const r = k.fastChargeRatio({ recentPeaksKw: [120, 118, 121, 119, 117], historyPeaksKw: [147, 148, 149, 150, 150, 151, 152, 153] });
  near(r.ratio, 0.781, 1e-3);
  assert.equal(r.baselineStable, true);
  assert.equal(k.checkFastCharge({ recentPeaksKw: [120, 118, 121, 119, 117], historyPeaksKw: [147, 148, 149, 150, 150, 151, 152, 153] }).status, k.PASS);
});

test('fast-charge ratio warns at 0.722', () => {
  const r = k.checkFastCharge({ recentPeaksKw: [110, 112, 108, 111, 109], historyPeaksKw: [147, 148, 149, 150, 150, 151, 152, 153] });
  assert.equal(r.status, k.WARN);
  assert.equal(r.value, 0.722);
});

test('fast-charge ratio fails below 0.60', () => {
  assert.equal(k.checkFastCharge({ recentPeaksKw: [90, 92, 88, 91, 89], historyPeaksKw: [147, 148, 149, 150, 150, 151, 152, 153] }).status, k.FAIL);
});

test('fast charge without recent sessions is not evaluated', () => {
  assert.equal(k.checkFastCharge({ recentPeaksKw: [], historyPeaksKw: [147, 148] }).status, k.NE);
});

test('fast charge flags an unstable baseline under 8 sessions', () => {
  const r = k.checkFastCharge({ recentPeaksKw: [140], historyPeaksKw: [150, 148, 152] });
  assert.match(r.detail, /Baseline unstable/);
  assert.equal(r.status, k.PASS);
});

// ---------- 6 interruption ----------
test('interruption rate 25% warns', () => {
  const r = k.checkInterrupt({ dcSessions: 20, abnormalDcSessions: 5 });
  assert.equal(r.status, k.WARN);
  assert.equal(r.value, 0.25);
});

test('interruption rate exactly 20% passes', () => {
  assert.equal(k.checkInterrupt({ dcSessions: 20, abnormalDcSessions: 4 }).status, k.PASS);
});

test('too few DC sessions are not evaluated', () => {
  assert.equal(k.checkInterrupt({ dcSessions: 4, abnormalDcSessions: 3 }).status, k.NE);
});

// ---------- 7 energy ----------
test('energy per 100 km applies DC efficiency', () => {
  near(k.energyPer100({ billedKwh: 48.9, distanceKm: 210, current: 'DC' }), 22.121, 1e-3);
});

test('energy per 100 km applies AC efficiency', () => {
  near(k.energyPer100({ billedKwh: 48.9, distanceKm: 210, current: 'AC' }), 20.957, 1e-3);
});

test('energy deviation 19.5% warns', () => {
  const r = k.checkEnergy({ billedKwh: 48.9, distanceKm: 210, current: 'DC', dashKwhPer100km: 18.5 });
  assert.equal(r.status, k.WARN);
  assert.equal(r.value, 0.196);
});

test('dash reading missing means not evaluated', () => {
  assert.equal(k.checkEnergy({ billedKwh: 48.9, distanceKm: 210, current: 'DC' }).status, k.NE);
});

// ---------- 8 winter ----------
test('winter 0.625 warns on NMC', () => {
  assert.equal(k.checkWinter({ winterRangeKm: 250, warmRangeKm: 400, chemistry: 'NMC' }).status, k.WARN);
});

test('winter 0.625 passes on LFP', () => {
  assert.equal(k.checkWinter({ winterRangeKm: 250, warmRangeKm: 400, chemistry: 'LFP' }).status, k.PASS);
});

test('winter without warm sample is not evaluated', () => {
  assert.equal(k.checkWinter({ winterRangeKm: 250 }).status, k.NE);
});

// ---------- 9 DC share ----------
test('heavy DC use warns', () => {
  assert.equal(k.checkDcShare({ dcCharges: 170, totalCharges: 200, annualDcCharges: 160 }).status, k.WARN);
});

test('high share with low annual count passes', () => {
  assert.equal(k.checkDcShare({ dcCharges: 170, totalCharges: 200, annualDcCharges: 120 }).status, k.PASS);
});

test('exactly 80% share passes', () => {
  assert.equal(k.checkDcShare({ dcCharges: 8, totalCharges: 10, annualDcCharges: 300 }).status, k.PASS);
});

// ---------- 10 deep discharge ----------
test('deep discharge 11% warns', () => {
  assert.equal(k.checkDeepDischarge({ deepDischargeCount: 11, totalCharges: 100 }).status, k.WARN);
});

test('deep discharge exactly 10% passes', () => {
  assert.equal(k.checkDeepDischarge({ deepDischargeCount: 10, totalCharges: 100 }).status, k.PASS);
});

// ---------- 11 aux battery ----------
test('12V battery 11.9 warns', () => {
  assert.equal(k.checkAuxBattery({ auxBatteryV: 11.9 }).status, k.WARN);
});

test('12V battery 11.5 fails', () => {
  assert.equal(k.checkAuxBattery({ auxBatteryV: 11.5 }).status, k.FAIL);
});

test('12V battery missing is not evaluated', () => {
  assert.equal(k.checkAuxBattery({}).status, k.NE);
});

// ---------- 12 connector ----------
test('connector above 60C fails', () => {
  assert.equal(k.checkConnector({ connectorTempC: 65 }).status, k.FAIL);
});

test('connector 45C passes', () => {
  assert.equal(k.checkConnector({ connectorTempC: 45 }).status, k.PASS);
});

test('connector skipped is not evaluated and never counts as pass', () => {
  assert.equal(k.checkConnector({}).status, k.NE);
});

// ---------- aggregate ----------
test('a clean car evaluates to PASS', () => {
  const r = k.evaluateVehicle(GOOD);
  assert.equal(r.overall, k.PASS);
  assert.equal(r.counts.fail, 0);
  assert.equal(r.counts.warn, 0);
  assert.equal(r.counts.pass, 12);
});

test('one fail dominates warns in the overall status', () => {
  const r = k.evaluateVehicle({ ...GOOD, auxBatteryV: 11.4 });
  assert.equal(r.overall, k.FAIL);
  assert.equal(r.counts.fail, 1);
});

test('an empty vehicle is entirely not evaluated', () => {
  const r = k.evaluateVehicle({});
  assert.equal(r.overall, k.NE);
  assert.equal(r.counts.notEvaluated, 12);
  assert.equal(r.counts.pass, 0);
});

test('missing data never inflates a pass count', () => {
  const r = k.evaluateVehicle({ ...GOOD, connectorTempC: undefined, samples: [], winterRangeKm: undefined });
  assert.equal(r.counts.notEvaluated, 3);
  assert.equal(r.counts.pass, 9);
});

test('same input produces byte-identical output', () => {
  const a = JSON.stringify(k.evaluateVehicle(GOOD));
  const b = JSON.stringify(k.evaluateVehicle(GOOD));
  assert.equal(a, b);
});

test('report carries the threshold version', () => {
  assert.equal(k.evaluateVehicle(GOOD).thresholdVersion, 'ev-1.0.0');
});

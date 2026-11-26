const test = require('node:test');
const assert = require('node:assert');
const K = require('../src/kernel');
const { buildInput, narrative, describe } = require('../src/derive');

const V = {
  id: 'v1',
  name: 'Test car',
  vin: '5YJ3E1EA7KF317000', // 10th char K => 2019
  registeredYear: 2019,
  epaRangeKm: 480,
  chemistry: 'NMC',
  warrantyEnd: '2028-01-01',
  openRecalls: 0,
  safetyRecalls: 0,
};

const CHARGES = [
  { id: 'c1', vehicleId: 'v1', date: '2026-11-10', current: 'DC', startSoc: 12, endSoc: 80, billedKwh: 48.9, distanceKm: 210, dashKwhPer100: 18.5, peakKw: 148, tempC: 20, interrupted: false },
  { id: 'c2', vehicleId: 'v1', date: '2026-11-14', current: 'DC', startSoc: 15, endSoc: 70, billedKwh: 30, distanceKm: 120, dashKwhPer100: 18.9, peakKw: 150, tempC: 18, interrupted: false },
];

const READINGS = [
  { id: 'r1', vehicleId: 'v1', date: '2026-11-01', type: 'range', value: 405, tempC: 22 },
  { id: 'r2', vehicleId: 'v1', date: '2026-11-05', type: 'range', value: 408, tempC: 24 },
  { id: 'r3', vehicleId: 'v1', date: '2026-11-09', type: 'range', value: 402, tempC: 18 },
  { id: 'r4', vehicleId: 'v2', date: '2026-11-09', type: 'range', value: 100, tempC: 18 },
];

test('buildInput drops other vehicles and keeps only within-band samples', () => {
  const input = buildInput(V, CHARGES, READINGS, '2026-11-25T00:00:00Z');
  assert.equal(input.samples.length, 3);
  assert.equal(input.dcSessions, 2);
  assert.equal(input.billedKwh, 30); // last energy sample with a distance
  assert.equal(input.epaRangeKm, 480);
});

test('golden: range index warns at 405/480', () => {
  const result = K.evaluateVehicle(buildInput(V, CHARGES, READINGS, '2026-11-25T00:00:00Z'));
  const item = result.items.find((i) => i.id === 4);
  assert.equal(item.status, K.WARN);
  // kernel rounds to 3 decimals: 405/480 = 0.84375 -> 0.844
  assert.ok(Math.abs(item.value - 0.844) < 1e-9);
});

test('golden: a cold sample never enters the range index', () => {
  const readings = [
    { id: 'a', vehicleId: 'v1', date: '2026-11-01', type: 'range', value: 300, tempC: -6 },
    { id: 'b', vehicleId: 'v1', date: '2026-11-02', type: 'range', value: 412, tempC: 21 },
    { id: 'c', vehicleId: 'v1', date: '2026-11-03', type: 'range', value: 415, tempC: 23 },
    { id: 'd', vehicleId: 'v1', date: '2026-11-04', type: 'range', value: 408, tempC: 19 },
  ];
  const input = buildInput(V, [], readings, '2026-11-25T00:00:00Z');
  assert.equal(input.samples.length, 4); // filtering by band happens in the kernel
  const result = K.evaluateVehicle(input);
  const item = result.items.find((i) => i.id === 4);
  assert.equal(item.status, K.PASS);
});

test('golden: energy deviation from the dash lands at 19.6 percent', () => {
  const input = buildInput(V, [CHARGES[0]], [], '2026-11-25T00:00:00Z');
  const result = K.evaluateVehicle(input);
  const item = result.items.find((i) => i.id === 7);
  assert.equal(item.status, K.WARN);
  assert.ok(Math.abs(item.value - 0.196) < 0.002);
});

test('an empty garage is not a pass', () => {
  const result = K.evaluateVehicle(buildInput({}, [], [], '2026-11-25T00:00:00Z'));
  assert.equal(result.overall, K.NE);
  assert.equal(result.counts.notEvaluated, 12);
  assert.equal(result.items.length, 12);
  const lines = narrative(result, { name: 'Nothing' });
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes('no verdict'));
});

test('describe never invents a percentage for VIN or recalls', () => {
  const fake = { id: 2, label: 'Open recalls', value: 3, status: 'fail' };
  assert.equal(describe(fake), '3 open recall(s)');
});

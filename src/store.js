// Local-first store. No account, no sync, no network. Everything lives in one
// AsyncStorage key so an export is a single JSON string the user can keep.
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const KEY = 'evprecheck.state.v1';
const EMPTY = { vehicles: [], charges: [], readings: [], activeVehicleId: null };

const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

async function load() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...EMPTY };
  try {
    const s = JSON.parse(raw);
    return { ...EMPTY, ...s };
  } catch (e) {
    return { ...EMPTY };
  }
}

async function save(state) {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

async function addVehicle(state, input) {
  const vehicle = {
    id: uid('veh'),
    name: (input.name || '').trim() || 'My EV',
    vin: (input.vin || '').trim().toUpperCase(),
    registeredYear: Number(input.registeredYear) || null,
    epaRangeKm: Number(input.epaRangeKm) || null,
    chemistry: input.chemistry || null,
    warrantyEnd: input.warrantyEnd || null,
    openRecalls: input.openRecalls === '' || input.openRecalls === undefined ? null : Number(input.openRecalls),
    safetyRecalls: input.safetyRecalls === '' || input.safetyRecalls === undefined ? null : Number(input.safetyRecalls),
    createdAt: new Date().toISOString(),
  };
  const next = { ...state, vehicles: [...state.vehicles, vehicle], activeVehicleId: vehicle.id };
  return save(next);
}

async function addCharge(state, input) {
  const charge = {
    id: uid('chg'),
    vehicleId: input.vehicleId,
    date: input.date || new Date().toISOString().slice(0, 10),
    startSoc: Number(input.startSoc),
    endSoc: Number(input.endSoc),
    billedKwh: Number(input.billedKwh),
    cost: Number(input.cost) || 0,
    current: input.current === 'AC' ? 'AC' : 'DC',
    distanceKm: Number(input.distanceKm) || null,
    dashKwhPer100: Number(input.dashKwhPer100) || null,
    peakKw: Number(input.peakKw) || null,
    tempC: Number(input.tempC) || null,
    interrupted: input.interrupted === true,
  };
  const next = { ...state, charges: [...state.charges, charge] };
  return save(next);
}

async function addReading(state, input) {
  const reading = {
    id: uid('rdg'),
    vehicleId: input.vehicleId,
    date: input.date || new Date().toISOString().slice(0, 10),
    type: input.type,
    value: Number(input.value),
    tempC: input.tempC === '' || input.tempC === undefined ? null : Number(input.tempC),
  };
  const next = { ...state, readings: [...state.readings, reading] };
  return save(next);
}

async function selectVehicle(state, id) {
  return save({ ...state, activeVehicleId: id });
}

async function reset() {
  await AsyncStorage.removeItem(KEY);
  return { ...EMPTY };
}

module.exports = { KEY, EMPTY, load, save, addVehicle, addCharge, addReading, selectVehicle, reset };

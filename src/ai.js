// The AI layer is a facade, not a dependency: every capability degrades to a
// deterministic local path when the native module or the model is absent.
// Nothing here sends data anywhere unless Foundation Models itself is running.
const { requireNativeModule } = require('expo-modules-core');

function native(name) {
  try {
    return requireNativeModule(name);
  } catch (e) {
    return null;
  }
}

const FM = native('AppleFM');
const SPOT = native('EVSpotlight');

const INSTRUCTIONS =
  'You are an EV inspection assistant. You never claim a battery state-of-health percentage. ' +
  'Use only the numbers given. Two short sentences, plain English, no bullet lists, no diagnosis, ' +
  'no promise that the car is safe.';

async function availability() {
  if (!FM || !FM.availability) return { available: false, reason: 'module-missing', backend: 'none' };
  try {
    return await FM.availability();
  } catch (e) {
    return { available: false, reason: 'probe-failed', backend: 'none' };
  }
}

function promptFor(result, vehicle) {
  const bad = result.items.filter((i) => i.status === 'warn' || i.status === 'fail');
  const skipped = result.items.filter((i) => i.status === 'notEvaluated');
  const rows = bad.map((i) => `${i.label}: ${i.status} (${i.value}${i.unit || ''})`).join('; ') || 'none';
  return [
    `Car: ${(vehicle && vehicle.name) || 'unnamed EV'}.`,
    `Overall: ${result.overall}.`,
    `Flagged: ${rows}.`,
    `Skipped for lack of data: ${skipped.length}.`,
    'What should the owner do next, and what should they not conclude from this?',
  ].join(' ');
}

async function explain(result, vehicle) {
  const fallback = localExplain(result, vehicle);
  if (!FM || !FM.respond) return { text: fallback, backend: 'local' };
  try {
    const r = await FM.respond(promptFor(result, vehicle), INSTRUCTIONS);
    if (r && r.ok && r.text) return { text: r.text, backend: r.backend };
    return { text: fallback, backend: 'local', error: r && r.error };
  } catch (e) {
    return { text: fallback, backend: 'local', error: String(e && e.message) };
  }
}

// Deterministic wording used offline and as the model's fallback. Kept short on
// purpose: it must never sound more certain than the numbers allow.
function localExplain(result, vehicle) {
  const name = (vehicle && vehicle.name) || 'This car';
  if (result.overall === 'notEvaluated') {
    return `${name} has no measured checks yet. Add a charge or a range reading, then run the check again.`;
  }
  const bad = result.items.filter((i) => i.status === 'warn' || i.status === 'fail');
  const un = result.items.filter((i) => i.status === 'notEvaluated').length;
  if (!bad.length) {
    return `The ${result.counts.pass} measured checks are inside range. ${un} were skipped, so this is not a full inspection and not a safety clearance.`;
  }
  const first = bad[0];
  return `${first.label}: ${first.detail || 'outside the expected range'}. Confirm it with one more measurement before booking a shop visit; ${un} checks are still unmeasured.`;
}

async function indexVehicle(vehicle, result) {
  if (!SPOT || !SPOT.indexVehicle) return false;
  try {
    return await SPOT.indexVehicle(vehicle.id, vehicle.name, result.overall, vehicle.vin || '');
  } catch (e) {
    return false;
  }
}

async function indexReport(reportId, title, subtitle) {
  if (!SPOT || !SPOT.indexReport) return false;
  try {
    return await SPOT.indexReport(reportId, title, subtitle);
  } catch (e) {
    return false;
  }
}

async function clearIndex() {
  if (!SPOT || !SPOT.clear) return false;
  try {
    return await SPOT.clear();
  } catch (e) {
    return false;
  }
}

// Widget / Control / Live Activity all read one small snapshot from the App Group.
// Writing it is best-effort: the app works whether or not the extension is installed.
async function syncWidget(vehicle, result) {
  if (!SPOT || !SPOT.setWidgetSnapshot) return false;
  const snapshot = {
    vehicleId: vehicle ? vehicle.id : '',
    name: vehicle ? vehicle.name : 'EVPrecheck',
    overall: result.overall,
    pass: result.counts.pass,
    warn: result.counts.warn,
    fail: result.counts.fail,
    notEvaluated: result.counts.notEvaluated,
    updatedAt: new Date().toISOString(),
  };
  try {
    return await SPOT.setWidgetSnapshot(JSON.stringify(snapshot));
  } catch (e) {
    return false;
  }
}

module.exports = { availability, explain, localExplain, indexVehicle, indexReport, clearIndex, syncWidget };

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Field, Btn, Pill, Label, Divider, Toggle } from '../ui';

export default function GarageScreen({ state, vehicle, result, aiStatus, onAdd, onSelect, onNav }) {
  const [open, setOpen] = useState(!vehicle);
  const [form, setForm] = useState({
    name: '', vin: '', registeredYear: '', epaRangeKm: '', chemistry: 'NMC', warrantyEnd: '',
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const counts = result ? result.counts : { pass: 0, warn: 0, fail: 0, notEvaluated: 12 };
  const headline = useMemo(() => {
    if (!result || result.overall === 'notEvaluated') return 'No verdict yet';
    if (result.overall === 'fail') return 'Stop and get it checked';
    if (result.overall === 'warn') return 'Something is drifting';
    return 'Inside range, for what was measured';
  }, [result]);

  const submit = () => {
    onAdd(form);
    setOpen(false);
    setForm({ name: '', vin: '', registeredYear: '', epaRangeKm: '', chemistry: 'NMC', warrantyEnd: '' });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
      {state.vehicles.length > 1 ? (
        <View style={styles.vehicles}>
          {state.vehicles.map((v) => (
            <Pressable key={v.id} onPress={() => onSelect(v.id)} style={[styles.chip, v.id === (vehicle && vehicle.id) && styles.chipOn]}>
              <Text style={[styles.chipText, v.id === (vehicle && vehicle.id) && { color: '#fff' }]}>{v.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {vehicle ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{vehicle.name}</Text>
              <Text style={styles.sub}>{vehicle.vin || 'No VIN on file'} · {vehicle.chemistry || '—'}</Text>
            </View>
            {result ? <Pill status={result.overall} /> : null}
          </View>

          <Text style={styles.headline}>{headline}</Text>

          <View style={styles.counts}>
            <Count n={counts.pass} t="OK" c={colors.accent} />
            <Count n={counts.warn} t="WATCH" c={colors.warn} />
            <Count n={counts.fail} t="STOP" c={colors.fail} />
            <Count n={counts.notEvaluated} t="NO DATA" c={colors.neutral} />
          </View>

          <Divider />

          <View style={styles.actions}>
            <Btn title="Run check" onPress={() => onNav('check')} />
            <Btn title="Log charge" kind="ghost" onPress={() => onNav('ledger')} />
          </View>
          <View style={styles.actions}>
            <Btn title="Report" kind="ghost" onPress={() => onNav('report')} />
            <Btn title="Add another car" kind="ghost" onPress={() => setOpen(true)} />
          </View>

          <Text style={styles.ai}>AI explanation: {aiStatus && aiStatus.available ? aiStatus.backend : 'offline wording'}</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.name}>No car yet</Text>
          <Text style={styles.sub}>Add one car to start. Nothing leaves this device.</Text>
        </Card>
      )}

      {open ? (
        <Card>
          <Label>NEW CAR</Label>
          <Field label="Name" value={form.name} onChange={set('name')} placeholder="e.g. Model 3 LR" />
          <Field label="VIN (17 characters, optional)" value={form.vin} onChange={set('vin')} placeholder="5YJ3E1EA7KF123456" />
          <Field label="Model year on registration" value={form.registeredYear} onChange={set('registeredYear')} placeholder="2019" keyboard="number-pad" />
          <Field label="EPA range (km)" value={form.epaRangeKm} onChange={set('epaRangeKm')} placeholder="480" keyboard="number-pad" />
          <Label>Battery chemistry</Label>
          <Toggle options={['NMC', 'LFP']} value={form.chemistry} onChange={set('chemistry')} />
          <Field label="Battery warranty end (YYYY-MM-DD, optional)" value={form.warrantyEnd} onChange={set('warrantyEnd')} placeholder="2030-01-01" />
          <View style={styles.actions}>
            <Btn title="Save car" onPress={submit} disabled={!form.name.trim()} />
            {state.vehicles.length ? <Btn title="Cancel" kind="ghost" onPress={() => setOpen(false)} /> : null}
          </View>
          <Text style={styles.foot}>VIN is used only to decode the model year and to look up recalls. It is never uploaded.</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Count({ n, t, c }) {
  return (
    <View style={styles.count}>
      <Text style={[styles.countN, { color: c }]}>{n}</Text>
      <Text style={styles.countT}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  vehicles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.sub },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.sub, marginTop: 2 },
  headline: { fontSize: 15, color: colors.ink, marginTop: space.md, fontWeight: '600' },
  counts: { flexDirection: 'row', marginTop: space.md },
  count: { flex: 1 },
  countN: { fontSize: 22, fontWeight: '700' },
  countT: { fontSize: 9, letterSpacing: 0.6, color: colors.sub, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  ai: { fontSize: 11, color: colors.sub, marginTop: space.sm },
  foot: { fontSize: 11, color: colors.sub, lineHeight: 16 },
});

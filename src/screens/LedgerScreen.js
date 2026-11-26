import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Field, Btn, Label, Divider, Toggle } from '../ui';

const TYPES = ['range', 'winter', 'warm', 'aux', 'connector'];

const HINT = {
  range: 'Full-charge range in km, with the outside temperature',
  winter: 'Range at or below -5 C',
  warm: 'Range at 25 C or so',
  aux: '12V resting voltage',
  connector: 'Connector temperature after charging, in C',
};

export default function LedgerScreen({ vehicle, charges, onAddCharge, onAddReading, onNav }) {
  const [c, setC] = useState({ date: today(), startSoc: '', endSoc: '', billedKwh: '', cost: '', current: 'DC', distanceKm: '', dashKwhPer100: '', peakKw: '', tempC: '', interrupted: 'No' });
  const [m, setM] = useState({ type: 'range', value: '', tempC: todayTemp() });
  const [showCharge, setShowCharge] = useState(false);
  const [showMeasure, setShowMeasure] = useState(false);

  if (!vehicle) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add a car first.</Text>
        <Btn title="Go to garage" onPress={() => onNav('garage')} />
      </View>
    );
  }

  const mine = charges.filter((x) => x.vehicleId === vehicle.id).slice().reverse();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
      <Card>
        <Text style={styles.title}>Charging ledger</Text>
        <Text style={styles.sub}>{mine.length} sessions logged · every number stays on this phone</Text>
        <View style={styles.row}>
          <Btn title="Add charge" onPress={() => setShowCharge((v) => !v)} />
          <Btn title="Add measurement" kind="ghost" onPress={() => setShowMeasure((v) => !v)} />
        </View>
      </Card>

      {showCharge ? (
        <Card>
          <Label>CHARGE SESSION</Label>
          <Field label="Date" value={c.date} onChange={(v) => setC({ ...c, date: v })} placeholder="2026-11-26" />
          <View style={styles.pair}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label="Start SOC %" value={c.startSoc} onChange={(v) => setC({ ...c, startSoc: v })} keyboard="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="End SOC %" value={c.endSoc} onChange={(v) => setC({ ...c, endSoc: v })} keyboard="number-pad" /></View>
          </View>
          <View style={styles.pair}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label="Billed kWh" value={c.billedKwh} onChange={(v) => setC({ ...c, billedKwh: v })} keyboard="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Cost" value={c.cost} onChange={(v) => setC({ ...c, cost: v })} keyboard="decimal-pad" /></View>
          </View>
          <Label>Current</Label>
          <Toggle options={['DC', 'AC']} value={c.current} onChange={(v) => setC({ ...c, current: v })} />
          <View style={styles.pair}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label="Distance since last charge, km" value={c.distanceKm} onChange={(v) => setC({ ...c, distanceKm: v })} keyboard="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Dash kWh/100km" value={c.dashKwhPer100} onChange={(v) => setC({ ...c, dashKwhPer100: v })} keyboard="decimal-pad" /></View>
          </View>
          <View style={styles.pair}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label="Peak kW (DC)" value={c.peakKw} onChange={(v) => setC({ ...c, peakKw: v })} keyboard="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Outside temp C" value={c.tempC} onChange={(v) => setC({ ...c, tempC: v })} keyboard="decimal-pad" /></View>
          </View>
          <Label>Did the session stop on its own?</Label>
          <Toggle options={['No', 'Yes']} value={c.interrupted} onChange={(v) => setC({ ...c, interrupted: v })} />
          <Btn title="Save session" onPress={() => { onAddCharge({ ...c, vehicleId: vehicle.id, interrupted: c.interrupted === 'Yes' }); setShowCharge(false); }} disabled={!c.billedKwh} />
        </Card>
      ) : null}

      {showMeasure ? (
        <Card>
          <Label>MEASUREMENT</Label>
          <Toggle options={TYPES} value={m.type} onChange={(v) => setM({ ...m, type: v })} />
          <Text style={styles.hint}>{HINT[m.type]}</Text>
          <Field label="Value" value={m.value} onChange={(v) => setM({ ...m, value: v })} keyboard="decimal-pad" />
          {m.type === 'range' ? <Field label="Outside temp C" value={m.tempC} onChange={(v) => setM({ ...m, tempC: v })} keyboard="decimal-pad" /> : null}
          <Btn title="Save measurement" onPress={() => { onAddReading({ ...m, vehicleId: vehicle.id }); setShowMeasure(false); setM({ ...m, value: '' }); }} disabled={!m.value} />
        </Card>
      ) : null}

      {mine.map((x) => (
        <View key={x.id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTop}>{x.date} · {x.current} · {x.billedKwh} kWh</Text>
            <Text style={styles.itemSub}>{x.startSoc}% → {x.endSoc}%{x.interrupted ? ' · stopped early' : ''}</Text>
          </View>
          {typeof x.peakKw === 'number' ? <Text style={styles.peak}>{x.peakKw} kW</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function todayTemp() { return ''; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyText: { color: colors.sub, marginBottom: space.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.sub, marginTop: 4 },
  row: { flexDirection: 'row', marginTop: space.md },
  pair: { flexDirection: 'row' },
  hint: { fontSize: 11, color: colors.sub, marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: space.md, borderRadius: radius.md, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  itemTop: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  itemSub: { fontSize: 12, color: colors.sub, marginTop: 2 },
  peak: { fontSize: 12, color: colors.sub },
});

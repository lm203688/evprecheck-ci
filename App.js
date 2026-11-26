import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, space } from './src/theme';
import * as store from './src/store';
import * as ai from './src/ai';
import K from './src/kernel';
import { buildInput } from './src/derive';
import GarageScreen from './src/screens/GarageScreen';
import CheckScreen from './src/screens/CheckScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import ReportScreen from './src/screens/ReportScreen';

const TABS = [
  { key: 'garage', label: 'Garage' },
  { key: 'check', label: 'Check' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'report', label: 'Report' },
];

export default function App() {
  const [state, setState] = useState(store.EMPTY);
  const [tab, setTab] = useState('garage');
  const [aiStatus, setAiStatus] = useState(null);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    store.load().then(setState);
    ai.availability().then(setAiStatus);
  }, []);

  const vehicle = useMemo(() => {
    const v = state.vehicles.find((x) => x.id === state.activeVehicleId) || state.vehicles[0];
    return v || null;
  }, [state]);

  const result = useMemo(() => {
    if (!vehicle) return null;
    return K.evaluateVehicle(buildInput(vehicle, state.charges, state.readings));
  }, [vehicle, state.charges, state.readings]);

  // Platform surfaces follow the data: widget snapshot and Spotlight both refresh
  // on every new verdict, and both fail silently when the native side is absent.
  useEffect(() => {
    if (!vehicle || !result) return;
    ai.syncWidget(vehicle, result);
    ai.indexVehicle(vehicle, result);
  }, [vehicle, result]);

  const addVehicle = async (form) => {
    const next = await store.addVehicle(state, form);
    setState(next);
    setAiText('');
    setTab('garage');
  };

  const addCharge = async (form) => {
    setState(await store.addCharge(state, form));
    setAiText('');
  };

  const addReading = async (form) => {
    setState(await store.addReading(state, form));
    setAiText('');
  };

  const selectVehicle = async (id) => {
    setState(await store.selectVehicle(state, id));
  };

  const ask = async () => {
    if (!vehicle || !result) return;
    const r = await ai.explain(result, vehicle);
    setAiText(r.text);
  };

  const common = { vehicle, result, aiStatus, onNav: setTab };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.brand}>EVPrecheck</Text>
          <Text style={styles.tag}>no dongle, no account</Text>
        </View>

        <View style={{ flex: 1 }}>
          {tab === 'garage' ? (
            <GarageScreen {...common} state={state} onAdd={addVehicle} onSelect={selectVehicle} />
          ) : null}
          {tab === 'check' ? <CheckScreen {...common} aiText={aiText} onAsk={ask} /> : null}
          {tab === 'ledger' ? (
            <LedgerScreen {...common} charges={state.charges} onAddCharge={addCharge} onAddReading={addReading} />
          ) : null}
          {tab === 'report' ? <ReportScreen {...common} /> : null}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
                <Text style={[styles.tabText, on && styles.tabOn]}>{t.label}</Text>
                {on ? <View style={styles.tabMark} /> : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  brand: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2, color: colors.ink, textTransform: 'uppercase' },
  tag: { fontSize: 10, color: colors.sub, letterSpacing: 0.4 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.sub },
  tabOn: { color: colors.accent },
  tabMark: { width: 16, height: 2, backgroundColor: colors.accent, marginTop: 6, borderRadius: 1 },
});

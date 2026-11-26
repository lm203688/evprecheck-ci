import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share, Linking, Pressable } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Btn, Pill, statusColor } from '../ui';
import { narrative } from '../derive';
import * as fb from '../feedback';

const CHIPS = [
  { k: 'missed', t: 'Missed a real issue' },
  { k: 'false', t: 'False alarm' },
  { k: 'unclear', t: 'Wording was unclear' },
];

export default function ReportScreen({ vehicle, result, onNav }) {
  const [kind, setKind] = useState(null);
  const [saved, setSaved] = useState(false);

  if (!vehicle || !result) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing to report yet.</Text>
        <Btn title="Go to garage" onPress={() => onNav('garage')} />
      </View>
    );
  }

  const lines = narrative(result, vehicle);
  const body = [
    `EVPrecheck report — ${vehicle.name}`,
    `VIN: ${vehicle.vin || 'not provided'}`,
    `Overall: ${result.overall}`,
    '',
    ...result.items.map((i) => `${i.id}. ${i.label}: ${i.status}${i.value !== null ? ` (${i.value}${i.unit || ''})` : ''}`),
    '',
    ...lines,
    '',
    `Thresholds ${result.thresholdVersion}. Not a substitute for a manufacturer diagnostic tool.`,
  ].join('\n');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
      <Card>
        <View style={styles.head}>
          <Text style={styles.title}>{vehicle.name}</Text>
          <Pill status={result.overall} />
        </View>
        <Text style={styles.meta}>{new Date().toISOString().slice(0, 10)} · table {result.thresholdVersion}</Text>
      </Card>

      {lines.map((l, idx) => (
        <Text key={idx} style={styles.line}>{l}</Text>
      ))}

      <Card style={{ marginTop: space.lg }}>
        {result.items.map((i) => (
          <View key={i.id} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: statusColor(i.status) }]} />
            <Text style={styles.itemLabel}>{i.label}</Text>
            <Text style={styles.itemValue}>{i.value !== null ? `${i.value}${i.unit || ''}` : '—'}</Text>
          </View>
        ))}
      </Card>

      <Btn title="Share report" onPress={() => Share.share({ message: body })} />

      <Card style={{ marginTop: space.lg }}>
        <Text style={styles.fbTitle}>Did this miss something?</Text>
        <Text style={styles.fbSub}>One tap. Stored on this phone first, nothing uploaded.</Text>
        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <Pressable
              key={c.k}
              onPress={() => {
                setKind(c.k);
                setSaved(false);
              }}
              style={[styles.chip, kind === c.k && styles.chipOn]}
            >
              <Text style={[styles.chipText, kind === c.k && { color: '#fff' }]}>{c.t}</Text>
            </Pressable>
          ))}
        </View>
        {kind ? (
          <Btn
            title={saved ? 'Saved — send a copy' : 'Save this'}
            kind="ghost"
            onPress={async () => {
              const entry = await fb.log(kind, '', {
                vehicle: vehicle.name,
                overall: result.overall,
                counts: result.counts,
                threshold: result.thresholdVersion,
              });
              setSaved(true);
              Share.share({
                message: `EVPrecheck feedback (${entry.kind}) — ${vehicle.name}, ${result.overall}, ${JSON.stringify(result.counts)}`,
              });
            }}
          />
        ) : null}
      </Card>
      <Text style={styles.disclaimer}>
        This is a checklist and an observation log, not a diagnosis. It cannot read the battery management system.
        Any safety-related finding belongs with a qualified workshop.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyText: { color: colors.sub, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 11, color: colors.sub, marginTop: 4 },
  line: { fontSize: 14, lineHeight: 21, color: colors.ink, marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  itemLabel: { flex: 1, fontSize: 13, color: colors.ink },
  itemValue: { fontSize: 12, color: colors.sub },
  disclaimer: { fontSize: 11, lineHeight: 16, color: colors.sub, marginTop: space.md },
  fbTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  fbSub: { fontSize: 11, color: colors.sub, marginTop: 2, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 11, color: colors.ink },
});

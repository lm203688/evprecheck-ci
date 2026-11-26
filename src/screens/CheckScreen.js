import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Btn, Pill, statusColor, Divider } from '../ui';

const WHY = {
  1: 'The 10th VIN character encodes the model year for 2010-2039. A mismatch is not proof of fraud, but the papers need checking before money changes hands.',
  2: 'Recall status comes from NHTSA by make, model and year. A lookup that failed is not a pass — it is unknown.',
  3: 'Twelve months is the line where an out-of-warranty battery becomes the buyer\u2019s problem rather than the manufacturer\u2019s.',
  4: 'Range is measured against the EPA figure for this car, and only compared between 15 and 30 C samples. Cold readings are excluded rather than extrapolated.',
  5: 'Peak DC power is compared with the car\u2019s own 90th percentile, never with other cars. A drop usually means the pack is throttling itself.',
  6: 'A session that stops and restarts, or jumps more than 5% SOC, is counted as abnormal. Fewer than five DC sessions is not enough to judge.',
  7: 'Energy from the bill minus charging losses is compared with what the dash claims. A large gap means the dash is optimistic or energy is going somewhere.',
  8: 'Winter range is compared with the same car in warm weather, not with a formula. Below 65% (60% for LFP) is worth watching.',
  9: 'Above 80% DC with more than 150 sessions a year is a usage pattern that ages a pack faster. It is a habit note, not a failure.',
  10: 'Charges that start under 10% SOC stress the pack. Above 10% of sessions is a pattern, not a defect.',
  11: 'A 12V battery resting under 12.0 V is on its way out; under 11.6 V it can strand an EV that otherwise looks fine.',
  12: 'A connector above 60 C after charging is a safety issue, not a performance one. This check is optional and never counted as a pass if skipped.',
};

export default function CheckScreen({ vehicle, result, aiText, onAsk, onNav }) {
  const [openId, setOpenId] = useState(null);
  if (!vehicle || !result) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add a car first.</Text>
        <Btn title="Go to garage" onPress={() => onNav('garage')} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
      <Card>
        <Text style={styles.title}>{vehicle.name}</Text>
        <Text style={styles.summary}>
          {result.counts.pass} OK · {result.counts.warn} watch · {result.counts.fail} stop · {result.counts.notEvaluated} no data
        </Text>
        <View style={styles.actRow}>
          <Btn title="Ask AI" onPress={onAsk} />
          <Btn title="Report" kind="ghost" onPress={() => onNav('report')} />
        </View>
        {aiText ? <Text style={styles.ai}>{aiText}</Text> : null}
      </Card>

      {result.items.map((it) => {
        const open = openId === it.id;
        return (
          <Pressable key={it.id} onPress={() => setOpenId(open ? null : it.id)} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: statusColor(it.status) }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.rowTop}>
                <Text style={styles.label}>{it.id}. {it.label}</Text>
                <Pill status={it.status} />
              </View>
              {it.value !== null ? (
                <Text style={styles.value}>{it.value}{it.unit ? ` ${it.unit}` : ''}</Text>
              ) : (
                <Text style={styles.value}>not measured</Text>
              )}
              {open ? (
                <View style={styles.detail}>
                  <Text style={styles.detailText}>{WHY[it.id]}</Text>
                  {it.detail ? <Text style={styles.detailMeta}>{it.detail}</Text> : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <Text style={styles.foot}>Threshold table {result.thresholdVersion}. A skipped check is never a pass.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyText: { color: colors.sub, marginBottom: space.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  summary: { fontSize: 13, color: colors.sub, marginTop: 4 },
  actRow: { flexDirection: 'row', marginTop: space.md },
  ai: { marginTop: space.sm, fontSize: 13, lineHeight: 19, color: colors.ink },
  row: { flexDirection: 'row', backgroundColor: colors.card, padding: space.md, borderRadius: radius.md, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1, paddingRight: 8 },
  value: { fontSize: 12, color: colors.sub, marginTop: 3 },
  detail: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  detailText: { fontSize: 12, lineHeight: 18, color: colors.ink },
  detailMeta: { fontSize: 11, color: colors.sub, marginTop: 6 },
  foot: { fontSize: 11, color: colors.sub, textAlign: 'center', marginTop: space.md },
});

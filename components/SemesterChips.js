// components/SemesterChips.js
// "All / Semester 1 / Semester 2" filter row. Shown only when the catalog has more than one Semester.
// value: null (All) or a Semester number. Display + selection only; the filtering itself is semesterMatches() in ItemModel.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/Theme';

export default function SemesterChips({ list, value, onChange }) {
  if (!list || list.length < 2) return null;
  const options = [{ key: 'all', val: null, label: 'All' }, ...list.map(n => ({ key: String(n), val: n, label: `Semester ${n}` }))];
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="book-open-page-variant-outline" size={16} color={Colors.primary} />
      {options.map(o => {
        const on = value === o.val;
        return (
          <TouchableOpacity key={o.key} style={[styles.chip, on && styles.chipOn]} onPress={() => onChange(o.val)} activeOpacity={0.8}>
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs + 2, marginBottom: Spacing.sm },
  chip:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 1, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  text:   { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  textOn: { color: Colors.primaryText },
});
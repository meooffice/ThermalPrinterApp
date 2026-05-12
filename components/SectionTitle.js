// components/SectionTitle.js
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Theme';

export default function SectionTitle({ children, style }) {
  return (
    <Text style={[styles.title, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize:      13,
    fontWeight:    '700',
    color:         Colors.textSecondary,
    marginTop:     16,
    marginBottom:  8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
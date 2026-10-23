// components/Card.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Shadow } from '../constants/Theme';

export default function Card({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius:    Radius.lg,
    padding:         14,
    marginBottom:    8,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    ...Shadow.card,
  },
});
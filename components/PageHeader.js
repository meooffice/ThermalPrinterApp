// components/PageHeader.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '../constants/Theme';

export default function PageHeader({ title, subtitle, icon }) {
  return (
    <View style={styles.header}>
      <View>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {icon ? (
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   Spacing.xxl,
  },
  subtitle: {
    fontSize:     12,
    color:        Colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize:   28,
    fontWeight: '800',
    color:      Colors.primaryDark,
  },
  iconWrap: {
    width:           52,
    height:          52,
    backgroundColor: Colors.primaryLight,
    borderRadius:    Radius.lg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  icon: {
    fontSize: 26,
  },
});
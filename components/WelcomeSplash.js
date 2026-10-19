// components/WelcomeSplash.js
// Welcome overlay shown once when the app opens, on top of the app (which loads behind it).
// Plain React Native Animated only (no new package). Tap to skip. Calls onDone() when finished.
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, TouchableWithoutFeedback, StyleSheet, Easing } from 'react-native';
import { Colors, Spacing } from '../constants/Theme';
import { APP_VERSION, APP_CREDITS } from '../constants/AppInfo';

const SHOW_MS = 2400;   // how long the welcome stays
const FADE_MS = 450;    // fade-out

export default function WelcomeSplash({ onDone }) {
  const rise   = useRef(new Animated.Value(0)).current;   // 0 -> 1 content comes in
  const fade   = useRef(new Animated.Value(1)).current;   // 1 -> 0 whole overlay leaves
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true })
      .start(() => onDone && onDone());
  };

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const t = setTimeout(finish, SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lift  = rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <TouchableWithoutFeedback onPress={finish}>
      <Animated.View style={[styles.root, { opacity: fade }]}>
        {/* soft decorative circles */}
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />

        <Animated.View style={[styles.center, { opacity: rise, transform: [{ translateY: lift }] }]}>
          <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
            <Image source={require('../assets/srkvm.png')} style={styles.logo} resizeMode="contain" />
          </Animated.View>
          <Text style={styles.welcome}>స్వాగతం · Welcome</Text>
          <Text style={styles.title}>SRKVM</Text>
          <Text style={styles.subtitle}>Kit Distribution System</Text>
          <View style={styles.line} />
          <Text style={styles.tagline}>Every kit · Every child · Every school</Text>
          <Text style={styles.version}>{`Version ${APP_VERSION}`}</Text>
        </Animated.View>

        <Animated.Text style={[styles.credits, { opacity: rise }]}>{APP_CREDITS}</Animated.Text>

        <Animated.Text style={[styles.hint, { opacity: rise }]}>Tap to continue</Animated.Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root:   { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 999 },
  center: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  blob:   { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  blobA:  { width: 320, height: 320, top: -90, right: -110 },
  blobB:  { width: 240, height: 240, bottom: -70, left: -80 },
  badge:  { width: 156, height: 156, borderRadius: 78, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl, elevation: 6 },
  logo:   { width: 148, height: 148, borderRadius: 74 },
  welcome:  { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '600', letterSpacing: 0.5 },
  title:    { fontSize: 44, color: '#fff', fontWeight: '800', letterSpacing: 6, marginTop: Spacing.xs },
  subtitle: { fontSize: 17, color: '#fff', fontWeight: '600', marginTop: 2 },
  line:     { width: 56, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)', marginVertical: Spacing.lg },
  tagline:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.4 },
  version:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 0.6, marginTop: Spacing.md },
  credits:  { position: 'absolute', bottom: 78, fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3, textAlign: 'center', paddingHorizontal: Spacing.xl },
  hint:     { position: 'absolute', bottom: 48, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
});
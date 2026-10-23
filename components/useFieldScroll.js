// components/useFieldScroll.js
// When a TextInput inside a ScrollView (typically in a bottom-sheet Modal) gets focus, scroll it to the top of the
// visible area so the Android keyboard never covers it. Works for any nesting depth (uses UIManager.measureLayout).
//
// Usage:
//   const fs = useFieldScroll();
//   <ScrollView ref={fs.ref} contentContainerStyle={[styles.x, fs.padStyle]} ...>
//     <TextInput onFocus={fs.onFocus} ... />
import { useRef, useState, useEffect, useCallback } from 'react';
import { Keyboard, UIManager, findNodeHandle } from 'react-native';

const TOP_GAP = 24;   // space left above the focused field

export default function useFieldScroll() {
  const ref     = useRef(null);
  const kbShown = useRef(false);
  const pending = useRef(null);            // focused input's native tag waiting for the keyboard
  const [kbH, setKbH] = useState(0);

  const scrollTo = useCallback((target) => {
    const sv = ref.current;
    if (!sv || !target) return;
    const inner = sv.getInnerViewNode ? sv.getInnerViewNode() : null;
    if (!inner) return;
    try {
      UIManager.measureLayout(target, inner, () => {}, (_x, y) => {
        sv.scrollTo({ y: Math.max(0, y - TOP_GAP), animated: true });
      });
    } catch { /* never crash because of scrolling */ }
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbShown.current = true;
      setKbH((e && e.endCoordinates && e.endCoordinates.height) || 300);
      const t = pending.current;
      if (t) setTimeout(() => { if (pending.current === t) { scrollTo(t); } }, 120); // after the extra padding is laid out
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      kbShown.current = false;
      pending.current = null;
      setKbH(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [scrollTo]);

  const onFocus = useCallback((e) => {
    const t = e && e.nativeEvent ? e.nativeEvent.target : null;
    pending.current = t;
    if (kbShown.current && t) setTimeout(() => scrollTo(t), 60);   // moving between fields: keyboard already open
  }, [scrollTo]);

  return { ref, onFocus, padStyle: { paddingBottom: kbH }, kbH };
}
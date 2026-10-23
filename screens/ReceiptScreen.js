// screens/ReceiptScreen.js
//
// Receipt flow: school -> roll popup -> items -> print / PDF / System print.
// The ESC/POS receipt (logo + header) is built in services/ReceiptPrinter.js.
//
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BluetoothService from '../services/BluetoothService';
import { buildReceiptBase64, buildReceiptPreview, loadLogo } from '../services/ReceiptPrinter';
import ReceiptHistory   from '../services/ReceiptHistory';
import SettingsService  from '../services/SettingsService';
import SchoolService    from '../services/SchoolService';
import CatalogService   from '../services/CatalogService';
import ItemTypeService  from '../services/ItemTypeService';
import ShareService     from '../services/ShareService';
import InvoiceSerial    from '../services/InvoiceSerial';
import { isValidAcademicYear } from '../services/AcademicYear';
import LedgerService from '../services/LedgerService';
import { requiredForSchool, rollConflicts } from '../services/RequirementModel';
import { rollSummary, classRange, buildSchoolData } from '../services/SchoolModel';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import useFieldScroll from '../components/useFieldScroll';
import { Card, Stepper } from '../components/ui';
import Hero from '../components/Hero';

// ─── Constants ───────────────────────────────────────────────────────────────
// MaterialCommunityIcons names (display only)
const CAT_ICONS  = {
  'Prime Textbook': 'book-open-page-variant-outline',
  'HS Text Books':  'book-multiple-outline',
  'Notebooks':      'notebook-outline',
  'Kits':           'bag-personal-outline',
  'Boys Shoes':     'shoe-sneaker',
  'Girls Shoes':    'shoe-heel',
  'Shoes':          'shoe-sneaker',
  'Others':         'shape-outline',
};

// Section heading: icon + uppercase label
const SectionHead = ({ icon, children }) => (
  <View style={styles.sectionRow}>
    <MaterialCommunityIcons name={icon} size={16} color={Colors.primary} />
    <Text style={styles.sectionTitle}>{children}</Text>
  </View>
);

// Icon + text on one row (text can wrap)
// Outer margins of the given text style are moved to the row, so icon and text stay centred together
const IconText = ({ icon, size = 16, color = Colors.primary, style, children }) => {
  const { margin, marginTop, marginBottom, marginVertical, ...textStyle } = StyleSheet.flatten(style) || {};
  return (
    <View style={[styles.iconTextRow, { margin, marginTop, marginBottom, marginVertical }]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
      <Text style={[textStyle, styles.iconTextFlex]}>{children}</Text>
    </View>
  );
};

// Semester of a catalog item as a number (1, 2 ...), or null when the item has none (Kits, Notebooks, Shoes ...)
const semOf = (it) => {
  const n = parseInt(it && it.semester, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Receipt filter by Item Type (Prime Textbook, HS Text Books, Kits, Shoes, Notebooks, Others ...): only the chosen types are shown
const catOf = (it) => (it && it.category) || 'Others';

// ─── Component // ─── Component // ─── Component ───────────────────────────────────────────────────────────────
export default function ReceiptScreen({ navigation }) {
  const fsRoll = useFieldScroll(); // keyboard auto-scroll of the focused field
  const fsSize = useFieldScroll(); // keyboard auto-scroll of the focused field
  const insets = useSafeAreaInsets();
  const sheetPad = { paddingBottom: Spacing.xl + insets.bottom };   // keep bottom sheet buttons above the Android nav bar
  const [settings, setSettings]             = useState(null);
  const [schools, setSchools]               = useState([]);
  const [catalog, setCatalog]               = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [spellNumber, setSpellNumber]       = useState(1);
  const [items, setItems]                   = useState([]);
  const [printing, setPrinting]             = useState(false);
  const printLockRef                        = useRef(false);   // double-tap guard
  const [schoolModal, setSchoolModal]       = useState(false);
  const [copiesModal, setCopiesModal]       = useState(false);
  const [copies, setCopies]                 = useState(1);
  const [pendingPrint, setPendingPrint]     = useState(null);
  const [previewModal, setPreviewModal]     = useState(false);   // receipt preview (nothing printed)
  const [schoolSearch, setSchoolSearch]     = useState('');
  const [collapsedCats, setCollapsedCats]   = useState({});
  const [types, setTypes]                   = useState([]);
  const [plan, setPlan]                     = useState({});      // { itemId: { required, given } } for the selected school
  const [hasRoll, setHasRoll]               = useState(false);   // selected school has a roll entered
  const [showAll, setShowAll]               = useState(false);   // also show items that do not apply to this school
  const [loadingSchool, setLoadingSchool]   = useState(false);
  const [rollPopup, setRollPopup]           = useState(false);   // roll shown after choosing a school
  const [rollEdit, setRollEdit]             = useState(false);   // roll being edited in that popup
  const [rollForm, setRollForm]             = useState({});      // { [class]: { b, g } } strings
  const [rollSaving, setRollSaving]         = useState(false);
  const [rollConfirmed, setRollConfirmed]   = useState(false);   // items are shown only after Proceed / Update
  const [sizeModal, setSizeModal]           = useState(null);    // id of the sized item (e.g. Shoes) whose size popup is open
  const [sizeDraft, setSizeDraft]           = useState({});      // { size: '3' } being edited in that popup
  const [sizeInfo, setSizeInfo]             = useState({ avail: {}, givenBy: {} });   // stock left per item+size / this school's given per item+size

  const [semester, setSemester]           = useState(null);    // Semester chosen for this receipt (null = not chosen yet / not needed)
  const [semModal, setSemModal]             = useState(false);   // "which Semester?" popup
  const [kinds, setKinds]                 = useState(null);    // chosen Item Type names for this receipt (null = not chosen / no filter)
  const [kindModal, setKindModal]           = useState(false);   // "which Item Types?" popup
  const [kindDraft, setKindDraft]           = useState([]);      // selection being edited in that popup
  const semMap = {};                                              // itemId -> Semester number (or null)
  catalog.forEach(c => { semMap[c.id] = semOf(c); });
  const semList = [...new Set(catalog.map(semOf).filter(n => n !== null))].sort((a, b) => a - b);
  const kindsPresent = [...new Set(catalog.map(catOf))].sort((a, b) => {   // Item Types that have items, in the Item Types order
    const ia = types.indexOf(a), ib = types.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  // Does any of the given Item Types have Semester books? (then the Semester is asked)
  const needsSem = (sel) => semList.length > 1 && catalog.some(c => (sel === null || sel.includes(catOf(c))) && semOf(c) !== null);

  useFocusEffect(useCallback(() => {
    loadData();
    loadLogo(); // pre-warm logo cache
  }, []));

  const loadData = async () => {
    const s  = await SettingsService.get();
    const sc = await SchoolService.getAll();
    const c  = await CatalogService.getAll();
    setSettings(s);
    setSchools(sc);
    setCatalog(c);
    setTypes(await ItemTypeService.getAll());
  };

  const toggleCategory = (cat) =>
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  // opts.silent = refresh only (after print / roll update): keep the current view, no roll popup
  const selectSchool = async (school, opts = {}) => {
    setSelectedSchool(school);
    setSchoolModal(false);
    setSchoolSearch('');
    setLoadingSchool(true);
    if (!opts.silent) { setShowAll(false); setRollConfirmed(false); setRollEdit(false); setSemester(null); setKinds(null); }
    // Semester in force for this checklist: given by chooseSemester, kept on a silent refresh, none for a new school
    const activeSem = opts.semester !== undefined ? opts.semester : (opts.silent ? semester : null);
    const activeKinds = opts.kinds !== undefined ? opts.kinds : (opts.silent ? kinds : null);   // same idea for Textbooks / Kits / Shoes

    const rolled = rollSummary(school).total > 0;
    let given = {}, receiptCount = null, avail = null, givenBySize = {}, availBySize = {};
    try {
      const ay = settings?.academicYear;
      if (isValidAcademicYear(ay)) {
        const sum = await LedgerService.schoolSummary(ay, school.id);
        given = sum.given; receiptCount = sum.receiptCount; givenBySize = sum.givenBySize || {};
        avail = await LedgerService.availableByItem(ay);   // stock left per item
        availBySize = await LedgerService.availableBySize(ay);   // stock left per item + size (sized items only)
      }
    } catch (e) {
      Alert.alert('Ledger చదవలేకపోయాను', `${e.message}\nSpell / ఇచ్చినవి లెక్క చూపలేను. Spell ను చేతితో సరిచూడండి.`);
    }

    const savedCounts = {};
    if (!rolled && school.items?.length > 0) {
      school.items.forEach(i => { savedCounts[i.id] = i.count || '0'; });   // old behaviour (no roll)
    }
    const nextPlan = {};
    const checklist = catalog.map(catItem => {
      const required  = rolled ? requiredForSchool(catItem, school) : 0;
      const givenQty  = Math.max(0, given[catItem.id] || 0);
      const remaining = Math.max(0, required - givenQty);
      const stockLeft = avail ? Math.max(0, avail[catItem.id] || 0) : null;   // null = unknown
      nextPlan[catItem.id] = { required, given: givenQty, stock: stockLeft };
      const hasStock = stockLeft === null || stockLeft > 0;
      const sized = Array.isArray(catItem.sizes) && catItem.sizes.length > 0;   // e.g. Shoes: given size-wise through a popup
      const cs = semOf(catItem);
      const kindHidden = activeKinds !== null && !activeKinds.includes(catOf(catItem));   // Item Type not chosen: not in this receipt
      const semHidden = kindHidden || (activeSem !== null && cs !== null && cs !== activeSem);   // other Semester's book / unchosen kind: not in this receipt
      return {
        id:       catItem.id,
        name:     catItem.name,
        category: catItem.category || 'Others',
        subType:  catItem.subType || 'Common',
        checked:  !semHidden && !sized && hasStock && (rolled ? remaining > 0 : savedCounts[catItem.id] !== undefined),
        count:    (sized || semHidden) ? '0'
                : rolled ? String(stockLeft === null ? remaining : Math.min(remaining, stockLeft))
                         : (hasStock ? (savedCounts[catItem.id] || '0') : '0'),
        sizeList:   sized ? catItem.sizes : [],
        sizeCounts: {},
      };
    });
    setHasRoll(rolled);
    setSizeInfo({ avail: availBySize, givenBy: givenBySize });
    setPlan(nextPlan);
    setItems(checklist);
    if (receiptCount !== null) setSpellNumber(receiptCount + 1);
    if (!opts.silent) setRollPopup(true);
    // Categories with ticked items open by default; the rest stay collapsed (tap a header to open / close)
    const initCollapsed = {};
    [...types, ...checklist.map(i => i.category)].forEach(c => {
      initCollapsed[c] = !checklist.some(i => i.category === c && i.checked);
    });
    if (!opts.silent || opts.semester !== undefined) setCollapsedCats(initCollapsed);
    setLoadingSchool(false);
  };

  // With a roll: only items that apply to this school (or already given / selected) unless "show all" is on
  // Items of the other Semester are never shown (items without a Semester always are)
  const semOk = (i) => semester === null || semMap[i.id] == null || semMap[i.id] === semester;
  const kindOk = (i) => kinds === null || kinds.includes(catOf(i));
  const isVisible = (i) =>
    semOk(i) && kindOk(i) && (!hasRoll || showAll || i.checked || (plan[i.id]?.required || 0) > 0 || (plan[i.id]?.given || 0) > 0);

  // ── Roll popup (shown after choosing a school) ───────────────────────────
  const proceedWithRoll = (school = selectedSchool) => {   // school: pass the just-saved school (state may not be updated yet)
    setRollPopup(false);
    setRollEdit(false);
    // Which kinds of items (Textbooks / Kits / Shoes) does this receipt have? Asked first when the catalog has more than one kind
    if (kindsPresent.length > 1 && kinds === null) {
      // pre-tick the Item Types that apply to this school (roll classes); no roll or nothing applies = all
      const applies = (cat) => catalog.some(c => catOf(c) === cat && requiredForSchool(c, school) > 0);
      const pre = school && rollSummary(school).total > 0 ? kindsPresent.filter(applies) : kindsPresent;
      setKindDraft(pre.length > 0 ? pre : kindsPresent);
      setKindModal(true);
      return;
    }
    // Books of Semester 1 and 2 are never mixed in one receipt: ask which one first (only when the chosen Item Types have Semester books)
    if (semester === null && needsSem(kinds)) { setSemModal(true); return; }
    setRollConfirmed(true);
  };

  // Applies the chosen Item Types: rebuilds the checklist (unchosen types are left out); asks the Semester if needed
  const applyKinds = async (sel) => {
    setKindModal(false);
    setKinds(sel);
    if (semester === null && needsSem(sel)) { setRollConfirmed(false); setSemModal(true); return; }
    try {
      await selectSchool(selectedSchool, { silent: true, kinds: sel });
      setRollConfirmed(true);
    } catch (e) {
      Alert.alert('Items', e.message);
    }
  };

  const confirmKinds = () => {
    const sel = kindsPresent.filter(k => kindDraft.includes(k));
    if (sel.length === 0) return;
    const same = kinds !== null && sel.length === kinds.length && sel.every(k => kinds.includes(k));
    if (same) { setKindModal(false); return; }
    if (kinds !== null && checkedItems.length > 0) {
      Alert.alert('Items మారుస్తారా?', `ఇప్పుడు tick చేసిన ${checkedItems.length} items తొలగిపోతాయి.`, [
        { text: 'వెనక్కి', style: 'cancel' },
        { text: 'మార్చు', onPress: () => applyKinds(sel) },
      ]);
      return;
    }
    applyKinds(sel);
  };

  // Rebuilds the checklist for the chosen Semester (the other Semester's books are left out), then shows the items
  const chooseSemester = async (n) => {
    setSemModal(false);
    setSemester(n);
    try {
      await selectSchool(selectedSchool, { silent: true, semester: n, kinds });
      setRollConfirmed(true);
    } catch (e) {
      Alert.alert('Semester', e.message);
    }
  };

  const pickSemester = (n) => {
    if (n === semester) { setSemModal(false); return; }
    if (semester !== null && checkedItems.length > 0) {
      Alert.alert('Semester మారుస్తారా?', `ఇప్పుడు tick చేసిన ${checkedItems.length} items తొలగిపోతాయి.`, [
        { text: 'వెనక్కి', style: 'cancel' },
        { text: 'మార్చు', onPress: () => chooseSemester(n) },
      ]);
      return;
    }
    chooseSemester(n);
  };

  const startRollEdit = () => {
    const f = {};
    classRange(selectedSchool.minClass, selectedSchool.maxClass).forEach(c => {
      const r = selectedSchool.roll?.[c] || {};
      f[c] = { b: String(r.b ?? 0), g: String(r.g ?? 0) };
    });
    setRollForm(f);
    setRollEdit(true);
  };

  const setRollField = (c, key, v) =>
    setRollForm(prev => ({ ...prev, [c]: { ...(prev[c] || {}), [key]: v.replace(/[^0-9]/g, '') } }));

  const saveRollAndProceed = async () => {
    const built = buildSchoolData({
      name: selectedSchool.name, udise: selectedSchool.udise, address: selectedSchool.address,
      type: selectedSchool.type, minClass: selectedSchool.minClass, maxClass: selectedSchool.maxClass,
      roll: rollForm,
    }, schools, selectedSchool.id);
    if (built.error) { Alert.alert('Roll', built.error); return; }

    const doSave = async () => {
      try {
        setRollSaving(true);
        await SchoolService.update(selectedSchool.id, { roll: built.data.roll });
        setSchools(await SchoolService.getAll());
        const updated = { ...selectedSchool, roll: built.data.roll };
        await selectSchool(updated, { silent: true });
        proceedWithRoll(updated);
      } catch (e) {
        Alert.alert('Save కాలేదు', e.message);
      } finally {
        setRollSaving(false);
      }
    };

    const givenMap = {};
    Object.keys(plan).forEach(id => { givenMap[id] = plan[id].given; });
    const conflicts = rollConflicts(catalog, built.data, givenMap);
    if (conflicts.length > 0) {
      const lines = conflicts.slice(0, 8)
        .map(c => `• ${c.name}: ఇచ్చినవి ${c.given}, కొత్త roll ప్రకారం అవసరం ${c.required}`).join('\n');
      Alert.alert('Roll తగ్గింది', `${lines}\n\nఇప్పటికే ఇచ్చినవి కొత్త roll కంటే ఎక్కువ. అయినా save చేయాలా?`, [
        { text: 'వెనక్కి', style: 'cancel' },
        { text: 'Save చేయి', onPress: doSave },
      ]);
      return;
    }
    await doSave();
  };

  const toggleItem  = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  // A leading '-' means Return (e.g. -3 = 3 taken back)
  const updateCount = (id, v) => {
    const clean = v.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
    setItems(prev => prev.map(i => i.id === id ? { ...i, count: clean } : i));
  };
  // Sized items (e.g. Shoes): count = total of the sizes entered in the popup, and the line carries sizes: { size: n }
  const withSizes = (i) => {
    if (!i.sizeList || i.sizeList.length === 0) return i;
    const map = {};
    let sum = 0;
    Object.keys(i.sizeCounts || {}).forEach(s => {
      const n = parseInt(i.sizeCounts[s], 10);
      if (!isNaN(n) && n !== 0) { map[s] = n; sum += n; }
    });
    return { ...i, count: String(sum), sizes: map };
  };
  const checkedItems = items.filter(i => i.checked).map(withSizes);

  // ── Size popup (items with sizes) ─────────────────────────────────────────
  const isSized = (i) => !!(i.sizeList && i.sizeList.length > 0);
  const openSizes = (item) => {
    const d = {};
    Object.keys(item.sizeCounts || {}).forEach(s => { d[s] = String(item.sizeCounts[s]); });
    setSizeDraft(d);
    setSizeModal(item.id);
  };
  const sizeAvail  = (id, s) => (sizeInfo.avail[id] ? (sizeInfo.avail[id][s] || 0) : null);   // null = stock not entered size-wise
  const sizeReturn = (id, s) => ((sizeInfo.givenBy[id] || {})[s] || 0);                        // most that can be taken back
  const setDraftSize = (s, v) => {
    const clean = v.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
    setSizeDraft(prev => ({ ...prev, [s]: clean }));
  };
  const stepDraftSize = (id, s, delta) => {
    const cur = parseInt(sizeDraft[s] || '0', 10) || 0;
    const avail = sizeAvail(id, s);
    let next = cur + delta;
    if (delta > 0 && avail !== null && next > avail) next = avail;
    if (next < -sizeReturn(id, s)) next = -sizeReturn(id, s);
    setSizeDraft(prev => ({ ...prev, [s]: next === 0 ? '' : String(next) }));
  };
  const draftTotal = () => Object.keys(sizeDraft).reduce((sum, s) => {
    const n = parseInt(sizeDraft[s], 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const saveSizes = () => {
    const id = sizeModal;
    const map = {};
    const errs = [];
    Object.keys(sizeDraft).forEach(s => {
      const raw = String(sizeDraft[s] ?? '').trim();
      if (raw === '' || raw === '-') return;
      if (!/^-?\d+$/.test(raw)) { errs.push(`• Size ${s}: సంఖ్య సరికాదు`); return; }
      const n = parseInt(raw, 10);
      if (n === 0) return;
      const avail = sizeAvail(id, s);
      if (n > 0 && avail !== null && n > avail) errs.push(`• Size ${s}: కావాలి ${n}, stock లో ${Math.max(avail, 0)}`);
      if (n < 0 && -n > sizeReturn(id, s)) errs.push(`• Size ${s}: Return ${-n}, ఇచ్చినవి ${sizeReturn(id, s)}`);
      map[s] = n;
    });
    if (errs.length > 0) { Alert.alert('Sizes సరిచేయండి', errs.slice(0, 8).join('\n')); return; }
    if (Object.keys(map).length === 0) { Alert.alert('Sizes', 'కనీసం ఒక size కి సంఖ్య ఇవ్వండి.'); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: true, sizeCounts: map } : i));
    setSizeModal(null);
  };
  // Row tap: a sized item opens its popup when ticked (and is unticked by a tap while ticked)
  const onItemPress = (item) => {
    if (isSized(item) && !item.checked) openSizes(item);
    else toggleItem(item.id);
  };
  const getTotalQty  = () => checkedItems.reduce((s, i) => s + parseInt(i.count || 0), 0);

  const toggleAllInCategory = (cat) => {
    const catItems   = items.filter(i => i.category === cat && isVisible(i));
    const allChecked = catItems.every(i => i.checked);
    // sized items (Shoes) cannot be ticked in bulk: they need their size popup
    setItems(prev => prev.map(i => (i.category === cat && isVisible(i) && (allChecked || !isSized(i))) ? { ...i, checked: !allChecked } : i));
  };

  const clearSelection = () =>
    setItems(prev => prev.map(i => ({ ...i, checked: false, count: '0', sizeCounts: {} })));

  const saveItemsToSchool = async () => {
    if (!selectedSchool) return;
    await SchoolService.updateItems(
      selectedSchool.id,
      checkedItems.map(i => ({ id: i.id, name: i.name, count: i.count }))
    );
  };

  // ── ESC/POS receipt ───────────────────────────────────────────────────────
  const buildReceipt = (invoiceNo) =>
    buildReceiptBase64({ settings, school: selectedSchool, spell: spellNumber, items: checkedItems, invoiceNo });

  // Preview: same school / items / spell as the print, no invoice number is used or taken
  const openPreview = () => {
    if (!selectedSchool)           { Alert.alert('స్కూల్ select చేయండి'); return; }
    if (checkedItems.length === 0) { Alert.alert('Items tick చేయండి'); return; }
    setPreviewModal(true);
  };
  const previewLines = previewModal
    ? buildReceiptPreview({ settings, school: selectedSchool, spell: spellNumber, items: checkedItems, invoiceNo: '(Print తర్వాత)' })
    : [];

  const validateAndAskCopies = (type) => {
    if (printLockRef.current || printing) return;
    if (!selectedSchool)           { Alert.alert('స్కూల్ select చేయండి'); return; }
    if (checkedItems.length === 0) { Alert.alert('Items tick చేయండి'); return; }
    if (type === 'thermal') {                 // copies only make sense for the thermal printer
      setPendingPrint(type);
      setCopies(1);
      setCopiesModal(true);
    } else {
      runPrint(type, 1);
    }
  };

  const handlePrint = () => runPrint(pendingPrint, copies);

  // Invoice number rule: the number is only LOOKED AT before printing. It is used up (together with
  // the ledger entry, in one atomic write) only AFTER something was really printed / produced,
  // so a failed print never burns a number.
  const runPrint = async (channel, numCopies) => {
    if (printLockRef.current) return;         // a print is already running
    printLockRef.current = true;
    setCopiesModal(false);
    try {
      const ay = settings?.academicYear;
      if (!isValidAcademicYear(ay)) {
        Alert.alert('Academic Year', 'Settings లో Academic Year సరిచూడండి (ఉదా: 2026-27).');
        return;
      }

      // Count check + Return check: a count must be a whole number; a Return (-n) cannot be more than Given
      const badCount = checkedItems.filter(i => !/^-?\d+$/.test(String(i.count ?? '0').trim() || '0'));
      if (badCount.length > 0) {
        Alert.alert('Count సరిగా లేదు', badCount.slice(0, 8).map(i => `• ${i.name}`).join('\n') + '\n\nసంఖ్య మాత్రమే (Return కి ముందు -).');
        return;
      }
      const noSizes = checkedItems.filter(i => isSized(i) && Object.keys(i.sizes || {}).length === 0);
      if (noSizes.length > 0) {
        Alert.alert('Sizes నమోదు చేయండి', noSizes.slice(0, 8).map(i => `• ${i.name}`).join('\n') + '\n\nItem మీద Sizes నొక్కి size వారీ సంఖ్యలు ఇవ్వండి.');
        return;
      }
      const badReturnSize = [];
      checkedItems.forEach(i => {
        if (!isSized(i)) return;
        Object.keys(i.sizes || {}).forEach(s => {
          const n = i.sizes[s];
          if (n < 0 && -n > sizeReturn(i.id, s)) badReturnSize.push(`• ${i.name} size ${s}: Return ${-n}, ఇచ్చినవి ${sizeReturn(i.id, s)}`);
        });
      });
      if (badReturnSize.length > 0) {
        Alert.alert('Return ఎక్కువ', `${badReturnSize.slice(0, 8).join('\n')}\n\nఇచ్చినవి కంటే ఎక్కువ Return చేయలేరు.`);
        return;
      }
      const badReturn = checkedItems.filter(i => {
        const n = parseInt(i.count || 0, 10);
        return n < 0 && -n > (plan[i.id]?.given || 0);
      });
      if (badReturn.length > 0) {
        const lines = badReturn.slice(0, 8)
          .map(i => `• ${i.name}: Return ${-parseInt(i.count, 10)}, ఇచ్చినవి ${plan[i.id]?.given || 0}`).join('\n');
        Alert.alert('Return ఎక్కువ', `${lines}\n\nఇచ్చినవి కంటే ఎక్కువ Return చేయలేరు.`);
        return;
      }

      // Roll check: warn (but allow) when given + this receipt is more than the school's requirement
      if (hasRoll) {
        const over = checkedItems.filter(i => {
          const p = plan[i.id];
          const n = parseInt(i.count || 0, 10);
          return p && !isNaN(n) && n > 0 && p.given + n > p.required;
        });
        if (over.length > 0) {
          const lines = over.slice(0, 8)
            .map(i => `• ${i.name}: అవసరం ${plan[i.id].required}, ఇచ్చినవి ${plan[i.id].given}, ఇప్పుడు ${i.count}`)
            .join('\n');
          const more = over.length > 8 ? `\n… +${over.length - 8} మరిన్ని` : '';
          const go = await new Promise(resolve => Alert.alert(
            'Roll కంటే ఎక్కువ',
            `${lines}${more}\n\nఅయినా కొనసాగాలా?`,
            [
              { text: 'వెనక్కి', style: 'cancel', onPress: () => resolve(false) },
              { text: 'కొనసాగు', onPress: () => resolve(true) },
            ],
            { cancelable: false },
          ));
          if (!go) return;
        }
      }

      // Stock check: a receipt cannot give more than Received - Given. Nothing is printed otherwise.
      const shortages = await LedgerService.checkAvailability(checkedItems, ay);
      if (shortages.length > 0) {
        const lines = shortages.slice(0, 8)
          .map(s => `• ${s.name}: కావాలి ${s.requested}, stock లో ${Math.max(s.available, 0)}`)
          .join('\n');
        const more = shortages.length > 8 ? `\n… +${shortages.length - 8} మరిన్ని` : '';
        Alert.alert(
          'Stock సరిపోలేదు',
          `${lines}${more}\n\nHome → Stock & Balance లో Received నమోదు చేయండి.`,
          [
            { text: 'సరే', style: 'cancel' },
            { text: 'Stock కి వెళ్ళు', onPress: () => navigation.navigate('Home', { screen: 'Stock' }) },
          ],
        );
        return;
      }

      const serialNo  = await InvoiceSerial.nextNumber(ay);
      const invoiceNo = InvoiceSerial.format(ay, serialNo);

      let issued  = 0;          // copies / documents really produced
      let failure = null;

      if (channel === 'thermal') {
        setPrinting(true);                    // also shown while a dropped printer is being reconnected
        const connected = await BluetoothService.ensureConnected();
        if (!connected) { Alert.alert('Not Connected', 'Printer connect చేయండి'); return; }
        try {
          const data = await buildReceipt(invoiceNo);
          for (let i = 0; i < numCopies; i++) {
            await BluetoothService.sendBase64(data);
            issued++;
            if (i < numCopies - 1) await new Promise(res => setTimeout(res, 1500));
          }
        } catch (e) { failure = e; }
      } else {
        const receiptData = {
          settings, school: selectedSchool, spell: spellNumber,
          items: checkedItems, totalQty: getTotalQty(), invoiceNo,
        };
        try {
          if (channel === 'pdf') await ShareService.sharePDF(receiptData);
          else                   await ShareService.printViaSystem(receiptData);
          issued = 1;
        } catch (e) { failure = e; }
      }

      if (issued === 0) {                     // nothing produced: no number used, nothing saved
        Alert.alert('Failed', failure ? failure.message : 'Print కాలేదు');
        return;
      }

      // Something was produced: record it in the ledger and use up the number in ONE write
      try {
        await ReceiptHistory.save({
          invoiceNo,
          academicYear: ay,
          channel,
          shopName:  `SRKVM Kits - ${settings?.shopName || ''} Mandal`,
          shopPhone: settings?.shopPhone || '',
          school:    selectedSchool,
          spell:     spellNumber,
          items:     checkedItems,
          footer:    settings?.shopTagline || '',
        }, [InvoiceSerial.commitPair(ay, serialNo)]);
      } catch (e) {
        try { await InvoiceSerial.commit(ay, serialNo); } catch { /* ignore */ }
        Alert.alert('Print అయింది, కానీ History లో save కాలేదు',
          `Invoice: ${invoiceNo}\n${e.message}\nఈ invoice number ను గుర్తుంచుకోండి.`);
        return;
      }
      try { await saveItemsToSchool(); } catch { /* school's last counts are optional */ }
      clearSelection();
      try { await selectSchool(selectedSchool, { silent: true }); } catch { /* refresh is optional */ }   // new Given / next spell

      if (failure) {
        Alert.alert('కొన్ని copies మాత్రమే print అయ్యాయి',
          `Invoice: ${invoiceNo}\n${issued}/${numCopies} copies print అయ్యాయి.\n${failure.message}`);
      } else if (channel === 'thermal') {
        Alert.alert('Success', `Invoice: ${invoiceNo}\n${numCopies} copy/copies printed!`);
      } else {
        Alert.alert('Receipt సిద్ధం', `Invoice: ${invoiceNo}`);
      }
    } catch (error) {
      Alert.alert('Failed', error.message);
    } finally {
      setPrinting(false);
      printLockRef.current = false;
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.udise.includes(schoolSearch)
  );

  // Categories not in the Types list (e.g. 'General') are still shown, not hidden
  const extraCats = items
    .filter(isVisible)
    .map(i => i.category)
    .filter((c, idx, arr) => !types.includes(c) && arr.indexOf(c) === idx);

  const groupedItems = [...types, ...extraCats].map(cat => ({
    cat,
    icon: CAT_ICONS[cat] || 'tag-outline',
    rows: items.filter(i => i.category === cat && isVisible(i)),
  })).filter(g => g.rows.length > 0);

  const checkedInCat = (cat) => items.filter(i => i.category === cat && isVisible(i) && i.checked).length;
  const totalInCat   = (cat) => items.filter(i => i.category === cat && isVisible(i)).length;

  if (!settings) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="New Receipt" subtitle="SRKVM Kits" />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="New Receipt" subtitle={`SRKVM Kits · ${settings.shopName} Mandal`} info={settings.academicYear ? `Academic Year ${settings.academicYear}` : undefined} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* School Selector */}
        <SectionHead icon="school-outline">School</SectionHead>
        <TouchableOpacity style={styles.schoolSelector} onPress={() => setSchoolModal(true)}>
          <View style={styles.schoolSelectorLeft}>
            <View style={styles.schoolSelectorIcon}><MaterialCommunityIcons name="school-outline" size={22} color={Colors.primary} /></View>
            <View>
              {selectedSchool ? (
                <>
                  <Text style={styles.schoolSelectedName}>{selectedSchool.name}</Text>
                  {selectedSchool.udise ? <Text style={styles.schoolSelectedUdise}>UDISE: {selectedSchool.udise}</Text> : null}
                </>
              ) : (
                <Text style={styles.schoolPlaceholder}>స్కూల్ select చేయండి...</Text>
              )}
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={22} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Spell */}
        <SectionHead icon="clipboard-list-outline">Distribution Spell</SectionHead>
        <Card>
          <View style={styles.spellRow}>
            <Text style={styles.spellLabel}>Spell Number</Text>
            <Stepper value={spellNumber} onChange={setSpellNumber} min={1} />
          </View>
          <View style={styles.spellBadgeWrap}>
            <View style={styles.spellBadge}><Text style={styles.spellBadgeText}>Spell {spellNumber}</Text></View>
          </View>
        </Card>

        {/* Kit Items */}
        <SectionHead icon="package-variant-closed">{`Kit Items${selectedSchool ? `  —  ${checkedItems.length} selected` : ''}`}</SectionHead>

        {catalog.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="package-variant-closed" size={40} color={Colors.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Catalog లో items లేవు</Text>
            <Text style={styles.emptyHint}>Settings → Item Catalog లో add చేయండి</Text>
          </Card>
        ) : !selectedSchool ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="school-outline" size={40} color={Colors.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyHint}>స్కూల్ select చేసిన తర్వాత checklist వస్తుంది</Text>
          </Card>
        ) : loadingSchool ? (
          <Card style={styles.emptyCard}><ActivityIndicator color={Colors.primary} /></Card>
        ) : !rollConfirmed ? (
          <TouchableOpacity onPress={() => setRollPopup(true)}>
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={Colors.textMuted} style={styles.emptyIcon} />
              <Text style={styles.emptyHint}>Roll చూసి Proceed చేస్తే items వస్తాయి (ఇక్కడ నొక్కండి)</Text>
            </Card>
          </TouchableOpacity>
        ) : (
          <>
          {kinds !== null && kindsPresent.length > 1 ? (
            <TouchableOpacity onPress={() => { setKindDraft(kinds); setKindModal(true); }}>
              <IconText icon="filter-variant" size={16} style={styles.planToggle}>{`${kinds.length <= 3 ? kinds.join(' + ') : `${kinds.length} Item Types`}  ·  మార్చు`}</IconText>
            </TouchableOpacity>
          ) : null}
          {semList.length > 1 && semester !== null && needsSem(kinds) ? (
            <TouchableOpacity onPress={() => setSemModal(true)}>
              <IconText icon="book-open-page-variant-outline" size={16} style={styles.planToggle}>{`Semester ${semester}  ·  మార్చు`}</IconText>
            </TouchableOpacity>
          ) : null}
          {!hasRoll ? (
            <IconText icon="alert-outline" size={16} color={Colors.danger} style={styles.planNote}>ఈ school కి roll నమోదు కాలేదు — అన్ని items చూపిస్తున్నాను. Schools లో roll నమోదు చేస్తే auto లెక్క వస్తుంది.</IconText>
          ) : (
            <TouchableOpacity onPress={() => setShowAll(v => !v)}>
              <IconText icon={showAll ? 'chevron-up' : 'chevron-down'} size={18} style={styles.planToggle}>{showAll ? 'ఈ school కి వర్తించే items మాత్రమే చూపించు' : 'ఇతర items కూడా చూపించు'}</IconText>
            </TouchableOpacity>
          )}
          {groupedItems.map(({ cat, icon, rows }) => {
            const isCollapsed = !!collapsedCats[cat];
            const checked     = checkedInCat(cat);
            const total       = totalInCat(cat);
            const allChecked  = checked === total && total > 0;
            return (
              <View key={cat} style={styles.categoryGroup}>
                <View style={styles.catHeader}>
                  <TouchableOpacity
                    style={[styles.catCheckbox, allChecked && styles.catCheckboxActive]}
                    onPress={() => toggleAllInCategory(cat)}>
                    {allChecked && <Text style={styles.catCheckmark}>✓</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catTitleRow} onPress={() => toggleCategory(cat)} activeOpacity={0.7}>
                    <MaterialCommunityIcons name={icon} size={18} color={Colors.primary} />
                    <Text style={styles.catTitle}>{cat}</Text>
                    <View style={styles.catBadge}><Text style={styles.catBadgeText}>{checked}/{total}</Text></View>
                    <MaterialCommunityIcons name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {!isCollapsed && rows.map(item => (
                  <TouchableOpacity key={item.id}
                    style={[styles.checkItem, item.checked && styles.checkItemActive]}
                    onPress={() => onItemPress(item)} activeOpacity={0.8}>
                    <View style={[styles.checkbox, item.checked && styles.checkboxActive]}>
                      {item.checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checkItemName, !item.checked && styles.checkItemNameMuted]}>{item.name}{item.subType && item.subType !== 'Common' ? `  · ${item.subType}` : ''}{hasRoll && plan[item.id] ? <Text style={styles.planHint}>{`\nఅవసరం ${plan[item.id].required} · ఇచ్చినవి ${plan[item.id].given} · మిగిలినవి ${Math.max(0, plan[item.id].required - plan[item.id].given)}${plan[item.id].stock === null ? '' : ` · stock ${plan[item.id].stock}`}`}</Text> : null}</Text>
                    {item.checked && isSized(item) && (
                      <TouchableOpacity style={styles.sizeBtn} onPress={() => openSizes(item)} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="ruler" size={14} color={Colors.primary} />
                        <Text style={styles.sizeBtnText}>{withSizes(item).count}</Text>
                      </TouchableOpacity>
                    )}
                    {item.checked && !isSized(item) && (
                      <TextInput style={styles.countInput} value={String(item.count)}
                        onChangeText={v => updateCount(item.id, v)}
                        keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
          </>
        )}

        {/* Summary */}
        {checkedItems.length > 0 && (
          <>
            <SectionHead icon="chart-box-outline">Summary</SectionHead>
            <Card>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Items</Text>
                <Text style={styles.summaryValue}>{checkedItems.length}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Quantity</Text>
                <Text style={styles.totalValue}>{getTotalQty()}</Text>
              </View>
            </Card>
          </>
        )}

        {/* Print Button */}
        <TouchableOpacity style={[styles.printBtn, printing && styles.printBtnDisabled]}
          onPress={() => validateAndAskCopies('thermal')} disabled={printing}>
          {printing ? <ActivityIndicator color={Colors.primaryText} /> : (
            <View style={styles.printBtnInner}>
              <MaterialCommunityIcons name="printer" size={20} color={Colors.primaryText} />
              <Text style={styles.printBtnText}>Thermal Printer లో Print</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Preview */}
        <TouchableOpacity style={styles.previewBtn} onPress={openPreview} disabled={printing}>
          <View style={styles.printBtnInner}>
            <MaterialCommunityIcons name="eye-outline" size={18} color={Colors.primary} />
            <Text style={styles.previewBtnText}>Preview</Text>
          </View>
        </TouchableOpacity>

        {/* Share Row */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={() => validateAndAskCopies('pdf')}>
            <MaterialCommunityIcons name="file-pdf-box" size={18} color={Colors.primary} /><Text style={styles.shareBtnText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={() => validateAndAskCopies('system')}>
            <MaterialCommunityIcons name="printer-outline" size={18} color={Colors.primary} /><Text style={styles.shareBtnText}>System Print</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xl }} />

        {/* School Modal */}
        <Modal visible={schoolModal} animationType="slide" transparent onRequestClose={() => setSchoolModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, sheetPad]}>
              <IconText icon="school-outline" size={22} color={Colors.primaryDark} style={styles.modalTitle}>స్కూల్ Select చేయండి</IconText>
              <View style={styles.modalSearchBox}>
                <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
                <TextInput style={styles.modalSearchInput} placeholder="పేరు లేదా UDISE search..."
                  value={schoolSearch} onChangeText={setSchoolSearch} placeholderTextColor={Colors.textMuted} />
              </View>
              {filteredSchools.length === 0 ? (
                <Text style={styles.emptyHint}>స్కూళ్ళు లేవు. Settings → Schools లో add చేయండి.</Text>
              ) : (
                <FlatList data={filteredSchools} keyExtractor={item => item.id} style={{ maxHeight: 380 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.schoolItem} onPress={() => selectSchool(item)}>
                      <View style={styles.schoolItemIcon}><MaterialCommunityIcons name="school-outline" size={18} color={Colors.primary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.schoolItemName}>{item.name}</Text>
                        {item.udise   ? <Text style={styles.schoolItemSub}>UDISE: {item.udise}</Text> : null}
                        {item.address ? <Text style={styles.schoolItemSub}>{item.address}</Text>      : null}
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )} />
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSchoolModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Roll popup */}
        <Modal visible={rollPopup && !!selectedSchool && !loadingSchool} animationType="fade" transparent
          onRequestClose={() => { if (!rollSaving) { setRollPopup(false); setRollEdit(false); } }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.copiesModal, sheetPad, { height: '75%' }]}>
              <IconText icon="clipboard-text-outline" size={22} color={Colors.primaryDark} style={styles.modalTitle}>{`Roll — ${selectedSchool?.name ?? ''}`}</IconText>
              {selectedSchool && classRange(selectedSchool.minClass, selectedSchool.maxClass).length > 0 ? (
                <>
                  <View style={styles.rollHead}>
                    <Text style={[styles.rollCell, { flex: 1 }]}>తరగతి</Text>
                    <Text style={styles.rollCell}>Boys</Text>
                    <Text style={styles.rollCell}>Girls</Text>
                  </View>
                  <ScrollView ref={fsRoll.ref} contentContainerStyle={fsRoll.padStyle} style={{ flex: 1, width: '100%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {classRange(selectedSchool.minClass, selectedSchool.maxClass).map(c => (
                      <View key={c} style={styles.rollRow}>
                        <Text style={[styles.rollClass, { flex: 1 }]}>Class {c}</Text>
                        {rollEdit ? (
                          <>
                            <TextInput onFocus={fsRoll.onFocus} style={styles.rollInput} keyboardType="numeric" maxLength={3}
                              value={rollForm[c]?.b ?? ''} onChangeText={v => setRollField(c, 'b', v)} />
                            <TextInput onFocus={fsRoll.onFocus} style={styles.rollInput} keyboardType="numeric" maxLength={3}
                              value={rollForm[c]?.g ?? ''} onChangeText={v => setRollField(c, 'g', v)} />
                          </>
                        ) : (
                          <>
                            <Text style={styles.rollVal}>{selectedSchool.roll?.[c]?.b ?? 0}</Text>
                            <Text style={styles.rollVal}>{selectedSchool.roll?.[c]?.g ?? 0}</Text>
                          </>
                        )}
                      </View>
                    ))}
                    {!rollEdit && (
                      <Text style={styles.rollTotal}>
                        మొత్తం: Boys {rollSummary(selectedSchool).boys} · Girls {rollSummary(selectedSchool).girls} · {rollSummary(selectedSchool).total}
                      </Text>
                    )}
                  </ScrollView>
                </>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={styles.planNote}>ఈ school కి Min–Max classes / roll నమోదు కాలేదు. Schools Data లో నమోదు చేస్తే auto లెక్క వస్తుంది. ఇప్పుడు పాత పద్ధతిలో కొనసాగవచ్చు.</Text>
                </View>
              )}
              <View style={styles.modalActions}>
                {rollEdit ? (
                  <>
                    <TouchableOpacity style={styles.cancelBtn} disabled={rollSaving} onPress={() => setRollEdit(false)}>
                      <Text style={styles.cancelBtnText}>వెనక్కి</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmBtn} disabled={rollSaving} onPress={saveRollAndProceed}>
                      {rollSaving ? <ActivityIndicator color={Colors.primaryText} /> : <Text style={styles.confirmBtnText}>Save & Proceed</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {selectedSchool && classRange(selectedSchool.minClass, selectedSchool.maxClass).length > 0 && (
                      <TouchableOpacity style={styles.cancelBtn} onPress={startRollEdit}>
                        <IconText icon="pencil-outline" size={16} color={Colors.textSecondary} style={styles.cancelBtnText}>Update</IconText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => proceedWithRoll()}>
                      <Text style={styles.confirmBtnText}>Proceed ›</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Preview Modal */}
        <Modal visible={previewModal} animationType="slide" transparent onRequestClose={() => setPreviewModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.copiesModal, sheetPad, { height: '85%' }]}>
              <IconText icon="eye-outline" size={22} color={Colors.primaryDark} style={styles.modalTitle}>Receipt Preview</IconText>
              <ScrollView style={styles.previewPaper} contentContainerStyle={{ padding: Spacing.md }}>
                {previewLines.map((l, i) => (
                  <Text key={i} style={[styles.previewLine, l.bold && styles.previewBold, l.center && { textAlign: 'center' }]}>
                    {l.t === '' ? ' ' : l.t}
                  </Text>
                ))}
              </ScrollView>
              <Text style={styles.previewNote}>Preview మాత్రమే. Logo, Invoice number, Date/Time print అయినప్పుడు వస్తాయి.</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPreviewModal(false)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => { setPreviewModal(false); validateAndAskCopies('thermal'); }}>
                  <IconText icon="printer" size={16} color={Colors.primaryText} style={styles.confirmBtnText}>Print</IconText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Size popup (items with sizes, e.g. Shoes) */}
        <Modal visible={sizeModal !== null} animationType="fade" transparent onRequestClose={() => setSizeModal(null)}>
          <View style={styles.modalOverlay}>
            {(() => {
              const it = items.find(x => x.id === sizeModal);
              if (!it) return null;
              const p = plan[it.id];
              return (
                <View style={[styles.copiesModal, sheetPad, { height: '85%' }]}>
                  <IconText icon="ruler" size={22} color={Colors.primaryDark} style={styles.modalTitle}>{it.name}</IconText>
                  <Text style={styles.sizeHint}>
                    {hasRoll && p ? `అవసరం ${p.required} · ఇచ్చినవి ${p.given} · మిగిలినవి ${Math.max(0, p.required - p.given)}\n` : ''}
                    ప్రతి size కి ఎన్ని ఇస్తున్నారో ఇవ్వండి (Return కి -)
                  </Text>
                  <ScrollView ref={fsSize.ref} contentContainerStyle={fsSize.padStyle} style={{ flex: 1, width: '100%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {it.sizeList.map(s => {
                      const avail = sizeAvail(it.id, s);
                      const n = parseInt(sizeDraft[s], 10);
                      const over = !isNaN(n) && n > 0 && avail !== null && n > avail;
                      return (
                        <View key={s} style={styles.sizeRow}>
                          <Text style={styles.sizeLabel}>{s}</Text>
                          <Text style={[styles.sizeStock, avail !== null && avail <= 0 && { color: Colors.danger }]}>
                            {avail === null ? '' : `stock ${Math.max(avail, 0)}`}
                          </Text>
                          <TouchableOpacity style={styles.stepBtn} onPress={() => stepDraftSize(it.id, s, -1)}>
                            <Text style={styles.stepBtnText}>−</Text>
                          </TouchableOpacity>
                          <TextInput onFocus={fsSize.onFocus}
                            style={[styles.sizeInput, over && { borderColor: Colors.danger }]}
                            value={String(sizeDraft[s] ?? '')}
                            onChangeText={v => setDraftSize(s, v)}
                            keyboardType="numbers-and-punctuation" placeholder="0" placeholderTextColor={Colors.textMuted} />
                          <TouchableOpacity style={styles.stepBtn} onPress={() => stepDraftSize(it.id, s, 1)}>
                            <Text style={styles.stepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <Text style={styles.sizeTotal}>మొత్తం: {draftTotal()}</Text>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setSizeModal(null)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmBtn} onPress={saveSizes}>
                      <Text style={styles.confirmBtnText}>✓ Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </Modal>

        {/* Kinds popup (Textbooks / Kits / Shoes: only the chosen kinds are shown in this receipt) */}
        <Modal visible={kindModal} animationType="fade" transparent onRequestClose={() => setKindModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.copiesModal, sheetPad]}>
              <IconText icon="filter-variant" size={22} color={Colors.primaryDark} style={styles.modalTitle}>ఏ items ఇస్తున్నారు?</IconText>
              <Text style={styles.copiesLabel}>ఈ receipt లో కావలసినవి tick చేయండి (ఈ school కి వర్తించేవి ముందే tick అయ్యాయి)</Text>
              <View style={styles.kindCol}>
                {kindsPresent.map(cat => {
                  const on = kindDraft.includes(cat);
                  return (
                    <TouchableOpacity key={cat} style={[styles.kindBtn, on && styles.semBtnActive]} activeOpacity={0.8}
                      onPress={() => setKindDraft(on ? kindDraft.filter(k => k !== cat) : [...kindDraft, cat])}>
                      <MaterialCommunityIcons name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={on ? Colors.primaryText : Colors.primary} />
                      <Text style={[styles.semBtnText, on && styles.semBtnTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setKindModal(false)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, kindDraft.length === 0 && { opacity: 0.45 }]} disabled={kindDraft.length === 0} onPress={confirmKinds}>
                  <Text style={styles.confirmBtnText}>కొనసాగించు</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Semester popup (Semester 1 / 2 books are never mixed in one receipt) */}
        <Modal visible={semModal} animationType="fade" transparent onRequestClose={() => setSemModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.copiesModal, sheetPad]}>
              <IconText icon="book-open-page-variant-outline" size={22} color={Colors.primaryDark} style={styles.modalTitle}>ఏ Semester?</IconText>
              <Text style={styles.copiesLabel}>ఒక receipt లో ఒక Semester పుస్తకాలు మాత్రమే వస్తాయి</Text>
              <View style={styles.semRow}>
                {semList.map(n => (
                  <TouchableOpacity key={n} style={[styles.semBtn, semester === n && styles.semBtnActive]}
                    onPress={() => pickSemester(n)} activeOpacity={0.8}>
                    <Text style={[styles.semBtnText, semester === n && styles.semBtnTextActive]}>{`Semester ${n}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSemModal(false)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Copies Modal */}
        <Modal visible={copiesModal} animationType="fade" transparent onRequestClose={() => setCopiesModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.copiesModal, sheetPad]}>
              <IconText icon="printer" size={22} color={Colors.primaryDark} style={styles.modalTitle}>Copies</IconText>
              <Text style={styles.copiesLabel}>ఎన్ని copies కావాలి?</Text>
              <View style={styles.copiesStepperWrap}>
                <Stepper value={copies} onChange={setCopies} min={1} />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCopiesModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handlePrint}>
                  <Text style={styles.confirmBtnText}>Print {copies} {copies === 1 ? 'Copy' : 'Copies'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, marginTop: Spacing.xs },
  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 1 },
  iconTextRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  iconTextFlex: { flexShrink: 1 },
  schoolSelector: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, elevation: 1 },
  schoolSelectorLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  schoolSelectorIcon:  { width: 40, height: 40, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  schoolPlaceholder:   { fontSize: 14, color: Colors.textMuted },
  schoolSelectedName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  schoolSelectedUdise: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  planHint:   { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  planNote:   { fontSize: 12, color: Colors.danger, marginBottom: Spacing.xs },
  planToggle: { fontSize: 12, fontWeight: '700', color: Colors.primary, paddingVertical: Spacing.xs },
  spellRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spellLabel:     { ...Typography.bodyMd, fontWeight: '600' },
  spellBadgeWrap: { alignItems: 'center', marginTop: Spacing.sm },
  spellBadge:     { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  spellBadgeText: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  categoryGroup:     { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden', marginBottom: Spacing.xs, elevation: 1 },
  catHeader:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background, gap: Spacing.sm },
  catCheckbox:       { width: 22, height: 22, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  catCheckboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catCheckmark:      { color: Colors.primaryText, fontSize: 12, fontWeight: '700' },
  catTitleRow:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  catTitle:          { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.4 },
  catBadge:          { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  catBadgeText:      { fontSize: 11, fontWeight: '700', color: Colors.primary },
  checkItem:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.cardBorder },
  checkItemActive:    { backgroundColor: '#F6FAF3' },
  checkbox:           { width: 22, height: 22, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark:          { color: Colors.primaryText, fontSize: 12, fontWeight: '700' },
  checkItemName:      { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  checkItemNameMuted: { color: Colors.textMuted },
  sizeBtn:            { backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sizeBtnText:        { fontSize: 13, fontWeight: '800', color: Colors.primary },
  sizeHint:           { ...Typography.bodySm, textAlign: 'center', marginBottom: Spacing.sm },
  sizeRow:            { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  sizeLabel:          { width: 44, fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sizeStock:          { flex: 1, fontSize: 11, color: Colors.textMuted },
  stepBtn:            { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:        { fontSize: 20, fontWeight: '800', color: Colors.primary, lineHeight: 22 },
  sizeInput:          { width: 56, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.sm, padding: Spacing.xs, textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primaryLight },
  sizeTotal:          { fontSize: 14, fontWeight: '800', color: Colors.primary, marginTop: Spacing.sm },
  countInput:         { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.sm, padding: Spacing.xs, width: 56, fontSize: 14, fontWeight: '700', color: Colors.primary, textAlign: 'center', backgroundColor: Colors.primaryLight },
  emptyCard:    { alignItems: 'center', gap: Spacing.xs },
  emptyIcon:    { marginBottom: Spacing.xs },
  emptyText:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  emptyHint:    { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  summaryLabel: { ...Typography.bodyMd },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  totalRow:     { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: Spacing.xs, paddingTop: Spacing.sm },
  totalLabel:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  totalValue:   { fontSize: 15, fontWeight: '800', color: Colors.primary },
  printBtn:         { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.sm, elevation: 2 },
  printBtnDisabled: { backgroundColor: '#9DB89F' },
  printBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  previewBtn:       { backgroundColor: Colors.primaryLight, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.primary },
  previewBtnText:   { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  previewPaper:     { flex: 1, width: '100%', backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md },
  previewLine:      { fontFamily: 'monospace', fontSize: 12, color: '#000' },
  previewBold:      { fontWeight: '800' },
  previewNote:      { ...Typography.bodySm, marginVertical: Spacing.sm, textAlign: 'center' },
  printBtnText:     { color: Colors.primaryText, fontWeight: '700', fontSize: 15 },
  shareRow: { flexDirection: 'row', gap: Spacing.sm },
  shareBtn: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.primary },
  shareBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  rollHead:  { width: '100%', flexDirection: 'row', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  rollCell:  { width: 64, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  rollRow:   { width: '100%', flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  rollClass: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  rollVal:   { width: 64, textAlign: 'center', fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  rollInput: { width: 56, marginHorizontal: 4, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, padding: Spacing.xs, textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primaryLight },
  rollTotal: { marginTop: Spacing.sm, fontSize: 13, fontWeight: '700', color: Colors.primary },
  semRow:           { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  semBtn:           { flex: 1, minWidth: '40%', padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  kindCol:          { width: '100%', gap: Spacing.sm, marginBottom: Spacing.sm },
  kindBtn:          { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  semBtnActive:     { backgroundColor: Colors.primary },
  semBtnText:       { fontSize: 15, fontWeight: '800', color: Colors.primary },
  semBtnTextActive: { color: Colors.primaryText },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:      { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 36 },
  copiesModal:       { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 36, alignItems: 'center' },
  modalTitle:        { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.md },
  copiesLabel:       { ...Typography.bodyMd, color: Colors.textSecondary, marginBottom: Spacing.lg },
  copiesStepperWrap: { transform: [{ scale: 1.4 }], marginBottom: Spacing.xl },
  modalSearchBox:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  modalSearchInput:  { flex: 1, paddingVertical: Spacing.sm, fontSize: 14, color: Colors.textPrimary },
  schoolItem:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  schoolItemIcon:    { width: 36, height: 36, backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  schoolItemName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  schoolItemSub:     { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  closeBtn:          { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md },
  closeBtnText:      { color: Colors.textSecondary, fontWeight: '600' },
  modalActions:      { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, width: '100%' },
  cancelBtn:         { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText:     { color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn:        { flex: 1, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  confirmBtnText:    { color: Colors.primaryText, fontWeight: '700' },
});
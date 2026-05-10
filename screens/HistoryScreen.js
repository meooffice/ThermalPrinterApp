// screens/HistoryScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ReceiptHistory from '../services/ReceiptHistory';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';

export default function HistoryScreen() {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(null); // receipt id

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    setLoading(true);
    const all = await ReceiptHistory.getAll();
    setHistory(all);
    setLoading(false);
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Receipt',
      'Remove this receipt from history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await ReceiptHistory.delete(id);
            loadHistory();
          },
        },
      ]
    );
  };

  const handleReprint = async (receipt) => {
    try {
      const connected = await BluetoothService.isConnected();
      if (!connected) {
        Alert.alert('Not Connected', 'Please connect to your printer first.');
        return;
      }
      setPrinting(receipt.id);
      const encoder = new EscPosEncoder();

      encoder.initialize();

      // Header
      encoder.align('center')
        .bold(true).size('double')
        .text(receipt.shopName).newline()
        .size('normal').bold(false)
        .text(receipt.shopPhone).newline()
        .divider('=')
        .align('left');

      // Original date
      const date = new Date(receipt.savedAt);
      encoder
        .text(`Date: ${date.toLocaleDateString()}  ${date.toLocaleTimeString()}`)
        .newline()
        .text('*** REPRINT ***').newline()
        .divider();

      // Items
      encoder.bold(true).row('Item', 'Qty  Total').bold(false).divider();
      receipt.items.forEach(item => {
        const total = (
          parseFloat(item.qty || 0) * parseFloat(item.price || 0)
        ).toFixed(2);
        encoder.row(item.name.substring(0, 16), `${item.qty}x  ${total}`);
      });

      // Totals
      const subtotal = receipt.items.reduce(
        (sum, item) =>
          sum + parseFloat(item.qty || 0) * parseFloat(item.price || 0),
        0
      );
      const tax   = (subtotal * parseFloat(receipt.tax || 0)) / 100;
      const total = subtotal + tax;

      encoder.divider()
        .row('Subtotal', `Rs.${subtotal.toFixed(2)}`)
        .row(`Tax (${receipt.tax}%)`, `Rs.${tax.toFixed(2)}`)
        .bold(true).row('TOTAL', `Rs.${total.toFixed(2)}`).bold(false)
        .divider()
        .align('center')
        .text(receipt.footer).newline()
        .newline(3)
        .cut();

      await BluetoothService.sendBase64(encoder.encodeBase64());
      Alert.alert('Success', 'Receipt reprinted!');
    } catch (error) {
      Alert.alert('Reprint Failed', error.message);
    } finally {
      setPrinting(null);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear History',
      'Delete all receipt history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await ReceiptHistory.clear();
            loadHistory();
          },
        },
      ]
    );
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()}  ${d.toLocaleTimeString()}`;
  };

  const getTotal = (receipt) => {
    const subtotal = receipt.items.reduce(
      (sum, item) =>
        sum + parseFloat(item.qty || 0) * parseFloat(item.price || 0),
      0
    );
    return subtotal + (subtotal * parseFloat(receipt.tax || 0)) / 100;
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.shopName}>{item.shopName}</Text>
          <Text style={styles.dateText}>{formatDate(item.savedAt)}</Text>
        </View>
        <Text style={styles.totalText}>Rs.{getTotal(item).toFixed(2)}</Text>
      </View>

      <Text style={styles.itemCount}>
        {item.items.length} item{item.items.length !== 1 ? 's' : ''}
      </Text>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.reprintBtn}
          onPress={() => handleReprint(item)}
          disabled={printing !== null}
        >
          {printing === item.id ? (
            <ActivityIndicator color="#4f46e5" size="small" />
          ) : (
            <Text style={styles.reprintText}>🖨️ Reprint</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.deleteText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Receipt History</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyText}>No receipts yet</Text>
          <Text style={styles.emptyHint}>
            Printed receipts will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  topBar: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      20,
    marginBottom:   16,
  },
  screenTitle: {
    fontSize:   22,
    fontWeight: '800',
    color:      '#1f2937',
  },
  clearText: {
    color:      '#ef4444',
    fontWeight: '600',
    fontSize:   14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius:    12,
    padding:         14,
    marginBottom:    10,
    elevation:       1,
  },
  cardHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   4,
  },
  shopName: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#111827',
  },
  dateText: {
    fontSize:  12,
    color:     '#6b7280',
    marginTop:  2,
  },
  totalText: {
    fontSize:   16,
    fontWeight: '800',
    color:      '#4f46e5',
  },
  itemCount: {
    fontSize:     13,
    color:        '#9ca3af',
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap:           8,
  },
  reprintBtn: {
    flex:            1,
    backgroundColor: '#ede9fe',
    padding:         10,
    borderRadius:    8,
    alignItems:      'center',
  },
  reprintText: {
    color:      '#4f46e5',
    fontWeight: '600',
    fontSize:   13,
  },
  deleteBtn: {
    flex:            1,
    backgroundColor: '#fee2e2',
    padding:         10,
    borderRadius:    8,
    alignItems:      'center',
  },
  deleteText: {
    color:      '#ef4444',
    fontWeight: '600',
    fontSize:   13,
  },
  centered: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  emptyIcon: {
    fontSize:     48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize:     18,
    fontWeight:   '700',
    color:        '#1f2937',
    marginBottom:  4,
  },
  emptyHint: {
    fontSize: 14,
    color:    '#9ca3af',
  },
});
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { apiService, MobileAlert } from '../services/apiService';

export const AlertsScreen: React.FC = () => {
  const [alerts, setAlerts] = useState<MobileAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await apiService.fetchDeviceAlerts('ESP32-MOB-001');
    setAlerts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico de Alertas</Text>
        <TouchableOpacity onPress={loadAlerts} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>{loading ? '...' : 'Atualizar'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const isCritical = item.severity === 'CRITICAL';
          return (
            <View style={[styles.alertCard, isCritical ? styles.criticalCard : styles.warningCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.alertType}>{item.alertType.replace('_', ' ')}</Text>
                <Text style={[styles.badge, isCritical ? styles.badgeCrit : styles.badgeWarn]}>
                  {item.status}
                </Text>
              </View>
              <Text style={styles.alertMsg}>{item.message}</Text>
              <Text style={styles.alertTime}>
                {new Date(item.createdAt).toLocaleString('pt-BR')}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum alerta registrado.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  refreshBtn: {
    backgroundColor: '#1f2937',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  refreshText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600'
  },
  alertCard: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1
  },
  criticalCard: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)'
  },
  warningCard: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  alertType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  badge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeCrit: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171'
  },
  badgeWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24'
  },
  alertMsg: {
    color: '#d1d5db',
    fontSize: 13,
    marginTop: 4
  },
  alertTime: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 6
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14
  }
});

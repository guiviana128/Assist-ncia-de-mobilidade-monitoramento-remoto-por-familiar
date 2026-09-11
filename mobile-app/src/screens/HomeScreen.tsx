import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { bleService, BleStickData } from '../services/bleService';
import { apiService } from '../services/apiService';

export const HomeScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<BleStickData>({
    deviceId: 'ESP32-MOB-001',
    distanceCm: 130,
    latitude: -23.550520,
    longitude: -46.633308,
    batteryPercent: 92,
    sosTriggered: false,
    fallDetected: false
  });

  useEffect(() => {
    const unsubscribe = bleService.subscribe((data) => {
      setTelemetry(data);
      if (data.sosTriggered) {
        Alert.alert('🚨 EMERGÊNCIA SOS', 'O botão SOS da bengala foi acionado!');
      }
      if (data.fallDetected) {
        Alert.alert('🚨 QUEDA DETECTADA', 'Uma queda brusca foi detectada pelo sensor de aceleração!');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleToggleBle = async () => {
    if (isConnected) {
      bleService.disconnect();
      setIsConnected(false);
    } else {
      const success = await bleService.scanAndConnect();
      setIsConnected(success);
    }
  };

  const handleTriggerSOS = async () => {
    Alert.alert(
      'Confirmar SOS',
      'Deseja enviar um alerta de socorro imediato para todos os contatos e familiares?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'ENVIAR SOS',
          style: 'destructive',
          onPress: async () => {
            await apiService.triggerQuickSOS(telemetry.deviceId, telemetry.latitude, telemetry.longitude);
            Alert.alert('Alerta Enviado', 'Sua localização e pedido de socorro foram enviados com sucesso!');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Status Bar Header */}
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.appTitle}>AssistMob</Text>
          <Text style={styles.subTitle}>Dispositivo: {telemetry.deviceId}</Text>
        </View>
        <TouchableOpacity
          style={[styles.bleButton, isConnected ? styles.bleConnected : styles.bleDisconnected]}
          onPress={handleToggleBle}
        >
          <Text style={styles.bleButtonText}>
            {isConnected ? 'BLE Conectado' : 'Conectar BLE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botão de Pânico SOS Gigante */}
      <View style={styles.sosContainer}>
        <TouchableOpacity style={styles.sosButton} onPress={handleTriggerSOS} activeOpacity={0.8}>
          <Text style={styles.sosEmoji}>🚨</Text>
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosSub}>Pressione em emergências</Text>
        </TouchableOpacity>
      </View>

      {/* Grid de Sensores */}
      <View style={styles.grid}>
        {/* Card Obstáculo */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Radar Ultrassônico</Text>
          <Text style={[styles.cardValue, { color: telemetry.distanceCm < 50 ? '#ef4444' : '#10b981' }]}>
            {telemetry.distanceCm} cm
          </Text>
          <Text style={styles.cardDesc}>
            {telemetry.distanceCm < 50 ? 'Obstáculo próximo!' : 'Caminho livre'}
          </Text>
        </View>

        {/* Card Bateria */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Bateria ESP32</Text>
          <Text style={[styles.cardValue, { color: telemetry.batteryPercent > 20 ? '#10b981' : '#ef4444' }]}>
            {telemetry.batteryPercent}%
          </Text>
          <Text style={styles.cardDesc}>Bateria LiPo 3.7V</Text>
        </View>

        {/* Card Queda */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Detector de Queda</Text>
          <Text style={[styles.cardValue, { color: '#3b82f6', fontSize: 18 }]}>
            Monitorando
          </Text>
          <Text style={styles.cardDesc}>MPU-6050 Ativo</Text>
        </View>

        {/* Card GPS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Localização GPS</Text>
          <Text style={[styles.cardValue, { color: '#06b6d4', fontSize: 16 }]}>
            Fix Ativo
          </Text>
          <Text style={styles.cardDesc}>
            {telemetry.latitude.toFixed(4)}, {telemetry.longitude.toFixed(4)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    padding: 16
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  subTitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2
  },
  bleButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  bleConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981'
  },
  bleDisconnected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3b82f6'
  },
  bleButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  sosContainer: {
    alignItems: 'center',
    marginVertical: 10
  },
  sosButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#fca5a5'
  },
  sosEmoji: {
    fontSize: 28
  },
  sosText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2
  },
  sosSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    marginTop: 2
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20
  },
  card: {
    width: '48%',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600'
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 6
  },
  cardDesc: {
    color: '#6b7280',
    fontSize: 11
  }
});

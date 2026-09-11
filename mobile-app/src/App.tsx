import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { HomeScreen } from './screens/HomeScreen';
import { AlertsScreen } from './screens/AlertsScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'alerts'>('home');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      <View style={styles.content}>
        {currentTab === 'home' ? <HomeScreen /> : <AlertsScreen />}
      </View>

      {/* Barra de Navegação Inferior */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'home' && styles.activeTab]}
          onPress={() => setCurrentTab('home')}
        >
          <Text style={[styles.tabText, currentTab === 'home' && styles.activeTabText]}>
            Bengala & SOS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'alerts' && styles.activeTab]}
          onPress={() => setCurrentTab('alerts')}
        >
          <Text style={[styles.tabText, currentTab === 'alerts' && styles.activeTabText]}>
            Histórico Alertas
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f19'
  },
  content: {
    flex: 1
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#3b82f6'
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600'
  },
  activeTabText: {
    color: '#3b82f6'
  }
});

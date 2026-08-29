import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RadarMapView } from '@/components/radar-map-view';
import { NetworkMonitor } from '@/components/network-monitor';
import { useAlerts } from '@/hooks/use-alerts';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function ExploreScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { alerts, userLocation, stats, refreshAlerts, setUserLocationManual } = useAlerts();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconBox, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="git-network" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.two }}>
            <ThemedText type="title" style={{ fontSize: 20 }}>
              Radar & Rede Distribuída
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Visualização Espacial e Topologia em Tempo Real
            </ThemedText>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Radar Geoespacial */}
          <RadarMapView
            alerts={alerts}
            userLocation={userLocation}
            onUserLocationChange={setUserLocationManual}
          />

          {/* Monitor de Topologia e Pacotes Distribuídos */}
          <NetworkMonitor stats={stats} onSimulationTriggered={refreshAlerts} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: BottomTabInset + 40,
  },
});

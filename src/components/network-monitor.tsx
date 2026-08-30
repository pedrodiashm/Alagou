import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { useColorScheme } from 'react-native';
import { DistributedPacket, SystemStats } from '@/types/alert';
import { fetchTopologyData, simulateAcademicScenario } from '@/services/api';
import { socketService } from '@/services/socket';

interface NetworkMonitorProps {
  stats: SystemStats | null;
  onSimulationTriggered?: () => void;
}

export function NetworkMonitor({ stats, onSimulationTriggered }: NetworkMonitorProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [packets, setPackets] = useState<DistributedPacket[]>([]);
  const [nodesCount, setNodesCount] = useState<number>(1);
  const [loadingTopology, setLoadingTopology] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const loadTopology = async () => {
    try {
      const data = await fetchTopologyData();
      if (data.packets) setPackets(data.packets);
      if (data.nodesCount) setNodesCount(data.nodesCount);
    } catch {
      // Usa dados locais se servidor estiver desconectado
    }
  };

  useEffect(() => {
    loadTopology();

    const unsub = socketService.subscribeTopology((data) => {
      setNodesCount(data.activeNodesCount);
      if (data.recentPackets) setPackets(data.recentPackets);
    });

    return () => {
      unsub();
    };
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    setActiveStep(1); // Usuário A produz

    try {
      setTimeout(() => setActiveStep(2), 600); // Servidor + MariaDB
      setTimeout(() => setActiveStep(3), 1200); // Distribuição B (500m) e C (800m)

      await simulateAcademicScenario();
      await loadTopology();
      if (onSimulationTriggered) onSimulationTriggered();

      setTimeout(() => {
        setActiveStep(null);
        setSimulating(false);
      }, 2500);
    } catch {
      setSimulating(false);
      setActiveStep(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header do Monitor */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <ThemedText type="subtitle" style={{ fontSize: 16 }}>
            Topologia do Sistema Distribuído
          </ThemedText>
        </View>

        <Pressable
          onPress={handleSimulate}
          disabled={simulating}
          style={[styles.simulateBtn, { backgroundColor: colors.primary }]}
        >
          {simulating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="play" size={12} color="#ffffff" />
              <ThemedText type="smallBold" style={{ color: '#ffffff', fontSize: 11, marginLeft: 4 }}>
                Simular Fluxo A ➔ Servidor ➔ B/C
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* Diagrama Visual Interativo dos Nós */}
      <View style={[styles.diagramBox, { backgroundColor: colors.backgroundElement }]}>
        {/* NÓ PRODUTOR (A) */}
        <View
          style={[
            styles.nodeCard,
            { backgroundColor: colors.card, borderColor: activeStep === 1 ? colors.danger : colors.cardBorder },
            activeStep === 1 && styles.nodeCardActive,
          ]}
        >
          <Ionicons name="phone-portrait-outline" size={20} color={colors.danger} />
          <ThemedText type="smallBold" style={{ fontSize: 11, marginTop: 2 }}>
            📱 Usuário A (Produtor)
          </ThemedText>
          <ThemedText type="small" style={{ fontSize: 9, color: colors.textSecondary }}>
            Gera evento 🌊 “Alagamento”
          </ThemedText>
        </View>

        {/* SETA DE FLUXO */}
        <View style={styles.flowArrow}>
          <Ionicons name="arrow-down" size={16} color={activeStep === 1 ? colors.danger : colors.textSecondary} />
        </View>

        {/* NÓ COORDENADOR CENTRAL & MARIADB */}
        <View
          style={[
            styles.serverNodeCard,
            { backgroundColor: colors.card, borderColor: activeStep === 2 ? colors.primary : colors.cardBorder },
            activeStep === 2 && styles.nodeCardActive,
          ]}
        >
          <View style={styles.serverHeader}>
            <Ionicons name="cloud-outline" size={20} color={colors.primary} />
            <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 6 }}>
              ☁️ Servidor / Coordenador Distribuído
            </ThemedText>
          </View>

          <View style={styles.serverSubGrid}>
            <View style={[styles.subNode, { backgroundColor: colors.backgroundElement }]}>
              <Ionicons name="server" size={14} color="#F59E0B" />
              <ThemedText type="smallBold" style={{ fontSize: 10, marginLeft: 4 }}>
                🗄️ MariaDB (ACID)
              </ThemedText>
            </View>
            <View style={[styles.subNode, { backgroundColor: colors.backgroundElement }]}>
              <Ionicons name="git-network" size={14} color="#06B6D4" />
              <ThemedText type="smallBold" style={{ fontSize: 10, marginLeft: 4 }}>
                🛰️ Distribuição Pub/Sub
              </ThemedText>
            </View>
          </View>
        </View>

        {/* SETA DE FLUXO PARA CONSUMIDORES */}
        <View style={styles.flowArrow}>
          <Ionicons name="arrow-down" size={16} color={activeStep === 3 ? colors.success : colors.textSecondary} />
        </View>

        {/* NÓS CONSUMIDORES (B e C com distâncias calculadas) */}
        <View style={styles.consumersRow}>
          <View
            style={[
              styles.consumerCard,
              { backgroundColor: colors.card, borderColor: activeStep === 3 ? colors.success : colors.cardBorder },
              activeStep === 3 && styles.nodeCardActive,
            ]}
          >
            <Ionicons name="phone-portrait-outline" size={18} color={colors.success} />
            <ThemedText type="smallBold" style={{ fontSize: 11 }}>
              📱 Usuário B
            </ThemedText>
            <View style={[styles.distancePill, { backgroundColor: colors.primaryLight }]}>
              <ThemedText type="smallBold" style={{ color: colors.primary, fontSize: 10 }}>
                📍 500m
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.consumerCard,
              { backgroundColor: colors.card, borderColor: activeStep === 3 ? colors.success : colors.cardBorder },
              activeStep === 3 && styles.nodeCardActive,
            ]}
          >
            <Ionicons name="phone-portrait-outline" size={18} color={colors.success} />
            <ThemedText type="smallBold" style={{ fontSize: 11 }}>
              📱 Usuário C
            </ThemedText>
            <View style={[styles.distancePill, { backgroundColor: colors.primaryLight }]}>
              <ThemedText type="smallBold" style={{ color: colors.primary, fontSize: 10 }}>
                📍 800m
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Log de Pacotes Distribuídos em Tempo Real */}
      <View style={styles.packetLogSection}>
        <View style={styles.logHeader}>
          <Ionicons name="receipt-outline" size={14} color={colors.textSecondary} />
          <ThemedText type="smallBold" style={{ fontSize: 12, marginLeft: 4 }}>
            Log de Mensagens da Rede ({packets.length} eventos)
          </ThemedText>
        </View>

        <ScrollView style={styles.logScrollView} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {packets.length === 0 ? (
            <ThemedText type="small" style={{ color: colors.textSecondary, fontStyle: 'italic', padding: 8 }}>
              Aguardando pacotes ou clique em “Simular Fluxo”...
            </ThemedText>
          ) : (
            packets.slice(0, 8).map((p) => (
              <View key={p.id} style={[styles.packetRow, { borderBottomColor: colors.cardBorder }]}>
                <ThemedText type="small" style={[styles.packetTime, { color: colors.textSecondary }]}>
                  {p.timestamp}
                </ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 11, color: colors.text }}>
                    {p.source} ➔ {p.destination}
                  </ThemedText>
                  <ThemedText type="small" style={{ fontSize: 10, color: colors.textSecondary }}>
                    {p.summary} {p.distanceInfo ? `(${p.distanceInfo})` : ''}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  diagramBox: {
    padding: Spacing.two,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  nodeCard: {
    width: '90%',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  nodeCardActive: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  serverNodeCard: {
    width: '95%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  serverSubGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  subNode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  flowArrow: {
    paddingVertical: 3,
  },
  consumersRow: {
    flexDirection: 'row',
    gap: 10,
    width: '95%',
  },
  consumerCard: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  distancePill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  packetLogSection: {
    marginTop: Spacing.one,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logScrollView: {
    maxHeight: 130,
  },
  packetRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  packetTime: {
    fontSize: 10,
    width: 50,
  },
});

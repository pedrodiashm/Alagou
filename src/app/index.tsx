import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AlertCard } from '@/components/alert-card';
import { NewAlertModal } from '@/components/new-alert-modal';
import { useAlerts } from '@/hooks/use-alerts';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { useColorScheme } from 'react-native';

type FilterType = 'all' | 'active' | 'nearby' | 'resolved';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const {
    alerts,
    loading,
    refreshing,
    error,
    userLocation,
    socketStatus,
    stats,
    activeBanner,
    dismissBanner,
    createAlert,
    resolveAlert,
    confirmAlert,
    refreshAlerts,
  } = useAlerts();

  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Aplica filtros locais na lista de alertas
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'active') return alert.status === 'active';
    if (filter === 'resolved') return alert.status === 'resolved';
    if (filter === 'nearby') {
      return alert.status === 'active' && alert.distanceMeters !== undefined && alert.distanceMeters <= 2000;
    }
    return true;
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header Principal */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="water" size={22} color="#ffffff" />
            </View>
            <View>
              <ThemedText type="title" style={styles.brandTitle}>
                Alagou
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Rede Distribuída de Alertas
              </ThemedText>
            </View>
          </View>

          {/* Status da Conexão Distribuída */}
          <View
            style={[
              styles.connectionPill,
              {
                backgroundColor:
                  socketStatus === 'connected'
                    ? colors.successLight
                    : socketStatus === 'connecting'
                    ? colors.warningLight
                    : colors.dangerLight,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    socketStatus === 'connected'
                      ? colors.success
                      : socketStatus === 'connecting'
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            />
            <ThemedText
              type="smallBold"
              style={{
                fontSize: 11,
                color:
                  socketStatus === 'connected'
                    ? colors.success
                    : socketStatus === 'connecting'
                    ? colors.warning
                    : colors.danger,
              }}
            >
              {socketStatus === 'connected' ? 'Nó Conectado' : socketStatus === 'connecting' ? 'Conectando...' : 'Offline'}
            </ThemedText>
          </View>
        </View>

        {/* Banner de Novo Alerta em Tempo Real (Broadcast Push) */}
        {activeBanner && (
          <Pressable
            onPress={dismissBanner}
            style={[styles.bannerAlert, { backgroundColor: colors.danger, shadowColor: '#000' }]}
          >
            <Ionicons name="warning" size={20} color="#ffffff" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                🌊 Novo Alagamento Registrado!
              </ThemedText>
              <ThemedText type="small" style={{ color: '#ffffff', opacity: 0.9 }}>
                {activeBanner.title} • 📍 {activeBanner.distanceText}
              </ThemedText>
            </View>
            <Ionicons name="close" size={18} color="#ffffff" />
          </Pressable>
        )}

        {/* Barra de Métricas Ambientais */}
        {stats && (
          <View style={[styles.statsRow, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.statItem}>
              <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
                Ativos
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: colors.danger, fontSize: 13 }}>
                🌊 {stats.activeAlerts}
              </ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
                Críticos
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: colors.warning, fontSize: 13 }}>
                ⚡ {stats.criticalAlerts}
              </ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
                Resolvidos
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: colors.success, fontSize: 13 }}>
                ✅ {stats.resolvedAlerts}
              </ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
                Banco
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: colors.primary, fontSize: 12 }}>
                🗄️ MariaDB
              </ThemedText>
            </View>
          </View>
        )}

        {/* Filtros Rápidos */}
        <View style={styles.filterChipsRow}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'all' ? colors.primary : colors.backgroundElement },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: filter === 'all' ? '#ffffff' : colors.text, fontSize: 12 }}
            >
              Todos ({alerts.length})
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setFilter('active')}
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'active' ? colors.danger : colors.backgroundElement },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: filter === 'active' ? '#ffffff' : colors.text, fontSize: 12 }}
            >
              🌊 Ativos ({alerts.filter((a) => a.status === 'active').length})
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setFilter('nearby')}
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'nearby' ? colors.accent : colors.backgroundElement },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: filter === 'nearby' ? '#ffffff' : colors.text, fontSize: 12 }}
            >
              📍 Próximos (&lt;2km)
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setFilter('resolved')}
            style={[
              styles.filterChip,
              { backgroundColor: filter === 'resolved' ? colors.success : colors.backgroundElement },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: filter === 'resolved' ? '#ffffff' : colors.text, fontSize: 12 }}
            >
              ✅ Resolvidos ({alerts.filter((a) => a.status === 'resolved').length})
            </ThemedText>
          </Pressable>
        </View>

        {/* Lista de Alertas */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.two }}>
              Sincronizando com a rede distribuída...
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredAlerts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AlertCard alert={item} onConfirm={confirmAlert} onResolve={resolveAlert} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAlerts} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark" size={48} color={colors.success} />
                <ThemedText type="subtitle" style={{ marginTop: Spacing.two, textAlign: 'center' }}>
                  Nenhum alagamento nesta categoria
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                  Você pode registrar um novo foco clicando no botão abaixo.
                </ThemedText>
              </View>
            }
          />
        )}

        {/* Botão de Ação Flutuante (FAB): "Alagou!" */}
        <Pressable
          onPress={() => setModalVisible(true)}
          style={[styles.fabButton, { backgroundColor: colors.danger, shadowColor: '#000' }]}
        >
          <Ionicons name="water" size={24} color="#ffffff" />
          <ThemedText type="subtitle" style={styles.fabText}>
            Alagou!
          </ThemedText>
        </Pressable>

        {/* Modal de Registro de Novo Alagamento */}
        <NewAlertModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSubmit={createAlert}
          userLocation={userLocation}
        />
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
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  bannerAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.three,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  listContent: {
    paddingBottom: BottomTabInset + 80,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  fabButton: {
    position: 'absolute',
    bottom: BottomTabInset + 16,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
});

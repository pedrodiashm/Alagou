import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FloodAlert } from '@/types/alert';
import { Colors, SeverityColors, Spacing, Fonts } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useColorScheme } from 'react-native';

interface AlertCardProps {
  alert: FloodAlert;
  onConfirm: (id: string) => Promise<any> | any;
  onResolve: (id: string) => Promise<any> | any;
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recente';
  }
}

function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null) return 'Calculando...';
  if (meters < 1000) return `${meters}m de você`;
  return `${(meters / 1000).toFixed(1)} km de você`;
}

export function AlertCard({ alert, onConfirm, onResolve }: AlertCardProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const severityStyle = SeverityColors[alert.severity] || SeverityColors.moderate;

  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [hasConfirmedLocally, setHasConfirmedLocally] = useState(false);

  const isResolved = alert.status === 'resolved';

  const handleConfirm = async () => {
    if (hasConfirmedLocally || isResolved) return;
    setConfirming(true);
    try {
      await onConfirm(alert.id);
      setHasConfirmedLocally(true);
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Erro ao confirmar');
      } else {
        Alert.alert('Erro', err.message || 'Erro ao confirmar alerta');
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleResolve = async () => {
    const executeResolve = async () => {
      setResolving(true);
      try {
        await onResolve(alert.id);
      } catch (err: any) {
        if (Platform.OS === 'web') {
          window.alert(err.message || 'Erro ao encerrar');
        } else {
          Alert.alert('Erro', err.message || 'Erro ao encerrar alerta');
        }
      } finally {
        setResolving(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja confirmar que a água baixou em "${alert.title}" e marcar como resolvido?`)) {
        await executeResolve();
      }
    } else {
      Alert.alert(
        'Confirmar Resolução',
        `A água já baixou no local (${alert.title})? Esta ação será sincronizada com todos os nós.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sim, Água Baixou', style: 'default', onPress: executeResolve },
        ]
      );
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isResolved ? colors.cardBorder : severityStyle.border,
          shadowColor: '#000',
        },
      ]}
    >
      {/* Top Header: Severidade, Distância e Status */}
      <View style={styles.headerRow}>
        <View style={[styles.severityBadge, { backgroundColor: isResolved ? colors.backgroundSelected : severityStyle.bg }]}>
          <Ionicons
            name={isResolved ? 'checkmark-circle-outline' : (severityStyle.icon as any)}
            size={14}
            color={isResolved ? colors.textSecondary : severityStyle.text}
          />
          <ThemedText
            type="smallBold"
            style={{
              color: isResolved ? colors.textSecondary : severityStyle.text,
              textTransform: 'uppercase',
              fontSize: 11,
              marginLeft: 4,
            }}
          >
            {isResolved ? 'Resolvido' : severityStyle.label}
          </ThemedText>
        </View>

        {alert.distanceMeters !== undefined && (
          <View style={[styles.distanceBadge, { backgroundColor: colors.backgroundElement }]}>
            <Ionicons name="navigate-circle" size={13} color={colors.primary} />
            <ThemedText type="smallBold" style={[styles.distanceText, { color: colors.primary }]}>
              {formatDistance(alert.distanceMeters)}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Título e Endereço */}
      <ThemedText type="subtitle" style={[styles.title, isResolved && styles.resolvedTitle]}>
        {alert.title}
      </ThemedText>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
        <ThemedText type="small" style={[styles.addressText, { color: colors.textSecondary }]}>
          {alert.address}
        </ThemedText>
      </View>

      {/* Descrição */}
      {!!alert.description && (
        <ThemedText type="default" style={[styles.description, { color: colors.text }]}>
          {alert.description}
        </ThemedText>
      )}

      {/* Indicadores ambientais: Nível d'água, Causa e Horário */}
      <View style={[styles.detailsGrid, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={[styles.detailLabel, { color: colors.textSecondary }]}>
            🌊 Nível da Água
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: colors.text }}>
            {alert.waterLevel || 'Não informado'}
          </ThemedText>
        </View>

        <View style={styles.detailItem}>
          <ThemedText type="small" style={[styles.detailLabel, { color: colors.textSecondary }]}>
            🌧️ Causa
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: colors.text }}>
            {alert.cause || 'Chuva forte'}
          </ThemedText>
        </View>

        <View style={styles.detailItem}>
          <ThemedText type="small" style={[styles.detailLabel, { color: colors.textSecondary }]}>
            👁️ Registrado
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: colors.text }}>
            {formatRelativeTime(alert.createdAt)}
          </ThemedText>
        </View>
      </View>

      {/* Rodapé: Informações do Nó Produtor e Ações Colaborativas */}
      <View style={styles.footerRow}>
        <ThemedText type="small" style={[styles.reportedByText, { color: colors.textSecondary }]}>
          Origem: {alert.reportedBy}
        </ThemedText>

        <View style={styles.actionsRow}>
          {/* Botão de Validação / Consenso */}
          <Pressable
            onPress={handleConfirm}
            disabled={confirming || hasConfirmedLocally || isResolved}
            style={[
              styles.actionButton,
              styles.confirmButton,
              hasConfirmedLocally && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
            ]}
          >
            {confirming ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name={hasConfirmedLocally ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={14}
                  color={hasConfirmedLocally ? colors.primary : colors.textSecondary}
                />
                <ThemedText
                  type="smallBold"
                  style={{
                    color: hasConfirmedLocally ? colors.primary : colors.textSecondary,
                    marginLeft: 4,
                    fontSize: 12,
                  }}
                >
                  Confirmar ({alert.confirmations})
                </ThemedText>
              </>
            )}
          </Pressable>

          {/* Botão de Resolução */}
          {!isResolved ? (
            <Pressable
              onPress={handleResolve}
              disabled={resolving}
              style={[styles.actionButton, styles.resolveButton, { backgroundColor: colors.successLight }]}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={15} color={colors.success} />
                  <ThemedText type="smallBold" style={{ color: colors.success, marginLeft: 4, fontSize: 12 }}>
                    Água Baixou
                  </ThemedText>
                </>
              )}
            </Pressable>
          ) : (
            <View style={[styles.resolvedBadge, { backgroundColor: colors.successLight }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <ThemedText type="smallBold" style={{ color: colors.success, marginLeft: 4, fontSize: 11 }}>
                Resolvido
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  distanceText: {
    fontSize: 12,
    marginLeft: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  resolvedTitle: {
    opacity: 0.7,
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  addressText: {
    fontSize: 13,
    marginLeft: 4,
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.two,
    borderRadius: 10,
    marginBottom: Spacing.three,
    gap: 8,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  reportedByText: {
    fontSize: 11,
    maxWidth: '35%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  confirmButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  resolveButton: {},
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
});

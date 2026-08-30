import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FloodAlert, UserLocation } from '@/types/alert';
import { Colors, SeverityColors, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { useColorScheme } from 'react-native';

interface RadarMapViewProps {
  alerts: FloodAlert[];
  userLocation: UserLocation;
  onSelectAlert?: (alert: FloodAlert) => void;
  onUserLocationChange?: (latitude: number, longitude: number) => void;
}

export function RadarMapView({ alerts, userLocation, onSelectAlert, onUserLocationChange }: RadarMapViewProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [selectedAlert, setSelectedAlert] = useState<FloodAlert | null>(null);
  const [fieldSize, setFieldSize] = useState<{ width: number; height: number } | null>(null);

  // Calcula offsets de posicionamento relativo no mapa de radar circular
  // Centro = userLocation
  const PIXELS_PER_DEGREE = 2000; // pixels por grau (escala usada nos marcadores)

  const radarRef = useRef<View | null>(null);

  const applyTap = useCallback(
    (locationX: number, locationY: number) => {
      if (!onUserLocationChange || !fieldSize) return;
      const dLng = (locationX - fieldSize.width / 2) / PIXELS_PER_DEGREE;
      const dLat = -(locationY - fieldSize.height / 2) / PIXELS_PER_DEGREE;
      onUserLocationChange(userLocation.latitude + dLat, userLocation.longitude + dLng);
    },
    [onUserLocationChange, userLocation.latitude, userLocation.longitude, fieldSize]
  );

  // No web, o onPress do Pressable nem sempre entrega locationX/locationY,
  // então capturamos as coordenadas direto do DOM (relativas ao radar).
  useEffect(() => {
    if (Platform.OS !== 'web' || !onUserLocationChange) return;
    const node = radarRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const handlePointer = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('[data-testid]')) return;
      const rect = node.getBoundingClientRect();
      applyTap(e.clientX - rect.left, e.clientY - rect.top);
    };

    node.addEventListener('pointerup', handlePointer);
    return () => node.removeEventListener('pointerup', handlePointer);
  }, [onUserLocationChange, applyTap]);

  const activeAlerts = alerts.filter((a) => a.status === 'active');

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="compass-outline" size={18} color={colors.primary} />
          <ThemedText type="smallBold" style={{ marginLeft: 6, fontSize: 14 }}>
            Radar Geoespacial Distribuído
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: colors.textSecondary }}>
          {activeAlerts.length} focos no perímetro
        </ThemedText>
      </View>

      {/* Área do Radar */}
      <Pressable
        ref={radarRef}
        onLayout={(e) => setFieldSize(e.nativeEvent.layout)}
        onPress={
          Platform.OS === 'web'
            ? undefined
            : (e: any) => {
                const { locationX = 0, locationY = 0 } = e.nativeEvent;
                applyTap(locationX, locationY);
              }
        }
        style={[styles.radarField, { backgroundColor: scheme === 'dark' ? '#070B14' : '#F1F5F9' }]}
      >
        {/* Círculos Concêntricos de Distância */}
        <View style={[styles.radarRing, styles.ringLarge, { borderColor: colors.primary, opacity: 0.15 }]} />
        <View style={[styles.radarRing, styles.ringMedium, { borderColor: colors.primary, opacity: 0.25 }]} />
        <View style={[styles.radarRing, styles.ringSmall, { borderColor: colors.primary, opacity: 0.35 }]} />

        {/* Linhas de Eixo do Radar */}
        <View style={[styles.axisHorizontal, { backgroundColor: colors.primary, opacity: 0.1 }]} />
        <View style={[styles.axisVertical, { backgroundColor: colors.primary, opacity: 0.1 }]} />

        {/* Marcadores de Distância dos Anéis */}
        <ThemedText type="small" style={[styles.ringLabel, { top: '18%', color: colors.textSecondary }]}>
          2 km
        </ThemedText>
        <ThemedText type="small" style={[styles.ringLabel, { top: '30%', color: colors.textSecondary }]}>
          1 km
        </ThemedText>
        <ThemedText type="small" style={[styles.ringLabel, { top: '42%', color: colors.textSecondary }]}>
          500m
        </ThemedText>

        {/* Ponto Central: Posição do Usuário Atual */}
        <View style={[styles.userBeacon, { backgroundColor: colors.primary }]}>
          <View style={[styles.userBeaconPulse, { borderColor: colors.primary }]} />
          <Ionicons name="person" size={12} color="#ffffff" />
        </View>

        {/* Marcadores de Alagamento */}
        {activeAlerts.map((alert) => {
          const dLat = (alert.latitude - userLocation.latitude) * 2000;
          const dLng = (alert.longitude - userLocation.longitude) * 2000;

          // Clampa para ficar dentro dos limites visíveis do radar
          const clampedX = Math.max(-120, Math.min(120, dLng));
          const clampedY = Math.max(-100, Math.min(100, -dLat));

          const sevStyle = SeverityColors[alert.severity] || SeverityColors.moderate;
          const isSelected = selectedAlert?.id === alert.id;

          return (
            <Pressable
              key={alert.id}
              testID={`alertpin-${alert.id}`}
              onPress={() => {
                setSelectedAlert(alert);
                if (onSelectAlert) onSelectAlert(alert);
              }}
              style={[
                styles.alertPin,
                {
                  transform: [{ translateX: clampedX }, { translateY: clampedY }],
                  backgroundColor: sevStyle.bg,
                  borderColor: isSelected ? colors.text : sevStyle.text,
                  borderWidth: isSelected ? 2 : 1.5,
                  zIndex: isSelected ? 10 : 5,
                },
              ]}
            >
              <Ionicons name="water" size={13} color={sevStyle.text} />
              {alert.distanceMeters && (
                <View style={[styles.pinDistanceBadge, { backgroundColor: sevStyle.text }]}>
                  <ThemedText style={styles.pinDistanceText}>
                    {alert.distanceMeters < 1000 ? `${alert.distanceMeters}m` : `${(alert.distanceMeters / 1000).toFixed(1)}k`}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </Pressable>

      {Platform.OS === 'web' && onUserLocationChange && (
        <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
          💡 Sem GPS no navegador: toque no radar para definir sua posição.
        </ThemedText>
      )}

      {/* Card de Detalhe Rápido do Alerta Selecionado no Radar */}
      {selectedAlert && (
        <View style={[styles.selectedAlertPreview, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.previewHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 13, color: colors.text }}>
                {selectedAlert.title}
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>
                {selectedAlert.address}
              </ThemedText>
            </View>
            <Pressable onPress={() => setSelectedAlert(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.previewMeta}>
            <ThemedText type="smallBold" style={{ color: colors.primary, fontSize: 11 }}>
              📍 {selectedAlert.distanceMeters ? `${selectedAlert.distanceMeters}m de você` : 'Próximo'}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>
              🌊 {selectedAlert.waterLevel}
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    overflow: 'hidden',
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
  },
  radarField: {
    height: 240,
    borderRadius: 14,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  ringSmall: {
    width: 80,
    height: 80,
  },
  ringMedium: {
    width: 150,
    height: 150,
  },
  ringLarge: {
    width: 220,
    height: 220,
  },
  axisHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
  },
  axisVertical: {
    position: 'absolute',
    height: '100%',
    width: 1,
  },
  ringLabel: {
    position: 'absolute',
    fontSize: 9,
    right: 12,
  },
  userBeacon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 4,
  },
  userBeaconPulse: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    opacity: 0.6,
  },
  alertPin: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  pinDistanceBadge: {
    position: 'absolute',
    bottom: -8,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pinDistanceText: {
    fontSize: 7,
    color: '#ffffff',
    fontWeight: '700',
  },
  selectedAlertPreview: {
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
});

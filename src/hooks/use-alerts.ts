import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { FloodAlert, UserLocation, CreateAlertInput, SystemStats } from '@/types/alert';
import {
  fetchAlerts,
  createAlertApi,
  resolveAlertApi,
  confirmAlertApi,
  fetchSystemStats,
  simulateAcademicScenario,
} from '@/services/api';
import { socketService, SocketStatus } from '@/services/socket';

// Localização padrão de referência (Centro de São Paulo / Sé) caso GPS não esteja autorizado
const DEFAULT_LOCATION: UserLocation = {
  latitude: -23.55052,
  longitude: -46.633308,
  address: '',
};

export function useAlerts() {
  const [alerts, setAlerts] = useState<FloodAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation>(DEFAULT_LOCATION);
  const [hasGpsPermission, setHasGpsPermission] = useState<boolean>(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activeBanner, setActiveBanner] = useState<{
    id: string;
    title: string;
    distanceText?: string;
    severity: string;
  } | null>(null);

  const bannerTimerRef = useRef<any>(null);

  // 1. Inicializa Localização GPS
  const initLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasGpsPermission(true);
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const newLoc: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setUserLocation(newLoc);
        socketService.updateLocation(newLoc.latitude, newLoc.longitude);
      } else {
        setHasGpsPermission(false);
      }
    } catch (err) {
      console.warn('Não foi possível obter GPS:', err);
    }
  }, []);

  // 2. Carrega Alertas da API
  const loadAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAlerts({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      });
      setAlerts(data);

      const systemStats = await fetchSystemStats().catch(() => null);
      if (systemStats) setStats(systemStats);
    } catch (err: any) {
      console.warn('Erro ao buscar alertas:', err.message);
      setError('Servidor em modo autônomo. Exibindo alertas sincronizados localmente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userLocation.latitude, userLocation.longitude]);

  // 3. Conexão WebSocket e Inscrição em Eventos Distribuídos
  useEffect(() => {
    initLocation();

    socketService.connect('📱 App Móvel Alagou', userLocation.latitude, userLocation.longitude);

    const unsubStatus = socketService.subscribeStatus((status) => {
      setSocketStatus(status);
    });

    const unsubAlert = socketService.subscribeAlerts((payload) => {
      const { alert, distanceText } = payload;

      setAlerts((prev) => {
        // Remove se já existia e insere no topo atualizado
        const filtered = prev.filter((a) => a.id !== alert.id);
        return [alert, ...filtered];
      });

      // Exibe banner de notificação distribuída em tempo real
      setActiveBanner({
        id: alert.id,
        title: alert.title,
        distanceText: distanceText || 'Próximo',
        severity: alert.severity,
      });

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        setActiveBanner(null);
      }, 7000);
    });

    const unsubResolved = socketService.subscribeResolved((payload) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === payload.alert.id
            ? { ...a, status: 'resolved', resolvedAt: payload.resolvedAt, resolvedBy: payload.resolvedBy }
            : a
        )
      );
    });

    const unsubConfirmed = socketService.subscribeConfirmed((payload) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === payload.alertId ? { ...a, confirmations: payload.confirmations } : a))
      );
    });

    return () => {
      unsubStatus();
      unsubAlert();
      unsubResolved();
      unsubConfirmed();
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [initLocation]);

  // Carrega alertas quando a localização for definida
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 4. Criação de Novo Alerta (🌊 Produtor)
  const createAlert = async (input: Omit<CreateAlertInput, 'deviceId'>) => {
    try {
      const created = await createAlertApi({
        ...input,
        deviceId: socketService.getDeviceId(),
      });
      setAlerts((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      return created;
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao registrar alerta');
    }
  };

  // 5. Resolução de Alerta (✅ Encerramento)
  const resolveAlert = async (id: string, resolvedBy = 'Usuário no Local') => {
    try {
      const updated = await resolveAlertApi(id, resolvedBy);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao encerrar alerta');
    }
  };

  // 6. Confirmação Coletiva (Consenso)
  const confirmAlert = async (id: string) => {
    try {
      const updated = await confirmAlertApi(id, socketService.getDeviceId());
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao confirmar alerta');
    }
  };

  // 7. Simulação do Cenário de Demonstração Acadêmica
  const triggerSimulation = async () => {
    try {
      const simulated = await simulateAcademicScenario();
      setAlerts((prev) => [simulated, ...prev.filter((a) => a.id !== simulated.id)]);
      return simulated;
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao rodar simulação');
    }
  };

  return {
    alerts,
    loading,
    refreshing,
    error,
    userLocation,
    hasGpsPermission,
    socketStatus,
    stats,
    activeBanner,
    dismissBanner: () => setActiveBanner(null),
    createAlert,
    resolveAlert,
    confirmAlert,
    refreshAlerts: () => loadAlerts(true),
    triggerSimulation,
    setUserLocation,
  };
}

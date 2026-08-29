import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SeverityLevel, UserLocation, CreateAlertInput } from '@/types/alert';
import { Colors, SeverityColors, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { useColorScheme } from 'react-native';

interface NewAlertModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateAlertInput, 'deviceId'>) => Promise<any> | any;
  userLocation: UserLocation;
}

const SEVERITY_OPTIONS: { level: SeverityLevel; label: string; desc: string; icon: any }[] = [
  {
    level: 'low',
    label: 'Leve',
    desc: 'Lâmina d água (até 15cm). Carros passam devagar.',
    icon: 'water-outline',
  },
  {
    level: 'moderate',
    label: 'Moderado',
    desc: 'Metade da roda (20-35cm). Risco a pedestres e carros baixos.',
    icon: 'warning-outline',
  },
  {
    level: 'high',
    label: 'Grave',
    desc: 'Nível da porta (40-60cm). Via intransitável para veículos.',
    icon: 'alert-circle-outline',
  },
  {
    level: 'critical',
    label: 'Crítico',
    desc: 'Inundação total (+70cm). Risco de arraste e perigo de vida.',
    icon: 'flash-outline',
  },
];

const WATER_LEVEL_PRESETS = [
  '15cm (Lâmina d água)',
  '30cm (Metade da Roda)',
  '50cm (Nível da Porta)',
  '80cm+ (Inundação Total)',
];

const CAUSE_PRESETS = [
  'Chuva Torrencial',
  'Bueiro Obstruído',
  'Transbordamento de Rio/Córrego',
  'Galeria Rompida',
];

export function NewAlertModal({ visible, onClose, onSubmit, userLocation }: NewAlertModalProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('moderate');
  const [waterLevel, setWaterLevel] = useState(WATER_LEVEL_PRESETS[1]);
  const [cause, setCause] = useState(CAUSE_PRESETS[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      const msg = 'Por favor, informe um título ou localização para o alagamento.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Atenção', msg);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        address: address.trim() || `Lat: ${userLocation.latitude.toFixed(4)}, Lng: ${userLocation.longitude.toFixed(4)}`,
        description: description.trim(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        severity,
        waterLevel,
        cause,
        reportedBy: '📱 Você (Nó Produtor)',
      });

      // Reset form
      setTitle('');
      setDescription('');
      setAddress('');
      onClose();
    } catch (err: any) {
      const errorMsg = err.message || 'Falha ao propagar alerta na rede distribuída.';
      if (Platform.OS === 'web') window.alert(errorMsg);
      else Alert.alert('Erro', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconPill, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="water" size={20} color={colors.danger} />
              </View>
              <View>
                <ThemedText type="title" style={styles.headerTitle}>
                  Alagou!
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Emitir alerta para nós próximos
                </ThemedText>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Indicador de GPS Ativo */}
            <View style={[styles.gpsBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <ThemedText type="smallBold" style={{ color: colors.primary, marginLeft: 6, flex: 1 }}>
                GPS: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </ThemedText>
            </View>

            {/* Nome do Local / Título */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Onde está alagado? *
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundElement,
                    color: colors.text,
                    borderColor: colors.cardBorder,
                  },
                ]}
                placeholder="Ex: Av. Ipiranga com Av. São João"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Ponto de Referência / Endereço */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Ponto de Referência / Bairro
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundElement,
                    color: colors.text,
                    borderColor: colors.cardBorder,
                  },
                ]}
                placeholder="Ex: Próximo à estação de metrô ou viaduto"
                placeholderTextColor={colors.textSecondary}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* Seletor de Severidade */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Grau de Severidade *
              </ThemedText>
              <View style={styles.severityGrid}>
                {SEVERITY_OPTIONS.map((opt) => {
                  const isSelected = severity === opt.level;
                  const sevColor = SeverityColors[opt.level];
                  return (
                    <Pressable
                      key={opt.level}
                      onPress={() => setSeverity(opt.level)}
                      style={[
                        styles.severityCard,
                        {
                          backgroundColor: isSelected ? sevColor.bg : colors.backgroundElement,
                          borderColor: isSelected ? sevColor.text : colors.cardBorder,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.severityCardHeader}>
                        <Ionicons
                          name={opt.icon}
                          size={18}
                          color={isSelected ? sevColor.text : colors.textSecondary}
                        />
                        <ThemedText
                          type="smallBold"
                          style={{
                            color: isSelected ? sevColor.text : colors.text,
                            marginLeft: 6,
                          }}
                        >
                          {opt.label}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="small"
                        style={{
                          color: isSelected ? sevColor.text : colors.textSecondary,
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {opt.desc}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Nível da Água */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Nível Estimado da Água
              </ThemedText>
              <View style={styles.chipsRow}>
                {WATER_LEVEL_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setWaterLevel(preset)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: waterLevel === preset ? colors.primary : colors.backgroundElement,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: waterLevel === preset ? '#ffffff' : colors.text,
                        fontSize: 12,
                      }}
                    >
                      {preset}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Causa Aparente */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Causa Observada
              </ThemedText>
              <View style={styles.chipsRow}>
                {CAUSE_PRESETS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCause(c)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: cause === c ? colors.primary : colors.backgroundElement,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: cause === c ? '#ffffff' : colors.text,
                        fontSize: 12,
                      }}
                    >
                      {c}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Detalhes / Observações */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.label}>
                Detalhes Adicionais (opcional)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.backgroundElement,
                    color: colors.text,
                    borderColor: colors.cardBorder,
                  },
                ]}
                placeholder="Ex: Água começou a subir há 10 minutos. Linha de ônibus desviada."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </ScrollView>

          {/* Footer CTA */}
          <View style={[styles.modalFooter, { borderTopColor: colors.cardBorder }]}>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.submitButton, { backgroundColor: colors.danger }]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="radio" size={20} color="#ffffff" />
                  <ThemedText type="subtitle" style={styles.submitButtonText}>
                    Difundir Alerta no Sistema
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    padding: 6,
  },
  scrollArea: {
    padding: Spacing.four,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 10,
    marginBottom: Spacing.three,
  },
  formGroup: {
    marginBottom: Spacing.four,
  },
  label: {
    fontSize: 13,
    marginBottom: Spacing.one,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  severityGrid: {
    gap: 8,
  },
  severityCard: {
    padding: 10,
    borderRadius: 10,
  },
  severityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalFooter: {
    padding: Spacing.four,
    borderTopWidth: 0.5,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});

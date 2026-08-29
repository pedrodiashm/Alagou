import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function ProposalScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [activeTab, setActiveTab] = useState<'proposal' | 'architecture' | 'database'>('proposal');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconBox, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="school" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.two }}>
            <ThemedText type="title" style={{ fontSize: 20 }}>
              Proposta Acadêmica
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Sistemas Distribuídos • Coordenação Auxiliar
            </ThemedText>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabsRow, { backgroundColor: colors.backgroundElement }]}>
          <Pressable
            onPress={() => setActiveTab('proposal')}
            style={[
              styles.tabBtn,
              activeTab === 'proposal' && { backgroundColor: colors.card, shadowColor: '#000', elevation: 2 },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: activeTab === 'proposal' ? colors.primary : colors.textSecondary }}
            >
              📄 Proposta
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('architecture')}
            style={[
              styles.tabBtn,
              activeTab === 'architecture' && { backgroundColor: colors.card, shadowColor: '#000', elevation: 2 },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: activeTab === 'architecture' ? colors.primary : colors.textSecondary }}
            >
              🛰️ Arquitetura
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('database')}
            style={[
              styles.tabBtn,
              activeTab === 'database' && { backgroundColor: colors.card, shadowColor: '#000', elevation: 2 },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: activeTab === 'database' ? colors.primary : colors.textSecondary }}
            >
              🗄️ MariaDB
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {activeTab === 'proposal' && (
            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <ThemedText type="subtitle" style={styles.sectionHeading}>
                1. Contexto & Requisitos
              </ThemedText>
              <ThemedText type="default" style={[styles.bodyText, { color: colors.text }]}>
                O <ThemedText type="smallBold">Alagou</ThemedText> é um sistema distribuído projetado para dispositivos
                móveis que aborda o desafio crítico de <ThemedText type="smallBold">alagamentos e inundações urbanas</ThemedText>.
              </ThemedText>

              <ThemedText type="subtitle" style={[styles.sectionHeading, { marginTop: Spacing.four }]}>
                2. Funcionalidades do Usuário Móvel
              </ThemedText>
              <View style={styles.bulletList}>
                <ThemedText type="default" style={styles.bulletItem}>
                  📍 <ThemedText type="smallBold">Visualizar alertas próximos</ThemedText> ordenados por distância relativa (ex.: 500m, 800m).
                </ThemedText>
                <ThemedText type="default" style={styles.bulletItem}>
                  🌊 <ThemedText type="smallBold">Registrar novo alagamento</ThemedText> com GPS automático, nível da água e causa observada.
                </ThemedText>
                <ThemedText type="default" style={styles.bulletItem}>
                  👁️ <ThemedText type="smallBold">Visualizar tempo de registro</ThemedText> com precisão temporal ("há 5 min").
                </ThemedText>
                <ThemedText type="default" style={styles.bulletItem}>
                  ✅ <ThemedText type="smallBold">Marcar como resolvido / encerrado</ThemedText> quando o nível da água baixar.
                </ThemedText>
                <ThemedText type="default" style={styles.bulletItem}>
                  🤝 <ThemedText type="smallBold">Consenso Comunitário (+1)</ThemedText> para validação contra falsos positivos.
                </ThemedText>
              </View>

              <View style={[styles.statusBox, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <ThemedText type="smallBold" style={{ color: colors.success }}>
                    Submissão Pronta para Aprovação
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.success, fontSize: 12 }}>
                    Arquivo formal gerado em PROPOSTA_PROJETO.md
                  </ThemedText>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'architecture' && (
            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <ThemedText type="subtitle" style={styles.sectionHeading}>
                Fundamentos de Sistemas Distribuídos
              </ThemedText>

              <View style={[styles.archItem, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="git-branch-outline" size={22} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                    Modelo Produtor-Consumidor
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    O Dispositivo A produz o evento de alagamento; o servidor despacha e os Dispositivos B e C consomem os dados.
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.archItem, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="radio-outline" size={22} color="#06B6D4" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                    Publish / Subscribe (Pub/Sub)
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    Comunicação assíncrona full-duplex via WebSockets com JSON envelopes para difusão instantânea.
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.archItem, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="navigate-outline" size={22} color="#F59E0B" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                    Distribuição Geo-Particionada
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    Cálculo da fórmula de Haversine para filtrar e entregar a distância exata customizada para cada nó receptor (ex: 500m, 800m).
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.archItem, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                    Consenso e Tolerância a Falhas
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    Heartbeat (ping/pong), reconexão automática exponencial e validação cruzada por votos comunitários.
                  </ThemedText>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'database' && (
            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <ThemedText type="subtitle" style={styles.sectionHeading}>
                Banco de Dados Relacional: MariaDB
              </ThemedText>
              <ThemedText type="default" style={[styles.bodyText, { color: colors.text }]}>
                O sistema utiliza <ThemedText type="smallBold">MariaDB (porta 3306)</ThemedText> com pool de conexões otimizado (`mysql2/promise`) e transações ACID.
              </ThemedText>

              <View style={[styles.codeBox, { backgroundColor: scheme === 'dark' ? '#070B14' : '#F1F5F9' }]}>
                <ThemedText type="code" style={{ fontSize: 11, color: colors.primary }}>
                  {`CREATE TABLE alerts (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  address VARCHAR(255) NOT NULL,
  severity ENUM('low','moderate','high','critical'),
  water_level VARCHAR(60),
  cause VARCHAR(120),
  status ENUM('active','resolved'),
  reported_by VARCHAR(100),
  confirmations INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL
);`}
                </ThemedText>
              </View>

              <ThemedText type="smallBold" style={{ marginTop: Spacing.three, marginBottom: Spacing.one }}>
                Como rodar o banco de dados:
              </ThemedText>
              <View style={[styles.commandPill, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="code" style={{ fontSize: 12 }}>
                  npm run db:up   # ou: docker compose up -d
                </ThemedText>
              </View>
            </View>
          )}
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
  tabsRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: Spacing.three,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  contentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.six,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  bulletList: {
    gap: 8,
    marginVertical: Spacing.two,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    marginTop: Spacing.four,
  },
  archItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  codeBox: {
    padding: Spacing.three,
    borderRadius: 10,
    marginVertical: Spacing.two,
  },
  commandPill: {
    padding: Spacing.two,
    borderRadius: 8,
  },
});

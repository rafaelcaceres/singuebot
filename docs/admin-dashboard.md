# 🎛️ Painel Administrativo

## Visão Geral

O painel administrativo é o centro de controle do WhatsApp AI Assistant. Aqui você monitora conversas, gerencia conhecimento, acompanha métricas e administra usuários.

**Acesso**: `http://localhost:5174/admin`

---

## 🏠 Dashboard Principal

### KPIs em Tempo Real

#### Métricas de Participantes
```typescript
// Dados exibidos
{
  totalParticipants: number,      // Total de usuários únicos
  activeToday: number,            // Ativos nas últimas 24h
  newThisWeek: number,           // Novos participantes (7 dias)
  completionRate: number         // % que completaram entrevista
}
```

#### Métricas de Sistema
- **Latência p95**: Tempo de resposta do bot
- **Taxa de Resposta**: % de mensagens respondidas
- **Uptime**: Disponibilidade do sistema
- **Documentos Processados**: Status da base de conhecimento

### Gráficos Interativos

#### 📈 Atividade por Hora
- **O que mostra**: Picos de uso durante o dia
- **Como usar**: Identifique horários de maior demanda
- **Período**: Últimas 24 horas

#### 📊 Progressão por Etapa
- **O que mostra**: Distribuição de usuários por etapa da entrevista
- **Como usar**: Identifique gargalos no fluxo
- **Etapas**: intro → termos_aceite → momento_carreira → expectativas_evento → objetivo_principal → finalizacao

#### 🔄 Taxa de Conversão
- **O que mostra**: Funil de conversão entre etapas
- **Como usar**: Otimize etapas com alta taxa de abandono

---

## 👥 Gestão de Participantes

### Lista de Participantes

#### Filtros Disponíveis
```typescript
interface ParticipantFilters {
  stage: 'intro' | 'termos_aceite' | 'momento_carreira' | 'expectativas_evento' | 'objetivo_principal' | 'finalizacao' | 'completed',
  dateRange: 'today' | 'week' | 'month' | 'all',
  status: 'active' | 'inactive' | 'blocked'
}
```

#### Informações Exibidas
- **Nome/Telefone**: Identificação do usuário
- **Etapa Atual**: Onde parou na entrevista
- **Última Atividade**: Timestamp da última mensagem
- **Total de Mensagens**: Nível de engajamento
- **Status**: Ativo, inativo ou bloqueado

### Ações Disponíveis

#### 👁️ Ver Conversa
```typescript
// Abre modal com histórico completo
interface ConversationView {
  messages: Message[],           // Todas as mensagens
  stateSnapshot: InterviewState, // Estado atual da entrevista
  metadata: {
    startedAt: Date,
    lastActivity: Date,
    totalMessages: number,
    currentStage: string
  }
}
```

#### 📤 Exportar Dados (LGPD)
- **Formato**: JSON estruturado
- **Conteúdo**: Todas as informações do usuário
- **Uso**: Atendimento a solicitações LGPD

#### 🚫 Bloquear Usuário
- **Efeito**: Para processamento de mensagens
- **Reversível**: Pode ser desbloqueado
- **Log**: Ação registrada para auditoria

---

## 💬 Monitoramento de Conversas

### Visualização em Tempo Real

#### Lista de Conversas Ativas
```typescript
interface ActiveConversation {
  participantId: string,
  lastMessage: {
    content: string,
    timestamp: Date,
    direction: 'inbound' | 'outbound'
  },
  currentStage: string,
  responseTime: number,        // ms para responder
  isWaitingResponse: boolean
}
```

#### Detalhes da Conversa
- **Timeline**: Sequência cronológica de mensagens
- **Estado da Entrevista**: Snapshot do estado atual
- **Metadados Técnicos**: IDs, timestamps, status de entrega
- **Contexto de IA**: Prompt usado, tokens consumidos

### Intervenção Manual

#### 📝 Enviar Mensagem
```typescript
// Interface para envio manual
interface ManualMessage {
  to: string,              // Número do WhatsApp
  content: string,         // Texto da mensagem
  bypassAI: boolean,       // Pular processamento de IA
  markAsAdmin: boolean     // Marcar como mensagem administrativa
}
```

#### ⏸️ Pausar Bot
- **Uso**: Permite intervenção humana
- **Duração**: Configurável (15min, 1h, indefinido)
- **Retomada**: Manual ou automática

---

## 📚 Gestão de Conhecimento

### Upload de Documentos

#### Formatos Suportados
```typescript
const SUPPORTED_FORMATS = [
  'application/pdf',           // PDF
  'text/plain',               // TXT
  'text/markdown',            // MD
  'application/msword',       // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

#### Interface de Upload
- **Drag & Drop**: Arraste arquivos diretamente
- **Seleção Manual**: Clique para escolher arquivos
- **Múltiplos Arquivos**: Upload em lote
- **Validação**: Formato e tamanho verificados

### Processamento de Documentos

#### Estados do Documento
```typescript
type DocumentStatus = 
  | 'pending'      // Aguardando processamento
  | 'processing'   // Sendo processado
  | 'completed'    // Pronto para uso
  | 'failed'       // Erro no processamento
  | 'reindexing';  // Reprocessando
```

#### Pipeline de Processamento
1. **Upload** → Arquivo salvo no Convex
2. **Extração** → Texto extraído do documento
3. **Chunking** → Dividido em pedaços menores
4. **Embedding** → Vetores gerados via OpenAI
5. **Indexação** → Armazenado para busca semântica

### Monitoramento da Base

#### Estatísticas
- **Total de Documentos**: Quantidade na base
- **Tamanho Total**: Espaço ocupado
- **Última Atualização**: Timestamp do último upload
- **Taxa de Sucesso**: % de documentos processados com sucesso

#### Ações de Manutenção

##### 🔄 Reindexar Tudo
```typescript
// Reprocessa todos os documentos
await reindexAllDocuments();
// Uso: Após mudanças no algoritmo de embedding
```

##### 🗑️ Limpar Cache
```typescript
// Remove embeddings órfãos
await cleanupOrphanedEmbeddings();
// Uso: Otimização de espaço
```

---

## 👤 Gestão de Usuários

### Papéis e Permissões

#### Tipos de Usuário
```typescript
type UserRole = 'owner' | 'editor' | 'viewer';

interface RolePermissions {
  owner: {
    read: true,
    write: true,
    delete: true,
    manageUsers: true,
    systemConfig: true
  },
  editor: {
    read: true,
    write: true,
    delete: false,
    manageUsers: false,
    systemConfig: false
  },
  viewer: {
    read: true,
    write: false,
    delete: false,
    manageUsers: false,
    systemConfig: false
  }
}
```

### Gerenciamento de Organizadores

#### Adicionar Novo Usuário
```typescript
interface NewOrganizer {
  name: string,
  email: string,
  role: UserRole,
  permissions: string[],    // Permissões específicas
  isActive: boolean
}
```

#### Lista de Usuários
- **Informações**: Nome, email, papel, último acesso
- **Status**: Ativo/inativo
- **Ações**: Editar, desativar, alterar papel

---

## 🔧 Configurações do Sistema

### Configurações de IA

#### Parâmetros do OpenAI
```typescript
interface AIConfig {
  model: 'gpt-4' | 'gpt-3.5-turbo',
  temperature: number,        // 0-1, criatividade
  maxTokens: number,         // Limite de resposta
  systemPrompt: string,      // Personalidade base
  contextWindow: number      // Mensagens de contexto
}
```

#### Configurações por Etapa
```typescript
interface StageConfig {
  [stage: string]: {
    prompt: string,           // Prompt específico da etapa
    maxDuration: number,      // Tempo máximo na etapa (min)
    requiredFields: string[], // Campos obrigatórios
    nextStage: string        // Próxima etapa
  }
}
```

### Configurações do WhatsApp

#### Twilio Settings
```typescript
interface TwilioConfig {
  accountSid: string,
  authToken: string,
  phoneNumber: string,       // Número do bot
  webhookUrl: string,        // URL para receber mensagens
  statusCallback: string     // URL para status de entrega
}
```

### Configurações de Segurança

#### Rate Limiting
```typescript
interface RateLimit {
  messagesPerMinute: number,    // Limite por usuário
  messagesPerHour: number,      // Limite por usuário
  globalPerSecond: number,      // Limite global
  blockDuration: number         // Tempo de bloqueio (min)
}
```

#### LGPD Compliance
```typescript
interface LGPDConfig {
  dataRetentionDays: number,    // Dias para manter dados
  autoDeleteInactive: boolean,  // Deletar inativos automaticamente
  consentRequired: boolean,     // Exigir consentimento
  exportFormat: 'json' | 'csv' // Formato de exportação
}
```

---

## 📊 Analytics e Relatórios

### Métricas Disponíveis

#### Engajamento
- **Mensagens por Dia**: Volume de interações
- **Tempo de Resposta**: Latência do sistema
- **Taxa de Abandono**: % que param em cada etapa
- **Sessões por Usuário**: Frequência de uso

#### Performance
- **Uptime**: Disponibilidade do sistema
- **Throughput**: Mensagens processadas/segundo
- **Erro Rate**: % de falhas
- **Resource Usage**: CPU, memória, storage

### Exportação de Dados

#### Formatos Disponíveis
- **CSV**: Para análise em Excel/Sheets
- **JSON**: Para integração com outras ferramentas
- **PDF**: Relatórios executivos

#### Períodos
- **Tempo Real**: Dados atuais
- **Diário**: Agregação por dia
- **Semanal**: Tendências semanais
- **Mensal**: Visão de longo prazo

---

## 🚨 Alertas e Notificações

### Tipos de Alerta

#### Sistema
- **Alto Uso de CPU**: > 80% por 5 minutos
- **Erro Rate Alto**: > 5% em 10 minutos
- **Storage Baixo**: < 1GB disponível
- **API Limits**: Próximo do limite OpenAI/Twilio

#### Negócio
- **Pico de Usuários**: 50% acima da média
- **Taxa de Abandono Alta**: > 30% em uma etapa
- **Tempo de Resposta Alto**: > 5 segundos
- **Documentos Falhando**: > 10% de falha no processamento

### Canais de Notificação
- **Dashboard**: Alertas visuais na interface
- **Email**: Para alertas críticos
- **Webhook**: Integração com Slack/Discord
- **SMS**: Para emergências (opcional)

---

## 🔍 Troubleshooting

### Problemas Comuns

#### Dashboard não carrega
```bash
# Verificar se organizador existe
npx convex run admin:listOrganizers

# Criar organizador se necessário
npx convex run admin:createOrganizer --name "Admin" --email "admin@example.com"
```

#### Documentos não processam
```typescript
// Verificar status no dashboard
// Ou via Convex
await ctx.db.query("documents")
  .filter(q => q.eq(q.field("status"), "failed"))
  .collect();
```

#### WhatsApp não responde
```bash
# Testar webhook
curl -X POST http://localhost:3000/whatsapp/webhook \
  -d "MessageSid=test&From=whatsapp:+5511999999999&Body=teste"

# Verificar logs
npx convex logs --tail
```

### Logs Importantes

#### Convex Dashboard
- **Functions**: Execução de funções
- **Database**: Queries e mutations
- **HTTP**: Webhooks e APIs
- **Errors**: Erros detalhados

#### Browser DevTools
- **Console**: Erros de JavaScript
- **Network**: Falhas de API
- **Application**: Estado do localStorage

---

## 🎯 Melhores Práticas

### Monitoramento Diário
1. **Verificar KPIs** no dashboard principal
2. **Revisar conversas ativas** para problemas
3. **Monitorar processamento** de documentos
4. **Checar alertas** pendentes

### Manutenção Semanal
1. **Analisar métricas** de engajamento
2. **Revisar logs** de erro
3. **Atualizar conhecimento** se necessário
4. **Backup** de dados importantes

### Otimização Mensal
1. **Analisar funil** de conversão
2. **Otimizar prompts** com baixa performance
3. **Limpar dados** antigos (LGPD)
4. **Revisar configurações** de IA

---

**💡 Dica**: Mantenha múltiplas abas abertas - Dashboard para visão geral, Conversas para monitoramento em tempo real, e Convex Dashboard para logs técnicos!
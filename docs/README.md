# 📚 Documentação do WhatsApp AI Assistant

## 🎯 Visão Geral

O **WhatsApp AI Assistant** é um sistema completo de entrevistas inteligentes via WhatsApp, potencializado por **RAG (Retrieval-Augmented Generation)** e um **Dashboard Administrativo** robusto. O sistema conduz entrevistas estruturadas através do WhatsApp usando fluxos de conversação inteligentes aprimorados por uma base de conhecimento.

### ✨ Principais Funcionalidades

- **Fluxo de Entrevista em 8 Etapas**: `intro → ASA → listas → pre_evento → diaD → pos_24h → pos_7d → pos_30d`
- **Respostas Aprimoradas por RAG**: Embeddings OpenAI + busca vetorial para respostas contextualmente relevantes
- **Gerenciamento de Janela de 24h**: Mensagens de sessão vs templates HSM para conformidade WhatsApp
- **Interface Administrativa Completa**: Gerenciamento de participantes, histórico de conversas, base de conhecimento, analytics
- **Conformidade LGPD**: Rastreamento de consentimento, exportação/exclusão de dados, políticas de retenção
- **Suporte a Modo Escuro**: Temas completos com componentes shadcn/ui

---

## 🚀 Como Começar

### 1. Configuração do Ambiente

Copie o template de ambiente:
```bash
cp .env.local.example .env.local
```

Preencha suas credenciais:
```env
# OpenAI
OPENAI_API_KEY=sk-...
EMBEDDINGS_MODEL=text-embedding-3-large
GENERATION_MODEL=gpt-4

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+14155238886

# Convex (fornecido automaticamente)
CONVEX_DEPLOYMENT=your-deployment
CONVEX_URL=https://your-deployment.convex.cloud
```

### 2. Desenvolvimento

Inicie frontend e backend:
```bash
npm run dev
```

Ou inicie individualmente:
```bash
npm run dev:frontend  # React/Vite (abre o navegador)
npm run dev:backend   # Backend Convex
```

### 3. Build e Validação

Execute a verificação completa de build:
```bash
npm run lint  # Validação TypeScript + build
```

Build para produção:
```bash
npm run build
```

---

## 🏗️ Arquitetura do Sistema

### Stack Tecnológico
- **Backend**: Convex (database + funções serverless)
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **IA**: OpenAI API (embeddings + geração)
- **Mensageria**: Twilio WhatsApp API
- **Autenticação**: Convex Auth

### Estrutura de Componentes

```
convex/
├── functions/
│   ├── rag.ts              # Pipeline RAG (ingest, retrieve, fuse)
│   ├── interview.ts        # Máquina de estado de 8 etapas
│   ├── twilio.ts          # Integração WhatsApp aprimorada
│   └── admin/             # Funções específicas do admin
├── schema.ts              # Schema de banco de dados estendido
└── router.ts              # Endpoints da API HTTP

src/
├── admin/                 # Dashboard administrativo
│   ├── layout/           # Componentes de layout do admin
│   ├── pages/            # Páginas do admin (dashboard, participantes, etc.)
│   └── components/       # Componentes específicos do admin
├── types/                # Definições TypeScript
├── lib/                  # Utilitários (helpers RAG, etc.)
└── components/           # Componentes UI reutilizáveis
```

---

## 📊 Dashboard Administrativo

### Como Acessar
1. Navegue para `http://localhost:5174/admin`
2. Faça login com suas credenciais de organizador
3. Acesse as diferentes seções através do menu lateral

### 🏠 Dashboard Principal
**Localização**: `/admin`

**Funcionalidades**:
- **KPIs em Tempo Real**: Total de participantes, ativos em 24h, taxa de resposta, latência p95
- **Gráficos de Volume**: Mensagens por período
- **Crescimento de Participantes**: Evolução temporal
- **Status do Sistema**: Saúde dos subsistemas (database, WhatsApp, AI, processing)
- **Funil de Entrevistas**: Progressão pelos estágios
- **Atividade Recente**: Últimas interações do sistema

### 👥 Gerenciamento de Participantes
**Localização**: `/admin/participants`

**Funcionalidades**:
- **Tabela Interativa**: Lista todos os participantes com filtros
- **Filtros Disponíveis**:
  - Por cluster/grupo
  - Por estágio da entrevista
  - Por status de consentimento
  - Por status de opt-out
- **Ações por Participante**:
  - Ver conversa completa
  - Exportar dados (LGPD)
  - Excluir participante (LGPD)
- **Paginação**: Navegação eficiente para grandes volumes

### 💬 Conversas
**Localização**: `/admin/conversations`

**Funcionalidades**:
- **Visualizador de Conversas**: Bolhas de mensagem com timestamps
- **Informações de Debug**: StateSnapshot para administradores (nunca exposto aos usuários)
- **Intervenção Manual**: Botão "Responder" para intervenção administrativa
- **Histórico Completo**: Todas as mensagens da conversa
- **Metadados**: Informações técnicas da conversa

### 📚 Base de Conhecimento
**Localização**: `/admin/knowledge`

**Funcionalidades**:
- **Upload de Documentos**: Interface drag-and-drop
- **Formatos Suportados**: PDF, DOC, DOCX, TXT, MD
- **Validação**: Limite de 10MB por arquivo
- **Lista de Documentos**: Status de processamento em tempo real
- **Estatísticas**: Progresso de indexação e métricas
- **Reindexação**: Botão para reprocessar documentos
- **Integração RAG**: Uso imediato em entrevistas

### 👤 Gerenciamento de Usuários
**Localização**: `/admin/users`

**Funcionalidades**:
- **Controle de Acesso Baseado em Papéis**:
  - **Owner**: Acesso total, gerenciamento de usuários
  - **Editor**: Edição de conteúdo e configurações
  - **Viewer**: Apenas visualização
- **Gerenciamento de Organizadores**: Adicionar, editar, remover
- **Auditoria**: Histórico de ações administrativas

---

## 🎯 Sistema de Entrevistas

### Fluxo das 8 Etapas

O sistema conduz entrevistas através de 8 etapas cuidadosamente projetadas:

```
intro → ASA → listas → pre_evento → diaD → pos_24h → pos_7d → pos_30d
```

#### Detalhes das Etapas

1. **intro**: Coleta de consentimento e boas-vindas
2. **ASA**: Exploração de Ancestralidade, Sabedoria, Ascensão
3. **listas**: Coleta estruturada de informações
4. **pre_evento**: Preparação para o evento
5. **diaD**: Experiência do dia do evento
6. **pos_24h**: Reflexão de 24 horas
7. **pos_7d**: Acompanhamento de uma semana
8. **pos_30d**: Avaliação de um mês

### Como Funciona

1. **Início da Conversa**: Usuário envia mensagem via WhatsApp
2. **Detecção de Estado**: Sistema identifica etapa atual da entrevista
3. **Processamento RAG**: Busca conhecimento relevante na base
4. **Geração de Resposta**: IA cria resposta contextualizada
5. **Progressão**: Sistema avança para próxima etapa quando apropriado

---

## 🧠 Sistema RAG (Retrieval-Augmented Generation)

### Como Funciona o Processamento de Documentos

1. **Upload**: Arquivos txt/md/pdf via interface administrativa
2. **Chunking**: Divisão em pedaços de 500-800 tokens com sobreposição de 100 tokens
3. **Embedding**: OpenAI text-embedding-3-large (3072 dimensões)
4. **Armazenamento**: Busca vetorial no banco Convex
5. **Classificação**: Tagging automática ASA + tema + nível

### Recuperação e Resposta

1. **Query Embedding**: Converte entrada do usuário em vetor
2. **Busca por Similaridade**: Top-k (8) chunks mais relevantes
3. **Fusão de Contexto**: Combina chunks com estado da sessão
4. **Geração de Resposta**: GPT-4 com contexto aprimorado

### Como Adicionar Conhecimento

1. Acesse `/admin/knowledge`
2. Arraste arquivos para a área de upload
3. Aguarde o processamento automático
4. Verifique o status na lista de documentos
5. Use "Reindexar" se necessário

---

## 🔐 Privacidade e Segurança

### Conformidade LGPD

- **Rastreamento de Consentimento**: Opt-in explícito obrigatório
- **Exportação de Dados**: Exportação JSON dos dados do participante
- **Direito ao Esquecimento**: Remoção completa de dados
- **Políticas de Retenção**: Limpeza automática após 180 dias

### Recursos de Segurança

- **Privacidade de Estado**: Estado da entrevista nunca exposto aos usuários
- **Acesso Baseado em Papéis**: Funções administrativas protegidas por papéis (owner/editor/viewer)
- **Segurança de Webhook**: Verificação de assinatura Twilio
- **Variáveis de Ambiente**: Todos os segredos externalizados

---

## 🧪 Como Testar o Sistema

### Teste Manual

1. **Simulação de Webhook Twilio**:
```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -d "MessageSid=test123&From=whatsapp:+5511999999999&Body=Olá&To=whatsapp:+14155238886"
```

2. **Interface Administrativa**:
- Navegue para `/admin` (autenticação obrigatória)
- Faça upload de documento de teste na seção Conhecimento
- Monitore conversas de participantes
- Teste funcionalidade de importação CSV

### Teste de Integração

- Ingestão de documento → verificação de recuperação RAG
- Teste de progressão do fluxo de entrevista
- Uso de template HSM fora da janela de 24h
- Fluxos de exportação/exclusão LGPD

---

## 📈 Metas de Performance

- **End-to-End**: p95 ≤ 1.5s (mensagem → resposta)
- **Recuperação RAG**: p95 ≤ 800ms (query → chunks)
- **Processamento de Documentos**: Jobs assíncronos em background
- **Busca Vetorial**: Otimizada para embeddings de 3072 dimensões

---

## 🛠️ Solução de Problemas

### Problemas Comuns

1. **Erro de Autenticação no Admin**
   - Verifique se existe um organizador criado no banco
   - Execute `npx convex run createAdminUser` se necessário

2. **Documentos Não Processando**
   - Verifique se a chave OpenAI está configurada
   - Monitore logs no console do Convex
   - Use o botão "Reindexar" na interface

3. **WhatsApp Não Respondendo**
   - Verifique configurações Twilio
   - Confirme webhook URL está acessível
   - Monitore logs de webhook

### Logs e Monitoramento

- **Convex Dashboard**: `https://dashboard.convex.dev`
- **Logs de Função**: Disponíveis no dashboard Convex
- **Métricas de Performance**: Visíveis no admin dashboard
- **Status do Sistema**: Seção de saúde no dashboard

---

## 📞 Suporte

Para suporte técnico ou dúvidas sobre implementação:

1. Consulte os logs no Convex Dashboard
2. Verifique a seção de troubleshooting acima
3. Revise a documentação técnica em `tasks.md`
4. Monitore métricas de performance no admin dashboard

---

**Status Atual**: 81% completo (8/12 fases implementadas)
**Última Atualização**: 2025-01-14
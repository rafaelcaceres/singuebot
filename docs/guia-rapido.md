# 🚀 Guia Rápido de Uso

## ⚡ Início Rápido (5 minutos)

### 1. Configuração Inicial
```bash
# Clone e instale dependências
npm install

# Configure ambiente
cp .env.local.example .env.local
# Edite .env.local com suas chaves API

# Inicie o sistema
npm run dev
```

### 2. Acesso ao Admin
1. Abra `http://localhost:5174/admin`
2. Faça login (se necessário, crie um organizador via Convex)
3. Explore o dashboard principal

### 3. Primeira Base de Conhecimento
1. Vá para **Conhecimento** no menu lateral
2. Arraste um arquivo PDF ou TXT
3. Aguarde o processamento (barra de progresso)
4. Documento estará disponível para o bot usar

---

## 📱 Como Funciona para o Usuário Final

### Fluxo do WhatsApp
1. **Usuário envia mensagem** → `"Olá"`
2. **Bot responde** → Coleta consentimento (etapa `intro`)
3. **Usuário consente** → Avança para etapa `ASA`
4. **Conversa continua** → Bot usa conhecimento + IA para responder
5. **Progressão automática** → 8 etapas até conclusão

### Exemplo de Conversa
```
👤 Usuário: "Olá"
🤖 Bot: "Olá! Para começarmos, preciso do seu consentimento para coletar dados..."

👤 Usuário: "Sim, concordo"
🤖 Bot: "Ótimo! Vamos explorar sua jornada de Ancestralidade, Sabedoria e Ascensão..."
```

---

## 🎛️ Principais Áreas do Admin

### 🏠 Dashboard
**O que ver**: KPIs, gráficos, status do sistema
**Como usar**: Monitore performance e atividade em tempo real

### 👥 Participantes
**O que ver**: Lista de todos os usuários
**Como usar**: 
- Filtre por estágio da entrevista
- Clique "Ver conversa" para detalhes
- Use "Exportar" para LGPD

### 💬 Conversas
**O que ver**: Histórico completo de mensagens
**Como usar**:
- Monitore conversas em andamento
- Veja informações técnicas (stateSnapshot)
- Intervenha manualmente se necessário

### 📚 Conhecimento
**O que ver**: Documentos da base de conhecimento
**Como usar**:
- Upload: Arraste arquivos (PDF, DOC, TXT, MD)
- Monitore: Status de processamento
- Reindexe: Se algo der errado

### 👤 Usuários
**O que ver**: Organizadores e permissões
**Como usar**:
- Adicione novos administradores
- Defina papéis (Owner/Editor/Viewer)
- Gerencie acessos

---

## 🔧 Comandos Úteis

### Desenvolvimento
```bash
npm run dev          # Inicia tudo
npm run dev:frontend # Só React
npm run dev:backend  # Só Convex
npm run lint         # Verifica erros
npm run build        # Build produção
```

### Convex (Backend)
```bash
npx convex dev       # Modo desenvolvimento
npx convex deploy    # Deploy produção
npx convex dashboard # Abre dashboard
```

### Teste de Webhook
```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -d "MessageSid=test&From=whatsapp:+5511999999999&Body=Olá"
```

---

## 🚨 Resolução Rápida de Problemas

### ❌ Admin não carrega
**Solução**: Crie um organizador
```bash
npx convex run createAdminUser
```

### ❌ Documentos não processam
**Soluções**:
1. Verifique `OPENAI_API_KEY` no `.env.local`
2. Clique "Reindexar" na interface
3. Verifique logs no Convex Dashboard

### ❌ WhatsApp não responde
**Soluções**:
1. Verifique credenciais Twilio
2. Confirme webhook URL público
3. Teste com curl primeiro

### ❌ Erro de permissão
**Soluções**:
1. Verifique papel do usuário (Owner/Editor/Viewer)
2. Faça logout/login
3. Verifique se organizador existe no banco

---

## 📊 Monitoramento Rápido

### KPIs Importantes
- **Total Participantes**: Crescimento da base
- **Ativos 24h**: Engajamento recente
- **Taxa de Resposta**: Qualidade das interações
- **Latência p95**: Performance do sistema

### Status de Saúde
- 🟢 **Verde**: Sistema funcionando
- 🟡 **Amarelo**: Atenção necessária
- 🔴 **Vermelho**: Problema crítico

### Onde Monitorar
1. **Dashboard Admin**: `/admin` - Visão geral
2. **Convex Dashboard**: Logs técnicos detalhados
3. **Conhecimento**: Status de processamento
4. **Conversas**: Atividade em tempo real

---

## 🎯 Próximos Passos

Após configurar o básico:

1. **📚 Adicione mais conhecimento**: Upload de documentos relevantes
2. **👥 Convide administradores**: Adicione outros usuários
3. **📊 Configure analytics**: Monitore métricas importantes
4. **🔧 Customize conteúdo**: Ajuste prompts por etapa (Fase 9)
5. **📋 Importe dados**: Use CSV para dados em massa (Fase 10)

---

**💡 Dica**: Mantenha o Convex Dashboard aberto em outra aba para monitorar logs em tempo real durante desenvolvimento!
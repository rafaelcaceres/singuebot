# 📡 Referência da API

## Visão Geral

Esta documentação detalha todas as APIs disponíveis no WhatsApp AI Assistant, incluindo endpoints Convex, webhooks do Twilio e integrações externas.

---

## 🔧 APIs Convex

### Queries (Leitura)

#### `api.participants.list`
Lista participantes com paginação e filtros.

```typescript
// Definição
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    stage: v.optional(v.string()),
    search: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Implementação
  }
});

// Uso no frontend
const participants = useQuery(api.participants.list, {
  limit: 20,
  stage: "demographics"
});
```

**Parâmetros:**
- `limit` (opcional): Número máximo de resultados (padrão: 20, máximo: 100)
- `cursor` (opcional): Token de paginação para próxima página
- `stage` (opcional): Filtrar por estágio da entrevista
- `search` (opcional): Busca por nome ou telefone

**Retorno:**
```typescript
{
  participants: Array<{
    _id: Id<"participants">,
    phoneNumber: string,
    name?: string,
    currentStage: string,
    progress: number,
    _creationTime: number
  }>,
  nextCursor?: string,
  hasMore: boolean
}
```

#### `api.conversations.getByParticipant`
Busca conversas de um participante específico.

```typescript
// Definição
export const getByParticipant = query({
  args: {
    participantId: v.id("participants"),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Implementação
  }
});

// Uso
const conversations = useQuery(api.conversations.getByParticipant, {
  participantId: selectedParticipant._id,
  limit: 50
});
```

#### `api.admin.getDashboardStats`
Estatísticas do dashboard administrativo.

```typescript
// Definição
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    // Implementação
  }
});

// Retorno
{
  totalParticipants: number,
  activeConversations: number,
  completedInterviews: number,
  averageCompletionTime: number,
  stageDistribution: Record<string, number>,
  dailyStats: Array<{
    date: string,
    participants: number,
    messages: number
  }>
}
```

#### `api.knowledge.list`
Lista documentos da base de conhecimento.

```typescript
export const list = query({
  args: {
    limit: v.optional(v.number()),
    category: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Implementação
  }
});
```

### Mutations (Escrita)

#### `api.participants.create`
Cria novo participante.

```typescript
export const create = mutation({
  args: {
    phoneNumber: v.string(),
    name: v.optional(v.string()),
    metadata: v.optional(v.object({
      source: v.string(),
      campaign: v.optional(v.string())
    }))
  },
  handler: async (ctx, args) => {
    // Validação
    const existingParticipant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();
    
    if (existingParticipant) {
      throw new Error("Participant already exists");
    }
    
    // Criação
    return await ctx.db.insert("participants", {
      phoneNumber: args.phoneNumber,
      name: args.name,
      currentStage: "welcome",
      progress: 0,
      metadata: args.metadata || {}
    });
  }
});
```

#### `api.conversations.addMessage`
Adiciona mensagem à conversa.

```typescript
export const addMessage = mutation({
  args: {
    participantId: v.id("participants"),
    content: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    messageType: v.optional(v.string()),
    metadata: v.optional(v.object({
      twilioSid: v.optional(v.string()),
      status: v.optional(v.string()),
      mediaUrl: v.optional(v.string())
    }))
  },
  handler: async (ctx, args) => {
    // Implementação
  }
});
```

#### `api.knowledge.upload`
Upload de documento para base de conhecimento.

```typescript
export const upload = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    fileType: v.string()
  },
  handler: async (ctx, args) => {
    // Processamento e armazenamento
    const documentId = await ctx.db.insert("knowledge_documents", {
      title: args.title,
      content: args.content,
      category: args.category,
      tags: args.tags,
      fileType: args.fileType,
      status: "processing"
    });
    
    // Trigger processamento assíncrono
    await ctx.scheduler.runAfter(0, internal.knowledge.processDocument, {
      documentId
    });
    
    return documentId;
  }
});
```

### Actions (Operações Externas)

#### `api.whatsapp.sendMessage`
Envia mensagem via Twilio.

```typescript
export const sendMessage = action({
  args: {
    to: v.string(),
    message: v.string(),
    mediaUrl: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Validação do número
    if (!args.to.startsWith("whatsapp:+")) {
      throw new Error("Invalid WhatsApp number format");
    }
    
    // Envio via Twilio
    const twilioResponse = await fetch("https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        From: "whatsapp:+14155238886", // Twilio Sandbox
        To: args.to,
        Body: args.message,
        ...(args.mediaUrl && { MediaUrl: args.mediaUrl })
      })
    });
    
    const result = await twilioResponse.json();
    
    if (!twilioResponse.ok) {
      throw new Error(`Twilio error: ${result.message}`);
    }
    
    // Salvar no banco
    await ctx.runMutation(internal.conversations.addMessage, {
      participantId: await getParticipantByPhone(ctx, args.to),
      content: args.message,
      direction: "outbound",
      metadata: {
        twilioSid: result.sid,
        status: result.status
      }
    });
    
    return result;
  }
});
```

#### `api.ai.generateResponse`
Gera resposta usando OpenAI.

```typescript
export const generateResponse = action({
  args: {
    participantId: v.id("participants"),
    message: v.string(),
    context: v.optional(v.object({
      stage: v.string(),
      previousMessages: v.array(v.object({
        content: v.string(),
        direction: v.string(),
        timestamp: v.number()
      }))
    }))
  },
  handler: async (ctx, args) => {
    // Buscar contexto do participante
    const participant = await ctx.runQuery(api.participants.get, {
      id: args.participantId
    });
    
    if (!participant) {
      throw new Error("Participant not found");
    }
    
    // Construir prompt
    const prompt = buildInterviewPrompt(
      participant.currentStage,
      args.message,
      args.context?.previousMessages || []
    );
    
    // Chamar OpenAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: prompt.system
          },
          {
            role: "user",
            content: args.message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    const result = await openaiResponse.json();
    
    if (!openaiResponse.ok) {
      throw new Error(`OpenAI error: ${result.error?.message}`);
    }
    
    const aiResponse = result.choices[0].message.content;
    
    // Salvar interação
    await ctx.runMutation(internal.ai.logInteraction, {
      participantId: args.participantId,
      prompt: args.message,
      response: aiResponse,
      model: "gpt-4",
      tokens: result.usage?.total_tokens
    });
    
    return {
      response: aiResponse,
      shouldAdvanceStage: checkStageCompletion(participant.currentStage, aiResponse),
      nextStage: getNextStage(participant.currentStage)
    };
  }
});
```

---

## 🌐 Webhooks HTTP

### WhatsApp Webhook (Twilio)

#### `POST /whatsapp/webhook`
Recebe mensagens do WhatsApp via Twilio.

```typescript
export const whatsappWebhook = httpAction(async (ctx, request) => {
  // Validação da assinatura Twilio
  const signature = request.headers.get("X-Twilio-Signature");
  const body = await request.text();
  
  if (!validateTwilioSignature(signature, body)) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Parse dos dados
  const formData = new URLSearchParams(body);
  const messageData = {
    sid: formData.get("MessageSid"),
    from: formData.get("From"),
    to: formData.get("To"),
    body: formData.get("Body"),
    mediaUrl: formData.get("MediaUrl0"),
    timestamp: new Date().toISOString()
  };
  
  // Processar mensagem
  await ctx.runMutation(internal.whatsapp.processInboundMessage, messageData);
  
  return new Response("OK", { status: 200 });
});
```

**Headers Esperados:**
- `X-Twilio-Signature`: Assinatura para validação
- `Content-Type`: `application/x-www-form-urlencoded`

**Payload (Form Data):**
```
MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
From=whatsapp:+5511999999999
To=whatsapp:+14155238886
Body=Olá, gostaria de participar da pesquisa
MediaUrl0=https://api.twilio.com/2010-04-01/Accounts/.../Media/...
```

#### `POST /whatsapp/status`
Recebe atualizações de status das mensagens.

```typescript
export const whatsappStatus = httpAction(async (ctx, request) => {
  const formData = await request.formData();
  
  const statusData = {
    messageSid: formData.get("MessageSid"),
    status: formData.get("MessageStatus"), // sent, delivered, read, failed
    errorCode: formData.get("ErrorCode"),
    errorMessage: formData.get("ErrorMessage")
  };
  
  await ctx.runMutation(internal.whatsapp.updateMessageStatus, statusData);
  
  return new Response("OK");
});
```

### Webhook de Autenticação

#### `POST /auth/callback`
Callback para providers OAuth.

```typescript
export const authCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  // Processar callback OAuth
  // Implementação específica do provider
  
  return new Response("Authentication successful", {
    status: 302,
    headers: {
      Location: "/admin/dashboard"
    }
  });
});
```

---

## 🔍 APIs de Busca e Filtros

### Busca de Participantes

```typescript
export const searchParticipants = query({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      stage: v.optional(v.string()),
      dateRange: v.optional(v.object({
        start: v.number(),
        end: v.number()
      })),
      completionStatus: v.optional(v.union(
        v.literal("completed"),
        v.literal("in_progress"),
        v.literal("abandoned")
      ))
    }))
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("participants");
    
    // Aplicar filtros
    if (args.filters?.stage) {
      query = query.filter((q) => q.eq(q.field("currentStage"), args.filters.stage));
    }
    
    if (args.filters?.dateRange) {
      query = query.filter((q) => 
        q.and(
          q.gte(q.field("_creationTime"), args.filters.dateRange.start),
          q.lte(q.field("_creationTime"), args.filters.dateRange.end)
        )
      );
    }
    
    const results = await query.collect();
    
    // Busca textual (simulada - em produção usar search index)
    if (args.query) {
      return results.filter(p => 
        p.name?.toLowerCase().includes(args.query.toLowerCase()) ||
        p.phoneNumber.includes(args.query)
      );
    }
    
    return results;
  }
});
```

### Analytics e Relatórios

```typescript
export const getAnalytics = query({
  args: {
    period: v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month")
    ),
    metrics: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    const startTime = now - periodMs[args.period];
    
    // Métricas disponíveis
    const metrics = {};
    
    if (args.metrics.includes("new_participants")) {
      metrics.newParticipants = await ctx.db
        .query("participants")
        .filter((q) => q.gte(q.field("_creationTime"), startTime))
        .collect()
        .then(results => results.length);
    }
    
    if (args.metrics.includes("completion_rate")) {
      const total = await ctx.db.query("participants").collect();
      const completed = total.filter(p => p.currentStage === "completed");
      metrics.completionRate = total.length > 0 ? completed.length / total.length : 0;
    }
    
    if (args.metrics.includes("average_session_time")) {
      // Calcular tempo médio de sessão
      const sessions = await ctx.db
        .query("conversations")
        .filter((q) => q.gte(q.field("_creationTime"), startTime))
        .collect();
      
      // Implementar cálculo de tempo médio
    }
    
    return metrics;
  }
});
```

---

## 🔐 Autenticação e Autorização

### Middleware de Autenticação

```typescript
// Função helper para verificar autenticação
export const requireAuth = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  
  if (!identity) {
    throw new Error("Authentication required");
  }
  
  return identity;
};

// Função helper para verificar permissões
export const requireRole = async (
  ctx: QueryCtx | MutationCtx,
  requiredRole: "admin" | "moderator" | "viewer"
) => {
  const identity = await requireAuth(ctx);
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();
  
  if (!user || !hasRole(user.role, requiredRole)) {
    throw new Error("Insufficient permissions");
  }
  
  return user;
};

const hasRole = (userRole: string, requiredRole: string): boolean => {
  const roleHierarchy = {
    viewer: 1,
    moderator: 2,
    admin: 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};
```

### APIs Protegidas

```typescript
export const deleteParticipant = mutation({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    // Verificar permissão de admin
    await requireRole(ctx, "admin");
    
    // Soft delete
    await ctx.db.patch(args.participantId, {
      deletedAt: Date.now(),
      status: "deleted"
    });
    
    return { success: true };
  }
});
```

---

## 📊 Rate Limiting e Quotas

### Rate Limiting Implementation

```typescript
// Rate limiting para APIs externas
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  identifier: string,
  limit: number,
  windowMs: number
): boolean => {
  const now = Date.now();
  const key = identifier;
  
  const current = rateLimiter.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimiter.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (current.count >= limit) {
    return false;
  }
  
  current.count++;
  return true;
};

// Uso em actions
export const sendMessage = action({
  args: { to: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    // Rate limit: 10 mensagens por minuto por número
    if (!checkRateLimit(args.to, 10, 60000)) {
      throw new Error("Rate limit exceeded");
    }
    
    // Continuar com envio...
  }
});
```

---

## 🔧 Utilitários e Helpers

### Validação de Dados

```typescript
// Validadores customizados
export const validators = {
  phoneNumber: (phone: string): boolean => {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace('whatsapp:', ''));
  },
  
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  stage: (stage: string): boolean => {
    const validStages = [
      "welcome", "demographics", "experience", 
      "preferences", "feedback", "completion"
    ];
    return validStages.includes(stage);
  }
};
```

### Formatação de Dados

```typescript
export const formatters = {
  phone: (phone: string): string => {
    // Remover whatsapp: prefix se existir
    const cleaned = phone.replace('whatsapp:', '');
    
    // Formatar para exibição (exemplo brasileiro)
    if (cleaned.startsWith('+55')) {
      const number = cleaned.slice(3);
      return `+55 (${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
    }
    
    return cleaned;
  },
  
  timestamp: (timestamp: number): string => {
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  },
  
  duration: (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};
```

---

## 🚨 Códigos de Erro

### Códigos Padrão

```typescript
export const ErrorCodes = {
  // Autenticação (1000-1099)
  UNAUTHORIZED: 1001,
  INVALID_TOKEN: 1002,
  EXPIRED_TOKEN: 1003,
  INSUFFICIENT_PERMISSIONS: 1004,
  
  // Validação (1100-1199)
  INVALID_PHONE_NUMBER: 1101,
  INVALID_EMAIL: 1102,
  REQUIRED_FIELD_MISSING: 1103,
  INVALID_STAGE: 1104,
  
  // Recursos (1200-1299)
  PARTICIPANT_NOT_FOUND: 1201,
  CONVERSATION_NOT_FOUND: 1202,
  DOCUMENT_NOT_FOUND: 1203,
  DUPLICATE_PARTICIPANT: 1204,
  
  // Integrações Externas (1300-1399)
  TWILIO_ERROR: 1301,
  OPENAI_ERROR: 1302,
  RATE_LIMIT_EXCEEDED: 1303,
  WEBHOOK_VALIDATION_FAILED: 1304,
  
  // Sistema (1400-1499)
  DATABASE_ERROR: 1401,
  INTERNAL_SERVER_ERROR: 1402,
  SERVICE_UNAVAILABLE: 1403
} as const;

// Helper para criar erros padronizados
export const createError = (
  code: keyof typeof ErrorCodes,
  message?: string,
  details?: any
) => {
  return {
    code: ErrorCodes[code],
    message: message || code,
    details,
    timestamp: Date.now()
  };
};
```

---

## 📝 Exemplos de Uso

### Frontend React

```typescript
// Hook personalizado para participantes
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

export const useParticipants = () => {
  const participants = useQuery(api.participants.list);
  const createParticipant = useMutation(api.participants.create);
  const updateParticipant = useMutation(api.participants.update);
  
  return {
    participants,
    createParticipant,
    updateParticipant,
    isLoading: participants === undefined
  };
};

// Componente de exemplo
const ParticipantsList = () => {
  const { participants, isLoading } = useParticipants();
  
  if (isLoading) return <div>Carregando...</div>;
  
  return (
    <div>
      {participants?.map(participant => (
        <div key={participant._id}>
          <h3>{participant.name || 'Anônimo'}</h3>
          <p>{formatters.phone(participant.phoneNumber)}</p>
          <p>Estágio: {participant.currentStage}</p>
        </div>
      ))}
    </div>
  );
};
```

### Integração com Webhook

```bash
# Teste do webhook com curl
curl -X POST https://your-deployment.convex.cloud/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Twilio-Signature: your-signature" \
  -d "MessageSid=SMxxxxxxxx&From=whatsapp:+5511999999999&Body=Olá"
```

---

**📚 Recursos Adicionais:**
- [Documentação do Convex](https://docs.convex.dev)
- [API do Twilio](https://www.twilio.com/docs/whatsapp)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
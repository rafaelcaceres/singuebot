# 🛠️ Guia de Desenvolvimento

## Visão Geral

Este guia fornece informações essenciais para desenvolvedores que desejam contribuir ou modificar o WhatsApp AI Assistant. O projeto utiliza uma arquitetura moderna com Convex, React, e integração com IA.

---

## 🏗️ Arquitetura do Sistema

### Stack Tecnológico

#### Frontend
- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **Tailwind CSS** para estilização
- **React Router** para navegação
- **Convex React** para estado e sincronização

#### Backend
- **Convex** como BaaS (Backend as a Service)
- **Node.js** runtime
- **TypeScript** para type safety
- **Twilio** para integração WhatsApp
- **OpenAI** para processamento de IA

#### Banco de Dados
- **Convex Database** (NoSQL)
- **Real-time subscriptions**
- **Automatic indexing**
- **ACID transactions**

### Estrutura de Diretórios

```
singue/
├── convex/                 # Backend Convex
│   ├── schema.ts          # Definições do banco
│   ├── whatsapp.ts        # Integração WhatsApp
│   ├── agents.ts         # Processamento IA com Convex Agent
│   ├── admin.ts           # Funções admin
│   ├── knowledge.ts       # Sistema RAG
│   ├── http.ts            # Rotas HTTP
│   └── _generated/        # Código gerado
├── src/                   # Frontend React
│   ├── admin/             # Interface administrativa
│   │   ├── components/    # Componentes admin
│   │   ├── pages/         # Páginas admin
│   │   └── hooks/         # Hooks customizados
│   ├── components/        # Componentes globais
│   ├── types/             # Definições TypeScript
│   ├── utils/             # Utilitários
│   └── App.tsx            # Componente principal
├── docs/                  # Documentação
├── public/                # Assets estáticos
└── package.json           # Dependências
```

---

## 🚀 Setup de Desenvolvimento

### Pré-requisitos

```bash
# Node.js 18+
node --version  # v18.0.0+

# npm ou yarn
npm --version   # 8.0.0+

# Git
git --version   # 2.30.0+
```

### Instalação

#### 1. Clone do Repositório
```bash
git clone <repository-url>
cd singue
```

#### 2. Instalação de Dependências
```bash
# Instalar dependências
npm install

# Instalar Convex CLI globalmente
npm install -g convex
```

#### 3. Configuração do Ambiente

##### Arquivo `.env.local`
```bash
# Convex
CONVEX_DEPLOYMENT=your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+14155238886

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Ambiente
NODE_ENV=development
```

##### Configuração do Convex
```bash
# Login no Convex
npx convex login

# Inicializar projeto
npx convex dev

# Deploy inicial do schema
npx convex deploy
```

#### 4. Inicialização do Desenvolvimento
```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: Frontend React
npm run dev
```

### Verificação da Instalação

#### Health Check
```bash
# Verificar se o Convex está rodando
curl http://localhost:3210/api/health

# Verificar se o frontend está acessível
curl http://localhost:5173
```

#### Teste de Integração
```typescript
// Testar função Convex
import { api } from "./convex/_generated/api";

// No console do navegador
const result = await convex.query(api.admin.getDashboardStats);
console.log(result);
```

---

## 📝 Padrões de Código

### Convex Functions

#### Estrutura Padrão
```typescript
// convex/example.ts
import { v } from "convex/values";
import { query, mutation, action, internalQuery } from "./_generated/server";

// Query pública
export const getPublicData = query({
  args: {
    id: v.id("table_name"),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Validação de argumentos é automática
    const data = await ctx.db.get(args.id);
    
    if (!data) {
      throw new Error("Data not found");
    }
    
    return data;
  }
});

// Mutation com validação
export const updateData = mutation({
  args: {
    id: v.id("table_name"),
    updates: v.object({
      name: v.optional(v.string()),
      status: v.optional(v.union(v.literal("active"), v.literal("inactive")))
    })
  },
  handler: async (ctx, args) => {
    // Verificar permissões
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    
    // Atualizar dados
    return await ctx.db.patch(args.id, args.updates);
  }
});

// Action para operações externas
export const processWithAI = action({
  args: {
    input: v.string(),
    context: v.optional(v.object({
      userId: v.string(),
      sessionId: v.string()
    }))
  },
  handler: async (ctx, args) => {
    // Chamar API externa
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: args.input }]
      })
    });
    
    const result = await response.json();
    
    // Salvar resultado no banco
    await ctx.runMutation(internal.example.saveResult, {
      input: args.input,
      output: result.choices[0].message.content,
      context: args.context
    });
    
    return result;
  }
});

// Internal function (não exposta publicamente)
export const saveResult = internalMutation({
  args: {
    input: v.string(),
    output: v.string(),
    context: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ai_interactions", {
      input: args.input,
      output: args.output,
      context: args.context,
      timestamp: Date.now()
    });
  }
});
```

#### Boas Práticas Convex

1. **Sempre use validators** para argumentos e retornos
2. **Prefira internal functions** para operações sensíveis
3. **Use actions** apenas para APIs externas
4. **Implemente error handling** adequado
5. **Mantenha functions pequenas** e focadas

### React Components

#### Estrutura de Componente
```typescript
// src/components/ExampleComponent.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

interface ExampleComponentProps {
  id: Id<"table_name">;
  onUpdate?: (data: any) => void;
  className?: string;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  id,
  onUpdate,
  className = ""
}) => {
  // State local
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  
  // Convex hooks
  const data = useQuery(api.example.getPublicData, { id });
  const updateData = useMutation(api.example.updateData);
  
  // Effects
  useEffect(() => {
    if (data) {
      setFormData(data);
    }
  }, [data]);
  
  // Handlers
  const handleSave = async () => {
    try {
      const result = await updateData({
        id,
        updates: formData
      });
      
      onUpdate?.(result);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating data:', error);
      // TODO: Show user-friendly error message
    }
  };
  
  // Loading state
  if (data === undefined) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }
  
  // Error state
  if (data === null) {
    return (
      <div className={`text-red-500 ${className}`}>
        Data not found
      </div>
    );
  }
  
  // Render
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      {isEditing ? (
        <EditForm
          data={formData}
          onChange={setFormData}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <DisplayView
          data={data}
          onEdit={() => setIsEditing(true)}
        />
      )}
    </div>
  );
};

// Sub-componentes
const EditForm: React.FC<{
  data: any;
  onChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ data, onChange, onSave, onCancel }) => {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <input
        type="text"
        value={data.name || ''}
        onChange={(e) => onChange({ ...data, name: e.target.value })}
        className="w-full p-2 border rounded mb-2"
        placeholder="Name"
      />
      
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

const DisplayView: React.FC<{
  data: any;
  onEdit: () => void;
}> = ({ data, onEdit }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{data.name}</h3>
      <p className="text-gray-600 mb-4">{data.description}</p>
      
      <button
        onClick={onEdit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Edit
      </button>
    </div>
  );
};

export default ExampleComponent;
```

#### Boas Práticas React

1. **Use TypeScript** para props e state
2. **Implemente loading states** para queries
3. **Handle errors** graciosamente
4. **Mantenha componentes pequenos** e focados
5. **Use custom hooks** para lógica reutilizável
6. **Prefira composition** sobre inheritance

### Custom Hooks

#### Hook para Convex Data
```typescript
// src/hooks/useParticipantData.ts
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export const useParticipantData = (participantId: Id<"participants">) => {
  // Queries
  const participant = useQuery(api.participants.getById, { id: participantId });
  const conversations = useQuery(api.conversations.getByParticipant, { participantId });
  const interviewState = useQuery(api.interviews.getState, { participantId });
  
  // Mutations
  const updateParticipant = useMutation(api.participants.update);
  const advanceStage = useMutation(api.interviews.advanceStage);
  
  // Computed values
  const isLoading = participant === undefined || conversations === undefined;
  const hasError = participant === null;
  const completionRate = interviewState?.completionRate || 0;
  
  // Actions
  const handleUpdateParticipant = async (updates: any) => {
    try {
      return await updateParticipant({ id: participantId, updates });
    } catch (error) {
      console.error('Error updating participant:', error);
      throw error;
    }
  };
  
  const handleAdvanceStage = async (stageData?: any) => {
    try {
      return await advanceStage({ participantId, stageData });
    } catch (error) {
      console.error('Error advancing stage:', error);
      throw error;
    }
  };
  
  return {
    // Data
    participant,
    conversations,
    interviewState,
    
    // States
    isLoading,
    hasError,
    completionRate,
    
    // Actions
    updateParticipant: handleUpdateParticipant,
    advanceStage: handleAdvanceStage
  };
};
```

---

## 🗄️ Banco de Dados

### Schema Design

#### Definição de Tabelas
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Participantes da pesquisa
  participants: defineTable({
    phoneNumber: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    currentStage: v.union(
      v.literal("intro"),
      v.literal("demographics"),
      v.literal("experience"),
      v.literal("preferences"),
      v.literal("satisfaction"),
      v.literal("feedback"),
      v.literal("conclusion"),
      v.literal("completed")
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      referrer: v.optional(v.string()),
      tags: v.optional(v.array(v.string()))
    }))
  })
  .index("by_phone", ["phoneNumber"])
  .index("by_stage", ["currentStage", "isActive"])
  .index("by_created", ["createdAt"]),
  
  // Conversas/Sessões
  conversations: defineTable({
    participantId: v.id("participants"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    messageCount: v.number(),
    isActive: v.boolean(),
    metadata: v.optional(v.object({
      userAgent: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      sessionId: v.optional(v.string())
    }))
  })
  .index("by_participant", ["participantId", "startedAt"])
  .index("by_active", ["isActive", "startedAt"]),
  
  // Mensagens
  messages: defineTable({
    conversationId: v.id("conversations"),
    participantId: v.id("participants"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    content: v.string(),
    messageType: v.union(
      v.literal("text"),
      v.literal("media"),
      v.literal("system")
    ),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    timestamp: v.number(),
    twilioSid: v.optional(v.string()),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
    metadata: v.optional(v.object({
      stage: v.optional(v.string()),
      intent: v.optional(v.string()),
      confidence: v.optional(v.number())
    }))
  })
  .index("by_conversation", ["conversationId", "timestamp"])
  .index("by_participant", ["participantId", "timestamp"])
  .index("by_status", ["status"])
  .index("by_twilio_sid", ["twilioSid"]),
  
  // Estados da entrevista
  interviewStates: defineTable({
    participantId: v.id("participants"),
    currentStage: v.string(),
    stageData: v.object({
      demographics: v.optional(v.object({
        age: v.optional(v.string()),
        gender: v.optional(v.string()),
        location: v.optional(v.string()),
        occupation: v.optional(v.string())
      })),
      experience: v.optional(v.object({
        yearsExperience: v.optional(v.number()),
        currentRole: v.optional(v.string()),
        technologies: v.optional(v.array(v.string()))
      })),
      preferences: v.optional(v.object({
        workStyle: v.optional(v.string()),
        communication: v.optional(v.string()),
        tools: v.optional(v.array(v.string()))
      })),
      satisfaction: v.optional(v.object({
        overallRating: v.optional(v.number()),
        aspects: v.optional(v.object({
          workload: v.optional(v.number()),
          compensation: v.optional(v.number()),
          growth: v.optional(v.number()),
          culture: v.optional(v.number())
        }))
      })),
      feedback: v.optional(v.object({
        improvements: v.optional(v.string()),
        recommendations: v.optional(v.string()),
        additionalComments: v.optional(v.string())
      }))
    }),
    completionRate: v.number(),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number())
  })
  .index("by_participant", ["participantId"])
  .index("by_stage", ["currentStage"])
  .index("by_completion", ["completionRate"]),
  
  // Base de conhecimento (RAG)
  knowledgeBase: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    embedding: v.optional(v.array(v.number())),
    metadata: v.object({
      source: v.optional(v.string()),
      author: v.optional(v.string()),
      lastUpdated: v.optional(v.number()),
      version: v.optional(v.string())
    }),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number())
  })
  .index("by_category", ["category", "isActive"])
  .index("by_tags", ["tags"])
  .index("by_active", ["isActive", "createdAt"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["category", "isActive"]
  }),
  
  // Interações com IA
  aiInteractions: defineTable({
    participantId: v.id("participants"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    prompt: v.string(),
    response: v.string(),
    model: v.string(),
    tokens: v.object({
      prompt: v.number(),
      completion: v.number(),
      total: v.number()
    }),
    latency: v.number(),
    timestamp: v.number(),
    metadata: v.optional(v.object({
      temperature: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
      context: v.optional(v.string())
    }))
  })
  .index("by_participant", ["participantId", "timestamp"])
  .index("by_conversation", ["conversationId", "timestamp"])
  .index("by_model", ["model", "timestamp"]),
  
  // Usuários admin
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("moderator"),
      v.literal("viewer")
    ),
    isActive: v.boolean(),
    lastLogin: v.optional(v.number()),
    createdAt: v.number(),
    metadata: v.optional(v.object({
      department: v.optional(v.string()),
      permissions: v.optional(v.array(v.string()))
    }))
  })
  .index("by_email", ["email"])
  .index("by_role", ["role", "isActive"])
});
```

### Queries Otimizadas

#### Paginação Eficiente
```typescript
// convex/participants.ts
export const getPaginatedParticipants = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    stage: v.optional(v.string()),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 20, 100);
    
    let query = ctx.db.query("participants");
    
    // Aplicar filtros
    if (args.stage && args.isActive !== undefined) {
      query = query.withIndex("by_stage", (q) => 
        q.eq("currentStage", args.stage).eq("isActive", args.isActive)
      );
    } else if (args.isActive !== undefined) {
      query = query.filter((q) => q.eq(q.field("isActive"), args.isActive));
    }
    
    // Aplicar cursor para paginação
    if (args.cursor) {
      query = query.filter((q) => q.gt(q.field("_id"), args.cursor));
    }
    
    const results = await query
      .order("desc")
      .take(limit + 1);
    
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? results[limit]._id : null;
    
    return {
      items,
      nextCursor,
      hasMore
    };
  }
});
```

#### Agregações Complexas
```typescript
// convex/analytics.ts
export const getParticipantStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const startDate = args.startDate || (Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = args.endDate || Date.now();
    
    // Buscar participantes no período
    const participants = await ctx.db.query("participants")
      .withIndex("by_created", (q) => 
        q.gte("createdAt", startDate).lte("createdAt", endDate)
      )
      .collect();
    
    // Calcular estatísticas
    const stats = {
      total: participants.length,
      byStage: {} as Record<string, number>,
      active: 0,
      completed: 0,
      averageCompletionTime: 0
    };
    
    let totalCompletionTime = 0;
    let completedCount = 0;
    
    for (const participant of participants) {
      // Contar por estágio
      stats.byStage[participant.currentStage] = 
        (stats.byStage[participant.currentStage] || 0) + 1;
      
      // Contar ativos
      if (participant.isActive) {
        stats.active++;
      }
      
      // Contar completados e calcular tempo médio
      if (participant.currentStage === "completed") {
        stats.completed++;
        
        // Buscar estado da entrevista para tempo de conclusão
        const interviewState = await ctx.db.query("interviewStates")
          .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
          .first();
        
        if (interviewState?.completedAt) {
          totalCompletionTime += interviewState.completedAt - interviewState.startedAt;
          completedCount++;
        }
      }
    }
    
    if (completedCount > 0) {
      stats.averageCompletionTime = totalCompletionTime / completedCount;
    }
    
    return stats;
  }
});
```

---

## 🧪 Testes

### Configuração de Testes

#### Jest + Testing Library
```bash
# Instalar dependências de teste
npm install --save-dev @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

#### Configuração Jest
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@convex/(.*)$': '<rootDir>/convex/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'convex/**/*.ts',
    '!src/**/*.d.ts',
    '!convex/_generated/**'
  ]
};
```

### Testes de Componentes

#### Exemplo de Teste React
```typescript
// src/components/__tests__/ParticipantCard.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ParticipantCard } from '../ParticipantCard';

// Mock do Convex
const mockConvex = new ConvexReactClient('https://test.convex.cloud');

const renderWithConvex = (component: React.ReactElement) => {
  return render(
    <ConvexProvider client={mockConvex}>
      {component}
    </ConvexProvider>
  );
};

// Mock data
const mockParticipant = {
  _id: "participant123" as any,
  phoneNumber: "+5511999999999",
  name: "João Silva",
  currentStage: "demographics" as const,
  isActive: true,
  createdAt: Date.now()
};

describe('ParticipantCard', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('renders participant information correctly', () => {
    renderWithConvex(
      <ParticipantCard participant={mockParticipant} />
    );
    
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('+5511999999999')).toBeInTheDocument();
    expect(screen.getByText('demographics')).toBeInTheDocument();
  });
  
  it('handles edit action', async () => {
    const onEdit = jest.fn();
    
    renderWithConvex(
      <ParticipantCard 
        participant={mockParticipant} 
        onEdit={onEdit}
      />
    );
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith(mockParticipant._id);
    });
  });
  
  it('shows loading state when data is undefined', () => {
    renderWithConvex(
      <ParticipantCard participant={undefined} />
    );
    
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });
  
  it('shows error state when participant is null', () => {
    renderWithConvex(
      <ParticipantCard participant={null} />
    );
    
    expect(screen.getByText(/participant not found/i)).toBeInTheDocument();
  });
});
```

### Testes de Convex Functions

#### Mock do Contexto Convex
```typescript
// convex/__tests__/utils/mockContext.ts
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

export const createMockQueryCtx = (overrides = {}): Partial<QueryCtx> => ({
  db: {
    query: jest.fn(),
    get: jest.fn(),
    ...overrides.db
  },
  auth: {
    getUserIdentity: jest.fn(),
    ...overrides.auth
  },
  ...overrides
});

export const createMockMutationCtx = (overrides = {}): Partial<MutationCtx> => ({
  ...createMockQueryCtx(overrides),
  db: {
    ...createMockQueryCtx(overrides).db,
    insert: jest.fn(),
    patch: jest.fn(),
    replace: jest.fn(),
    delete: jest.fn()
  }
});
```

#### Teste de Query
```typescript
// convex/__tests__/participants.test.ts
import { getParticipantById } from '../participants';
import { createMockQueryCtx } from './utils/mockContext';

describe('participants queries', () => {
  describe('getParticipantById', () => {
    it('returns participant when found', async () => {
      const mockParticipant = {
        _id: 'participant123',
        phoneNumber: '+5511999999999',
        name: 'João Silva',
        currentStage: 'demographics',
        isActive: true,
        createdAt: Date.now()
      };
      
      const mockCtx = createMockQueryCtx({
        db: {
          get: jest.fn().mockResolvedValue(mockParticipant)
        }
      });
      
      const result = await getParticipantById.handler(
        mockCtx as any,
        { id: 'participant123' as any }
      );
      
      expect(result).toEqual(mockParticipant);
      expect(mockCtx.db.get).toHaveBeenCalledWith('participant123');
    });
    
    it('throws error when participant not found', async () => {
      const mockCtx = createMockQueryCtx({
        db: {
          get: jest.fn().mockResolvedValue(null)
        }
      });
      
      await expect(
        getParticipantById.handler(
          mockCtx as any,
          { id: 'nonexistent' as any }
        )
      ).rejects.toThrow('Participant not found');
    });
  });
});
```

### Testes de Integração

#### Teste de Webhook WhatsApp
```typescript
// convex/__tests__/integration/whatsapp.test.ts
import { whatsappWebhook } from '../whatsapp';

describe('WhatsApp Integration', () => {
  it('processes inbound message correctly', async () => {
    const mockRequest = new Request('http://localhost/webhook', {
      method: 'POST',
      body: new URLSearchParams({
        MessageSid: 'SM123456789',
        From: 'whatsapp:+5511999999999',
        To: 'whatsapp:+14155238886',
        Body: 'Olá, gostaria de participar da pesquisa',
        Timestamp: new Date().toISOString()
      })
    });
    
    const mockCtx = {
      runMutation: jest.fn().mockResolvedValue({}),
      runAction: jest.fn().mockResolvedValue({})
    };
    
    const response = await whatsappWebhook.handler(mockCtx as any, mockRequest);
    
    expect(response.status).toBe(200);
    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        message: expect.objectContaining({
          sid: 'SM123456789',
          from: 'whatsapp:+5511999999999',
          body: 'Olá, gostaria de participar da pesquisa'
        })
      })
    );
  });
});
```

---

## 🚀 Deploy e CI/CD

### Deploy Manual

#### Convex Deploy
```bash
# Deploy do backend
npx convex deploy --prod

# Verificar deploy
npx convex dashboard
```

#### Frontend Build
```bash
# Build de produção
npm run build

# Preview local do build
npm run preview
```

### GitHub Actions

#### Workflow de CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test -- --coverage --watchAll=false
    
    - name: Run linting
      run: npm run lint
    
    - name: Type check
      run: npm run type-check
  
  deploy-convex:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy Convex
      run: npx convex deploy --prod
      env:
        CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
  
  deploy-frontend:
    needs: [test, deploy-convex]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build frontend
      run: npm run build
      env:
        VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
    
    - name: Deploy to Vercel
      uses: vercel/action@v1
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        vercel-args: '--prod'
```

### Monitoramento de Deploy

#### Health Checks
```typescript
// convex/health.ts
export const healthCheck = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Verificar conectividade do banco
    const dbCheck = await ctx.db.query("participants").take(1);
    
    // Verificar APIs externas
    const externalChecks = await Promise.allSettled([
      fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
      }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
        headers: { 'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}` }
      })
    ]);
    
    return {
      status: 'healthy',
      timestamp: now,
      checks: {
        database: dbCheck ? 'ok' : 'error',
        openai: externalChecks[0].status === 'fulfilled' ? 'ok' : 'error',
        twilio: externalChecks[1].status === 'fulfilled' ? 'ok' : 'error'
      }
    };
  }
});
```

---

## 🔧 Debugging

### Logs e Monitoramento

#### Structured Logging
```typescript
// utils/logger.ts
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    log('info', message, context);
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    log('warn', message, context);
  },
  
  error: (message: string, error?: Error, context?: Record<string, any>) => {
    log('error', message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  },
  
  debug: (message: string, context?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      log('debug', message, context);
    }
  }
};

function log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: Date.now(),
    context
  };
  
  console.log(JSON.stringify(entry));
  
  // Em produção, enviar para serviço de logging
  if (process.env.NODE_ENV === 'production') {
    // sendToLoggingService(entry);
  }
}
```

### Performance Monitoring

#### Métricas de Performance
```typescript
// utils/performance.ts
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  
  static startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }
  
  static endTimer(name: string): number {
    const start = this.timers.get(name);
    if (!start) {
      throw new Error(`Timer ${name} not found`);
    }
    
    const duration = performance.now() - start;
    this.timers.delete(name);
    
    logger.info(`Performance: ${name}`, { duration });
    
    return duration;
  }
  
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }
}

// Uso em Convex functions
export const expensiveQuery = query({
  args: { id: v.id("participants") },
  handler: async (ctx, args) => {
    return await PerformanceMonitor.measureAsync(
      'expensiveQuery',
      async () => {
        // Operação custosa
        const result = await ctx.db.get(args.id);
        return result;
      }
    );
  }
});
```

---

## 📚 Recursos Adicionais

### Documentação Oficial
- [Convex Documentation](https://docs.convex.dev/)
- [React Documentation](https://react.dev/)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [OpenAI API](https://platform.openai.com/docs)

### Ferramentas Recomendadas
- **VS Code** com extensões:
  - Convex
  - TypeScript
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets
- **Postman** para testes de API
- **React DevTools** para debugging
- **Convex Dashboard** para monitoramento

### Comunidade
- [Convex Discord](https://discord.gg/convex)
- [React Community](https://reactjs.org/community/support.html)

---

**🎯 Próximos Passos**: Após configurar o ambiente, comece explorando o código existente e execute os testes para garantir que tudo está funcionando corretamente!
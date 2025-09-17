# 🔧 Guia de Solução de Problemas

## Visão Geral

Este guia aborda os problemas mais comuns encontrados no WhatsApp AI Assistant e suas soluções. Organize os problemas por categoria para facilitar a localização da solução.

---

## 🚀 Problemas de Inicialização

### Erro: "Convex deployment not found"

**Sintomas:**
```bash
Error: Deployment "your-deployment" not found
```

**Soluções:**
1. **Verificar configuração do .env.local:**
   ```bash
   # Verificar se as variáveis estão corretas
   cat .env.local | grep CONVEX
   
   # Deve mostrar:
   CONVEX_DEPLOYMENT=your-deployment-name
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   ```

2. **Fazer login no Convex:**
   ```bash
   npx convex login
   npx convex dev
   ```

3. **Recriar deployment se necessário:**
   ```bash
   npx convex deploy --create-deployment
   ```

### Erro: "Port 5173 already in use"

**Sintomas:**
```bash
Error: Port 5173 is already in use
```

**Soluções:**
1. **Matar processo na porta:**
   ```bash
   # macOS/Linux
   lsof -ti:5173 | xargs kill -9
   
   # Ou usar porta diferente
   npm run dev -- --port 3000
   ```

2. **Verificar processos Node.js:**
   ```bash
   ps aux | grep node
   killall node
   ```

### Erro: "Module not found"

**Sintomas:**
```bash
Error: Cannot resolve module '@/components/...'
```

**Soluções:**
1. **Reinstalar dependências:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Verificar configuração do Vite:**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   });
   ```

---

## 🗄️ Problemas de Banco de Dados

### Erro: "Schema mismatch"

**Sintomas:**
```bash
Error: Schema validation failed
ConvexError: Schema mismatch for table "participants"
```

**Soluções:**
1. **Verificar schema atual:**
   ```bash
   npx convex dashboard
   # Ir para "Schema" e comparar com convex/schema.ts
   ```

2. **Fazer push do schema:**
   ```bash
   npx convex dev --once
   # Ou forçar deploy
   npx convex deploy --replace
   ```

3. **Limpar dados de desenvolvimento:**
   ```bash
   # CUIDADO: Apaga todos os dados!
   npx convex import --replace convex/sampleData.jsonl
   ```

### Erro: "Index not found"

**Sintomas:**
```bash
Error: Index "by_phone" not found on table "participants"
```

**Soluções:**
1. **Verificar definição do índice:**
   ```typescript
   // convex/schema.ts
   participants: defineTable({
     phoneNumber: v.string(),
     // ... outros campos
   })
   .index("by_phone", ["phoneNumber"]) // ← Verificar se existe
   ```

2. **Aguardar criação do índice:**
   ```bash
   # Índices são criados automaticamente, mas pode demorar
   # Verificar no dashboard se está "Building"
   ```

### Erro: "Document not found"

**Sintomas:**
```typescript
// Query retorna null inesperadamente
const participant = await ctx.db.get(participantId);
// participant é null
```

**Soluções:**
1. **Verificar se ID existe:**
   ```typescript
   // Adicionar validação
   const participant = await ctx.db.get(participantId);
   if (!participant) {
     throw new Error(`Participant ${participantId} not found`);
   }
   ```

2. **Verificar tipo do ID:**
   ```typescript
   // Garantir que é um ID válido
   import { Id } from "./_generated/dataModel";
   
   function isValidId(id: string): id is Id<"participants"> {
     return id.startsWith("participant_");
   }
   ```

---

## 📱 Problemas de WhatsApp

### Webhook não recebe mensagens

**Sintomas:**
- Mensagens enviadas no WhatsApp não aparecem no sistema
- Logs não mostram chamadas do webhook

**Diagnóstico:**
```bash
# Verificar se webhook está acessível
curl -X POST https://your-deployment.convex.cloud/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=test&From=whatsapp:+5511999999999&Body=test"
```

**Soluções:**
1. **Verificar configuração no Twilio:**
   ```
   Webhook URL: https://your-deployment.convex.cloud/whatsapp/webhook
   HTTP Method: POST
   ```

2. **Verificar logs do Convex:**
   ```bash
   npx convex logs --tail
   ```

3. **Testar com ngrok (desenvolvimento):**
   ```bash
   ngrok http 3210
   # Usar URL do ngrok no Twilio Console
   ```

### Erro: "Invalid phone number"

**Sintomas:**
```bash
Twilio Error 21211: The 'To' number is not a valid phone number
```

**Soluções:**
1. **Verificar formato do número:**
   ```typescript
   // Formato correto: whatsapp:+5511999999999
   const formatPhoneNumber = (phone: string): string => {
     // Remover caracteres especiais
     const cleaned = phone.replace(/[^\d+]/g, '');
     
     // Adicionar + se não tiver
     const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
     
     return `whatsapp:${withPlus}`;
   };
   ```

2. **Validar número antes de enviar:**
   ```typescript
   const isValidPhoneNumber = (phone: string): boolean => {
     const phoneRegex = /^\+[1-9]\d{1,14}$/;
     return phoneRegex.test(phone.replace('whatsapp:', ''));
   };
   ```

### Mensagens não são entregues

**Sintomas:**
- Status permanece em "sent" ou "queued"
- Usuário não recebe mensagens

**Soluções:**
1. **Verificar status da mensagem:**
   ```typescript
   // Implementar webhook de status
   export const whatsappStatus = httpAction(async (ctx, request) => {
     const formData = await request.formData();
     const status = formData.get("MessageStatus");
     const sid = formData.get("MessageSid");
     
     console.log(`Message ${sid} status: ${status}`);
     
     // Atualizar status no banco
     await ctx.runMutation(internal.whatsapp.updateMessageStatus, {
       sid: sid as string,
       status: status as string
     });
   });
   ```

2. **Verificar limites de rate:**
   ```typescript
   // Implementar rate limiting
   const checkRateLimit = async (phoneNumber: string) => {
     const recentMessages = await ctx.db.query("messages")
       .withIndex("by_phone", (q) => q.eq("to", phoneNumber))
       .filter((q) => q.gt(q.field("timestamp"), Date.now() - 60000))
       .collect();
     
     return recentMessages.length < 10; // Max 10 por minuto
   };
   ```

---

## 🤖 Problemas de IA

### Erro: "OpenAI API rate limit"

**Sintomas:**
```bash
Error: Rate limit exceeded for requests
```

**Soluções:**
1. **Implementar retry com backoff:**
   ```typescript
   const callOpenAIWithRetry = async (prompt: string, maxRetries = 3) => {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await openai.chat.completions.create({
           model: "gpt-4",
           messages: [{ role: "user", content: prompt }]
         });
       } catch (error) {
         if (error.status === 429 && i < maxRetries - 1) {
           const delay = Math.pow(2, i) * 1000; // Backoff exponencial
           await new Promise(resolve => setTimeout(resolve, delay));
           continue;
         }
         throw error;
       }
     }
   };
   ```

2. **Implementar queue de requests:**
   ```typescript
   class AIRequestQueue {
     private queue: Array<() => Promise<any>> = [];
     private processing = false;
     
     async add<T>(request: () => Promise<T>): Promise<T> {
       return new Promise((resolve, reject) => {
         this.queue.push(async () => {
           try {
             const result = await request();
             resolve(result);
           } catch (error) {
             reject(error);
           }
         });
         
         this.process();
       });
     }
     
     private async process() {
       if (this.processing || this.queue.length === 0) return;
       
       this.processing = true;
       
       while (this.queue.length > 0) {
         const request = this.queue.shift()!;
         await request();
         await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
       }
       
       this.processing = false;
     }
   }
   ```

### Respostas de IA inconsistentes

**Sintomas:**
- IA não segue o fluxo da entrevista
- Respostas fora de contexto

**Soluções:**
1. **Melhorar prompt engineering:**
   ```typescript
   const buildStagePrompt = (stage: string, context: any) => {
     const basePrompt = `
   Você é um assistente de pesquisa especializado em entrevistas estruturadas.
   
   CONTEXTO ATUAL:
   - Estágio: ${stage}
   - Participante: ${context.participantName || 'Anônimo'}
   - Mensagens anteriores: ${context.messageCount || 0}
   
   INSTRUÇÕES ESPECÍFICAS PARA O ESTÁGIO "${stage}":
   ${getStageInstructions(stage)}
   
   REGRAS IMPORTANTES:
   1. Mantenha o foco no estágio atual
   2. Faça apenas UMA pergunta por vez
   3. Use linguagem natural e amigável
   4. Não avance para o próximo estágio sem completar o atual
   `;
   
     return basePrompt;
   };
   ```

2. **Validar respostas da IA:**
   ```typescript
   const validateAIResponse = (response: string, stage: string): boolean => {
     const stageKeywords = {
       demographics: ['idade', 'profissão', 'localização'],
       experience: ['experiência', 'anos', 'trabalho'],
       preferences: ['prefere', 'gosta', 'importante']
     };
     
     const keywords = stageKeywords[stage] || [];
     return keywords.some(keyword => 
       response.toLowerCase().includes(keyword)
     );
   };
   ```

### Erro: "Context length exceeded"

**Sintomas:**
```bash
Error: This model's maximum context length is 4096 tokens
```

**Soluções:**
1. **Implementar truncamento de contexto:**
   ```typescript
   const truncateContext = (messages: Message[], maxTokens = 3000) => {
     let totalTokens = 0;
     const truncated = [];
     
     // Começar pelas mensagens mais recentes
     for (let i = messages.length - 1; i >= 0; i--) {
       const message = messages[i];
       const tokens = estimateTokens(message.content);
       
       if (totalTokens + tokens > maxTokens) break;
       
       totalTokens += tokens;
       truncated.unshift(message);
     }
     
     return truncated;
   };
   
   const estimateTokens = (text: string): number => {
     // Estimativa aproximada: 1 token ≈ 4 caracteres
     return Math.ceil(text.length / 4);
   };
   ```

2. **Usar resumos para contexto longo:**
   ```typescript
   const createContextSummary = async (messages: Message[]) => {
     if (messages.length <= 10) return messages;
     
     const oldMessages = messages.slice(0, -5);
     const recentMessages = messages.slice(-5);
     
     // Resumir mensagens antigas
     const summary = await openai.chat.completions.create({
       model: "gpt-3.5-turbo",
       messages: [{
         role: "system",
         content: "Resuma esta conversa em 2-3 frases, mantendo informações importantes:"
       }, {
         role: "user",
         content: oldMessages.map(m => `${m.direction}: ${m.content}`).join('\n')
       }]
     });
     
     return [
       { content: `[Resumo]: ${summary.choices[0].message.content}`, direction: "system" },
       ...recentMessages
     ];
   };
   ```

---

## 🔐 Problemas de Autenticação

### Erro: "User not authenticated"

**Sintomas:**
```bash
ConvexError: User not authenticated
```

**Soluções:**
1. **Verificar configuração do Convex Auth:**
   ```typescript
   // convex/auth.ts
   export default {
     providers: [
       GitHub({
         clientId: process.env.GITHUB_CLIENT_ID!,
         clientSecret: process.env.GITHUB_CLIENT_SECRET!,
       }),
     ],
   };
   ```

2. **Verificar token no frontend:**
   ```typescript
   // src/hooks/useAuth.ts
   import { useConvexAuth } from "convex/react";
   
   export const useAuth = () => {
     const { isLoading, isAuthenticated } = useConvexAuth();
     
     if (isLoading) {
       return { loading: true };
     }
     
     if (!isAuthenticated) {
       return { authenticated: false };
     }
     
     return { authenticated: true };
   };
   ```

### Sessão expira rapidamente

**Sintomas:**
- Usuário precisa fazer login frequentemente
- Token expira inesperadamente

**Soluções:**
1. **Configurar refresh automático:**
   ```typescript
   // src/components/AuthProvider.tsx
   import { useEffect } from 'react';
   import { useConvexAuth } from 'convex/react';
   
   export const AuthProvider = ({ children }) => {
     const { isAuthenticated } = useConvexAuth();
     
     useEffect(() => {
       if (isAuthenticated) {
         // Refresh token a cada 30 minutos
         const interval = setInterval(() => {
           // Convex handles this automatically
         }, 30 * 60 * 1000);
         
         return () => clearInterval(interval);
       }
     }, [isAuthenticated]);
     
     return <>{children}</>;
   };
   ```

---

## 🎨 Problemas de Interface

### Componentes não renderizam

**Sintomas:**
- Tela em branco
- Componentes não aparecem

**Soluções:**
1. **Verificar console do navegador:**
   ```javascript
   // Abrir DevTools (F12) e verificar erros
   console.error // Procurar por erros em vermelho
   ```

2. **Adicionar error boundaries:**
   ```typescript
   // src/components/ErrorBoundary.tsx
   import React from 'react';
   
   interface State {
     hasError: boolean;
     error?: Error;
   }
   
   export class ErrorBoundary extends React.Component<
     React.PropsWithChildren<{}>,
     State
   > {
     constructor(props: React.PropsWithChildren<{}>) {
       super(props);
       this.state = { hasError: false };
     }
     
     static getDerivedStateFromError(error: Error): State {
       return { hasError: true, error };
     }
     
     componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
       console.error('Error caught by boundary:', error, errorInfo);
     }
     
     render() {
       if (this.state.hasError) {
         return (
           <div className="p-4 bg-red-50 border border-red-200 rounded">
             <h2 className="text-red-800 font-semibold">Algo deu errado</h2>
             <p className="text-red-600 mt-2">
               {this.state.error?.message || 'Erro desconhecido'}
             </p>
             <button
               onClick={() => this.setState({ hasError: false })}
               className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
             >
               Tentar novamente
             </button>
           </div>
         );
       }
       
       return this.props.children;
     }
   }
   ```

### Estilos não aplicam

**Sintomas:**
- CSS não funciona
- Tailwind classes não aplicam

**Soluções:**
1. **Verificar configuração do Tailwind:**
   ```javascript
   // tailwind.config.js
   module.exports = {
     content: [
       "./index.html",
       "./src/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {},
     },
     plugins: [],
   };
   ```

2. **Verificar importação do CSS:**
   ```typescript
   // src/main.tsx
   import './index.css'; // ← Verificar se está importado
   ```

3. **Verificar arquivo CSS:**
   ```css
   /* src/index.css */
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

---

## 📊 Problemas de Performance

### Aplicação lenta

**Sintomas:**
- Interface travando
- Queries demoradas

**Diagnóstico:**
```typescript
// Adicionar logs de performance
const measurePerformance = async (name: string, fn: () => Promise<any>) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  
  console.log(`${name} took ${end - start} milliseconds`);
  
  return result;
};
```

**Soluções:**
1. **Otimizar queries:**
   ```typescript
   // ❌ Ruim: buscar todos os dados
   const allParticipants = await ctx.db.query("participants").collect();
   
   // ✅ Bom: usar paginação
   const participants = await ctx.db.query("participants")
     .order("desc")
     .take(20);
   ```

2. **Implementar memoização:**
   ```typescript
   // src/hooks/useMemoizedQuery.ts
   import { useMemo } from 'react';
   import { useQuery } from 'convex/react';
   
   export const useMemoizedQuery = (query, args, deps = []) => {
     const memoizedArgs = useMemo(() => args, deps);
     return useQuery(query, memoizedArgs);
   };
   ```

### Memory leaks

**Sintomas:**
- Uso de memória crescente
- Aplicação trava após uso prolongado

**Soluções:**
1. **Limpar subscriptions:**
   ```typescript
   // src/hooks/useRealTimeData.ts
   import { useEffect, useRef } from 'react';
   
   export const useRealTimeData = () => {
     const subscriptionRef = useRef<any>();
     
     useEffect(() => {
       // Criar subscription
       subscriptionRef.current = createSubscription();
       
       // Cleanup
       return () => {
         if (subscriptionRef.current) {
           subscriptionRef.current.unsubscribe();
         }
       };
     }, []);
   };
   ```

2. **Evitar closures desnecessárias:**
   ```typescript
   // ❌ Ruim: cria nova função a cada render
   const handleClick = () => {
     doSomething(data);
   };
   
   // ✅ Bom: usar useCallback
   const handleClick = useCallback(() => {
     doSomething(data);
   }, [data]);
   ```

---

## 🔍 Ferramentas de Debug

### Logs Estruturados

```typescript
// utils/debug.ts
export const debug = {
  convex: (functionName: string, args: any, result?: any) => {
    console.group(`🔧 Convex: ${functionName}`);
    console.log('Args:', args);
    if (result !== undefined) {
      console.log('Result:', result);
    }
    console.groupEnd();
  },
  
  whatsapp: (direction: 'in' | 'out', message: any) => {
    console.group(`📱 WhatsApp ${direction === 'in' ? '→' : '←'}`);
    console.log('From:', message.from);
    console.log('Content:', message.content);
    console.log('Timestamp:', new Date(message.timestamp));
    console.groupEnd();
  },
  
  ai: (prompt: string, response: string, tokens?: number) => {
    console.group('🤖 AI Interaction');
    console.log('Prompt:', prompt.substring(0, 100) + '...');
    console.log('Response:', response.substring(0, 100) + '...');
    if (tokens) console.log('Tokens:', tokens);
    console.groupEnd();
  }
};
```

### Health Check Endpoint

```typescript
// convex/debug.ts
export const systemHealth = query({
  args: {},
  handler: async (ctx) => {
    const checks = {
      database: false,
      auth: false,
      external_apis: {
        openai: false,
        twilio: false
      }
    };
    
    try {
      // Test database
      await ctx.db.query("participants").take(1);
      checks.database = true;
    } catch (error) {
      console.error('Database check failed:', error);
    }
    
    try {
      // Test auth
      const identity = await ctx.auth.getUserIdentity();
      checks.auth = !!identity;
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    
    // Test external APIs seria feito em uma action
    
    return {
      status: Object.values(checks).every(Boolean) ? 'healthy' : 'degraded',
      checks,
      timestamp: Date.now()
    };
  }
});
```

---

## 📞 Suporte e Escalação

### Quando Escalar

1. **Problemas de Infraestrutura:**
   - Convex deployment down
   - Rate limits atingidos
   - Problemas de rede

2. **Bugs Críticos:**
   - Perda de dados
   - Falhas de segurança
   - Sistema inacessível

3. **Performance Severa:**
   - Queries > 10 segundos
   - Memory leaks críticos
   - CPU usage > 90%

### Informações para Suporte

Sempre incluir:
```
1. Timestamp do problema
2. Logs relevantes
3. Steps to reproduce
4. Environment (dev/prod)
5. User affected (se aplicável)
6. Error messages completas
```

### Contatos de Emergência

```
- Convex Support: support@convex.dev
- Twilio Support: help.twilio.com
- OpenAI Support: help.openai.com
```

---

**💡 Dica Final**: Mantenha este guia atualizado conforme novos problemas são descobertos e resolvidos. Documente sempre as soluções que funcionaram!
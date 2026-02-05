# 🔍 Indexação de Participantes - Guia Completo

Este documento explica todas as formas de indexar participantes no sistema RAG para busca semântica.

## 📋 Índice

1. [Via NPM Script (Mais Fácil)](#1-via-npm-script-mais-fácil)
2. [Via Convex Dashboard](#2-via-convex-dashboard)
3. [Via npx convex run](#3-via-npx-convex-run)
4. [Via Código (Frontend/Backend)](#4-via-código-frontendbackend)
5. [Via Cron Jobs (Automático)](#5-via-cron-jobs-automático)
6. [Via HTTP API](#6-via-http-api)

---

## 1. Via NPM Script (Mais Fácil) ⭐

A forma mais simples e recomendada:

```bash
# Indexar TODOS os participantes
npm run index-participants

# Indexar apenas os primeiros 100
npm run index-participants 100

# Indexar os primeiros 50
npm run index-participants 50
```

**Vantagens:**
- ✅ Mais simples de usar
- ✅ Não precisa de curl ou Postman
- ✅ Feedback imediato no terminal
- ✅ Link direto para os logs

---

## 2. Via Convex Dashboard 🎛️

Acesse o dashboard e execute funções diretamente:

### Passo a Passo:

1. Abra o [Convex Dashboard](https://dashboard.convex.dev/d/neighborly-ibex-402)

2. Vá em **Functions** no menu lateral

3. Procure pela função `admin:indexAllParticipants`

4. Clique em **"Run"**

5. (Opcional) Configure o argumento:
   ```json
   {
     "limit": 100
   }
   ```

6. Clique em **"Run Function"**

7. Vá em **Logs** para acompanhar o progresso

**Vantagens:**
- ✅ Interface visual
- ✅ Não precisa de terminal
- ✅ Logs em tempo real
- ✅ Perfeito para testes

---

## 3. Via npx convex run 🚀

Use a CLI do Convex diretamente:

```bash
# Indexar todos os participantes
npx convex run admin:indexAllParticipants

# Indexar com limite
npx convex run admin:indexAllParticipants '{"limit": 100}'

# Versão detalhada
npx convex run admin:indexAllParticipants \
  --arg limit:100
```

**Vantagens:**
- ✅ Comando único
- ✅ Funciona em qualquer ambiente
- ✅ Bom para CI/CD
- ✅ Não precisa de script customizado

---

## 4. Via Código (Frontend/Backend) 💻

### No Frontend (React):

```typescript
import { useMutation } from "convex/react";
import { api } from "./convex/_generated/api";

function AdminPanel() {
  const indexAll = useMutation(api.admin.indexAllParticipants);

  const handleIndex = async () => {
    const result = await indexAll({ limit: 100 });
    console.log(result.message);
  };

  return (
    <button onClick={handleIndex}>
      Indexar Participantes
    </button>
  );
}
```

### No Backend (Action/Mutation):

```typescript
// Em qualquer action ou mutation do Convex
export const myFunction = mutation({
  args: {},
  handler: async (ctx) => {
    // Trigger indexing
    await ctx.runMutation(api.admin.indexAllParticipants, {
      limit: 100
    });
  },
});
```

**Vantagens:**
- ✅ Integração nativa com sua aplicação
- ✅ Pode ser acionado por eventos
- ✅ Controle programático completo

---

## 5. Via Cron Jobs (Automático) ⏰

Edite `convex/crons.ts` para habilitar indexação automática:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reindexar tudo diariamente às 3 AM UTC
crons.daily(
  "reindex participants",
  { hourUTC: 3, minuteUTC: 0 },
  internal.functions.participantRAG.batchAddParticipants,
  { limit: 1000 }
);

// OU: Indexar incrementalmente a cada hora
crons.hourly(
  "sync new participants",
  { minuteUTC: 0 },
  internal.functions.participantRAG.batchAddParticipants,
  { limit: 100 }
);

export default crons;
```

**Vantagens:**
- ✅ Totalmente automático
- ✅ Sempre atualizado
- ✅ Zero manutenção
- ✅ Configurável por horário

---

## 6. Via HTTP API 🌐

Se precisar chamar de fora do Convex:

```bash
# Via curl
curl -X POST https://neighborly-ibex-402.convex.site/participants/rag/batch-add \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# Via JavaScript/Node.js
const response = await fetch(
  'https://neighborly-ibex-402.convex.site/participants/rag/batch-add',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 100 })
  }
);

# Via Python
import requests

response = requests.post(
  'https://neighborly-ibex-402.convex.site/participants/rag/batch-add',
  json={'limit': 100}
)
```

**Vantagens:**
- ✅ Funciona de qualquer linguagem
- ✅ Pode ser chamado de webhooks
- ✅ Integra com sistemas externos

---

## 🎯 Qual Método Usar?

| Situação | Método Recomendado |
|----------|-------------------|
| Primeira indexação | `npm run index-participants` |
| Teste/Debug | Convex Dashboard |
| CI/CD Pipeline | `npx convex run` |
| Aplicação Web | Código (Frontend) |
| Manutenção contínua | Cron Jobs |
| Integração externa | HTTP API |

---

## 📊 Monitorando o Progresso

Todas as formas de indexação geram logs detalhados:

1. **Via Dashboard**: [Convex Logs](https://dashboard.convex.dev/d/neighborly-ibex-402/logs)

2. **Via Terminal** (quando usando npm ou npx):
   ```
   🚀 Starting indexing of 100 participants...
   ✅ Indexing scheduled for 100 participants
   📊 Monitor progress in Convex Dashboard > Logs
   ```

3. **Logs do Convex** mostram:
   - `🔮 Adding participant <id> to RAG`
   - `✅ Added participant <id> to RAG`
   - `🏁 Batch complete: X processed, Y skipped, Z failed`

---

## 🔄 Indexação Automática

Por padrão, os participantes são indexados automaticamente quando:

✅ **Novo participante criado** → Auto-indexado em background
✅ **Participante atualizado** → Re-indexado se dados relevantes mudaram
✅ **Participante deletado** → Removido do RAG

Você só precisa indexar manualmente se:
- É a primeira vez usando o sistema
- Quer reindexar tudo após mudanças no algoritmo
- Teve algum problema e quer re-processar

---

## 💡 Dicas

1. **Primeira vez?** Use `npm run index-participants` para indexar tudo

2. **Desenvolvimento?** Use o Convex Dashboard para testes rápidos

3. **Produção?** Ative os Cron Jobs para manutenção automática

4. **Performance?** Use `limit` para processar em lotes menores:
   ```bash
   npm run index-participants 50  # Processa 50 por vez
   ```

5. **Monitoramento?** Sempre confira os logs para ver o progresso

---

## ❓ Troubleshooting

### Problema: "CONVEX_URL not found"
**Solução:** Certifique-se que o arquivo `.env.local` existe com:
```
VITE_CONVEX_URL=https://neighborly-ibex-402.convex.cloud
```

### Problema: Indexação muito lenta
**Solução:** Use batches menores:
```bash
npm run index-participants 25
```

### Problema: Alguns participantes não indexados
**Solução:** Participantes sem dados relevantes são pulados. Confira os logs:
```
⚠️ Participant <id> has no data, skipping
```

---

## 📚 Referências

- [Convex RAG Documentation](https://docs.convex.dev/rag)
- [Convex Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [Convex CLI Reference](https://docs.convex.dev/cli)

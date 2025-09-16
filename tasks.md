# Implementation Tasks: Interview Bot with RAG + Admin Dashboard

## Current State Analysis
- **Existing codebase**: WhatsApp AI Assistant with Convex backend, React/Vite frontend
- **Current integrations**: Twilio WhatsApp, OpenAI API, Convex Auth (anonymous)
- **shadcn/ui configured**: components.json present, Tailwind CSS configured
- **Missing**: RAG system, interview state machine, comprehensive admin interface

## Implementation Roadmap (12 phases)

### Phase 1: Infrastructure Setup
**Duration**: 1-2 days
**Status**: ✅ COMPLETED

#### Tasks:
- [x] Update Tailwind config to match shadcn/ui requirements + dark mode support
- [x] Install missing shadcn/ui components: `data-table`, `dialog`, `drawer`, `toast`, `badge`, `progress`, `form`, `tabs`, `command`, etc.
- [x] Create TypeScript types in `src/types/`: `interview.ts`, `rag.ts`, `admin.ts`, `twilio.ts`
- [x] Setup environment variables structure with `.env.local.example`
- [x] Create routing structure for admin pages using React Router

### Phase 2: Convex Schema Extensions
**Duration**: 1 day
**Status**: ✅ COMPLETED

#### Tasks:
- [x] Extend `convex/schema.ts` with new collections:
  - [x] `participants`: phone, name, consent, clusterId, tags, createdAt
  - [x] `organizers`: email, role (owner|editor|viewer)  
  - [x] `conversations`: participantId, channel, openedAt, lastMessageAt, isOpen
  - [x] `interview_sessions`: participantId, step, answers, lastStepAt
  - [x] `templates`: HSM templates with name, locale, twilioId, variables, stage
  - [x] `knowledge_docs`: title, source, tags, status, createdAt
  - [x] `knowledge_chunks`: docId, chunk, embedding, tags
  - [x] `clusters`: name, description, rules
  - [x] `content_blocks`: stage, clusterId, prompt, tips, cta
  - [x] `jobs`: type, status, payload, progress, createdAt, updatedAt
  - [x] `analytics_events`: type, refId, meta, createdAt
- [x] Add proper indexes for all collections
- [x] Migrate existing `whatsappMessages` to include `stateSnapshot` field

### Phase 3: RAG Pipeline Implementation  
**Duration**: 2-3 days
**Status**: ✅ COMPLETED

#### Tasks:
- [x] Create `convex/functions/rag.ts`:
  - [x] `ingestDocument()`: chunking (500-800 tokens, 100 overlap), embedding via OpenAI text-embedding-3-large
  - [x] `retrieve()`: cosine similarity search with top-k (8) + tag-based filtering  
  - [x] `fuseAnswer()`: prompt construction with context + session state + retrieved chunks
- [x] Implement text chunking utilities in `src/lib/rag.ts`
- [x] Add embedding storage in `knowledge_chunks` with vector search capabilities
- [x] Create reranking logic based on tags (ASA, tema, nivel) and cosine similarity

### Phase 4: Interview State Machine
**Duration**: 2-3 days
**Status**: ✅ COMPLETED

#### Tasks:
- [x] Create `convex/functions/interview.ts`:
  - [x] State machine: `intro → ASA → listas → pre_evento → diaD → pos_24h → pos_7d → pos_30d`
  - [x] `startOrResumeSession()`: initialize or load existing session
  - [x] `handleInbound()`: process user input, call RAG if needed, advance state, generate response
  - [x] `nextStep()`: transition logic with completion guards
- [x] Implement response generation rules: brief + empathetic, 1 open question, 1 micro-task, 1 subtle invite
- [x] **CRITICAL**: Never expose `stateSnapshot` to end users - internal use only
- [x] Integration with existing `aiAgent.ts` for backwards compatibility

### Phase 5: Enhanced Twilio Integration
**Duration**: 1-2 days
**Status**: ✅ COMPLETED

#### Tasks:
- [x] Refactor `convex/functions/twilio.ts`:
  - [x] Enhance `inboundMessage()` with interview flow integration
  - [x] Add `sendTemplate()` for HSM outside 24h window  
  - [x] Add `sendMessage()` improvements for session messages within window
  - [x] Implement signature verification for production security
- [x] Update `convex/router.ts` webhook endpoints to use new interview system
- [x] Add template management and 24h window detection

### Phase 6: Admin Dashboard Foundation
**Duration**: 2 days
**Status**: ✅ COMPLETED

#### Tasks:
- [x] Create admin layout in `src/admin/`:
  - [x] `layout/AdminLayout.tsx`: navigation, auth guards, theme provider
  - [x] `components/Navigation.tsx`: sidebar with role-based menu items
  - [x] `pages/Dashboard.tsx`: KPI cards (participants, 24h active, response rate, p95 latency)
- [x] Implement role-based access control (owner/editor/viewer)
- [x] Create `src/hooks/useAuth.ts` for admin authentication state
- [x] Setup protected routes with redirect logic
- [x] Create `convex/admin.ts` with organizer management and dashboard KPI functions
- [x] **BONUS**: Fixed authentication system and created test organizer user for admin access

### Phase 7: Participants & Conversations Admin
**Duration**: 2-3 days
**Status**: ✅ COMPLETED

#### Tasks:
- [x] `src/admin/pages/Participants.tsx`:
  - [x] DataTable with TanStack Table: filters by cluster/stage/opt-out
  - [x] "Ver conversa" action opens conversation drawer
  - [x] Export/Delete functionality for LGPD compliance
- [x] `src/admin/components/ConversationViewer.tsx`:
  - [x] Message bubbles (inbound/outbound) with timestamps
  - [x] **Admin-only** stateSnapshot display for debugging
  - [x] "Responder" action for manual intervention
- [x] `src/admin/pages/Conversations.tsx`: conversation detail page with full history
- [x] Added `getConversations` function to `convex/admin.ts` for conversation management
- [x] Fixed all TypeScript errors and permission checks
- [x] Implemented proper TanStack Table integration with pagination and filtering
- [x] **BONUS**: Verified admin dashboard is fully functional with proper authentication

### Phase 8: Knowledge Management System
**Duration**: 2-3 days
**Status**: 🔄 NEXT (Ready to Start)

#### Tasks:
- [ ] `src/admin/pages/Knowledge.tsx`:
  - [ ] Document upload interface (txt/md/pdf support)
  - [ ] Document list with status indicators
  - [ ] "Reindex" button triggering background job
  - [ ] Progress indicators for ingestion jobs
- [ ] `src/admin/components/UploadDocuments.tsx`: drag-and-drop with validation
- [ ] `convex/functions/admin/knowledge.ts`: document processing, chunk creation, embedding generation
- [ ] Integration with RAG pipeline for immediate use in interviews

### Phase 9: Content Management by Stage/Cluster  
**Duration**: 2 days
**Status**: ⏳ Pending

#### Tasks:
- [ ] `src/admin/pages/Content.tsx`:
  - [ ] Tabbed interface by interview stage
  - [ ] Cluster selector (combobox) for targeted content
  - [ ] Rich text editor for prompts, tips, CTA configuration
  - [ ] Preview functionality showing how content appears to users
- [ ] `src/admin/components/ContentEditor.tsx`: WYSIWYG editor with markdown support
- [ ] `convex/functions/admin/content.ts`: CRUD operations for content blocks
- [ ] Integration with interview state machine to use dynamic content

### Phase 10: HSM Templates & CSV Import
**Duration**: 2-3 days
**Status**: ⏳ Pending

#### Tasks:
- [ ] `src/admin/pages/Templates.tsx`: CRUD for WhatsApp HSM templates
- [ ] `src/admin/pages/Import.tsx`:
  - [ ] CSV upload with automatic column detection
  - [ ] Column mapping interface with preview
  - [ ] Error handling per row (no full abort on partial errors)  
  - [ ] Confirmation step before creating content_blocks/clusters
- [ ] `src/admin/components/CSVMapper.tsx`: interactive mapping component
- [ ] `convex/functions/admin/import.ts`: CSV processing and content block generation

### Phase 11: Jobs System & Scheduling
**Duration**: 2 days
**Status**: ⏳ Pending

#### Tasks:
- [ ] `src/admin/pages/Jobs.tsx`: job list with status badges, rerun capability
- [ ] `convex/functions/jobs/`: scheduled jobs for interview stages (10d before, day D, +24h, +7d, +30d)
- [ ] Dry-run functionality in admin to preview scheduled sends
- [ ] HSM vs session message logic based on 24h window
- [ ] Job progress tracking and error handling

### Phase 12: LGPD Compliance & Analytics  
**Duration**: 2 days
**Status**: ⏳ Pending

#### Tasks:
- [ ] `src/admin/pages/Settings.tsx`: 
  - [ ] Environment variables management (owner only)
  - [ ] Data retention policies configuration
  - [ ] LGPD compliance tools
- [ ] Participant data export (JSON format) and permanent deletion
- [ ] Retention job (180 days default) for automatic cleanup
- [ ] Analytics dashboard with p95 latency tracking
- [ ] Mini time-series charts for performance monitoring

## Technical Specifications

### Environment Variables (.env.local.example)
```bash
# OpenAI
OPENAI_API_KEY=sk-...
EMBEDDINGS_MODEL=text-embedding-3-large
GENERATION_MODEL=gpt-4

# Twilio  
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+14155238886

# Convex (auto-provided)
CONVEX_DEPLOYMENT=...
CONVEX_URL=...
```

### Key Architecture Decisions
1. **State Management**: Interview state stored in Convex, never exposed to end users
2. **RAG Implementation**: OpenAI embeddings + Convex vector storage + cosine similarity  
3. **Admin Security**: Role-based access with Convex Auth integration
4. **Performance Targets**: p95 ≤ 1.5s end-to-end, ≤ 800ms retrieval
5. **Data Compliance**: Built-in LGPD tools, consent tracking, data retention

### Testing Strategy
- Manual Twilio webhook simulation via curl
- Admin workflow testing: upload doc → reindex → verify RAG usage
- CSV import with preview and error handling
- HSM template testing outside 24h window
- LGPD export/delete workflows

## Files to Create/Modify

### New Convex Functions
- `convex/functions/interview.ts`
- `convex/functions/rag.ts` 
- `convex/functions/admin/knowledge.ts`
- `convex/functions/admin/content.ts`
- `convex/functions/admin/import.ts`
- `convex/functions/jobs/scheduler.ts`

### Frontend Structure
- `src/types/` (interview.ts, rag.ts, admin.ts, twilio.ts)
- `src/admin/layout/AdminLayout.tsx`
- `src/admin/pages/` (Dashboard, Participants, Conversations, Knowledge, Content, Templates, Import, Jobs, Settings)
- `src/admin/components/` (Navigation, ConversationViewer, UploadDocuments, ContentEditor, CSVMapper, etc.)
- `src/hooks/useAuth.ts`
- `src/lib/rag.ts`

### Configuration
- `.env.local.example`
- Updated `tailwind.config.js` for shadcn/ui compatibility
- `package.json` updates for React Router, TanStack Table, additional shadcn/ui components

## Acceptance Criteria
- [ ] Interview bot with state machine (8 stages) integrated with RAG  
- [ ] Admin dashboard with all specified pages and functionality
- [ ] No stateSnapshot leakage to end users
- [ ] LGPD compliant with export/delete/retention
- [ ] CSV import with auto-detection and error handling  
- [ ] Performance targets met (p95 ≤ 1.5s, retrieval ≤ 800ms)
- [ ] HSM templates working outside 24h window
- [ ] Complete documentation and environment setup

## Estimated Timeline: 18-22 days
**Critical Path**: Schema → RAG → Interview State Machine → Admin Core → Specialized Admin Pages

---

## Progress Tracking
- **Total Tasks**: ~80
- **Completed**: ~45
- **In Progress**: 0  
- **Remaining**: ~35
- **Overall Progress**: 56% (7/12 phases completed)

**Last Updated**: 2025-01-14 (After completing Phases 1-7, including admin dashboard authentication fix)
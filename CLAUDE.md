# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Primary development:**
- `npm run dev` - Start both frontend (Vite) and Convex backend in parallel
- `npm run dev:frontend` - Start only the Vite frontend server (opens browser automatically)
- `npm run dev:backend` - Start only the Convex backend development server

**Build and validation:**
- `npm run build` - Build the frontend for production
- `npm run lint` - Run TypeScript checks and build validation (includes convex dev --once)

**Note:** The lint command performs comprehensive validation including TypeScript checking for both the main project and Convex backend, plus a full build to catch all potential issues.

## Architecture Overview

This is a **WhatsApp AI Assistant** built with Convex as the backend and React (Vite) as the frontend. The application processes incoming WhatsApp messages via Twilio webhooks and automatically responds using OpenAI's API.

### Tech Stack
- **Backend:** Convex (realtime database + serverless functions)
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS
- **Authentication:** Convex Auth with anonymous sign-in
- **External APIs:** Twilio (WhatsApp), OpenAI (AI responses)

### Core Components

**Convex Functions (Backend):**
- `convex/whatsapp.ts` - WhatsApp message handling, Twilio API integration
- `convex/agents.ts` - AI agent processing using Convex Agent framework
- `convex/router.ts` - HTTP API endpoints for Twilio webhooks and REST API
- `convex/auth.ts` - Authentication configuration
- `convex/schema.ts` - Database schema definitions

**Frontend Components:**
- `src/App.tsx` - Main dashboard with message history, contact management, AI logs
- `src/SignInForm.tsx` - Anonymous authentication flow
- `src/SignOutButton.tsx` - Sign out functionality

### Database Schema

**whatsappMessages:** Stores all WhatsApp messages (inbound/outbound) with Twilio metadata
**whatsappContacts:** Contact management with activity tracking
**aiInteractions:** Logs all AI responses for monitoring and debugging

### Key Architectural Patterns

1. **Webhook Processing:** Twilio webhooks trigger immediate message storage and schedule AI processing asynchronously
2. **AI Response Flow:** Incoming messages → conversation history retrieval → OpenAI API call → response via Twilio → interaction logging
3. **Real-time Updates:** Frontend uses Convex queries for live message updates without polling
4. **Error Handling:** Fallback responses when AI fails, comprehensive logging throughout the pipeline

### Important Configuration

**Required Environment Variables:**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` - Twilio credentials
- `OPENAI_API_KEY` or `CONVEX_OPENAI_API_KEY` - OpenAI API access
- `CONVEX_OPENAI_BASE_URL` - Optional custom OpenAI endpoint

**Convex Rules:** The project follows strict Convex development patterns from `.cursor/rules/convex_rules.mdc`:
- Always use new function syntax with args/returns validators
- Use internal functions for sensitive operations
- Proper function references and scheduling
- No deprecated validators (use `v.int64()` not `v.bigint()`)

### Development Notes

- The application is deployed to Convex deployment `neighborly-ibex-402`
- Uses Chef framework for Convex project structure
- Frontend and backend are developed simultaneously with hot reloading
- All HTTP endpoints are defined in `convex/router.ts` (not `convex/http.ts`) to protect auth routes from modification
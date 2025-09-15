# WhatsApp AI Assistant - Project Rules

## Project Overview
This is a WhatsApp AI Assistant built with Convex backend, React frontend, Twilio integration, and OpenAI for intelligent responses.

## Architecture Guidelines

### Backend (Convex)
- Use the new function syntax for all Convex functions
- Always include argument and return validators
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- Use `query`, `mutation`, `action` for public API functions
- Follow file-based routing conventions

### Database Schema
- Define all schemas in `convex/schema.ts`
- Use descriptive index names that include all fields
- System fields (`_id`, `_creationTime`) are automatically added
- Use proper validators for all field types

### WhatsApp Integration
- All webhook endpoints are in `convex/router.ts`
- Messages are stored with Twilio metadata
- Support both inbound and outbound message tracking
- Handle media attachments and message status updates

### AI Processing
- AI responses are processed asynchronously
- Conversation history provides context for responses
- All AI interactions are logged for monitoring
- Use OpenAI with configurable personality and limits

## Development Guidelines

### Code Organization
- Keep public functions in appropriate modules
- Use internal functions for sensitive operations
- Separate HTTP routes from business logic
- Maintain clear separation between frontend and backend

### Error Handling
- Always handle webhook failures gracefully
- Log errors for debugging
- Provide meaningful error messages
- Don't expose internal errors to external APIs

### Security
- Use Convex Auth for user authentication
- Validate all incoming webhook data
- Don't expose sensitive configuration
- Use environment variables for API keys

### Performance
- Use database indexes for efficient queries
- Implement pagination for large result sets
- Process AI responses asynchronously
- Cache conversation history appropriately

## File Structure
```
convex/
├── schema.ts          # Database schema definitions
├── whatsapp.ts        # WhatsApp message operations
├── aiAgent.ts         # AI processing logic
├── router.ts          # HTTP webhook endpoints
├── auth.ts            # Authentication configuration
└── http.ts            # HTTP router setup

src/
├── App.tsx            # Main application component
├── SignInForm.tsx     # Authentication form
└── SignOutButton.tsx  # Logout functionality
```

## API Endpoints
- `POST /whatsapp/webhook` - Receive incoming messages
- `POST /whatsapp/status` - Handle message status updates
- `POST /whatsapp/send` - Send outbound messages
- `GET /whatsapp/messages` - Retrieve message history
- `GET /whatsapp/contacts` - Get contact list
- `GET /whatsapp/ai-interactions` - View AI logs

## Environment Variables
- `CONVEX_DEPLOYMENT` - Convex deployment identifier
- `VITE_CONVEX_URL` - Convex API URL for frontend
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `OPENAI_API_KEY` - OpenAI API key for AI responses

## Testing Guidelines
- Test webhook endpoints with Twilio simulator
- Verify AI responses with different conversation contexts
- Test authentication flows
- Validate real-time updates in the dashboard

## Deployment Notes
- Frontend is built with Vite
- Backend runs on Convex serverless platform
- Webhooks must be publicly accessible
- Environment variables must be configured in production
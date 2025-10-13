# TypeScript Interfaces Documentation

This file documents the TypeScript interfaces used throughout the application, particularly for the participant import system.

## Participant Interface

The `Participant` interface represents a participant in the system with all their associated data.

### Core Fields
- `_id`: Unique identifier (Convex ID)
- `phone`: WhatsApp phone number with `whatsapp:` prefix (required)
- `name`: Participant's full name (optional)
- `consent`: LGPD consent status (required boolean)
- `tags`: Custom tags for categorization
- `createdAt`: Registration timestamp

### External Tracking
- `externalId`: Original survey/form ID for import tracking (prevents duplicate imports)
- `importSource`: CSV filename to filter participants by import batch

### Professional Information
- `cargo`: Job position/role
- `empresa`: Company name (free text - may contain wrong data)
- `empresaPrograma`: Company name from dropdown (more reliable - use this!)
- `setor`: Industry sector

### Demographics
- `email`: Professional email address
- `estado`: Brazilian state
- `raca`: Race/ethnicity
- `genero`: Gender identity
- `annosCarreira`: Years of career experience
- `senioridade`: Seniority level (e.g., "Diretor", "Gerente")
- `linkedin`: LinkedIn profile URL
- `tipoOrganizacao`: Organization type (Startup, Corporação, etc.)
- `programaMarca`: Program brand (FIB, TEMPLO, MOVER 1, MOVER 2, BAYER)
- `receitaAnual`: Annual revenue range

### Additional Identity Fields
- `transgenero`: Transgender identity (boolean)
- `pais`: Country of origin
- `portfolioUrl`: Portfolio or personal website URL

### Program-Specific Flags
- `blackSisterInLaw`: Black Sister in Law membership (boolean)
- `mercadoFinanceiro`: Works in financial market (boolean)
- `membroConselho`: Board member status (boolean)
- `programasPactua`: Previous Pactuá programs (comma-separated string)
- `programasSingue`: Previous Singuê programs (comma-separated string)

## ParticipantProfile Interface

Separate table for rich text content (performance optimization). Linked via `participantId`.

- `realizacoes`: Professional achievements and impact (long text)
- `visaoFuturo`: Career vision for next 5 years (long text)
- `desafiosSuperados`: Barriers overcome in career (long text)
- `desafiosAtuais`: Current challenges for career growth (long text)
- `motivacao`: Motivation for joining program (long text)

## CSV Import Interfaces

### CSVImportRequest
Used when calling `importParticipantsFromCSV`:

```typescript
{
  csvData: Array<{
    nome: string;          // Required
    telefone: string;      // Required
    externalId?: string;   // Optional tracking identifier from external systems
    email?: string;
    // ... all other participant fields
    realizacoes?: string;  // Rich text fields
    visaoFuturo?: string;
    // etc.
  }>;
  clusterId?: string;      // Optional cluster assignment
  importSource?: string;   // Filename for tracking
}
```

### CSVImportResult
Response from import operation:

```typescript
{
  success: number;              // Count of successfully imported participants
  errors: Array<{
    row: number;               // CSV row number
    error: string;             // Error description
    data: any;                 // Original row data
  }>;
  duplicates: Array<{
    row: number;               // CSV row number
    identifierType: 'email' | 'phone'; // Which field triggered the duplicate
    identifierValue: string;   // Value that matched an existing participant
    existingId: string;        // Existing participant ID
    email?: string;            // Email reported back for quick review
  }>;
}
```

## Best Practices

### 1. Deduplication Strategy
The import system checks for duplicates in this priority order:
1. **email** (lowercased for consistency)
2. **phone** (normalized with country code)

`externalId` is still persisted for traceability, but it no longer participates in deduplication.

### 2. Company Name Field Usage
- Use `empresaPrograma` for filtering/analytics (dropdown selection - reliable)
- Use `empresa` only as fallback (may contain achievements instead of company name)

### 3. Import Source Tracking
Always pass `importSource` with the CSV filename:
```typescript
importParticipants({
  csvData: parsedRows,
  importSource: file.name, // e.g., "PLAN Aprovados - Parceiros - APROVADOS.csv"
})
```

This allows you to:
- Filter participants by import batch
- Track which CSV file each participant came from
- Compare different import batches
- Audit import history

### 4. Rich Text vs. Participant Table
- **Participant table**: Core identity, demographics, professional info
- **ParticipantProfile table**: Long text responses (achievements, goals, challenges)

**Why separated?**
- Performance: List queries don't load heavy text content
- Normalization: Keeps participant table focused on searchable/filterable fields

## Query Examples

### Filter by Import Source
```typescript
const batch1 = await getParticipants({
  importSource: "aprovados_marco_2025.csv"
});
```

### Filter by Program
```typescript
const fib = await getParticipants({
  programaMarca: "FIB"
});
```

### Filter by Company (Dropdown)
```typescript
const pepsico = await getParticipants({
  empresaPrograma: "PepsiCo"
});
```

## Migration Notes

If you're updating existing code:
1. Update `Participant` interface imports to include new fields
2. Use `empresaPrograma` instead of `empresa` for company filtering
3. Add `importSource` parameter when importing CSVs
4. Check for `ParticipantProfile` when accessing rich text fields

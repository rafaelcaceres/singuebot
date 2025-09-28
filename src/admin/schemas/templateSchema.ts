import { z } from 'zod';

// Base schema with common validation rules
const baseTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  locale: z.string().min(1, 'Idioma é obrigatório'),
  twilioId: z.string().min(1, 'Twilio Template ID é obrigatório'),
  variables: z.array(z.string()).optional(),
  stage: z.string().min(1, 'Estágio é obrigatório'),
  content: z.string().optional(),
});

// Schema for creating new templates (stricter validation)
export const createTemplateSchema = baseTemplateSchema.extend({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  twilioId: z.string()
    .min(1, 'Twilio Template ID é obrigatório')
    .regex(/^HX[a-zA-Z0-9]+$/, 'Formato de Twilio ID inválido (deve começar com HX)'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
});

// Schema for editing existing templates (more lenient)
export const editTemplateSchema = baseTemplateSchema.extend({
  twilioId: z.string()
    .min(1, 'Twilio Template ID é obrigatório')
    .startsWith('HX', 'ID deve começar com HX'),
});

// Type definitions
export type CreateTemplateFormData = z.infer<typeof createTemplateSchema>;
export type EditTemplateFormData = z.infer<typeof editTemplateSchema>;
export type BaseTemplateFormData = z.infer<typeof baseTemplateSchema>;
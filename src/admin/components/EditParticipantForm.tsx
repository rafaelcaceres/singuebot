import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Schema de validação
const participantSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  cargo: z.string().max(100, 'Cargo deve ter no máximo 100 caracteres').optional(),
  empresa: z.string().max(100, 'Empresa deve ter no máximo 100 caracteres').optional(),
  setor: z.string().max(100, 'Setor deve ter no máximo 100 caracteres').optional(),
  tags: z.array(z.string()).optional(),
});

type ParticipantFormData = z.infer<typeof participantSchema>;

interface EditParticipantFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: Id<"participants"> | null;
  onSuccess?: () => void;
}

export const EditParticipantForm: React.FC<EditParticipantFormProps> = ({
  open,
  onOpenChange,
  participantId,
  onSuccess,
}) => {
  // Fetch participant data
  const participant = useQuery(
    api.admin.getParticipantById,
    participantId ? { participantId } : "skip"
  );

  const form = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: '',
      cargo: '',
      empresa: '',
      setor: '',
      tags: [],
    },
  });

  const [currentTag, setCurrentTag] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Update form when participant data loads
  useEffect(() => {
    if (participant) {
      form.reset({
        name: participant.name || '',
        cargo: participant.cargo || '',
        empresa: participant.empresa || '',
        setor: participant.setor || '',
        tags: participant.tags || [],
      });
    }
  }, [participant, form]);

  // Mutations
  const updateParticipant = useMutation(api.admin.updateParticipant);

  const handleSubmit: SubmitHandler<ParticipantFormData> = async (data) => {
    if (!participantId) return;
    
    setIsSubmitting(true);
    try {
      await updateParticipant({
        participantId,
        updates: {
          name: data.name,
          cargo: data.cargo,
          empresa: data.empresa,
          setor: data.setor,
          tags: data.tags,
        },
      });

      toast({
        title: "Sucesso!",
        description: "Participante atualizado com sucesso.",
      });

      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating participant:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar participante",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setCurrentTag('');
    }
    onOpenChange(newOpen);
  };

  const addTag = () => {
    const tag = currentTag.trim();
    if (tag && !form.getValues('tags')?.includes(tag)) {
      const currentTags = form.getValues('tags') || [];
      form.setValue('tags', [...currentTags, tag]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags') || [];
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  if (!participant && participantId) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Participante</DialogTitle>
          <DialogDescription>
            Edite as informações do participante. O telefone não pode ser alterado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-4">
            {/* Phone field (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <Input
                value={participant?.phone?.replace('whatsapp:', '') || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                O telefone não pode ser alterado
              </p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Digite o nome do participante"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Gerente de Vendas"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Acme Corp"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="setor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setor</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Tecnologia"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Digite uma tag"
                          value={currentTag}
                          onChange={(e) => setCurrentTag(e.target.value)}
                          onKeyPress={handleTagKeyPress}
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTag}
                          disabled={!currentTag.trim() || isSubmitting}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {field.value && field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                                disabled={isSubmitting}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Pressione Enter ou clique no botão + para adicionar uma tag
                  </FormDescription>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => void form.handleSubmit(handleSubmit)()}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
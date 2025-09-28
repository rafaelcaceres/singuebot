import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
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
  phone: z
    .string()
    .min(1, 'Telefone é obrigatório')
    .transform((val) => val.replace(/[^+\d]/g, '')) // Remove any non-digit characters except +
    .refine((val) => /^\+\d{10,15}$/.test(val), {
      message: 'Formato de telefone inválido (ex: +5511999999999)',
    }),
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  cargo: z
    .string()
    .max(100, 'Cargo deve ter no máximo 100 caracteres')
    .optional(),
  empresa: z
    .string()
    .max(100, 'Empresa deve ter no máximo 100 caracteres')
    .optional(),
  setor: z
    .string()
    .max(100, 'Setor deve ter no máximo 100 caracteres')
    .optional(),
  tags: z.array(z.string()).optional(),
});

type ParticipantFormData = z.infer<typeof participantSchema>;

interface AddParticipantFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddParticipantForm: React.FC<AddParticipantFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [newTag, setNewTag] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  
  const createParticipant = useMutation(api.admin.createParticipant);

  const form = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      phone: '',
      name: '',
      cargo: '',
      empresa: '',
      setor: '',
      tags: [],
    },
  });

  const { isSubmitting } = form.formState;

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      form.setValue('tags', updatedTags);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    form.setValue('tags', updatedTags);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit: SubmitHandler<ParticipantFormData> = async (data) => {
    try {
      await createParticipant({
        phone: data.phone,
        name: data.name,
        cargo: data.cargo,
        empresa: data.empresa,
        setor: data.setor,
        tags: tags,
      });

      toast({
        title: 'Participante criado com sucesso!',
        description: `${data.name} foi adicionado à lista de participantes.`,
      });

      // Reset form
      form.reset();
      setTags([]);
      setNewTag('');

      // Close dialog and call success callback
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao criar participante:', error);

      toast({
        title: 'Erro ao criar participante',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      // Reset form when closing
      form.reset({
        phone: '',
        name: '',
        cargo: '',
        empresa: '',
        setor: '',
        tags: [],
      });
      setTags([]);
      setNewTag('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Participante</DialogTitle>
          <DialogDescription>
            Adicione um novo participante ao sistema. Campos obrigatórios: telefone e nome.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+5511999999999"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Inclua o código do país (ex: +55 para Brasil)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome do participante"
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
                  <FormLabel>Cargo (opcional)</FormLabel>
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
                  <FormLabel>Empresa (opcional)</FormLabel>
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
                  <FormLabel>Setor (opcional)</FormLabel>
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

            <div className="space-y-2">
              <FormLabel>Tags (opcional)</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTag}
                  disabled={!newTag.trim() || isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        disabled={isSubmitting}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              <FormDescription>
                Pressione Enter ou clique no botão + para adicionar uma tag
              </FormDescription>
            </div>

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
                Criar Participante
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
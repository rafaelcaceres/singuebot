import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { createTemplateSchema, CreateTemplateFormData } from '../schemas/templateSchema';

interface AddTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddTemplateModal: React.FC<AddTemplateModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [newVariable, setNewVariable] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  
  const createTemplate = useMutation(api.admin.createTemplate);

  const form = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      locale: '',
      twilioId: '',
      variables: [],
      stage: '',
      content: '',
    },
  });

  const { isSubmitting } = form.formState;

  const handleAddVariable = () => {
    if (newVariable.trim() && !variables.includes(newVariable.trim())) {
      const updatedVariables = [...variables, newVariable.trim()];
      setVariables(updatedVariables);
      form.setValue('variables', updatedVariables);
      setNewVariable('');
    }
  };

  const handleRemoveVariable = (variableToRemove: string) => {
    const updatedVariables = variables.filter(variable => variable !== variableToRemove);
    setVariables(updatedVariables);
    form.setValue('variables', updatedVariables);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddVariable();
    }
  };

  const handleSubmit: SubmitHandler<CreateTemplateFormData> = async (data) => {
    try {
      await createTemplate({
        name: data.name,
        locale: data.locale,
        twilioId: data.twilioId,
        variables: variables,
        stage: data.stage,
        content: data.content,
      });

      toast({
        title: 'Template criado com sucesso!',
        description: `Template "${data.name}" foi criado.`,
      });

      // Reset form
      form.reset();
      setVariables([]);
      setNewVariable('');

      // Close dialog and call success callback
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao criar template:', error);

      toast({
        title: 'Erro ao criar template',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      // Reset form when closing
      form.reset();
      setVariables([]);
      setNewVariable('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Template</DialogTitle>
          <DialogDescription>
            Crie um novo template de mensagem. Todos os campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Template *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome do template"
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
              name="locale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Idioma *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um idioma" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="twilioId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twilio Template ID *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="HX..."
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    ID do template no Twilio (deve começar com HX)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estágio *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um estágio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="welcome">Boas-vindas</SelectItem>
                      <SelectItem value="interview">Entrevista</SelectItem>
                      <SelectItem value="followup">Acompanhamento</SelectItem>
                      <SelectItem value="reminder">Lembrete</SelectItem>
                      <SelectItem value="completion">Finalização</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Conteúdo do template..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {`Use {{variavel}} para inserir variáveis no template`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Variáveis (opcional)</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da variável"
                  value={newVariable}
                  onChange={(e) => setNewVariable(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddVariable}
                  disabled={!newVariable.trim() || isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {variables.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {variables.map((variable) => (
                    <Badge key={variable} variant="secondary" className="flex items-center gap-1">
                      {variable}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(variable)}
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
                Pressione Enter ou clique no botão + para adicionar uma variável
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
                Criar Template
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
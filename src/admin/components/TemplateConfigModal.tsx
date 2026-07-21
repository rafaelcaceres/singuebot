import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TemplateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: Id<"templates">;
}

interface VariableMapping {
  templateVariable: string;
  participantField: string;
  defaultValue?: string;
  isRequired: boolean;
}

export const TemplateConfigModal: React.FC<TemplateConfigModalProps> = ({
  isOpen,
  onClose,
  templateId,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    locale: 'pt-BR',
    twilioId: '',
    stage: 'draft' as 'draft' | 'submitted' | 'approved' | 'rejected',
    variableMappings: [] as VariableMapping[],
  });

  const configureTemplate = useMutation(api.functions.templateConfig.configureTemplate);
  const participantFields = useQuery(api.functions.templateConfig.getParticipantFields);
  const templateConfig = useQuery(
    api.functions.templateConfig.getTemplateConfig,
    templateId ? { templateId } : "skip"
  );

  useEffect(() => {
    if (templateConfig) {
      setFormData({
        name: templateConfig.name,
        locale: templateConfig.locale,
        twilioId: templateConfig.twilioId,
        stage: templateConfig.stage as 'draft' | 'submitted' | 'approved' | 'rejected',
        variableMappings: templateConfig.variableMappings || [],
      });
    }
  }, [templateConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await configureTemplate({
        templateId,
        ...formData,
      });
      onClose();
    } catch (error) {
      toast.error('Não foi possível salvar a configuração do template', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const addVariableMapping = () => {
    setFormData(prev => ({
      ...prev,
      variableMappings: [
        ...prev.variableMappings,
        {
          templateVariable: '',
          participantField: 'name',
          defaultValue: '',
          isRequired: false,
        },
      ],
    }));
  };

  const updateVariableMapping = (index: number, field: keyof VariableMapping, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      variableMappings: prev.variableMappings.map((mapping, i) =>
        i === index ? { ...mapping, [field]: value } : mapping
      ),
    }));
  };

  const removeVariableMapping = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variableMappings: prev.variableMappings.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {templateId ? 'Edit Template Configuration' : 'Create Template Configuration'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
          {/* Basic Template Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Twilio Template ID
              </label>
              <input
                type="text"
                value={formData.twilioId}
                onChange={(e) => setFormData(prev => ({ ...prev, twilioId: e.target.value }))}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="HX..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Locale
              </label>
              <select
                value={formData.locale}
                onChange={(e) => setFormData(prev => ({ ...prev, locale: e.target.value }))}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Spanish (Spain)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value as 'draft' | 'submitted' | 'approved' | 'rejected' }))}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Variable Mappings */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Variable Mappings</h3>
              <Button type="button" onClick={addVariableMapping}>
                Add Mapping
              </Button>
            </div>

            <div className="space-y-4">
              {formData.variableMappings.map((mapping, index) => (
                <div key={index} className="border border-border rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Template Variable
                      </label>
                      <input
                        type="text"
                        value={mapping.templateVariable}
                        onChange={(e) => updateVariableMapping(index, 'templateVariable', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="nome, telefone, etc."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Participant Field
                      </label>
                      <select
                        value={mapping.participantField}
                        onChange={(e) => updateVariableMapping(index, 'participantField', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {participantFields?.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label} ({field.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Default Value
                      </label>
                      <input
                        type="text"
                        value={mapping.defaultValue || ''}
                        onChange={(e) => updateVariableMapping(index, 'defaultValue', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Optional default"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={mapping.isRequired}
                          onChange={(e) => updateVariableMapping(index, 'isRequired', e.target.checked)}
                          className="mr-2"
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariableMapping(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {formData.variableMappings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No variable mappings configured. Click "Add Mapping" to start.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <DialogFooter className="flex gap-2 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {templateId ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
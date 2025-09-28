import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

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
      console.error('Failed to configure template:', error);
      alert('Failed to configure template. Please try again.');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {templateId ? 'Edit Template Configuration' : 'Create Template Configuration'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
          {/* Basic Template Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Twilio Template ID
              </label>
              <input
                type="text"
                value={formData.twilioId}
                onChange={(e) => setFormData(prev => ({ ...prev, twilioId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="HX..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Locale
              </label>
              <select
                value={formData.locale}
                onChange={(e) => setFormData(prev => ({ ...prev, locale: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Spanish (Spain)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value as 'draft' | 'submitted' | 'approved' | 'rejected' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <button
                type="button"
                onClick={addVariableMapping}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Add Mapping
              </button>
            </div>

            <div className="space-y-4">
              {formData.variableMappings.map((mapping, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Template Variable
                      </label>
                      <input
                        type="text"
                        value={mapping.templateVariable}
                        onChange={(e) => updateVariableMapping(index, 'templateVariable', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="nome, telefone, etc."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Participant Field
                      </label>
                      <select
                        value={mapping.participantField}
                        onChange={(e) => updateVariableMapping(index, 'participantField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {participantFields?.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label} ({field.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Value
                      </label>
                      <input
                        type="text"
                        value={mapping.defaultValue || ''}
                        onChange={(e) => updateVariableMapping(index, 'defaultValue', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <button
                        type="button"
                        onClick={() => removeVariableMapping(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {formData.variableMappings.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No variable mappings configured. Click "Add Mapping" to start.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              {templateId ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
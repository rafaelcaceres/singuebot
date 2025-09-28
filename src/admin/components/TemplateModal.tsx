import React, { useState, useEffect } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface TemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedParticipants: Array<{
    _id: Id<"participants">;
    name?: string;
    phone: string;
  }>;
}

interface SendResult {
  total: number;
  success: Array<{
    participantId: Id<"participants">;
    phone: string;
  }>;
  failed: Array<{
    participantId: Id<"participants">;
    phone: string;
    error: string;
  }>;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  open,
  onOpenChange,
  selectedParticipants,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const templates = useQuery(api.admin.getTemplates);
  const sendTemplateToMultiple = useAction(api.functions.twilio.sendTemplateToMultipleParticipants);

  const selectedTemplateData = templates?.find(t => t._id === selectedTemplate);

  useEffect(() => {
    if (selectedTemplateData) {
      const initialVariables: Record<string, string> = {};
      selectedTemplateData.variables.forEach((variable: string) => {
        initialVariables[variable] = '';
      });
      setVariables(initialVariables);
    }
  }, [selectedTemplateData]);

  const handleSend = async () => {
    if (!selectedTemplate || !selectedTemplateData) return;

    setIsLoading(true);
    try {
      const result = await sendTemplateToMultiple({
        templateName: selectedTemplateData.name,
        participantIds: selectedParticipants.map(p => p._id),
        variables,
      });

      setSendResult({
        total: selectedParticipants.length,
        success: result.success || [],
        failed: result.failed || [],
      });
    } catch (error) {
      setSendResult({
        total: selectedParticipants.length,
        success: [],
        failed: selectedParticipants.map(p => ({
          participantId: p._id,
          phone: p.phone,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplate('');
    setVariables({});
    setSendResult(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Enviar Template</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {sendResult ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Resultado do Envio</h3>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Total:</span> {sendResult.total}
                </div>
                <div className="text-sm text-green-600">
                  <span className="font-medium">Enviados com sucesso:</span> {sendResult.success.length}
                </div>
                <div className="text-sm text-red-600">
                  <span className="font-medium">Falhas:</span> {sendResult.failed.length}
                </div>
              </div>
            </div>

            {sendResult.failed.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">Falhas:</h4>
                <div className="space-y-1">
                  {sendResult.failed.map((failure, index) => (
                    <div key={index} className="text-sm text-red-700">
                      {failure.phone}: {failure.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Enviando para {selectedParticipants.length} participante(s)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecionar Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione um template...</option>
                {templates?.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplateData && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Variáveis do Template
                </h3>
                <div className="bg-blue-50 p-3 rounded-md mb-3">
                  <p className="text-sm text-blue-700">
                    <strong>Automático:</strong> As variáveis serão preenchidas automaticamente com dados dos participantes selecionados:
                  </p>
                  <ul className="text-xs text-blue-600 mt-1 ml-4">
                    <li>• <strong>nome/name:</strong> Nome do participante</li>
                    <li>• <strong>telefone/phone:</strong> Telefone do participante</li>
                    <li>• <strong>email/cargo:</strong> Valores opcionais abaixo (se fornecidos)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  {selectedTemplateData.variables.map((variable: string) => {
                    const isAutoFilled = ['nome', 'name', 'telefone', 'phone'].includes(variable.toLowerCase());
                    
                    if (isAutoFilled) {
                      return (
                        <div key={variable}>
                          <label className="block text-sm text-gray-600 mb-1">
                            {variable} <span className="text-green-600 text-xs">(automático)</span>
                          </label>
                          <input
                            type="text"
                            value={variable.toLowerCase() === 'nome' || variable.toLowerCase() === 'name' 
                              ? 'Nome do participante' 
                              : 'Telefone do participante'}
                            disabled
                            className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500"
                          />
                        </div>
                      );
                    }
                    
                    return (
                      <div key={variable}>
                        <label className="block text-sm text-gray-600 mb-1">
                          {variable} <span className="text-orange-600 text-xs">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={variables[variable] || ''}
                          onChange={(e) =>
                            setVariables(prev => ({
                              ...prev,
                              [variable]: e.target.value,
                            }))
                          }
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Valor opcional para ${variable}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSend()}
                disabled={!selectedTemplate || isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enviando...' : 'Enviar Template'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
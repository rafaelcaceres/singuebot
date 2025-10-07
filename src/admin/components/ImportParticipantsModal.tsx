import React, { useState, useCallback } from 'react';
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
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X,
  Download,
  Users
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CSVRow {
  nome: string;
  telefone: string;
  cargo?: string;
  empresa?: string;
  setor?: string;
}

interface ImportResult {
  success: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  duplicates: Array<{
    row: number;
    phone: string;
    existingId: string;
  }>;
}

interface ImportParticipantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ImportParticipantsModal: React.FC<ImportParticipantsModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Id<"clusters"> | undefined>();
  const [dragActive, setDragActive] = useState(false);

  const importParticipants = useMutation(api.admin.importParticipantsFromCSV);
  const clusters = useQuery(api.admin.getClusters);

  const parseCSV = useCallback((csvText: string): CSVRow[] => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Map CSV headers to our expected format
    const headerMap: Record<string, keyof CSVRow> = {
      'nome': 'nome',
      'name': 'nome',
      'telefone': 'telefone',
      'phone': 'telefone',
      'cargo': 'cargo',
      'position': 'cargo',
      'empresa': 'empresa',
      'company': 'empresa',
      'setor': 'setor',
      'sector': 'setor',
    };

    const data: CSVRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Partial<CSVRow> = {};
      
      headers.forEach((header, index) => {
        const mappedKey = headerMap[header];
        if (mappedKey && values[index]) {
          row[mappedKey] = values[index];
        }
      });
      
      if (row.nome && row.telefone) {
        data.push(row as CSVRow);
      }
    }
    
    return data;
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo CSV.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const parsedData = parseCSV(csvText);
        
        if (parsedData.length === 0) {
          toast({
            title: 'Arquivo vazio',
            description: 'O arquivo CSV não contém dados válidos.',
            variant: 'destructive',
          });
          return;
        }

        setCsvData(parsedData);
        setImportResult(null);
        
        toast({
          title: 'Arquivo carregado',
          description: `${parsedData.length} participantes encontrados no arquivo.`,
        });
      } catch (error) {
        toast({
          title: 'Erro ao processar arquivo',
          description: 'Não foi possível processar o arquivo CSV.',
          variant: 'destructive',
        });
      }
    };
    
    reader.readAsText(file, 'utf-8');
  }, [parseCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleImport = async () => {
    if (csvData.length === 0) return;

    setIsProcessing(true);
    
    try {
      const result = await importParticipants({
        csvData,
        clusterId: selectedCluster,
      });
      
      setImportResult(result);
      
      if (result.success > 0) {
        toast({
          title: 'Importação concluída',
          description: `${result.success} participantes importados com sucesso.`,
        });
        
        if (result.errors.length === 0 && result.duplicates.length === 0) {
          onSuccess?.();
          onOpenChange(false);
        }
      }
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadErrorReport = () => {
    if (!importResult) return;

    const errorData = [
      ['Linha', 'Erro', 'Nome', 'Telefone', 'Cargo', 'Empresa', 'Setor'],
      ...importResult.errors.map(error => [
        error.row.toString(),
        error.error,
        error.data.nome || '',
        error.data.telefone || '',
        error.data.cargo || '',
        error.data.empresa || '',
        error.data.setor || '',
      ]),
      ...importResult.duplicates.map(duplicate => [
        duplicate.row.toString(),
        'Participante já existe',
        '',
        duplicate.phone,
        '',
        '',
        '',
      ]),
    ];

    const csvContent = errorData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `erros_importacao_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetModal = () => {
    setCsvData([]);
    setImportResult(null);
    setSelectedCluster(undefined);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Importar Participantes via CSV
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV para importar participantes em lote.
            O arquivo deve conter as colunas: Nome, Telefone, Cargo, Empresa, Setor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          {csvData.length === 0 && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Arraste um arquivo CSV aqui
              </p>
              <p className="text-sm text-gray-500 mb-4">
                ou clique para selecionar um arquivo
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Selecionar Arquivo
              </label>
            </div>
          )}

          {/* CSV Preview */}
          {csvData.length > 0 && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="font-medium">
                    {csvData.length} participantes encontrados
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCsvData([])}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              </div>

              {/* Cluster Selection */}
              {clusters && clusters.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Cluster (opcional)
                  </label>
                  <select
                    value={selectedCluster || ''}
                    onChange={(e) => setSelectedCluster(e.target.value as Id<"clusters"> || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Nenhum cluster</option>
                    {clusters.map((cluster) => (
                      <option key={cluster._id} value={cluster._id}>
                        {cluster.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sample Data Preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h4 className="font-medium text-sm">Prévia dos dados (primeiras 3 linhas)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-left">Telefone</th>
                        <th className="px-4 py-2 text-left">Cargo</th>
                        <th className="px-4 py-2 text-left">Empresa</th>
                        <th className="px-4 py-2 text-left">Setor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">{row.nome}</td>
                          <td className="px-4 py-2">{row.telefone}</td>
                          <td className="px-4 py-2">{row.cargo || '-'}</td>
                          <td className="px-4 py-2">{row.empresa || '-'}</td>
                          <td className="px-4 py-2">{row.setor || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span>Importando participantes...</span>
              </div>
              <Progress value={50} className="w-full" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.success}
                  </div>
                  <div className="text-sm text-green-700">Importados</div>
                </div>
                
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-600">
                    {importResult.duplicates.length}
                  </div>
                  <div className="text-sm text-yellow-700">Duplicados</div>
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <X className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">
                    {importResult.errors.length}
                  </div>
                  <div className="text-sm text-red-700">Erros</div>
                </div>
              </div>

              {(importResult.errors.length > 0 || importResult.duplicates.length > 0) && (
                <div className="space-y-4">
                  <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                      <div className="flex-1">
                        {importResult.errors.length > 0 && (
                          <div>
                            <strong className="text-yellow-800">{importResult.errors.length} erros encontrados:</strong>
                            <ul className="mt-2 space-y-1">
                              {importResult.errors.slice(0, 3).map((error, index) => (
                                <li key={index} className="text-sm text-yellow-700">
                                  Linha {error.row}: {error.error}
                                </li>
                              ))}
                              {importResult.errors.length > 3 && (
                                <li className="text-sm text-yellow-600">
                                  ... e mais {importResult.errors.length - 3} erros
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                        
                        {importResult.duplicates.length > 0 && (
                          <div className="mt-4">
                            <strong className="text-yellow-800">{importResult.duplicates.length} participantes já existem</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={downloadErrorReport}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Relatório de Erros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Fechar' : 'Cancelar'}
          </Button>
          
          {csvData.length > 0 && !importResult && (
            <Button 
              onClick={() => void handleImport()}
              disabled={isProcessing}
              className="min-w-[120px]"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {csvData.length} participantes
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
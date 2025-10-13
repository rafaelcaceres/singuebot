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
  externalId?: string;
  email?: string;
  cargo?: string;
  empresa?: string;
  empresaPrograma?: string; // From dropdown columns (more reliable)
  setor?: string;
  // Demographic fields
  estado?: string;
  raca?: string;
  genero?: string;
  annosCarreira?: string;
  senioridade?: string;
  linkedin?: string;
  tipoOrganizacao?: string;
  programaMarca?: string;
  receitaAnual?: string;
  // Additional identity fields
  transgenero?: boolean;
  pais?: string;
  portfolioUrl?: string;
  // Program-specific flags
  blackSisterInLaw?: boolean;
  mercadoFinanceiro?: boolean;
  membroConselho?: boolean;
  programasPactua?: string;
  programasSingue?: string;
  // Rich text profile fields
  realizacoes?: string;
  visaoFuturo?: string;
  desafiosSuperados?: string;
  desafiosAtuais?: string;
  motivacao?: string;
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
    identifierType: 'email' | 'phone';
    identifierValue: string;
    existingId: string;
    email?: string;
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
  const [fileName, setFileName] = useState<string>('');

  const importParticipants = useMutation(api.admin.importParticipantsFromCSV);
  const clusters = useQuery(api.admin.getClusters);

  const parseCSV = useCallback((csvText: string): CSVRow[] => {
    // Use a proper CSV parser that handles quotes, commas, and newlines correctly
    const parseCSVLine = (text: string): string[][] => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let insideQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            // Escaped quote
            currentCell += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          // End of cell
          currentRow.push(currentCell);
          currentCell = '';
        } else if (char === '\n' && !insideQuotes) {
          // End of row
          currentRow.push(currentCell);
          if (currentRow.some(cell => cell.trim())) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        } else {
          currentCell += char;
        }
      }

      // Handle last cell/row
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell);
        if (currentRow.some(cell => cell.trim())) {
          rows.push(currentRow);
        }
      }

      return rows;
    };

    const rows = parseCSVLine(csvText);
    if (rows.length === 0) return [];

    const headers = rows[0].map(h => h.trim().toLowerCase());

    // Map CSV headers to our expected format (handling Portuguese column names)
    const headerMap: Record<string, keyof CSVRow> = {
      // Core fields
      'id': 'externalId',
      'coloque aqui seu nome completo.': 'nome',
      'nome': 'nome',
      'name': 'nome',
      'qual seu nº. de telefone? (com ddd)': 'telefone',
      'telefone': 'telefone',
      'phone': 'telefone',
      'agora informe seu e-mail profissional': 'email',
      'email': 'email',

      // Professional fields
      'qual seu cargo atualmente?': 'cargo',
      'cargo': 'cargo',
      'position': 'cargo',
      // IMPORTANT: This is column 23 (index 22) - free text company name
      // NOT to be confused with column 26 which has "Realização de Impacto"
      'setor principal de atuação:': 'setor',
      'setor': 'setor',
      'sector': 'setor',

      // Demographic fields
      'e em qual estado você reside?': 'estado',
      'estado': 'estado',
      'como você se declara racialmente?': 'raca',
      'raça': 'raca',
      'raca': 'raca',
      'com qual gênero você se identifica?': 'genero',
      'genero': 'genero',
      'gênero': 'genero',
      'quantos anos de carreira você possui?': 'annosCarreira',
      'anos de carreira': 'annosCarreira',
      'qual das opções abaixo melhor descreve seu nível de senioridade atual? internamente': 'senioridade',
      'senioridade': 'senioridade',
      'compartilhe conosco seu linkedin:': 'linkedin',
      'linkedin': 'linkedin',
      'tipo de organização:': 'tipoOrganizacao',
      'tipo de organização': 'tipoOrganizacao',
      'marca': 'programaMarca',
      'programa': 'programaMarca',
      'receita anual da empresa:': 'receitaAnual',
      'receita anual': 'receitaAnual',

      // Additional identity fields
      'você se considera uma pessoa transgênero?': 'transgenero',
      'transgenero': 'transgenero',
      'transgênero': 'transgenero',
      'qual seu país de origem?': 'pais',
      'país': 'pais',
      'pais': 'pais',
      'caso você possua portifólio ou site': 'portfolioUrl',
      'portfolio': 'portfolioUrl',
      'portfólio': 'portfolioUrl',

      // Program-specific flags
      'você faz parte do black sister in law?': 'blackSisterInLaw',
      'black sister in law': 'blackSisterInLaw',
      'você atua no mercado financeiro?': 'mercadoFinanceiro',
      'mercado financeiro': 'mercadoFinanceiro',
      'você atua nesse momento como membro de conselho?': 'membroConselho',
      'membro de conselho': 'membroConselho',
      'por qual desses programas você já passou no pactuá?': 'programasPactua',
      'programas pactuá': 'programasPactua',
      'informe aqui de qual programa da singuê você já participou:': 'programasSingue',
      'programas singuê': 'programasSingue',

      // Rich text fields
      'realização de impacto: descreva uma ou mais realizações profissionais que foram importantes para a sua carreira.': 'realizacoes',
      'realizações': 'realizacoes',
      'realizacoes': 'realizacoes',
      'visão de futuro: qual é o seu principal objetivo de carreira para os próximos 5 anos? onde você quer chegar e o que te move nessa direção?': 'visaoFuturo',
      'visão de futuro': 'visaoFuturo',
      'superando barreiras: qual foi o maior desafio superado em sua trajetória até aqui?': 'desafiosSuperados',
      'desafios superados': 'desafiosSuperados',
      'qual é o seu maior desafio para ascender profissionalmente na carreira atualmente?': 'desafiosAtuais',
      'desafios atuais': 'desafiosAtuais',
      'porque você escolheu o fellowship bayer & future in black: executivos negros para se inscrever?': 'motivacao',
      'motivação': 'motivacao',
    };

    const data: CSVRow[] = [];

    // Process data rows (skip header row at index 0)
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const row: Partial<CSVRow> = {};

      // Track the 3 duplicate "empresa" dropdown columns
      const empresaDropdownValues: string[] = [];

      headers.forEach((header, index) => {
        const mappedKey = headerMap[header];
        // Values are already properly parsed, just trim whitespace
        const value = values[index] ? values[index].trim() : '';

        // Special handling: Column 23 (index 22) is the free-text empresa field
        if (index === 22 && value) {
          row.empresa = value;
          return;
        }

        // Special handling: Column 24 (index 23) is the portfolio URL
        if (index === 23 && value) {
          row.portfolioUrl = value;
          return;
        }

        // Special handling for the 3 duplicate empresa dropdown columns (indices 29, 31, 34)
        if (header === 'em qual das empresas abaixo você está atualmente?' && value) {
          empresaDropdownValues.push(value);
          return; // Don't process through normal flow
        }

        if (mappedKey && value) {
          // Handle boolean fields
          if (mappedKey === 'transgenero' || mappedKey === 'blackSisterInLaw' ||
              mappedKey === 'mercadoFinanceiro' || mappedKey === 'membroConselho') {
            const lowerValue = value.toLowerCase();
            if (lowerValue === 'sim' || lowerValue === 'yes' || lowerValue === 'true') {
              (row as any)[mappedKey] = true;
            } else if (lowerValue === 'não' || lowerValue === 'nao' || lowerValue === 'no' || lowerValue === 'false') {
              (row as any)[mappedKey] = false;
            }
          } else {
            (row as any)[mappedKey] = value;
          }
        }
      });

      // Use the last non-empty empresa dropdown value (as requested)
      if (empresaDropdownValues.length > 0) {
        row.empresaPrograma = empresaDropdownValues[empresaDropdownValues.length - 1];
      }

      // Only add row if it has required fields AND is not empty
      if (row.nome && row.nome.trim() && row.telefone && row.telefone.trim()) {
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
        setFileName(file.name); // Store the filename
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
        importSource: fileName, // Pass the filename to backend
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
      ['Linha', 'Erro', 'Email'],
      ...importResult.errors.map(error => [
        error.row.toString(),
        error.error,
        error.data?.email ?? '',
      ]),
      ...importResult.duplicates.map(duplicate => [
        duplicate.row.toString(),
        `Participante já existe (${duplicate.identifierType}: ${duplicate.identifierValue})`,
        duplicate.email || '',
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
    setFileName('');
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
            Colunas obrigatórias: Nome e Telefone. Campos opcionais: Email, Cargo, Empresa, Setor, Estado, Programa, e outros dados demográficos e profissionais.
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
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      {csvData.length} participantes encontrados
                    </span>
                  </div>
                  {fileName && (
                    <span className="text-xs text-gray-500 ml-7">
                      Arquivo: {fileName}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCsvData([]);
                    setFileName('');
                  }}
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
                <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                  <h4 className="font-medium text-sm">Prévia dos dados (primeiras 3 linhas)</h4>
                  <span className="text-xs text-gray-500">
                    {csvData.length} {csvData.length === 1 ? 'participante' : 'participantes'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium">Nome</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Telefone</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Programa</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Cargo</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Empresa (Texto)</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Empresa (Dropdown)</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Setor</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Estado</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">External ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{row.nome}</td>
                          <td className="px-3 py-2 text-xs">{row.telefone}</td>
                          <td className="px-3 py-2 text-xs">{row.email || '-'}</td>
                          <td className="px-3 py-2">
                            {row.programaMarca ? (
                              <Badge variant="outline" className="text-xs">
                                {row.programaMarca}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs">{row.cargo || '-'}</td>
                          <td className="px-3 py-2 text-xs max-w-[150px] truncate" title={row.empresa}>
                            {row.empresa || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.empresaPrograma ? (
                              <Badge variant="secondary" className="text-xs">
                                {row.empresaPrograma}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs">{row.setor || '-'}</td>
                          <td className="px-3 py-2 text-xs">{row.estado || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{row.externalId || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 px-4 py-2 border-t">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Nota:</span> "Empresa (Texto)" = campo livre, "Empresa (Dropdown)" = seleção do programa
                  </p>
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

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UploadDocumentsProps {
  namespace?: string;
}

const UploadDocuments: React.FC<UploadDocumentsProps> = ({ namespace }) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const uploadDocument = useMutation(api.admin.uploadKnowledgeDocument);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxSize: 2 * 1024 * 1024, // 2MB limit
  });

  const uploadSingleFile = async (uploadFile: UploadFile) => {
    try {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading', progress: 25 }
          : f
      ));

      // Validate file size and type
      const { validateFile, processDocumentFile, generateContentHash } = await import('../../lib/rag');
      
      try {
        validateFile(uploadFile.file);
      } catch (validationError) {
        throw new Error(`Validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`);
      }

      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, progress: 50 }
          : f
      ));

      // Process file content
      const content = await processDocumentFile(uploadFile.file);
      const hash = generateContentHash(content, uploadFile.file.name);
      const format = uploadFile.file.name.split('.').pop()?.toLowerCase() as 'pdf' | 'txt' | 'md';

      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, progress: 75 }
          : f
      ));

      // Upload to Convex with namespace
      await uploadDocument({
        title: uploadFile.file.name,
        source: `upload:${uploadFile.file.name}`,
        tags: ['uploaded'],
        content,
        format: format || 'txt',
        hash,
        namespace,
      });

      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));

      toast({
        title: "Upload realizado com sucesso",
        description: `${uploadFile.file.name} foi processado.`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: errorMessage }
          : f
      ));

      toast({
        title: "Erro no upload",
        description: `Falha ao processar ${uploadFile.file.name}: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadAll = () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    pendingFiles.forEach(fileItem => {
      uploadSingleFile(fileItem).catch(console.error);
    });
  };

  const clearCompleted = () => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600">Solte os arquivos aqui...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="text-sm text-gray-500">
                  Suporte para PDF, DOC, DOCX, TXT, MD (máx. 10MB)
                </p>
              </div>
            )}
          </div>

          {uploadFiles.length > 0 && (
            <div className="mt-4 flex gap-2">
              <Button 
                onClick={uploadAll}
                disabled={!uploadFiles.some(f => f.status === 'pending')}
              >
                Upload Todos ({uploadFiles.filter(f => f.status === 'pending').length})
              </Button>
              <Button 
                variant="outline" 
                onClick={clearCompleted}
                disabled={!uploadFiles.some(f => f.status === 'success')}
              >
                Limpar Concluídos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      {uploadFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arquivos ({uploadFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadFiles.map((uploadFile) => (
                <div key={uploadFile.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {getStatusIcon(uploadFile.status)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadFile.file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {uploadFile.error && (
                      <p className="text-sm text-red-500 mt-1">{uploadFile.error}</p>
                    )}
                  </div>

                  {uploadFile.status === 'uploading' && (
                    <div className="w-24">
                      <Progress value={uploadFile.progress} className="h-2" />
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadFile.id)}
                    disabled={uploadFile.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { UploadDocuments };
export default UploadDocuments;
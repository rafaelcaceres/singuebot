import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { 
  Upload, 
  FileText, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock
} from "lucide-react";
import { UploadDocuments } from "../components/UploadDocuments";
import { useToast } from '@/hooks/use-toast';

interface Document {
  _id: Id<"knowledge_docs">;
  title: string;
  source: string;
  status: "ingested" | "pending" | "failed";
  createdAt: number;
}

export const KnowledgePage: React.FC = () => {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("documents");

  // Get active bot config for namespace
  const botSettings = useQuery(api.functions.botConfig.getActiveBotSettings);
  const namespace = botSettings?.config?.ragNamespace;

  // Queries - filter by namespace
  const documents = useQuery(api.admin.getKnowledgeDocuments, { namespace }) || [];
  const processingJobs = useQuery(api.admin.getProcessingJobs) || [];
  
  // Mutations
  const deleteDocument = useMutation(api.admin.deleteKnowledgeDocument);
  const reindexDocument = useMutation(api.admin.reindexDocument);

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument({ documentId: documentId as Id<"knowledge_docs"> });
      toast({
        title: "Documento excluído",
        description: "O documento foi removido com sucesso.",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Erro ao excluir documento: " + documentId,
        description: "Não foi possível excluir o documento.",
        variant: "destructive",
      });
    }
  };

  const handleReindexDocument = async (documentId: string) => {
    try {
      await reindexDocument({ documentId: documentId as Id<"knowledge_docs"> });
      toast({
        title: "Reindexação iniciada",
        description: "O documento será reprocessado em breve.",
      });
    } catch (error) {
      toast({
        title: "Erro ao reindexar",
        description: "Não foi possível reindexar o documento.",
        variant: "destructive",
      });
    }
  };

  const handleReindexAll = async () => {
    try {
      // For now, we'll reindex all documents individually
      // since there's no reindexAll function in the backend
      const allDocs = documents || [];
      for (const doc of allDocs) {
        await reindexDocument({ documentId: doc._id });
      }
      toast({
        title: "Reindexação geral iniciada",
        description: "Todos os documentos serão reprocessados.",
      });
    } catch (error) {
      toast({
        title: "Erro na reindexação",
        description: "Não foi possível iniciar a reindexação geral.",
        variant: "destructive",
      });
      console.error("Error reindexing all documents:", error);
    }
  };

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "ingested":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Upload className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: Document["status"]) => {
    const variants = {
      ingested: "default" as const,
      pending: "secondary" as const,
      failed: "destructive" as const,
    };

    const labels = {
      ingested: "Processado",
      pending: "Processando",
      failed: "Erro",
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("pt-BR");
  };

  const completedDocs = documents.filter(doc => doc.status === "ingested");
  const processingDocs = documents.filter(doc => doc.status === "pending");
  const errorDocs = documents.filter(doc => doc.status === "failed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground">
            Gerencie documentos para melhorar as respostas da IA
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void handleReindexAll()}
            disabled={documents.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reindexar Tudo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedDocs.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processando</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{processingDocs.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Erro</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorDocs.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="jobs">Jobs de Processamento</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documentos da Base de Conhecimento</CardTitle>
              <CardDescription>
                Lista de todos os documentos processados para a IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Nenhum documento encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Faça upload de documentos para começar
                  </p>
                  <Button onClick={() => setSelectedTab("upload")}>
                    <Upload className="h-4 w-4 mr-2" />
                    Fazer Upload
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(doc.status)}
                        <div>
                          <h4 className="font-medium">{doc.title}</h4>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>{doc.source}</span>
                            <span>•</span>
                            <span>Enviado em {formatDate(doc.createdAt)}</span>
                          </div>
                          {doc.status === "failed" && (
                            <p className="text-sm text-red-500 mt-1">Falha no processamento</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(doc.status)}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleReindexDocument(doc._id)}
                          disabled={doc.status === "pending"}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDeleteDocument(doc._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <UploadDocuments namespace={namespace} />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Jobs de Processamento</CardTitle>
              <CardDescription>
                Acompanhe o progresso dos documentos sendo processados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {processingJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Nenhum job em execução</h3>
                  <p className="text-muted-foreground">
                    Todos os documentos foram processados
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processingJobs.map((job: any) => (
                    <div key={job._id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{job.title}</h4>
                        <Badge variant="secondary">{job.status}</Badge>
                      </div>
                      <Progress value={job.progress} className="mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {job.currentStep} - {job.progress}% concluído
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
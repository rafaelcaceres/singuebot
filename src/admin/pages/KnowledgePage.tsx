import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/ui/status-badge";
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
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { PageHeader } from "../components/PageHeader";
import { StatCluster } from "../components/StatCluster";
import { toast } from "sonner";

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Na fila",
  processing: "Processando",
  running: "Processando",
  completed: "Concluído",
  failed: "Falhou",
};

interface Document {
  _id: Id<"knowledge_docs">;
  title: string;
  source: string;
  status: "ingested" | "pending" | "failed";
  createdAt: number;
}

export const KnowledgePage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState("documents");

  // Get active bot config for namespace
  const botSettings = useQuery(api.functions.botConfig.getActiveBotSettings);
  const namespace = botSettings?.config?.ragNamespace;

  // Queries - filter by namespace
  const documents = useQuery(api.admin.getKnowledgeDocuments, { namespace }) || [];
  const processingJobs = useQuery(api.admin.getProcessingJobs) || [];
  
  // Mutations & actions
  const deleteDocument = useMutation(api.admin.deleteKnowledgeDocument);
  const reindexDocument = useMutation(api.admin.reindexDocument);
  const reindexNamespace = useAction(api.admin.reindexNamespace);
  const [isReindexingAll, setIsReindexingAll] = useState(false);
  const [isReindexAllConfirmOpen, setIsReindexAllConfirmOpen] = useState(false);

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument({ documentId: documentId as Id<"knowledge_docs"> });
      toast.success("Documento excluído", {
        description: "O documento foi removido com sucesso.",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Erro ao excluir documento: ", {
        description: "Não foi possível excluir o documento.",
      });
    }
  };

  const handleReindexDocument = async (documentId: string) => {
    try {
      await reindexDocument({ documentId: documentId as Id<"knowledge_docs"> });
      toast.success("Reindexação iniciada", {
        description: "O documento será reprocessado em breve.",
      });
    } catch (error) {
      toast.error("Erro ao reindexar", {
        description: "Não foi possível reindexar o documento.",
      });
    }
  };

  const handleReindexAll = async () => {
    if (!namespace) {
      toast.error("Bot não configurado", {
        description: "Selecione um bot com namespace RAG configurado.",
      });
      setIsReindexAllConfirmOpen(false);
      return;
    }
    setIsReindexingAll(true);
    try {
      const result = await reindexNamespace({ namespace });
      const parts = [
        `${result.reindexed} reindexados`,
        `${result.orphansDeleted} órfãos removidos`,
      ];
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} sem conteúdo (re-upload)`);
      if (result.failed.length > 0) parts.push(`${result.failed.length} falharam`);
      toast.success("Reindexação concluída");
      if (result.skipped.length > 0 || result.failed.length > 0) {
        console.warn("Reindex report", result);
      }
    } catch (error) {
      toast.error("Erro na reindexação");
      console.error("Error reindexing all documents:", error);
    } finally {
      setIsReindexingAll(false);
      setIsReindexAllConfirmOpen(false);
    }
  };

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "ingested":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Upload className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusBadge = (status: Document["status"]) => {
    const tones = {
      ingested: "success" as const,
      pending: "warning" as const,
      failed: "danger" as const,
    };

    const labels = {
      ingested: "Processado",
      pending: "Processando",
      failed: "Erro",
    };

    return <StatusBadge tone={tones[status]} dot>{labels[status]}</StatusBadge>;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("pt-BR");
  };

  const completedDocs = documents.filter(doc => doc.status === "ingested");
  const processingDocs = documents.filter(doc => doc.status === "pending");
  const errorDocs = documents.filter(doc => doc.status === "failed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conhecimento"
        description="Gerencie documentos para melhorar as respostas da IA"
        actions={
          <Button
            variant="outline"
            onClick={() => setIsReindexAllConfirmOpen(true)}
            disabled={documents.length === 0 || !namespace || isReindexingAll}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isReindexingAll ? "animate-spin" : ""}`} />
            {isReindexingAll ? "Reindexando..." : "Reindexar Tudo"}
          </Button>
        }
      />

      <StatCluster
        stats={[
          { label: "Documentos", value: documents.length, icon: FileText },
          { label: "Processados", value: completedDocs.length, icon: CheckCircle, tone: "success" },
          { label: "Processando", value: processingDocs.length, icon: Clock, tone: "warning" },
          { label: "Com erro", value: errorDocs.length, icon: AlertCircle, tone: "danger" },
        ]}
      />

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
                            <p className="text-sm text-destructive mt-1">Falha no processamento</p>
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
                          aria-label={`Reindexar documento ${doc.title}`}
                          title="Reindexar documento"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDeleteDocument(doc._id)}
                          aria-label={`Excluir documento ${doc.title}`}
                          title="Excluir documento"
                          className="text-destructive hover:text-destructive"
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
                        <StatusBadge tone="info">{JOB_STATUS_LABELS[job.status] ?? job.status}</StatusBadge>
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

      <DeleteConfirmationModal
        isOpen={isReindexAllConfirmOpen}
        onClose={() => setIsReindexAllConfirmOpen(false)}
        onConfirm={handleReindexAll}
        isLoading={isReindexingAll}
        tone="default"
        confirmLabel="Reindexar"
        loadingLabel="Reindexando..."
        title="Reindexar toda a base?"
        message="Isso vai apagar embeddings órfãos e reprocessar todos os documentos da base. Continuar?"
      />
    </div>
  );
};
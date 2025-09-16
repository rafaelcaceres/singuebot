import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UploadDocuments from "../components/UploadDocuments";
import { 
  FileText, 
  RefreshCw, 
  Trash2, 
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  Tag,
  Database
} from "lucide-react";



export default function Knowledge() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);

  // Note: These will be connected once the API is properly generated
  // const documents = useQuery(api.functions.rag.getDocuments, { limit: 50 });
  // const reindexDocument = useMutation(api.functions.admin.knowledge.reindexDocument);
  // const deleteDocument = useMutation(api.functions.admin.knowledge.deleteDocument);

  // Mock data for demonstration
  const documents = [
    {
      _id: "1",
      title: "Future in Black - Metodologia ASA",
      source: "Manual Interno",
      status: "ingested",
      tags: ["ASA", "metodologia", "pilares"],
      _creationTime: Date.now() - 86400000,
      chunkCount: 15
    },
    {
      _id: "2", 
      title: "Guia de Entrevistas Estruturadas",
      source: "Documentação",
      status: "ingested",
      tags: ["entrevistas", "processo", "estrutura"],
      _creationTime: Date.now() - 172800000,
      chunkCount: 8
    },
    {
      _id: "3",
      title: "Ancestralidade e Carreira Profissional",
      source: "Artigo Acadêmico",
      status: "pending",
      tags: ["ancestralidade", "carreira", "pesquisa"],
      _creationTime: Date.now() - 259200000,
      chunkCount: 0
    }
  ];

  const handleReindex = async (docId: string) => {
    try {
      // await reindexDocument({ docId });
      alert(`Documento ${docId} será reindexado em breve.`);
    } catch (error) {
      alert("Erro ao reindexar documento");
    }
  };

  const handleDelete = async (docId: string) => {
    if (confirm("Tem certeza que deseja excluir este documento?")) {
      try {
        // await deleteDocument({ docId });
        alert(`Documento ${docId} foi excluído.`);
      } catch (error) {
        alert("Erro ao excluir documento");
      }
    }
  };

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "all" || doc.status === selectedStatus;
    const matchesTag = selectedTag === "all" || doc.tags.includes(selectedTag);
    
    return matchesSearch && matchesStatus && matchesTag;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ingested": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "failed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "ingested": return "Processado";
      case "pending": return "Pendente";
      case "failed": return "Falhou";
      default: return status;
    }
  };

  const allTags = Array.from(new Set(documents?.flatMap(doc => doc.tags) || []));
  const totalDocuments = documents?.length || 0;
  const processedDocuments = documents?.filter(doc => doc.status === "ingested").length || 0;
  const totalChunks = documents?.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Base de Conhecimento</h1>
          <p className="text-gray-600 mt-1">
            Gerencie documentos e conteúdo para o sistema RAG
          </p>
        </div>
        <Button 
          onClick={() => setShowUpload(!showUpload)}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {showUpload ? "Ocultar Upload" : "Adicionar Documentos"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total de Documentos</p>
                <p className="text-2xl font-bold">{totalDocuments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Processados</p>
                <p className="text-2xl font-bold">{processedDocuments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Tag className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Total de Chunks</p>
                <p className="text-2xl font-bold">{totalChunks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Search className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Tags Únicas</p>
                <p className="text-2xl font-bold">{allTags.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <UploadDocuments />
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por título ou fonte..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os Status</option>
                <option value="ingested">Processado</option>
                <option value="pending">Pendente</option>
                <option value="failed">Falhou</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tag</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas as Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Documentos ({filteredDocuments.length})</span>
            <div className="flex gap-2">
              <Button className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhum documento encontrado</p>
                <p className="text-sm">Tente ajustar os filtros ou adicionar novos documentos</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <div key={doc._id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <h3 className="font-semibold text-lg">{doc.title}</h3>
                        <Badge className={getStatusColor(doc.status)}>
                          {getStatusText(doc.status)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Fonte:</span>
                          <span>{doc.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(doc._creationTime).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          <span>{doc.chunkCount} chunks</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {doc.tags.map((tag) => (
                          <Badge key={tag} className="bg-blue-100 text-blue-800 text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => alert(`Visualizar documento: ${doc.title}`)}
                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                         onClick={() => void handleReindex(doc._id)}
                         className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50"
                         disabled={doc.status === "pending"}
                       >
                         <RefreshCw className="h-4 w-4" />
                       </Button>
                       <Button
                         onClick={() => void handleDelete(doc._id)}
                         className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
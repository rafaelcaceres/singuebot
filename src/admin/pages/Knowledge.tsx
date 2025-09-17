import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Upload, 
  RefreshCw, 
  Search,
  Filter,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Plus,
  MoreHorizontal,
  Calendar,
  Database
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import UploadDocuments from "../components/UploadDocuments";

interface MockDocument {
  _id: string;
  title: string;
  source: string;
  status: "ingested" | "pending" | "failed";
  tags: string[];
  createdAt: number;
  chunkCount: number;
}

export default function Knowledge() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ingested" | "pending" | "failed">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Queries - using mock data for now until backend functions are implemented
  // const documents = useQuery(api.admin.getKnowledgeDocuments) || [];
  // const jobs = useQuery(api.admin.getProcessingJobs) || [];
  // const availableTags = useQuery(api.admin.getKnowledgeTags) || [];

  // Mutations - will be implemented when backend is ready
  // const reindexDocument = useMutation(api.admin.reindexDocument);
  // const deleteDocument = useMutation(api.admin.deleteKnowledgeDocument);
  // const reindexAll = useMutation(api.admin.reindexAllDocuments);

  // Mock data for demonstration
  const documents: MockDocument[] = [
    {
      _id: "1",
      title: "Future in Black - Metodologia ASA",
      source: "Manual Interno",
      status: "ingested",
      tags: ["ASA", "metodologia", "pilares"],
      createdAt: Date.now() - 86400000,
      chunkCount: 15
    },
    {
      _id: "2", 
      title: "Guia de Entrevistas Estruturadas",
      source: "Documentação",
      status: "ingested",
      tags: ["entrevistas", "processo", "estrutura"],
      createdAt: Date.now() - 172800000,
      chunkCount: 8
    },
    {
      _id: "3",
      title: "Ancestralidade e Carreira Profissional",
      source: "Artigo Acadêmico",
      status: "pending",
      tags: ["ancestralidade", "carreira", "pesquisa"],
      createdAt: Date.now() - 259200000,
      chunkCount: 0
    }
  ];

  const jobs: any[] = []; // Mock empty jobs array
  const availableTags = Array.from(new Set(documents.flatMap(doc => doc.tags)));

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => doc.tags.includes(tag));
    
    return matchesSearch && matchesStatus && matchesTags;
  });

  // Get active processing jobs
  const activeJobs = jobs.filter(job => job.status === "running" || job.status === "queued");
  const processingProgress = activeJobs.length > 0 ? 
    Math.round(activeJobs.reduce((sum, job) => sum + (job.progress || 0), 0) / activeJobs.length) : 0;

  const handleReindex = async (docId: string) => {
    try {
      // await reindexDocument({ docId });
      toast({
        title: "Reindexing started",
        description: "Document will be reprocessed in the background.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start reindexing process.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      // await deleteDocument({ docId });
      toast({
        title: "Document deleted",
        description: "Document and all its chunks have been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    }
  };

  const handleReindexAll = async () => {
    try {
      // await reindexAll();
      toast({
        title: "Bulk reindexing started",
        description: "All documents will be reprocessed in the background.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start bulk reindexing.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ingested":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ingested</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalDocuments = documents.length;
  const processedDocuments = documents.filter(doc => doc.status === "ingested").length;
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunkCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Management</h1>
          <p className="text-muted-foreground">
            Upload and manage documents for the RAG system
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeJobs.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Processing {activeJobs.length} job{activeJobs.length > 1 ? 's' : ''}
            </div>
          )}
          <Button onClick={() => void handleReindexAll()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reindex All
          </Button>
        </div>
      </div>

      {/* Processing Progress */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Processing Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={processingProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {activeJobs.length} job{activeJobs.length > 1 ? 's' : ''} running • {processingProgress}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
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
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold">{processedDocuments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Search className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Chunks</p>
                <p className="text-2xl font-bold">{totalChunks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Filter className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Unique Tags</p>
                <p className="text-2xl font-bold">{availableTags.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label htmlFor="search" className="block text-sm font-medium mb-2">Search documents</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      id="search"
                      placeholder="Search by title or source..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-2">Status</label>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="all">All Status</option>
                    <option value="ingested">Ingested</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              {/* Tags Filter */}
              {availableTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Filter by tags</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedTags(prev => 
                            prev.includes(tag) 
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          );
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {filteredDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-lg font-medium">No documents found</p>
                    <p className="text-sm">Try adjusting your filters or upload new documents</p>
                  </div>
                ) : (
                  filteredDocuments.map((doc) => (
                    <div key={doc._id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold text-lg">{doc.title}</h3>
                            {getStatusBadge(doc.status)}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Source:</span>
                              <span>{doc.source}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(doc.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4" />
                              <span>{doc.chunkCount} chunks</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {doc.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            onClick={() => void handleReindex(doc._id)}
                            variant="outline"
                            size="sm"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reindex
                          </Button>
                          <Button
                            onClick={() => void handleDelete(doc._id)}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <UploadDocuments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Bot, Shield, Sliders, Save, ToggleLeft, ToggleRight } from "lucide-react";

function FeatureToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onChange(!enabled)}
    >
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {enabled ? (
        <ToggleRight className="h-6 w-6 text-primary" />
      ) : (
        <ToggleLeft className="h-6 w-6 text-muted-foreground" />
      )}
    </div>
  );
}

export function SettingsPage() {
  const { toast } = useToast();
  const botSettings = useQuery(api.functions.botConfig.getActiveBotSettings);
  const updateBotConfig = useMutation(api.functions.botConfig.updateBotConfig);

  // Local form state
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("");
  const [guardrails, setGuardrails] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [ragNamespace, setRagNamespace] = useState("");

  // Feature flags
  const [enableRAG, setEnableRAG] = useState(true);
  const [enableInterview, setEnableInterview] = useState(false);
  const [enableClustering, setEnableClustering] = useState(false);
  const [enableTemplates, setEnableTemplates] = useState(false);
  const [enableParticipantRAG, setEnableParticipantRAG] = useState(false);
  const [enableCSVImport, setEnableCSVImport] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Populate form with existing data
  useEffect(() => {
    if (botSettings) {
      setName(botSettings.name || "");
      setPersonality(botSettings.config?.personality || "");
      setGuardrails(botSettings.config?.guardrailsPrompt || "");
      setFallbackMessage(botSettings.config?.fallbackMessage || "");
      setModel(botSettings.config?.model || "gpt-4o-mini");
      setTemperature(botSettings.config?.temperature ?? 0.3);
      setMaxTokens(botSettings.config?.maxTokens ?? 1000);
      setRagNamespace(botSettings.config?.ragNamespace || "");
      setEnableRAG(botSettings.config?.enableRAG ?? true);
      setEnableInterview(botSettings.config?.enableInterview ?? false);
      setEnableClustering(botSettings.config?.enableClustering ?? false);
      setEnableTemplates(botSettings.config?.enableTemplates ?? false);
      setEnableParticipantRAG(botSettings.config?.enableParticipantRAG ?? false);
      setEnableCSVImport(botSettings.config?.enableCSVImport ?? false);
      setConsentRequired(botSettings.config?.consentRequired ?? false);
    }
  }, [botSettings]);

  const handleSave = async () => {
    if (!botSettings?._id) {
      toast({
        title: "Erro",
        description: "Nenhum bot configurado. Execute o seed primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateBotConfig({
        botId: botSettings._id as Id<"bots">,
        name,
        config: {
          personality: personality || undefined,
          maxTokens,
          temperature,
          model: model || undefined,
          fallbackMessage: fallbackMessage || undefined,
          enableRAG,
          ragNamespace: ragNamespace || undefined,
          guardrailsPrompt: guardrails || undefined,
          enableInterview: enableInterview || undefined,
          enableClustering: enableClustering || undefined,
          enableTemplates: enableTemplates || undefined,
          enableParticipantRAG: enableParticipantRAG || undefined,
          enableCSVImport: enableCSVImport || undefined,
          consentRequired: consentRequired || undefined,
        },
      });

      toast({
        title: "Configurações salvas",
        description: "As configurações do bot foram atualizadas.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!botSettings) {
    return (
      <div className="p-8 text-center">
        <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum bot configurado</h2>
        <p className="text-muted-foreground">
          Execute a função seedUniversityBot no Convex Dashboard para criar o bot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Configure o bot, personalidade e funcionalidades
          </p>
        </div>
        <div className="flex items-center gap-2">
          {botSettings.tenantName && (
            <Badge variant="outline">{botSettings.tenantName}</Badge>
          )}
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personality">
        <TabsList>
          <TabsTrigger value="personality">
            <Bot className="h-4 w-4 mr-2" />
            Personalidade
          </TabsTrigger>
          <TabsTrigger value="guardrails">
            <Shield className="h-4 w-4 mr-2" />
            Guardrails
          </TabsTrigger>
          <TabsTrigger value="model">
            <Sliders className="h-4 w-4 mr-2" />
            Modelo AI
          </TabsTrigger>
          <TabsTrigger value="features">
            <Settings className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
        </TabsList>

        {/* Personality Tab */}
        <TabsContent value="personality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalidade do Bot</CardTitle>
              <CardDescription>
                Define como o bot se comporta e responde aos usuários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bot-name">Nome do Bot</Label>
                <Input
                  id="bot-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Assistente Virtual"
                />
              </div>

              <div>
                <Label htmlFor="personality">System Prompt / Personalidade</Label>
                <Textarea
                  id="personality"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Descreva a personalidade do bot, tom de voz, o que ele faz e não faz..."
                  className="min-h-[250px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {personality.length} caracteres
                </p>
              </div>

              <div>
                <Label htmlFor="fallback">Mensagem de Fallback</Label>
                <Input
                  id="fallback"
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  placeholder="Mensagem quando o bot não encontra informação"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usada quando a IA não consegue gerar uma resposta
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guardrails Tab */}
        <TabsContent value="guardrails" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guardrails / Restrições</CardTitle>
              <CardDescription>
                Regras para manter o bot focado no assunto e evitar fugir do escopo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="guardrails">Regras de Guardrails</Label>
                <Textarea
                  id="guardrails"
                  value={guardrails}
                  onChange={(e) => setGuardrails(e.target.value)}
                  placeholder="Ex: Responda APENAS com base nos documentos da base de conhecimento..."
                  className="min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Essas regras são adicionadas ao system prompt para reforçar limites de comportamento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Tab */}
        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Modelo AI</CardTitle>
              <CardDescription>
                Ajuste o modelo e parâmetros de geração de texto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="model">Modelo</Label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (rápido, econômico)</option>
                  <option value="gpt-4o">GPT-4o (melhor qualidade)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>

              <div>
                <Label htmlFor="temperature">
                  Temperatura: {temperature.toFixed(1)}
                </Label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Preciso (0)</span>
                  <span>Criativo (1)</span>
                </div>
              </div>

              <div>
                <Label htmlFor="max-tokens">Max Tokens por Resposta</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                  min={100}
                  max={4000}
                />
              </div>

              <div>
                <Label htmlFor="rag-namespace">RAG Namespace</Label>
                <Input
                  id="rag-namespace"
                  value={ragNamespace}
                  onChange={(e) => setRagNamespace(e.target.value)}
                  placeholder="Ex: university_support"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Namespace isolado para os documentos deste bot
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Funcionalidades</CardTitle>
              <CardDescription>
                Ative ou desative módulos do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FeatureToggle
                label="RAG (Base de Conhecimento)"
                description="Consulta documentos para gerar respostas"
                enabled={enableRAG}
                onChange={setEnableRAG}
              />
              <FeatureToggle
                label="Consentimento LGPD"
                description="Exige aceite antes de conversar"
                enabled={consentRequired}
                onChange={setConsentRequired}
              />

              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground mb-3 uppercase font-medium">
                  Módulos Avançados
                </p>
              </div>

              <FeatureToggle
                label="Entrevistas"
                description="Sistema de entrevistas com estágios"
                enabled={enableInterview}
                onChange={setEnableInterview}
              />
              <FeatureToggle
                label="Clustering"
                description="Clusterização de participantes com UMAP/HDBSCAN"
                enabled={enableClustering}
                onChange={setEnableClustering}
              />
              <FeatureToggle
                label="Templates HSM"
                description="Templates de mensagens do WhatsApp Business"
                enabled={enableTemplates}
                onChange={setEnableTemplates}
              />
              <FeatureToggle
                label="Busca Semântica de Participantes"
                description="RAG para busca de participantes similares"
                enabled={enableParticipantRAG}
                onChange={setEnableParticipantRAG}
              />
              <FeatureToggle
                label="Importação CSV"
                description="Importar participantes via arquivo CSV"
                enabled={enableCSVImport}
                onChange={setEnableCSVImport}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

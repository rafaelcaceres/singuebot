import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface Tenant {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
}

interface Bot {
  _id: string;
  tenantId: string;
  name: string;
  type: 'ai' | 'rule_based' | 'hybrid';
  isActive: boolean;
  config: {
    ai?: {
      provider: string;
      model: string;
      personality?: string;
    };
    rag?: {
      enabled: boolean;
      namespace?: string;
    };
  };
}

interface Channel {
  _id: string;
  tenantId: string;
  botId: string;
  type: 'whatsapp' | 'telegram' | 'sms' | 'email';
  name: string;
  isActive: boolean;
  config: Record<string, any>;
}

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'bots' | 'channels' | 'migration'>('tenants');
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  // Queries
  const tenants = useQuery(api.functions.admin.getAllTenants) || [];
  const bots = useQuery(api.functions.admin.getAllBots, selectedTenant ? { tenantId: selectedTenant } : {}) || [];
  const channels = useQuery(api.functions.admin.getAllChannels, selectedTenant ? { tenantId: selectedTenant } : {}) || [];

  // Mutations
  const createTenant = useMutation(api.functions.admin.createTenant);
  const createBot = useMutation(api.functions.admin.createBot);
  const createChannel = useMutation(api.functions.admin.createChannel);
  const runMigration = useMutation(api.migrations.runMigration.runSingueMigration);

  const [newTenant, setNewTenant] = useState({
    slug: '',
    name: '',
    description: '',
  });

  const [newBot, setNewBot] = useState({
    name: '',
    type: 'ai' as const,
    personality: '',
    aiProvider: 'openai',
    aiModel: 'gpt-4',
    ragEnabled: false,
  });

  const [newChannel, setNewChannel] = useState({
    type: 'whatsapp' as const,
    name: '',
    config: {},
  });

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTenant({
        slug: newTenant.slug,
        name: newTenant.name,
        description: newTenant.description,
      });
      setNewTenant({ slug: '', name: '', description: '' });
      alert('Tenant criado com sucesso!');
    } catch (error) {
      alert(`Erro ao criar tenant: ${String(error)}`);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      alert('Selecione um tenant primeiro');
      return;
    }

    try {
      await createBot({
        tenantId: selectedTenant,
        name: newBot.name,
        type: newBot.type,
        config: {
          ai: {
            provider: newBot.aiProvider,
            model: newBot.aiModel,
            personality: newBot.personality,
          },
          rag: {
            enabled: newBot.ragEnabled,
            namespace: `${tenants.find(t => t._id === selectedTenant)?.slug || 'default'}_${newBot.name.toLowerCase().replace(/\s+/g, '_')}`,
          },
        },
      });
      setNewBot({
        name: '',
        type: 'ai',
        personality: '',
        aiProvider: 'openai',
        aiModel: 'gpt-4',
        ragEnabled: false,
      });
      alert('Bot criado com sucesso!');
    } catch (error) {
      alert(`Erro ao criar bot: ${String(error)}`);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      alert('Selecione um tenant primeiro');
      return;
    }

    const selectedBot = bots.find(b => b.tenantId === selectedTenant);
    if (!selectedBot) {
      alert('Crie um bot primeiro');
      return;
    }

    try {
      await createChannel({
        tenantId: selectedTenant,
        botId: selectedBot._id,
        type: newChannel.type,
        name: newChannel.name,
        config: newChannel.config,
      });
      setNewChannel({ type: 'whatsapp', name: '', config: {} });
      alert('Canal criado com sucesso!');
    } catch (error) {
      alert(`Erro ao criar canal: ${String(error)}`);
    }
  };

  const handleRunMigration = async () => {
    if (!confirm('Tem certeza que deseja executar a migração? Esta operação pode demorar alguns minutos.')) {
      return;
    }

    try {
      const result = await runMigration({ dryRun: false });
      alert(`Migração concluída: ${String(result.message)}`);
    } catch (error) {
      alert(`Erro na migração: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Painel de Administração</h1>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'tenants', label: 'Tenants' },
              { key: 'bots', label: 'Bots' },
              { key: 'channels', label: 'Canais' },
              { key: 'migration', label: 'Migração' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tenant Selection */}
        {(activeTab === 'bots' || activeTab === 'channels') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Tenant:
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um tenant...</option>
              {tenants.map((tenant) => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name} ({tenant.slug})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Tenant Form */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Criar Novo Tenant</h2>
                <form onSubmit={(e) => { void handleCreateTenant(e); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slug (identificador único)
                    </label>
                    <input
                      type="text"
                      value={newTenant.slug}
                      onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={newTenant.name}
                      onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={newTenant.description}
                      onChange={(e) => setNewTenant({ ...newTenant, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Criar Tenant
                  </button>
                </form>
              </div>

              {/* Tenants List */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Tenants Existentes</h2>
                <div className="space-y-3">
                  {tenants.map((tenant) => (
                    <div key={tenant._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{tenant.name}</h3>
                          <p className="text-sm text-gray-500">Slug: {tenant.slug}</p>
                          {tenant.description && (
                            <p className="text-sm text-gray-600 mt-1">{tenant.description}</p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            tenant.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tenant.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bots Tab */}
          {activeTab === 'bots' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Bot Form */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Criar Novo Bot</h2>
                <form onSubmit={(e) => { void handleCreateBot(e); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Bot
                    </label>
                    <input
                      type="text"
                      value={newBot.name}
                      onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo
                    </label>
                    <select
                      value={newBot.type}
                      onChange={(e) => setNewBot({ ...newBot, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="ai">AI</option>
                      <option value="rule_based">Baseado em Regras</option>
                      <option value="hybrid">Híbrido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personalidade (AI)
                    </label>
                    <textarea
                      value={newBot.personality}
                      onChange={(e) => setNewBot({ ...newBot, personality: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Descreva a personalidade e comportamento do bot..."
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="ragEnabled"
                      checked={newBot.ragEnabled}
                      onChange={(e) => setNewBot({ ...newBot, ragEnabled: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="ragEnabled" className="ml-2 block text-sm text-gray-900">
                      Habilitar RAG (Retrieval-Augmented Generation)
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedTenant}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
                  >
                    Criar Bot
                  </button>
                </form>
              </div>

              {/* Bots List */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Bots Existentes</h2>
                <div className="space-y-3">
                  {bots.map((bot) => (
                    <div key={bot._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{bot.name}</h3>
                          <p className="text-sm text-gray-500">Tipo: {bot.type}</p>
                          {bot.config.ai?.personality && (
                            <p className="text-sm text-gray-600 mt-1 truncate">
                              {bot.config.ai.personality.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            bot.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {bot.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Channel Form */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Criar Novo Canal</h2>
                <form onSubmit={(e) => { void handleCreateChannel(e); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Canal
                    </label>
                    <select
                      value={newChannel.type}
                      onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Canal
                    </label>
                    <input
                      type="text"
                      value={newChannel.name}
                      onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedTenant}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
                  >
                    Criar Canal
                  </button>
                </form>
              </div>

              {/* Channels List */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Canais Existentes</h2>
                <div className="space-y-3">
                  {channels.map((channel) => (
                    <div key={channel._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{channel.name}</h3>
                          <p className="text-sm text-gray-500">Tipo: {channel.type}</p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            channel.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {channel.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Migration Tab */}
          {activeTab === 'migration' && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Migração de Dados</h2>
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Atenção
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Esta operação irá migrar todos os dados existentes do WhatsApp para o novo sistema genérico.
                          Certifique-se de fazer backup dos dados antes de prosseguir.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-900">Migração Singuê</h3>
                  <p className="text-sm text-gray-600">
                    Migra os dados existentes do WhatsApp para o tenant "Singuê" com o bot "Fabi".
                  </p>
                  <button
                    onClick={() => { void handleRunMigration(); }}
                    className="bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    Executar Migração Singuê
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
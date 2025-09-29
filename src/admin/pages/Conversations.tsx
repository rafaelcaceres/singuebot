import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Search, Filter, Download, Trash2, MessageSquare, Users, Calendar, CheckSquare } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { ConversationViewer } from '../components/ConversationViewer';
import { usePermissions } from '../../hooks/useAuth';

interface Conversation {
  _id: string;
  participantId: string;
  participantName?: string;
  participantPhone: string;
  lastMessageAt: number;
  messageCount: number;
  unreadCount: number;
  currentStage: string;
  cluster?: { id: string; name: string } | null;
  consent: boolean;
}

export const Conversations: React.FC = () => {
  const { canManageUsers, canViewAnalytics } = usePermissions();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filters state
  const [clusterFilter, setClusterFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [unreadFilter, setUnreadFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({ startDate: '', endDate: '' });
  const [consentFilter, setConsentFilter] = useState<string>('');
  const [messageCountFilter, setMessageCountFilter] = useState<{
    min: string;
    max: string;
  }>({ min: '', max: '' });

  // Fetch data
  const conversationsData = useQuery(api.admin.getConversations, {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    clusterId: clusterFilter ? clusterFilter as any : undefined,
    stage: stageFilter || undefined,
    hasUnread: unreadFilter === 'true' ? true : unreadFilter === 'false' ? false : undefined,
  });

  const clusters = useQuery(api.admin.getClusters);

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedRows.size === (conversationsData?.conversations?.length || 0)) {
      setSelectedRows(new Set());
    } else {
      const allIds = new Set(conversationsData?.conversations?.map(c => c._id) || []);
      setSelectedRows(allIds);
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    
    if (confirm(`Tem certeza que deseja excluir ${selectedRows.size} conversa(s)?`)) {
      // TODO: Implement bulk delete mutation
      console.log('Bulk delete:', Array.from(selectedRows));
      setSelectedRows(new Set());
    }
  };

  const handleExportData = () => {
    const dataToExport = conversationsData?.conversations || [];
    const csvContent = [
      ['Participante', 'Telefone', 'Estágio', 'Cluster', 'Mensagens', 'Não lidas', 'Consentimento', 'Última atividade'].join(','),
      ...dataToExport.map(conv => [
        conv.participantName || 'Sem nome',
        conv.participantPhone.replace('whatsapp:', ''),
        conv.currentStage,
        conv.cluster?.name || 'Sem cluster',
        conv.messageCount,
        conv.unreadCount,
        conv.consent ? 'Sim' : 'Não',
        new Date(conv.lastMessageAt).toLocaleString('pt-BR')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `conversas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAllFilters = () => {
    setGlobalFilter('');
    setClusterFilter('');
    setStageFilter('');
    setUnreadFilter('');
    setDateRangeFilter({ startDate: '', endDate: '' });
    setConsentFilter('');
    setMessageCountFilter({ min: '', max: '' });
  };

  const columns = useMemo<ColumnDef<Conversation>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              onChange={handleSelectAll}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedRows.has(row.original._id)}
              onChange={() => handleSelectRow(row.original._id)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'participantName',
        header: 'Participante',
        cell: (info) => (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {info.getValue() as string ? (info.getValue() as string).charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {(info.getValue() as string) || 'Sem nome'}
              </p>
              <p className="text-sm text-gray-500">
                {info.row.original.participantPhone.replace('whatsapp:', '')}
              </p>
            </div>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'currentStage',
        header: 'Estágio',
        cell: (info) => {
          const stage = info.getValue() as string;
          const stageLabels: Record<string, string> = {
            not_started: 'Não iniciado',
            intro: 'Introdução',
            termos_confirmacao: 'Termos & Confirmação',
            mapeamento_carreira: 'Mapeamento de Carreira',
            finalizacao: 'Finalização',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              stage === 'not_started' ? 'bg-gray-100 text-gray-800' :
              stage === 'intro' ? 'bg-blue-100 text-blue-800' :
              stage === 'termos_confirmacao' ? 'bg-green-100 text-green-800' :
              stage === 'mapeamento_carreira' ? 'bg-purple-100 text-purple-800' :
              stage === 'finalizacao' ? 'bg-emerald-100 text-emerald-800' :
              'bg-green-100 text-green-800'
            }`}>
              {stageLabels[stage] || stage}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: 'cluster',
        header: 'Cluster',
        cell: (info) => (info.getValue() as any)?.name || 'Sem cluster',
        enableSorting: false,
      },
      {
        accessorKey: 'messageCount',
        header: 'Mensagens',
        cell: (info) => (
          <div className="flex items-center space-x-2">
            <span className="text-gray-900">{info.getValue() as number}</span>
            {info.row.original.unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {info.row.original.unreadCount} nova{info.row.original.unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'consent',
        header: 'Consentimento',
        cell: (info) => (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            info.getValue() as boolean
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {(info.getValue() as boolean) ? 'Sim' : 'Não'}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'lastMessageAt',
        header: 'Última atividade',
        cell: (info) => {
          const timestamp = info.getValue() as number;
          const date = new Date(timestamp);
          const now = new Date();
          const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
          
          let timeAgo = '';
          if (diffInHours < 1) {
            timeAgo = 'Agora há pouco';
          } else if (diffInHours < 24) {
            timeAgo = `${Math.floor(diffInHours)}h atrás`;
          } else {
            const diffInDays = Math.floor(diffInHours / 24);
            timeAgo = `${diffInDays}d atrás`;
          }
          
          return (
            <div>
              <p className="text-sm text-gray-900">{timeAgo}</p>
              <p className="text-xs text-gray-500">
                {date.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <button
            onClick={() => setSelectedParticipant(info.row.original.participantId)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Ver conversa
          </button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: conversationsData?.conversations || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil((conversationsData?.total || 0) / pagination.pageSize),
  });

  // Check permissions
  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso negado</h3>
          <p className="text-gray-500">Você não tem permissão para visualizar conversas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
        <div className="flex items-center space-x-3">
          {selectedRows.size > 0 && (
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
              <span className="text-sm text-blue-700 font-medium">
                {selectedRows.size} selecionada(s)
              </span>
              <button
                 onClick={() => void handleBulkDelete()}
                 className="text-red-600 hover:text-red-800 p-1"
                 title="Excluir selecionadas"
               >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
             onClick={() => void handleExportData()}
             className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
           >
            <Download className="h-4 w-4" />
            <span>Exportar</span>
          </button>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              showAdvancedFilters 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filtros Avançados</span>
          </button>
        </div>
      </div>

      {/* Basic Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar por nome, telefone ou ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(globalFilter || clusterFilter || stageFilter || unreadFilter || 
            dateRangeFilter.startDate || dateRangeFilter.endDate || 
            consentFilter || messageCountFilter.min || messageCountFilter.max) && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros Avançados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cluster
              </label>
              <select
                value={clusterFilter}
                onChange={(e) => setClusterFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os clusters</option>
                {clusters?.map((cluster) => (
                  <option key={cluster._id} value={cluster._id}>
                    {cluster.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estágio
              </label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os estágios</option>
                <option value="not_started">Não iniciado</option>
                <option value="intro">Introdução</option>
                <option value="termos_confirmacao">Termos & Confirmação</option>
                <option value="mapeamento_carreira">Mapeamento de Carreira</option>
                <option value="finalizacao">Finalização</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensagens não lidas
              </label>
              <select
                value={unreadFilter}
                onChange={(e) => setUnreadFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="true">Com não lidas</option>
                <option value="false">Sem não lidas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consentimento
              </label>
              <select
                value={consentFilter}
                onChange={(e) => setConsentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Com consentimento</option>
                <option value="false">Sem consentimento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data inicial
              </label>
              <input
                type="date"
                value={dateRangeFilter.startDate}
                onChange={(e) => setDateRangeFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data final
              </label>
              <input
                type="date"
                value={dateRangeFilter.endDate}
                onChange={(e) => setDateRangeFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mín. mensagens
              </label>
              <input
                type="number"
                value={messageCountFilter.min}
                onChange={(e) => setMessageCountFilter(prev => ({ ...prev, min: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Máx. mensagens
              </label>
              <input
                type="number"
                value={messageCountFilter.max}
                onChange={(e) => setMessageCountFilter(prev => ({ ...prev, max: e.target.value }))}
                placeholder="999"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Conversas</p>
              <p className="text-2xl font-bold text-gray-900">{conversationsData?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Users className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Não Lidas</p>
              <p className="text-2xl font-bold text-gray-900">
                {conversationsData?.conversations?.filter(c => c.unreadCount > 0).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckSquare className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Com Consentimento</p>
              <p className="text-2xl font-bold text-gray-900">
                {conversationsData?.conversations?.filter(c => c.consent).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Hoje</p>
              <p className="text-2xl font-bold text-gray-900">
                {conversationsData?.conversations?.filter(c => {
                  const today = new Date();
                  const messageDate = new Date(c.lastMessageAt);
                  return messageDate.toDateString() === today.toDateString();
                }).length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center space-x-1">
                        <span>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getIsSorted() && (
                          <span className="text-blue-500">
                            {header.column.getIsSorted() === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando{' '}
                <span className="font-medium">
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                </span>{' '}
                até{' '}
                <span className="font-medium">
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    conversationsData?.total || 0
                  )}
                </span>{' '}
                de{' '}
                <span className="font-medium">{conversationsData?.total || 0}</span> resultados
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ««
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  »
                </button>
                <button
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  »»
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Viewer Modal */}
      {selectedParticipant && (
        <ConversationViewer
          participantId={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
        />
      )}
    </div>
  );
};
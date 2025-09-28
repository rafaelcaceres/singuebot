import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Plus, MessageSquare } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { ConversationViewer } from '../components/ConversationViewer';
import { AddParticipantForm } from '../components/AddParticipantForm';
import { EditParticipantForm } from '../components/EditParticipantForm';
import { TemplateModal } from '../components/TemplateModal';
import { usePermissions } from '../../hooks/useAuth';

interface Participant {
  _id: string;
  phone: string;
  name?: string;
  consent: boolean;
  clusterId?: string;
  currentStage: string;
  lastMessageAt?: number;
  cluster?: { id: string; name: string } | null;
  tags: string[];
  createdAt: number;
  cargo?: string;
  empresa?: string;
  setor?: string;
}

const columnHelper = createColumnHelper<Participant>();

export const Participants: React.FC = () => {
  const { canManageUsers, canDeleteData } = usePermissions();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [editParticipantId, setEditParticipantId] = useState<string | null>(null);
  
  // Multi-selection state
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Filters state
  const [clusterFilter, setClusterFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [consentFilter, setConsentFilter] = useState<string>('');

  // Fetch data
  const participantsData = useQuery(api.admin.getParticipants, {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    clusterId: (clusterFilter || undefined) as any,
    consent: consentFilter === 'true' ? true : consentFilter === 'false' ? false : undefined,
    stage: stageFilter || undefined,
  });

  const clusters = useQuery(api.admin.getClusters);

  // Mutations
  const deleteParticipantMutation = useMutation(api.admin.deleteParticipant);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(participantsData?.participants?.map(p => p._id) || []);
      setSelectedParticipants(allIds);
    } else {
      setSelectedParticipants(new Set());
    }
  };

  const handleSelectParticipant = (participantId: string, checked: boolean) => {
    const newSelection = new Set(selectedParticipants);
    if (checked) {
      newSelection.add(participantId);
    } else {
      newSelection.delete(participantId);
    }
    setSelectedParticipants(newSelection);
  };

  const isAllSelected = (participantsData?.participants?.length ?? 0) > 0 && 
    participantsData?.participants?.every(p => selectedParticipants.has(p._id)) === true;
  
  const isIndeterminate = selectedParticipants.size > 0 && !isAllSelected;

  const columns = useMemo<ColumnDef<Participant, any>[]>(
    () => [
      // Checkbox column
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isIndeterminate;
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedParticipants.has(row.original._id)}
            onChange={(e) => handleSelectParticipant(row.original._id, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Nome',
        cell: (info) => info.getValue() || 'Sem nome',
        enableSorting: true,
      }),
      columnHelper.accessor('phone', {
        header: 'Telefone',
        cell: (info) => {
          const phone = info.getValue();
          return phone ? phone.replace('whatsapp:', '') : '';
        },
        enableSorting: false,
      }),
      columnHelper.accessor('currentStage', {
        header: 'Estágio',
        cell: (info) => {
          const stage = info.getValue();
          const stageLabels: Record<string, string> = {
            not_started: 'Não iniciado',
            intro: 'Introdução',
            asa: 'ASA',
            listas: 'Listas',
            pre_evento: 'Pré-evento',
            diaD: 'Dia D',
            pos_24h: 'Pós 24h',
            pos_7d: 'Pós 7 dias',
            pos_30d: 'Pós 30 dias',
          };
          
          const getStageColor = (stageValue: string) => {
            switch (stageValue) {
              case 'not_started': return 'bg-gray-100 text-gray-800';
              case 'intro': return 'bg-blue-100 text-blue-800';
              case 'asa': return 'bg-yellow-100 text-yellow-800';
              case 'listas': return 'bg-purple-100 text-purple-800';
              case 'pre_evento': return 'bg-orange-100 text-orange-800';
              case 'diaD': return 'bg-red-100 text-red-800';
              default: return 'bg-green-100 text-green-800';
            }
          };

          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(stage)}`}>
              {stageLabels[stage] || stage}
            </span>
          );
        },
        enableSorting: true,
      }),
      columnHelper.accessor('cluster', {
        header: 'Cluster',
        cell: (info) => {
          const cluster = info.getValue();
          return cluster?.name || 'Sem cluster';
        },
        enableSorting: false,
      }),
      columnHelper.accessor('consent', {
        header: 'Consentimento',
        cell: (info) => {
          const consent = info.getValue();
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              consent 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {consent ? 'Sim' : 'Não'}
            </span>
          );
        },
        enableSorting: true,
      }),
      columnHelper.accessor('cargo', {
        header: 'Cargo',
        cell: (info) => info.getValue() || '-',
        enableSorting: true,
      }),
      columnHelper.accessor('empresa', {
        header: 'Empresa',
        cell: (info) => info.getValue() || '-',
        enableSorting: true,
      }),
      columnHelper.accessor('setor', {
        header: 'Setor',
        cell: (info) => info.getValue() || '-',
        enableSorting: true,
      }),
      columnHelper.accessor('lastMessageAt', {
        header: 'Última mensagem',
        cell: (info) => {
          const timestamp = info.getValue();
          if (!timestamp) return 'Nunca';
          
          try {
            return new Date(timestamp).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch (error) {
            console.error('Error formatting date:', error);
            return 'Data inválida';
          }
        },
        enableSorting: true,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedParticipant(info.row.original._id)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Ver conversa
            </button>
            {canManageUsers && (
              <button
                onClick={() => setEditParticipantId(info.row.original._id)}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                Editar
              </button>
            )}
            {canDeleteData && (
              <button
                onClick={() => void handleDeleteParticipant(info.row.original._id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Excluir
              </button>
            )}
          </div>
        ),
      }),
    ],
    [canDeleteData, canManageUsers, selectedParticipants, isAllSelected, isIndeterminate, handleSelectAll, handleSelectParticipant]
  );

  const table = useReactTable({
    data: participantsData?.participants || [],
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
    pageCount: Math.ceil((participantsData?.total || 0) / pagination.pageSize),
  });

  const handleDeleteParticipant = async (participantId: string) => {
    if (!confirm('Tem certeza que deseja excluir este participante? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      await deleteParticipantMutation({ participantId: participantId as any });
      // Refresh data by triggering a re-fetch
      window.location.reload();
    } catch (error) {
      console.error('Error deleting participant:', error);
      alert('Erro ao excluir participante. Tente novamente.');
    }
  };

  const handleExportData = () => {
    if (!participantsData?.participants) return;
    
    // Create CSV content
    const headers = ['Nome', 'Telefone', 'Cargo', 'Empresa', 'Setor', 'Estágio', 'Cluster', 'Consentimento', 'Última Mensagem', 'Data de Criação'];
    const csvContent = [
      headers.join(','),
      ...participantsData.participants.map(participant => [
        participant.name || 'Sem nome',
        participant.phone.replace('whatsapp:', ''),
        participant.cargo || '-',
        participant.empresa || '-',
        participant.setor || '-',
        participant.currentStage,
        participant.cluster?.name || 'Sem cluster',
        participant.consent ? 'Sim' : 'Não',
        participant.lastMessageAt 
          ? new Date(participant.lastMessageAt).toLocaleDateString('pt-BR')
          : 'Nunca',
        new Date(participant.createdAt).toLocaleDateString('pt-BR')
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `participantes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Você não tem permissão para ver os participantes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
        <div className="flex space-x-3">
          {selectedParticipants.size > 0 && (
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Enviar Template ({selectedParticipants.size})
            </button>
          )}
          {canManageUsers && (
            <button
              onClick={() => setIsAddParticipantOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Participante
            </button>
          )}
          <button
            onClick={handleExportData}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Exportar dados
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Nome ou telefone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
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
              <option value="asa">ASA</option>
              <option value="listas">Listas</option>
              <option value="pre_evento">Pré-evento</option>
              <option value="diaD">Dia D</option>
              <option value="pos_24h">Pós 24h</option>
              <option value="pos_7d">Pós 7 dias</option>
              <option value="pos_30d">Pós 30 dias</option>
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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
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
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-gray-400">
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
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando{' '}
                <span className="font-medium">
                  {pagination.pageIndex * pagination.pageSize + 1}
                </span>{' '}
                até{' '}
                <span className="font-medium">
                  {Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    participantsData?.total || 0
                  )}
                </span>{' '}
                de{' '}
                <span className="font-medium">{participantsData?.total || 0}</span>{' '}
                resultados
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Primeira
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Próximo
                </button>
                <button
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Última
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

      {/* Add Participant Modal */}
      <AddParticipantForm
        open={isAddParticipantOpen}
        onOpenChange={setIsAddParticipantOpen}
      />

      {/* Edit Participant Form */}
      <EditParticipantForm
        open={!!editParticipantId}
        onOpenChange={(open) => !open && setEditParticipantId(null)}
        participantId={editParticipantId as any}
        onSuccess={() => {
          setEditParticipantId(null);
          // Refresh data by triggering a re-fetch
          window.location.reload();
        }}
      />

      {/* Template Modal */}
      <TemplateModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        selectedParticipants={
          participantsData?.participants?.filter(p => selectedParticipants.has(p._id)) || []
        }
      />
    </div>
  );
};
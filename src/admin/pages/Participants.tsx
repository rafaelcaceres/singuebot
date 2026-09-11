import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, MessageSquare, Upload } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { AddParticipantForm } from '../components/AddParticipantForm';
import { EditParticipantForm } from '../components/EditParticipantForm';
import { BroadcastComposer } from '../components/BroadcastComposer';
import { ImportParticipantsModal } from '../components/ImportParticipantsModal';
import { usePermissions } from '../../hooks/useAuth';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/PageHeader';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { stageLabel, stageTone } from '@/admin/lib/stages';

interface Participant {
  _id: string;
  phone: string;
  name?: string;
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
  const navigate = useNavigate();
  const { canManageUsers, canDeleteData } = usePermissions();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [deletingParticipantId, setDeletingParticipantId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [editParticipantId, setEditParticipantId] = useState<string | null>(null);
  
  // Multi-selection state
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filters state
  const [clusterFilter, setClusterFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [importSourceFilter, setImportSourceFilter] = useState<string>('');

  // Fetch data
  const filterArgs = {
    clusterId: (clusterFilter || undefined) as Id<'clusters'> | undefined,
    stage: stageFilter || undefined,
    importSource: importSourceFilter || undefined,
  };
  const participantsData = useQuery(api.admin.getParticipants, {
    ...filterArgs,
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  const clusters = useQuery(api.admin.getClusters);
  const importSources = useQuery(api.admin.getImportSources);

  // Mutations
  const deleteParticipantMutation = useMutation(api.admin.deleteParticipant);

  // Selection handlers.
  // Selection spans pages: the header checkbox unions/removes only the current page
  // rather than replacing the whole set, so paginating no longer silently drops
  // rows while the button keeps showing the full count.
  const handleSelectAll = (checked: boolean) => {
    const pageIds = participantsData?.participants?.map(p => p._id) || [];
    setSelectedParticipants(prev => {
      const next = new Set(prev);
      if (checked) {
        pageIds.forEach(id => next.add(id));
      } else {
        pageIds.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  // Functional update, not `new Set(selectedParticipants)`: the captured value goes
  // stale between clicks that land in the same render, silently dropping all but
  // the last one.
  const handleSelectParticipant = (participantId: string, checked: boolean) => {
    setSelectedParticipants(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(participantId);
      } else {
        next.delete(participantId);
      }
      return next;
    });
  };

  const isAllSelected = (participantsData?.participants?.length ?? 0) > 0 && 
    participantsData?.participants?.every(p => selectedParticipants.has(p._id)) === true;
  
  const isIndeterminate = selectedParticipants.size > 0 && !isAllSelected;

  const hasSelection = selectedParticipants.size > 0;

  // "Select all" across pages (Gmail-style). The table only ever holds one page,
  // so the ids of everyone matching the filters come from the server — a one-off
  // fetch rather than a subscription, since they're only needed at click time.
  // They're remembered with the filters they were fetched for, so the selection
  // bar can tell "the whole filtered set" apart from "just this page".
  const convex = useConvex();
  const [matchingSelection, setMatchingSelection] = useState<{ key: string; ids: string[] } | null>(null);
  const [isSelectingAllMatching, setIsSelectingAllMatching] = useState(false);
  const filterKey = JSON.stringify(filterArgs);
  const totalMatching = participantsData?.total ?? 0;
  const pageRowCount = participantsData?.participants.length ?? 0;
  const filterSuffix = clusterFilter || stageFilter || importSourceFilter ? ' deste filtro' : '';

  const allMatchingSelected =
    matchingSelection?.key === filterKey &&
    matchingSelection.ids.length === totalMatching &&
    matchingSelection.ids.every(id => selectedParticipants.has(id));

  // Search only narrows the rows of the current page (client-side), so offering
  // "all N" while searching would select people the operator can't see.
  const canOfferSelectAllMatching =
    isAllSelected && !allMatchingSelected && !globalFilter && totalMatching > pageRowCount;

  const handleSelectAllMatching = async () => {
    setIsSelectingAllMatching(true);
    try {
      const ids = await convex.query(api.admin.getParticipantIds, filterArgs);
      setSelectedParticipants(prev => new Set([...prev, ...ids]));
      setMatchingSelection({ key: filterKey, ids });
    } catch (error) {
      toast.error('Não foi possível selecionar todos', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSelectingAllMatching(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedParticipants(new Set());
    setMatchingSelection(null);
  };

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
            aria-label="Selecionar todos os participantes desta página"
            className="rounded border-input text-primary focus:ring-ring focus-visible:ring-2 focus-visible:ring-ring"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedParticipants.has(row.original._id)}
            onChange={(e) => handleSelectParticipant(row.original._id, e.target.checked)}
            aria-label={`Selecionar ${row.original.name || row.original.phone.replace('whatsapp:', '')}`}
            className="rounded border-input text-primary focus:ring-ring focus-visible:ring-2 focus-visible:ring-ring"
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
          return <StatusBadge tone={stageTone(stage)}>{stageLabel(stage)}</StatusBadge>;
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
          <div className="flex items-center gap-1">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void navigate(`/participants/${info.row.original._id}`)}
            >
              Perfil
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 ml-2"
              onClick={() =>
                void navigate(`/atendimento?participant=${info.row.original._id}`)
              }
            >
              Conversa
            </Button>
            {canManageUsers && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-2"
                onClick={() => setEditParticipantId(info.row.original._id)}
              >
                Editar
              </Button>
            )}
            {canDeleteData && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-2 text-destructive"
                onClick={() => setDeletingParticipantId(info.row.original._id)}
              >
                Excluir
              </Button>
            )}
          </div>
        ),
      }),
    ],
    [canDeleteData, canManageUsers, selectedParticipants, isAllSelected, isIndeterminate, handleSelectAll, handleSelectParticipant, navigate]
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

  const handleDeleteParticipant = async () => {
    if (!deletingParticipantId) return;

    setIsDeleting(true);
    try {
      await deleteParticipantMutation({
        participantId: deletingParticipantId as Id<'participants'>,
      });
      setDeletingParticipantId(null);
      toast.success('Participante excluído');
    } catch (error) {
      toast.error('Não foi possível excluir o participante', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportData = () => {
    if (!participantsData?.participants) return;
    
    // Create CSV content
    const headers = ['Nome', 'Telefone', 'Cargo', 'Empresa', 'Setor', 'Estágio', 'Cluster', 'Última Mensagem', 'Data de Criação'];
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
        <p className="text-muted-foreground">Você não tem permissão para ver os participantes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* One primary action at a time, and which one depends on context: with a
          selection active, sending to those people is why the selection exists,
          so it takes the emphasis away from "Adicionar". */}
      <PageHeader
        title="Participantes"
        description="O cadastro base do programa. Selecione para disparar ou editar."
        actions={
          <>
            {hasSelection && (
              <Button onClick={() => setIsComposerOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" aria-hidden="true" />
                Criar disparo ({selectedParticipants.size})
              </Button>
            )}
            {canManageUsers && (
              <>
                <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                  Importar CSV
                </Button>
                <Button
                  variant={hasSelection ? 'outline' : 'default'}
                  onClick={() => setIsAddParticipantOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Adicionar Participante
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleExportData}>
              Exportar dados
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg shadow border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="participants-search" className="block text-sm font-medium text-foreground mb-1">
              Buscar
            </label>
            <input
              id="participants-search"
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Nome ou telefone..."
              className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="participants-cluster" className="block text-sm font-medium text-foreground mb-1">
              Cluster
            </label>
            <select
              id="participants-cluster"
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <label htmlFor="participants-stage" className="block text-sm font-medium text-foreground mb-1">
              Estágio
            </label>
            <select
              id="participants-stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todos os estágios</option>
              <option value="not_started">Não iniciado</option>
              <option value="intro">Introdução</option>
              <option value="termos_aceite">Termos & Confirmação</option>
                <option value="mapeamento_carreira">Mapeamento de Carreira</option>
                <option value="momento_carreira">Momento de Carreira</option>
                <option value="expectativas_evento">Expectativas do Evento</option>
                <option value="objetivo_principal">Objetivo Principal</option>
                <option value="finalizacao">Finalização</option>
            </select>
          </div>

          <div>
            <label htmlFor="participants-import-source" className="block text-sm font-medium text-foreground mb-1">
              Origem da importação
            </label>
            <select
              id="participants-import-source"
              value={importSourceFilter}
              onChange={(e) => setImportSourceFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todas as importações</option>
              {importSources?.map((source) => (
                <option key={source.importSource} value={source.importSource}>
                  {source.importSource} ({source.count})
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Table */}
      <div className="bg-card shadow rounded-lg border border-border overflow-hidden">
        {/* Selection bar: the selection spans pages, so the checkboxes alone can't
            show how far it reaches. Also where "this page" becomes "everyone
            matching the filters". */}
        {hasSelection && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted px-6 py-2.5 text-sm text-foreground"
          >
            <span>
              {allMatchingSelected
                ? `Todos os ${totalMatching} participantes${filterSuffix} estão selecionados.`
                : isAllSelected && selectedParticipants.size === pageRowCount
                  ? `Os ${pageRowCount} participantes desta página estão selecionados.`
                  : `${selectedParticipants.size} participante(s) selecionado(s).`}
            </span>
            {canOfferSelectAllMatching && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={isSelectingAllMatching}
                onClick={() => void handleSelectAllMatching()}
              >
                {isSelectingAllMatching
                  ? 'Selecionando...'
                  : `Selecionar todos os ${totalMatching} participantes${filterSuffix}`}
              </Button>
            )}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-muted-foreground"
              onClick={handleClearSelection}
            >
              Limpar seleção
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      // nowrap: the table scrolls horizontally, so a wrapped
                      // header just reads as truncated ("ÚLT / ME") instead of
                      // signalling there is more to scroll to.
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-muted"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center space-x-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-muted-foreground">
                            {header.column.getIsSorted() === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="outline"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              className="ml-3"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Próximo
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-foreground">
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
              <nav
                aria-label="Paginação de participantes"
                className="relative z-0 inline-flex items-center gap-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Próximo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  Última
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={!!deletingParticipantId}
        onClose={() => setDeletingParticipantId(null)}
        onConfirm={handleDeleteParticipant}
        isLoading={isDeleting}
        title="Excluir participante?"
        message="Além do cadastro, o histórico de conversa, a entrevista e o perfil deste participante serão apagados. Esta ação não pode ser desfeita."
      />

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
        onSuccess={() => setEditParticipantId(null)}
      />

      {/* Import Participants Modal */}
      <ImportParticipantsModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onSuccess={() => setIsImportModalOpen(false)}
      />

      {/* Broadcast composer.
          Receives the ids directly rather than participant docs filtered from the
          current page, so a selection built across several pages stays intact. */}
      <BroadcastComposer
        open={isComposerOpen}
        onOpenChange={setIsComposerOpen}
        participantIds={[...selectedParticipants] as Id<'participants'>[]}
      />
    </div>
  );
};
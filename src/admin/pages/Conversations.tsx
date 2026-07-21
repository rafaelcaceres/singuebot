import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
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
import { Search, Filter, Download, Trash2, MessageSquare, Users, Calendar } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { usePermissions } from '../../hooks/useAuth';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/PageHeader';
import { StatCluster } from '../components/StatCluster';
import { stageLabel, stageTone } from '@/admin/lib/stages';
import { toast } from 'sonner';

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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();
  const bulkDeleteConversations = useMutation(api.admin.bulkDeleteConversations);

  /** One thread, one place. The table links into the inbox instead of opening a second viewer. */
  const openConversation = (participantId: string) => {
    void navigate(`/atendimento?participant=${participantId}`);
  };

  // Filters state
  const [clusterFilter, setClusterFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [unreadFilter, setUnreadFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({ startDate: '', endDate: '' });
  const [messageCountFilter, setMessageCountFilter] = useState<{
    min: string;
    max: string;
  }>({ min: '', max: '' });

  // Fetch data
  const parsedCount = (value: string): number | undefined => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const conversationsData = useQuery(api.admin.getConversations, {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    clusterId: clusterFilter ? clusterFilter as any : undefined,
    stage: stageFilter || undefined,
    hasUnread: unreadFilter === 'true' ? true : unreadFilter === 'false' ? false : undefined,
    startDate: dateRangeFilter.startDate
      ? new Date(`${dateRangeFilter.startDate}T00:00:00`).getTime()
      : undefined,
    endDate: dateRangeFilter.endDate
      ? new Date(`${dateRangeFilter.endDate}T23:59:59.999`).getTime()
      : undefined,
    minMessages: parsedCount(messageCountFilter.min),
    maxMessages: parsedCount(messageCountFilter.max),
  });

  const clusters = useQuery(api.admin.getClusters);

  // Selection is kept in our own Set rather than TanStack's row-selection state.
  // The header checkbox used to *read* `table.getIsAllPageRowsSelected()` while
  // writing here, so it never appeared checked — two sources of truth for one
  // control. Everything below reads and writes the same Set.
  const pageIds = useMemo(
    () => (conversationsData?.conversations ?? []).map((c) => c._id),
    [conversationsData]
  );

  const isAllPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedRows.has(id));
  const isSomePageSelected = pageIds.some((id) => selectedRows.has(id));
  const isIndeterminate = isSomePageSelected && !isAllPageSelected;

  // Union/remove only the current page, so paginating never silently drops rows
  // that the count in the toolbar still claims are selected.
  const handleSelectAll = (checked: boolean) => {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  // Functional update: the captured Set goes stale between two clicks landing in
  // the same render, which silently drops all but the last.
  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0 || isDeleting) return;

    setIsDeleting(true);
    try {
      const count = selectedRows.size;
      await bulkDeleteConversations({
        participantIds: Array.from(selectedRows) as Id<'participants'>[],
      });
      setSelectedRows(new Set());
      setShowDeleteConfirmation(false);
      toast.success(
        `Histórico de ${count} conversa${count > 1 ? 's' : ''} em exclusão`,
        {
          description:
            'Os participantes continuam cadastrados. A lista atualiza sozinha ao terminar.',
        }
      );
    } catch (error) {
      toast.error('Não foi possível excluir as conversas', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportData = () => {
    const dataToExport = conversationsData?.conversations || [];
    const csvContent = [
      ['Participante', 'Telefone', 'Estágio', 'Cluster', 'Mensagens', 'Não lidas', 'Última atividade'].join(','),
      ...dataToExport.map(conv => [
        conv.participantName || 'Sem nome',
        conv.participantPhone.replace('whatsapp:', ''),
        conv.currentStage,
        conv.cluster?.name || 'Sem cluster',
        conv.messageCount,
        conv.unreadCount,
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
    setMessageCountFilter({ min: '', max: '' });
  };

  const columns = useMemo<ColumnDef<Conversation>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isAllPageSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate;
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              aria-label="Selecionar todas as conversas desta página"
              className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedRows.has(row.original._id)}
              onChange={(e) => handleSelectRow(row.original._id, e.target.checked)}
              aria-label={`Selecionar ${row.original.participantName || row.original.participantPhone.replace('whatsapp:', '')}`}
              className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
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
            <div
              aria-hidden="true"
              className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium"
            >
              {info.getValue() as string ? (info.getValue() as string).charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <p className="font-medium text-foreground">
                {(info.getValue() as string) || 'Sem nome'}
              </p>
              <p className="text-sm text-muted-foreground">
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
          return <StatusBadge tone={stageTone(stage)}>{stageLabel(stage)}</StatusBadge>;
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
            <span className="text-foreground">{info.getValue() as number}</span>
            {info.row.original.unreadCount > 0 && (
              <StatusBadge tone="danger">
                {info.row.original.unreadCount} nova{info.row.original.unreadCount > 1 ? 's' : ''}
              </StatusBadge>
            )}
          </div>
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
              <p className="text-sm text-foreground">{timeAgo}</p>
              <p className="text-xs text-muted-foreground">
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
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => openConversation(info.row.original.participantId)}
          >
            Ver conversa
          </Button>
        ),
      },
    ],
    // These were memoized with an empty dep array, so every cell closed over the
    // first render's (empty) selection: `checked` never updated and clicking a
    // second checkbox rebuilt the Set from the stale one, dropping the first.
    [selectedRows, isAllPageSelected, isIndeterminate]
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
          <h3 className="text-lg font-medium text-foreground mb-2">Acesso negado</h3>
          <p className="text-muted-foreground">Você não tem permissão para visualizar conversas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversas"
        description="Todas as conversas dos participantes. Abra uma para ver a thread completa."
        actions={
          <>
            {selectedRows.size > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-md">
                <span className="text-sm text-primary font-medium">
                  {selectedRows.size} selecionada(s)
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirmation(true)}
                  aria-label="Excluir conversas selecionadas"
                  title="Excluir selecionadas"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => void handleExportData()}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              variant={showAdvancedFilters ? 'default' : 'secondary'}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              aria-pressed={showAdvancedFilters}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros Avançados
            </Button>
          </>
        }
      />

      {/* Basic Search */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <label htmlFor="conversations-search" className="sr-only">
              Buscar conversas
            </label>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
            />
            <input
              id="conversations-search"
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar por nome, telefone ou ID..."
              className="w-full pl-10 pr-4 py-2 bg-background text-foreground border border-input rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {(globalFilter || clusterFilter || stageFilter || unreadFilter ||
            dateRangeFilter.startDate || dateRangeFilter.endDate ||
            messageCountFilter.min || messageCountFilter.max) && (
            <Button variant="outline" onClick={clearAllFilters}>
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-medium text-foreground mb-4">Filtros Avançados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="filter-cluster" className="block text-sm font-medium text-foreground mb-1">
                Cluster
              </label>
              <select
                id="filter-cluster"
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
              <label htmlFor="filter-stage" className="block text-sm font-medium text-foreground mb-1">
                Estágio
              </label>
              <select
                id="filter-stage"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos os estágios</option>
                <option value="not_started">Não iniciado</option>
                <option value="termos_aceite">Termos & Confirmação</option>
                <option value="mapeamento_carreira">Mapeamento de Carreira</option>
                  <option value="momento_carreira">Momento de Carreira</option>
                  <option value="expectativas_evento">Expectativas do Evento</option>
                  <option value="objetivo_principal">Objetivo Principal</option>
                <option value="finalizacao">Finalização</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-unread" className="block text-sm font-medium text-foreground mb-1">
                Mensagens não lidas
              </label>
              <select
                id="filter-unread"
                value={unreadFilter}
                onChange={(e) => setUnreadFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todas</option>
                <option value="true">Com não lidas</option>
                <option value="false">Sem não lidas</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-start-date" className="block text-sm font-medium text-foreground mb-1">
                Data inicial
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={dateRangeFilter.startDate}
                onChange={(e) => setDateRangeFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="filter-end-date" className="block text-sm font-medium text-foreground mb-1">
                Data final
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={dateRangeFilter.endDate}
                onChange={(e) => setDateRangeFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="filter-min-messages" className="block text-sm font-medium text-foreground mb-1">
                Mín. mensagens
              </label>
              <input
                id="filter-min-messages"
                type="number"
                value={messageCountFilter.min}
                onChange={(e) => setMessageCountFilter(prev => ({ ...prev, min: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="filter-max-messages" className="block text-sm font-medium text-foreground mb-1">
                Máx. mensagens
              </label>
              <input
                id="filter-max-messages"
                type="number"
                value={messageCountFilter.max}
                onChange={(e) => setMessageCountFilter(prev => ({ ...prev, max: e.target.value }))}
                placeholder="999"
                className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>
      )}

      <StatCluster
        className="md:grid-cols-3"
        stats={[
          {
            label: "Total de conversas",
            value: conversationsData?.total || 0,
            icon: MessageSquare,
          },
          {
            label: "Não lidas",
            value:
              conversationsData?.conversations?.filter((c) => c.unreadCount > 0).length || 0,
            icon: Users,
            tone: "danger",
          },
          {
            label: "Hoje",
            value:
              conversationsData?.conversations?.filter((c) => {
                const today = new Date();
                const messageDate = new Date(c.lastMessageAt);
                return messageDate.toDateString() === today.toDateString();
              }).length || 0,
            icon: Calendar,
            tone: "warning",
          },
        ]}
      />

      {/* Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center space-x-1">
                        <span>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getIsSorted() && (
                          <span className="text-primary">
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
              <nav
                aria-label="Paginação de conversas"
                className="relative z-0 inline-flex items-center gap-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Primeira página"
                >
                  <span aria-hidden="true">««</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Página anterior"
                >
                  <span aria-hidden="true">«</span>
                </Button>
                <span className="px-3 text-sm font-medium text-foreground">
                  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Próxima página"
                >
                  <span aria-hidden="true">»</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  aria-label="Última página"
                >
                  <span aria-hidden="true">»»</span>
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleBulkDelete}
        isLoading={isDeleting}
        title={`Excluir histórico de ${selectedRows.size} conversa${selectedRows.size > 1 ? 's' : ''}?`}
        message="As mensagens trocadas serão apagadas permanentemente. Os participantes, seus perfis e as entrevistas continuam cadastrados — só o histórico da conversa é removido."
      />
    </div>
  );
};
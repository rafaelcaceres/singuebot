import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
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
import { RefreshCw, Trash2, Search, Settings } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { TemplateConfigModal } from '../components/TemplateConfigModal';
import { usePermissions } from '../../hooks/useAuth';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';

interface Template {
  _id: Id<"templates">;
  name: string;
  locale: string;
  twilioId: string;
  variables: string[];
  stage: string;
  approvalStatus?: string;
  contentType?: string;
  syncedAt?: number;
  twilioStructure?: { body?: string };
  _creationTime: number;
}

interface SyncResult {
  scanned: number;
  created: number;
  updated: number;
  archived: number;
  conflicts: Array<{ twilioId: string; friendlyName: string; reason: string }>;
}

const APPROVAL_TONES: Record<string, StatusTone> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  unsubmitted: 'neutral',
  archived_remote: 'warning',
};

const APPROVAL_LABELS: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Em análise',
  rejected: 'Rejeitado',
  unsubmitted: 'Não enviado',
  archived_remote: 'Removido no Twilio',
};

const columnHelper = createColumnHelper<Template>();

export const TemplatesPage: React.FC = () => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Modal states
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [configuringTemplate, setConfiguringTemplate] = useState<Template | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Permissions
  const { canManageUsers } = usePermissions();

  // Data fetching
  const templates = (useQuery(api.admin.getTemplates) || []) as Template[];
  const deleteTemplate = useMutation(api.admin.deleteTemplate);
  const syncTemplates = useAction(api.functions.templateSync.syncTemplatesFromTwilio);

  const lastSyncedAt = useMemo(() => {
    const stamps = templates.map((t) => t.syncedAt ?? 0).filter(Boolean);
    return stamps.length ? Math.max(...stamps) : null;
  }, [templates]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      setSyncResult(await syncTemplates({}));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Nome',
      cell: (info) => (
        <div className="font-medium text-foreground">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('locale', {
      header: 'Idioma',
      cell: (info) => <StatusBadge tone="info">{info.getValue()}</StatusBadge>,
    }),
    columnHelper.accessor('approvalStatus', {
      header: 'Aprovação',
      cell: (info) => {
        const status = info.getValue() ?? 'unsubmitted';
        return (
          <StatusBadge tone={APPROVAL_TONES[status] ?? 'neutral'} dot>
            {APPROVAL_LABELS[status] ?? status}
          </StatusBadge>
        );
      },
    }),
    columnHelper.display({
      id: 'body',
      header: 'Mensagem',
      cell: (info) => {
        const body = info.row.original.twilioStructure?.body;
        if (!body) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <p className="text-xs text-muted-foreground max-w-sm line-clamp-2" title={body}>
            {body}
          </p>
        );
      },
    }),
    columnHelper.accessor('variables', {
      header: 'Variáveis',
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {info.getValue().map((variable, index) => (
            <StatusBadge key={index} tone="neutral">
              {variable}
            </StatusBadge>
          ))}
        </div>
      ),
    }),
    columnHelper.accessor('twilioId', {
      header: 'Twilio ID',
      cell: (info) => (
        <code className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
          {info.getValue()}
        </code>
      ),
    }),
    columnHelper.accessor('_creationTime', {
      header: 'Criado em',
      cell: (info) => (
        <span className="text-sm text-muted-foreground">
          {new Date(info.getValue()).toLocaleDateString('pt-BR')}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ações',
      cell: (info) => (
        <div className="flex items-center space-x-1">
          {canManageUsers && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfiguringTemplate(info.row.original)}
                aria-label={`Configurar template ${info.row.original.name}`}
                title="Configurar template"
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingTemplate(info.row.original)}
                aria-label={`Excluir template ${info.row.original.name}`}
                title="Excluir template"
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    }),
  ], [canManageUsers]);

  const table = useReactTable({
    data: templates,
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
  });

  const handleDeleteTemplate = async (templateId: Id<"templates">) => {
    try {
      await deleteTemplate({ templateId });
      setDeletingTemplate(null);
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-foreground">Templates HSM</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Templates são criados e aprovados no Twilio. Aqui você os sincroniza e
            define de quais campos do participante cada variável é preenchida.
          </p>
          {lastSyncedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Última sincronização: {new Date(lastSyncedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        {canManageUsers && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Button onClick={() => void handleSync()} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar do Twilio'}
            </Button>
          </div>
        )}
      </div>

      {syncError && (
        <div
          role="alert"
          className="mt-4 rounded-md bg-destructive-muted p-4 text-sm text-destructive-muted-foreground"
        >
          {syncError}
        </div>
      )}

      {syncResult && (
        <div className="mt-4 rounded-md bg-info-muted p-4">
          <p className="text-sm text-info-muted-foreground">
            {syncResult.scanned} template(s) lidos no Twilio · {syncResult.created} novo(s) ·{' '}
            {syncResult.updated} atualizado(s)
            {syncResult.archived > 0 && ` · ${syncResult.archived} não existe(m) mais no Twilio`}
          </p>
          {syncResult.conflicts.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-info-muted-foreground">
              {syncResult.conflicts.map((conflict, index) => (
                <li key={index}>
                  <strong>{conflict.friendlyName}:</strong> {conflict.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <label htmlFor="templates-search" className="sr-only">
            Buscar templates
          </label>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            id="templates-search"
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-input rounded-md leading-5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            placeholder="Buscar templates..."
          />
        </div>
      </div>

      {/* Templates Table */}
      <div className="mt-6 flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-border sm:rounded-lg">
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
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
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
          </div>
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
                  {Math.min((pagination.pageIndex + 1) * pagination.pageSize, templates.length)}
                </span>{' '}
                de{' '}
                <span className="font-medium">{templates.length}</span>{' '}
                resultados
              </p>
            </div>
            <div>
              <nav
                aria-label="Paginação de templates"
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

      {/* Modals.
          Manual create/edit was removed: a template body typed here that Twilio has
          never seen cannot be sent, so the form could only ever mislead. Templates
          come from "Sincronizar do Twilio"; what stays editable is the variable
          mapping, in TemplateConfigModal. */}
      {deletingTemplate && (
        <DeleteConfirmationModal
          isOpen={!!deletingTemplate}
          onClose={() => setDeletingTemplate(null)}
          onConfirm={() => handleDeleteTemplate(deletingTemplate._id)}
          title="Excluir Template"
          message={`Tem certeza que deseja excluir o template "${deletingTemplate.name}"? Esta ação não pode ser desfeita.`}
        />
      )}

      {configuringTemplate && (
        <TemplateConfigModal
          isOpen={!!configuringTemplate}
          onClose={() => setConfiguringTemplate(null)}
          templateId={configuringTemplate._id}
        />
      )}
    </div>
  );
};
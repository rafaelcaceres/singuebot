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

const APPROVAL_STYLES: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  unsubmitted: 'bg-gray-100 text-gray-700',
  archived_remote: 'bg-orange-100 text-orange-800',
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
        <div className="font-medium text-gray-900">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('locale', {
      header: 'Idioma',
      cell: (info) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('approvalStatus', {
      header: 'Aprovação',
      cell: (info) => {
        const status = info.getValue() ?? 'unsubmitted';
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              APPROVAL_STYLES[status] ?? 'bg-gray-100 text-gray-700'
            }`}
          >
            {APPROVAL_LABELS[status] ?? status}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'body',
      header: 'Mensagem',
      cell: (info) => {
        const body = info.row.original.twilioStructure?.body;
        if (!body) return <span className="text-xs text-gray-400">—</span>;
        return (
          <p className="text-xs text-gray-600 max-w-sm line-clamp-2" title={body}>
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
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
            >
              {variable}
            </span>
          ))}
        </div>
      ),
    }),
    columnHelper.accessor('twilioId', {
      header: 'Twilio ID',
      cell: (info) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
          {info.getValue()}
        </code>
      ),
    }),
    columnHelper.accessor('_creationTime', {
      header: 'Criado em',
      cell: (info) => (
        <span className="text-sm text-gray-500">
          {new Date(info.getValue()).toLocaleDateString('pt-BR')}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ações',
      cell: (info) => (
        <div className="flex items-center space-x-2">
          {/* Temporarily showing buttons for testing - remove canManageUsers check */}
          <button
            onClick={() => setConfiguringTemplate(info.row.original)}
            className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
            title="Configurar template"
          >
            <Settings className="h-4 w-4" />
          </button>
          {canManageUsers && (
            <>

              <button
                onClick={() => setDeletingTemplate(info.row.original)}
                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                title="Excluir template"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
          <h1 className="text-2xl font-semibold text-gray-900">Templates HSM</h1>
          <p className="mt-2 text-sm text-gray-700">
            Templates são criados e aprovados no Twilio. Aqui você os sincroniza e
            define de quais campos do participante cada variável é preenchida.
          </p>
          {lastSyncedAt && (
            <p className="mt-1 text-xs text-gray-500">
              Última sincronização: {new Date(lastSyncedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        {canManageUsers && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => void handleSync()}
              disabled={isSyncing}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar do Twilio'}
            </button>
          </div>
        )}
      </div>

      {syncError && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {syncError}
        </div>
      )}

      {syncResult && (
        <div className="mt-4 rounded-md bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            {syncResult.scanned} template(s) lidos no Twilio · {syncResult.created} novo(s) ·{' '}
            {syncResult.updated} atualizado(s)
            {syncResult.archived > 0 && ` · ${syncResult.archived} não existe(m) mais no Twilio`}
          </p>
          {syncResult.conflicts.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-blue-800">
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
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Buscar templates..."
          />
        </div>
      </div>

      {/* Templates Table */}
      <div className="mt-6 flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
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
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
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
          </div>
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
                  {Math.min((pagination.pageIndex + 1) * pagination.pageSize, templates.length)}
                </span>{' '}
                de{' '}
                <span className="font-medium">{templates.length}</span>{' '}
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
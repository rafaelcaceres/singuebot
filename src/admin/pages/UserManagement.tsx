import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../components/PageHeader";
import { StatCluster } from "../components/StatCluster";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Edit, 
  Trash2, 
  Crown,
  Eye,
  Settings,
  Mail,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, usePermissions } from '../../hooks/useAuth';

type UserRole = 'owner' | 'editor' | 'viewer';

interface Organizer {
  _id: string;
  email: string;
  role: UserRole;
}

interface NewOrganizerForm {
  email: string;
  role: UserRole;
}

export const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { canManageUsers, isOwner } = usePermissions();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingOrganizer, setEditingOrganizer] = useState<Organizer | null>(null);
  const [newOrganizer, setNewOrganizer] = useState<NewOrganizerForm>({
    email: '',
    role: 'viewer'
  });

  // Queries
  const organizers = useQuery(api.admin.getOrganizers) || [];

  // Mutations
  const upsertOrganizer = useMutation(api.admin.upsertOrganizer);
  const deleteOrganizer = useMutation(api.admin.deleteOrganizer);

  const handleAddOrganizer = async () => {
    if (!newOrganizer.email.trim()) {
      toast.error("Email obrigatório", {
        description: "Por favor, insira um email válido.",
      });
      return;
    }

    try {
      await upsertOrganizer({
        email: newOrganizer.email.trim().toLowerCase(),
        role: newOrganizer.role,
      });

      toast.success("Organizador adicionado", {
        description: `${newOrganizer.email} foi adicionado com o papel ${getRoleLabel(newOrganizer.role)}.`,
      });

      setNewOrganizer({ email: '', role: 'viewer' });
      setIsAddDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao adicionar organizador", {
        description: "Não foi possível adicionar o organizador. Tente novamente.",
      });
    }
  };

  const handleUpdateOrganizer = async (organizerId: string, role: UserRole) => {
    const organizer = organizers.find(o => o._id === organizerId);
    if (!organizer) return;

    try {
      await upsertOrganizer({
        email: organizer.email,
        role: role,
      });

      toast.success("Papel atualizado", {
        description: `O papel de ${organizer.email} foi alterado para ${getRoleLabel(role)}.`,
      });

      setEditingOrganizer(null);
    } catch (error) {
      toast.error("Erro ao atualizar papel", {
        description: "Não foi possível atualizar o papel do organizador.",
      });
    }
  };

  const handleDeleteOrganizer = async (organizerId: string) => {
    try {
      await deleteOrganizer({ organizerId: organizerId as any });

      toast.success("Organizador removido", {
        description: "O organizador foi removido com sucesso.",
      });
    } catch (error) {
      toast.error("Erro ao remover organizador", {
        description: "Não foi possível remover o organizador.",
      });
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-warning" />;
      case 'editor':
        return <Edit className="h-4 w-4 text-primary" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'Proprietário';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Visualizador';
    }
  };

  const getRoleTone = (role: UserRole): StatusTone => {
    switch (role) {
      case 'owner':
        return 'warning';
      case 'editor':
        return 'info';
      case 'viewer':
        return 'neutral';
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'Acesso total ao sistema, incluindo gerenciamento de usuários e configurações';
      case 'editor':
        return 'Pode editar conteúdo, gerenciar participantes e acessar relatórios';
      case 'viewer':
        return 'Acesso somente leitura aos dados e relatórios';
    }
  };

  const roleStats = useMemo(() => {
    const stats = {
      owner: organizers.filter(o => o.role === 'owner').length,
      editor: organizers.filter(o => o.role === 'editor').length,
      viewer: organizers.filter(o => o.role === 'viewer').length,
    };
    return stats;
  }, [organizers]);

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Acesso Restrito</h3>
          <p className="text-muted-foreground">
            Você não tem permissão para gerenciar usuários.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Organizadores e suas permissões no console."
        actions={
          isOwner && (
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Organizador
            </Button>
          )
        }
      />

      <StatCluster
        stats={[
          { label: "Organizadores", value: organizers.length, icon: Users },
          { label: "Proprietários", value: roleStats.owner, icon: Crown, tone: "warning" },
          { label: "Editores", value: roleStats.editor, icon: Edit, tone: "primary" },
          { label: "Visualizadores", value: roleStats.viewer, icon: Eye, tone: "muted" },
        ]}
      />

      {/* Organizers List */}
      <Card>
        <CardHeader>
          <CardTitle>Organizadores do Sistema</CardTitle>
          <CardDescription>
            Lista de todos os organizadores e suas permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhum organizador encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione organizadores para começar a gerenciar o sistema
              </p>
              {isOwner && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Organizador
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {organizers.map((organizer) => (
                <div
                  key={organizer._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(organizer.role)}
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{organizer.email}</h4>
                        {user?.email === organizer.email && (
                          <StatusBadge tone="neutral">Você</StatusBadge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getRoleDescription(organizer.role)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <StatusBadge tone={getRoleTone(organizer.role)} dot>
                      {getRoleLabel(organizer.role)}
                    </StatusBadge>
                    
                    {isOwner && user?.email !== organizer.email && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingOrganizer(organizer)}
                          aria-label={`Editar papel de ${organizer.email}`}
                          title="Editar papel"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void handleDeleteOrganizer(organizer._id);
                          }}
                          aria-label={`Remover organizador ${organizer.email}`}
                          title="Remover organizador"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle>Permissões por Papel</CardTitle>
          <CardDescription>
            Entenda o que cada papel pode fazer no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Crown className="h-5 w-5 text-warning" />
                <h3 className="font-semibold">Proprietário</h3>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Gerenciar usuários e permissões</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Configurações do sistema</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Excluir dados permanentemente</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Todas as funcionalidades</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Edit className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Editor</h3>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Editar conteúdo e templates</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Gerenciar participantes</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Importar dados CSV</span>
                </li>
                <li className="flex items-center space-x-2">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span>Sem acesso a configurações</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Visualizador</h3>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Ver relatórios e analytics</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Visualizar conversas</span>
                </li>
                <li className="flex items-center space-x-2">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span>Sem permissão de edição</span>
                </li>
                <li className="flex items-center space-x-2">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span>Sem acesso a configurações</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Organizer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Organizador</DialogTitle>
            <DialogDescription>
              Adicione um novo organizador ao sistema. Ele poderá acessar o painel administrativo com as permissões do papel selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={newOrganizer.email}
                onChange={(e) => setNewOrganizer({ ...newOrganizer, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Papel</Label>
              <Select
                value={newOrganizer.role}
                onValueChange={(value: UserRole) => setNewOrganizer({ ...newOrganizer, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center space-x-2">
                      <Crown className="h-4 w-4 text-warning" />
                      <span>Proprietário</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex items-center space-x-2">
                      <Edit className="h-4 w-4 text-primary" />
                      <span>Editor</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span>Visualizador</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getRoleDescription(newOrganizer.role)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddOrganizer}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organizer Dialog */}
      <Dialog open={!!editingOrganizer} onOpenChange={(open) => !open && setEditingOrganizer(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Papel</DialogTitle>
            <DialogDescription>
              Altere o papel de {editingOrganizer?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Papel</Label>
              <Select
                value={editingOrganizer?.role || "viewer"}
                onValueChange={(value: UserRole) => {
                  if (editingOrganizer) {
                    void handleUpdateOrganizer(editingOrganizer._id, value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center space-x-2">
                      <Crown className="h-4 w-4 text-warning" />
                      <span>Proprietário</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex items-center space-x-2">
                      <Edit className="h-4 w-4 text-primary" />
                      <span>Editor</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span>Visualizador</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getRoleDescription(editingOrganizer?.role || "viewer")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrganizer(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
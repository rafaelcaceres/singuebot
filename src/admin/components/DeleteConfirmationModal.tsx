import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  isLoading?: boolean;
  /**
   * The confirm button's label. Defaults to the destructive wording, but a
   * confirmation is not always a deletion — a button that says "Excluir" for a
   * reindex is lying about what it does.
   */
  confirmLabel?: string;
  loadingLabel?: string;
  /** `destructive` (default) tints the title and the confirm button red. */
  tone?: 'destructive' | 'default';
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
  confirmLabel,
  loadingLabel,
  tone = 'destructive',
}) => {
  const isDestructive = tone === 'destructive';
  const confirmText = confirmLabel ?? (isDestructive ? 'Excluir' : 'Confirmar');
  const busyText = loadingLabel ?? (isDestructive ? 'Excluindo...' : 'Processando...');

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Surfaced rather than swallowed into the console: the dialog stays open
      // so the person can retry or cancel.
      toast.error('A ação não pôde ser concluída', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className={isDestructive ? 'text-destructive' : undefined}>
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={() => void handleConfirm()}
            disabled={isLoading}
          >
            {isLoading ? busyText : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

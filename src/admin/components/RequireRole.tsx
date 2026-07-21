import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/admin';

/**
 * Route-level role gate, mirroring the `roles` already declared per nav item.
 *
 * Until now the sidebar hid restricted pages while their URLs stayed reachable
 * by anyone who typed them. Like `RequireFlag`, this is a UI concern — the
 * Convex functions remain the real authorization boundary.
 *
 * Note the bootstrap path: with an empty `organizers` table the first
 * authenticated user is reported as owner, so nobody gets locked out of /users
 * before they can add themselves.
 */
export const RequireRole: React.FC<{
  roles: UserRole[];
  children: React.ReactNode;
}> = ({ roles, children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!user?.role || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserRole } from "../types/admin";

export interface AuthUser {
  _id: string;
  email?: string;
  role?: UserRole;
  name?: string;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (requiredRole: UserRole | UserRole[]) => boolean;
  canAccess: (requiredRoles: UserRole[]) => boolean;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function useAuth(): UseAuthReturn {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  
  // Fetch organizer role based on user email
  const organizer = useQuery(
    api.admin.getOrganizerByEmail,
    loggedInUser?.email ? { email: loggedInUser.email } : "skip"
  );

  const isLoading = convexAuthLoading || 
    (isAuthenticated && loggedInUser === undefined) ||
    Boolean(loggedInUser?.email && organizer === undefined);

  // Transform Convex user to our AuthUser interface
  const user: AuthUser | null = loggedInUser ? {
    _id: loggedInUser._id,
    email: loggedInUser.email,
    role: organizer?.role || "viewer", // Get role from organizers table
    name: loggedInUser.name,
  } : null;

  /**
   * Check if user has a specific role or higher in the hierarchy
   */
  const hasRole = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user?.role) return false;

    const userRoleLevel = ROLE_HIERARCHY[user.role];
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.some(role => userRoleLevel >= ROLE_HIERARCHY[role]);
    }
    
    return userRoleLevel >= ROLE_HIERARCHY[requiredRole];
  };

  /**
   * Check if user can access features requiring specific roles
   */
  const canAccess = (requiredRoles: UserRole[]): boolean => {
    if (!user?.role) return false;
    return requiredRoles.includes(user.role);
  };

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(isAuthenticated && user),
    hasRole,
    canAccess,
  };
}

/**
 * Hook for checking specific permissions based on user role
 */
export function usePermissions() {
  const { user, hasRole } = useAuth();

  return {
    canManageUsers: hasRole(["owner", "editor"]),
    canViewAnalytics: hasRole(["owner", "editor", "viewer"]),
    canExportData: hasRole(["owner", "editor"]),
    canManageSettings: hasRole("owner"),
    canImportCSV: hasRole(["owner", "editor"]),
    canDeleteData: hasRole("owner"),
    isOwner: user?.role === "owner",
    isEditor: user?.role === "editor",
    isViewer: user?.role === "viewer",
  };
}
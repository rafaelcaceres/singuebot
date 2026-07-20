import React from 'react';
import { useQuery } from 'convex/react';
import { Navigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';

type FeatureFlag = 'enableTemplates' | 'enableBroadcasts' | 'enableCSVImport' |
  'enableInterview' | 'enableClustering' | 'enableParticipantRAG' | 'enableRAG';

/**
 * Route-level feature gate.
 *
 * Navigation already filtered links by flag, but the routes themselves were
 * unguarded, so a disabled page stayed reachable by typing its URL. This is still
 * only a UI concern — the server-side check inside createBroadcast is what actually
 * enforces the flag.
 */
export const RequireFlag: React.FC<{
  flag: FeatureFlag;
  children: React.ReactNode;
}> = ({ flag, children }) => {
  const flags = useQuery(api.functions.botConfig.getFeatureFlags);

  if (flags === undefined) {
    return <div className="p-8 text-sm text-gray-500">Carregando...</div>;
  }

  if (!flags[flag]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

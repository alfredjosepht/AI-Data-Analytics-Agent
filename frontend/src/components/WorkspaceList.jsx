import { useEffect, useState } from "react";
import { listWorkspaces, activateWorkspace, profileWorkspace } from "../services/api";
import { Folder, Database, FileText, CheckCircle2, Edit2, Copy, Trash2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function WorkspaceList({ 
  activeWorkspaceId, 
  onWorkspaceActivated, 
  refreshTrigger,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  collapsed = false
}) {
  const [workspaces, setWorkspaces] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadingProfiles, setLoadingProfiles] = useState({});

  const loadWorkspaces = async () => {
    try {
      const res = await listWorkspaces();
      setWorkspaces(res.workspaces || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [refreshTrigger]);

  // Load profiles/metadata concurrently in the background using state-safe updates
  useEffect(() => {
    if (workspaces.length === 0) return;

    const fetchProfiles = async () => {
      // Filter out workspaces that already have profiles or are currently loading
      const missing = workspaces.filter(ws => !profiles[ws.id] && !loadingProfiles[ws.id]);
      if (missing.length === 0) return;

      // Mark them as loading
      setLoadingProfiles(prev => {
        const next = { ...prev };
        missing.forEach(ws => { next[ws.id] = true; });
        return next;
      });

      try {
        const results = await Promise.all(
          missing.map(async (ws) => {
            try {
              const res = await profileWorkspace(ws.id);
              if (res.status === "success" && res.profile) {
                return { id: ws.id, profile: res.profile };
              }
            } catch (e) {
              console.error(`Failed to load profile for workspace ${ws.id}:`, e);
            }
            return null;
          })
        );

        // Save profiles in state
        setProfiles(prev => {
          const next = { ...prev };
          results.forEach(r => {
            if (r) next[r.id] = r.profile;
          });
          return next;
        });
      } finally {
        // Clear loading indicators
        setLoadingProfiles(prev => {
          const next = { ...prev };
          missing.forEach(ws => { next[ws.id] = false; });
          return next;
        });
      }
    };

    fetchProfiles();
  }, [workspaces]);

  const handleActivate = async (id) => {
    try {
      const res = await activateWorkspace(id);
      if (res.status === "success") {
        const fullWs = workspaces.find((w) => w.id === id);
        const enrichedWs = {
          ...fullWs,
          row_count: profiles[id]?.row_count || fullWs.row_count,
          overall_score: profiles[id]?.overall_score || fullWs.overall_score
        };
        onWorkspaceActivated?.(enrichedWs);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to activate workspace");
    }
  };

  const getIcon = (filename, isActive) => {
    const ext = filename ? filename.split('.').pop().toLowerCase() : "";
    const colorClass = isActive ? "text-brand-lime" : "text-brand-muted group-hover:text-white";
    if (["csv", "xls", "xlsx", "tsv", "parquet", "json"].includes(ext)) {
      return <Database className={`h-4 w-4 shrink-0 transition-colors ${colorClass}`} />;
    }
    return <FileText className={`h-4 w-4 shrink-0 transition-colors ${colorClass}`} />;
  };

  const getFileBadge = (filename) => {
    const ext = filename ? filename.split('.').pop().toUpperCase() : "";
    if (!ext) return null;
    return (
      <span className="text-[8px] font-extrabold px-1 py-0.5 rounded border border-brand-border bg-brand-input text-brand-dimmed tracking-wider font-mono shrink-0">
        {ext}
      </span>
    );
  };

  const getQualityBadge = (score) => {
    if (score === undefined || score === null) return null;
    let color = "text-brand-lime bg-brand-lime/10 border-brand-lime/20";
    if (score < 50) color = "text-brand-error bg-brand-error/10 border-brand-error/20";
    else if (score < 80) color = "text-brand-warning bg-brand-warning/10 border-brand-warning/20";

    return (
      <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded border tracking-wider font-mono shrink-0 flex items-center gap-0.5 ${color}`}>
        <ShieldCheck className="h-2 w-2 shrink-0" />
        {Math.round(score)}%
      </span>
    );
  };

  const getRowCountBadge = (count) => {
    if (count === undefined || count === null) return null;
    let formatted = count;
    if (count >= 1000000) {
      formatted = `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      formatted = `${(count / 1000).toFixed(1)}k`;
    }
    return (
      <span className="text-[8px] text-brand-dimmed font-mono bg-brand-card/80 px-1 py-0.5 rounded border border-brand-border/40 shrink-0">
        {formatted} rows
      </span>
    );
  };

  if (collapsed) {
    return (
      <div className="space-y-4 flex flex-col items-center">
        <Folder className="h-4.5 w-4.5 text-brand-lime" title="Workspaces" />
        <div className="space-y-3 w-full flex flex-col items-center">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <button
                key={ws.id}
                onClick={() => handleActivate(ws.id)}
                className={`relative p-2 rounded-lg border transition-all duration-300 group cursor-pointer ${
                  isActive
                    ? "bg-brand-lime/10 border-brand-lime shadow-[0_0_15px_rgba(184,255,44,0.2)] scale-110"
                    : "bg-brand-card border-brand-border hover:border-brand-muted hover:scale-105"
                }`}
                title={`${ws.name?.toUpperCase() || "WORKSPACE"} (${ws.file_name || ""})`}
              >
                {getIcon(ws.file_name, isActive)}
                {isActive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-lime shadow-lg" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <div className="flex items-center gap-2 text-brand-muted px-1 shrink-0">
        <Folder className="h-4 w-4 text-brand-lime" />
        <span className="text-xs font-black uppercase tracking-wider">
          Active Workspaces
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {workspaces.length === 0 ? (
          <p className="text-xs text-brand-dimmed italic px-2">No active workspaces.</p>
        ) : (
          <AnimatePresence initial={false}>
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const profile = profiles[ws.id];
              
              return (
                <motion.div
                  key={ws.id}
                  layoutId={`ws-card-${ws.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`group flex flex-col p-3 rounded-lg border transition-all duration-200 relative overflow-hidden cursor-pointer ${
                    isActive
                      ? "bg-brand-card border-brand-lime shadow-[0_0_20px_rgba(184,255,44,0.12)] scale-[1.01]"
                      : "bg-brand-card border-brand-border hover:bg-brand-card-hover hover:border-brand-muted/30"
                  }`}
                  onClick={() => handleActivate(ws.id)}
                >
                  {/* Top: Header Info */}
                  <div className="flex items-start justify-between min-w-0 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-16">
                      {getIcon(ws.file_name, isActive)}
                      <div className="min-w-0">
                        <p className={`text-xs font-black truncate transition-colors flex items-center gap-1 ${
                          isActive ? "text-brand-lime" : "text-white group-hover:text-brand-lime"
                        }`}>
                          {ws.name?.toUpperCase() || "WORKSPACE"}
                          {isActive && (
                            <CheckCircle2 className="h-3 w-3 text-brand-lime shrink-0" />
                          )}
                        </p>
                        <p className="text-[10px] text-brand-dimmed truncate font-medium">
                          {ws.file_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Badges Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {getFileBadge(ws.file_name)}
                    {profile && getRowCountBadge(profile.row_count)}
                    {profile && getQualityBadge(profile.overall_score)}
                    {!profile && loadingProfiles[ws.id] && (
                      <span className="h-3 w-10 rounded shimmer-placeholder inline-block" />
                    )}
                  </div>

                  {/* Action Control Bar - Always Visible */}
                  <div className="absolute right-2 top-2 flex items-center gap-1 bg-brand-card/90 border border-brand-border/60 rounded px-1.5 py-0.5 shadow-md">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRenameWorkspace?.(ws); }}
                      title="Rename Workspace"
                      className="p-1 rounded text-brand-muted hover:text-brand-lime hover:bg-brand-sidebar/55 transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicateWorkspace?.(ws); }}
                      title="Duplicate Workspace"
                      className="p-1 rounded text-brand-muted hover:text-brand-success hover:bg-brand-sidebar/55 transition-colors cursor-pointer"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteWorkspace?.(ws); }}
                      title="Delete Workspace"
                      className="p-1 rounded text-brand-muted hover:text-brand-error hover:bg-brand-sidebar/55 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default WorkspaceList;

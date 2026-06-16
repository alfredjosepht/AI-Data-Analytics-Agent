import { useEffect, useState } from "react";
import { listWorkspaces, activateWorkspace } from "../services/api";
import { Folder, Database, FileText, CheckCircle2, Edit2, Copy, Trash2 } from "lucide-react";

function WorkspaceList({ 
  activeWorkspaceId, 
  onWorkspaceActivated, 
  refreshTrigger,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onDeleteWorkspace
}) {
  const [workspaces, setWorkspaces] = useState([]);

  const loadWorkspaces = async () => {
    try {
      const res = await listWorkspaces();
      setWorkspaces(res.workspaces);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [refreshTrigger]);

  const handleActivate = async (id) => {
    try {
      const res = await activateWorkspace(id);
      if (res.status === "success") {
        const fullWs = workspaces.find((w) => w.id === id);
        onWorkspaceActivated?.(fullWs);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to activate workspace");
    }
  };

  const getIcon = (filename) => {
    const ext = filename?.split('.').pop().toLowerCase();
    if (["csv", "xls", "xlsx", "tsv", "parquet", "json"].includes(ext)) {
      return <Database className="h-4 w-4 text-emerald-400 shrink-0" />;
    }
    return <FileText className="h-4 w-4 text-blue-400 shrink-0" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-slate-400 px-1">
        <Folder className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Active Workspaces
        </span>
      </div>

      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
        {workspaces.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-2">No active workspaces.</p>
        ) : (
          workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div
                key={ws.id}
                className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-500/5"
                    : "bg-[#0f172a]/40 border-slate-800/60 hover:bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                <div 
                  onClick={() => handleActivate(ws.id)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  {getIcon(ws.file_name)}
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate transition-colors ${
                      isActive ? "text-blue-400" : "text-slate-200 group-hover:text-white"
                    }`}>
                      {ws.name.toUpperCase()}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {ws.file_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRenameWorkspace?.(ws); }}
                    title="Rename Workspace"
                    className="p-1 rounded text-slate-400 hover:text-blue-450 hover:bg-slate-800/60 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicateWorkspace?.(ws); }}
                    title="Duplicate Workspace"
                    className="p-1 rounded text-slate-400 hover:text-green-450 hover:bg-slate-800/60 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteWorkspace?.(ws); }}
                    title="Delete Workspace"
                    className="p-1 rounded text-slate-400 hover:text-red-450 hover:bg-slate-800/60 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {isActive && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default WorkspaceList;


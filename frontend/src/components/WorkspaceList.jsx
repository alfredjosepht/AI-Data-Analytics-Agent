import { useEffect, useState } from "react";
import { listWorkspaces, activateWorkspace } from "../services/api";
import { Folder, Database, FileText, CheckCircle2 } from "lucide-react";

function WorkspaceList({ activeWorkspaceId, onWorkspaceActivated, refreshTrigger }) {
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
        // Find full workspace details and refresh
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
                onClick={() => handleActivate(ws.id)}
                className={`group flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-500/5"
                    : "bg-[#0f172a]/40 border-slate-800/60 hover:bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
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
                {isActive && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default WorkspaceList;

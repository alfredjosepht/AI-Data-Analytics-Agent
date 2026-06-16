import { useEffect, useState } from "react";
import WorkspaceList from "./components/WorkspaceList";
import UploadPanel from "./components/UploadPanel";
import ChatPanel from "./components/ChatPanel";
import ResultTable from "./components/ResultTable";
import SqlViewer from "./components/SqlViewer";
import ChartView from "./components/ChartView";
import { 
  getActiveWorkspace, 
  exportWorkspacePdf, 
  exportWorkspacePptx,
  profileWorkspace,
  getWorkspaceVersions,
  rollbackWorkspaceVersion,
  createSchedule,
  listSchedules,
  deleteSchedule,
  listReports,
  cleanWorkspace,
  exportWorkspaceCsv,
  exportWorkspaceExcel,
  renameWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  exportWorkspaceDocx,
  exportWorkspaceHtml,
  listWorkspaces,
  getChatMessages,
  exportReportWizard
} from "./services/api";
import { 
  Bot, 
  Layers, 
  Activity, 
  FileText, 
  Clock, 
  Plus, 
  Download, 
  Trash2,
  FileSpreadsheet,
  X,
  Wand2,
  Sun,
  Moon,
  Search,
  AlertTriangle
} from "lucide-react";

function App() {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [versions, setVersions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [reports, setReports] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schName, setSchName] = useState("");
  const [schQuery, setSchQuery] = useState("");
  const [schFreq, setSchFreq] = useState("daily");
  const [schCron, setSchCron] = useState("");

  const [response, setResponse] = useState(null);
  const [workspaceRefreshTrigger, setWorkspaceRefreshTrigger] = useState(0);

  const [selectedCleaningActions, setSelectedCleaningActions] = useState([]);
  const [cleaningLoading, setCleaningLoading] = useState(false);

  // Advanced States
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [toasts, setToasts] = useState([]);
  const [wsToRename, setWsToRename] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [wsToDelete, setWsToDelete] = useState(null);
  const [showCleaningConfirmModal, setShowCleaningConfirmModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStep, setExportStep] = useState(1);
  const [wizardChatLog, setWizardChatLog] = useState([]);
  const [exportConfig, setExportConfig] = useState({
    include_dataset_summary: true,
    include_query_results: true,
    include_sql: true,
    include_insights: true,
    include_charts: true,
    include_tables: true,
    scope: "session",
    format: "pdf"
  });

  const openExportWizard = async (format) => {
    setExportConfig(prev => ({ ...prev, format }));
    setExportStep(1);
    setShowExportModal(true);
    
    try {
      const res = await getChatMessages(activeWorkspaceId);
      if (res.status === "success" && res.chat_messages) {
        setWizardChatLog(res.chat_messages);
      }
    } catch (err) {
      console.error("Failed to load chat history for preview", err);
    }
  };

  const handleWizardExport = async () => {
    try {
      showToast(`Generating ${exportConfig.format.toUpperCase()} report...`);
      setShowExportModal(false);
      await exportReportWizard(activeWorkspaceId, exportConfig);
      showToast("Report exported successfully!");
      loadReports(activeWorkspaceId);
    } catch (err) {
      console.error(err);
      showToast("Failed to export report.", "error");
    }
  };

  const getPreviewCounts = () => {
    const assistantMsgs = wizardChatLog.filter(m => m.role === "assistant");
    const targetMsgs = exportConfig.scope === "current" 
      ? assistantMsgs.slice(-1) 
      : assistantMsgs;
      
    let queryCount = targetMsgs.length;
    let chartCount = 0;
    let tableCount = 0;
    
    targetMsgs.forEach(m => {
      if (m.chart) chartCount++;
      if (m.result && m.result.length > 0) tableCount++;
    });
    
    return {
      queryCount,
      chartCount,
      tableCount
    };
  };

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K -> Search workspaces
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      // Ctrl+E -> Export report (PDF)
      if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (activeWorkspaceId) {
          exportWorkspacePdf(activeWorkspaceId);
          showToast("PDF report export initiated!");
        } else {
          showToast("Please activate a workspace to export reports.", "error");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeWorkspaceId]);

  const loadActiveWorkspace = async () => {
    try {
      const res = await getActiveWorkspace();
      if (res.workspace) {
        const wsId = res.workspace.id || res.workspace.workspace_id;
        setActiveWorkspace(res.workspace);
        setActiveWorkspaceId(wsId);
        if (wsId) {
          loadProfile(wsId);
          loadVersions(wsId);
          loadSchedules(wsId);
          loadReports(wsId);
        }
      } else {
        setActiveWorkspace(null);
        setActiveWorkspaceId(null);
        setProfile(null);
        setVersions([]);
      }
    } catch (err) {
      console.error("Failed to load active workspace", err);
    }
  };

  const loadWorkspacesList = async () => {
    try {
      const res = await listWorkspaces();
      if (res.workspaces) {
        setWorkspaces(res.workspaces);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadProfile = async (id) => {
    try {
      const res = await profileWorkspace(id);
      if (res.status === "success") {
        setProfile(res.profile);
        if (res.profile && res.profile.profile && res.profile.profile.recommendations) {
          setSelectedCleaningActions(res.profile.profile.recommendations.map(r => r.id));
        } else {
          setSelectedCleaningActions([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadVersions = async (id) => {
    try {
      const res = await getWorkspaceVersions(id);
      if (res.status === "success") {
        setVersions(res.versions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchedules = async (id) => {
    try {
      const res = await listSchedules(id);
      if (res.status === "success") {
        setSchedules(res.schedules);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadReports = async (id) => {
    try {
      const res = await listReports(id);
      if (res.status === "success") {
        setReports(res.reports);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadActiveWorkspace();
    loadWorkspacesList();
  }, [workspaceRefreshTrigger]);

  const handleWorkspaceActivated = (ws) => {
    const wsId = ws.id || ws.workspace_id;
    setActiveWorkspace(ws);
    setActiveWorkspaceId(wsId);
    setResponse(null);
    if (wsId) {
      loadProfile(wsId);
      loadVersions(wsId);
      loadSchedules(wsId);
      loadReports(wsId);
    }
  };

  const handleRollback = async (versionNum) => {
    if (!activeWorkspaceId) return;
    if (window.confirm(`Are you sure you want to rollback to version ${versionNum}?`)) {
      try {
        const res = await rollbackWorkspaceVersion(activeWorkspaceId, versionNum);
        if (res.status === "success") {
          showToast(`Rolled back successfully to version ${versionNum}!`);
          setWorkspaceRefreshTrigger(prev => prev + 1);
        }
      } catch (err) {
        console.error(err);
        showToast("Failed to roll back version.", "error");
      }
    }
  };

  const handleApplyCleaningFromSidebar = () => {
    if (selectedCleaningActions.length === 0) return;
    setShowCleaningConfirmModal(true);
  };

  const executeCleaning = async () => {
    if (!activeWorkspaceId) return;
    setCleaningLoading(true);
    setShowCleaningConfirmModal(false);
    try {
      const res = await cleanWorkspace(activeWorkspaceId, selectedCleaningActions);
      if (res.status === "success") {
        showToast("Data cleaning successfully applied!");
        setWorkspaceRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to apply cleaning actions.", "error");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await createSchedule(activeWorkspaceId, schName, schQuery, schFreq, schCron);
      if (res.status === "success") {
        showToast("Report schedule created successfully!");
        setShowScheduleModal(false);
        setSchName("");
        setSchQuery("");
        setSchFreq("daily");
        setSchCron("");
        loadSchedules(activeWorkspaceId);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to create schedule.", "error");
    }
  };

  const handleDeleteSchedule = async (sid) => {
    try {
      await deleteSchedule(sid);
      showToast("Schedule deleted.");
      loadSchedules(activeWorkspaceId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!wsToRename || !renameVal.trim()) return;
    try {
      await renameWorkspace(wsToRename.id, renameVal.trim());
      showToast(`Workspace renamed to "${renameVal.trim()}"`);
      setWsToRename(null);
      setRenameVal("");
      setWorkspaceRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast("Failed to rename workspace", "error");
    }
  };

  const handleDuplicateWorkspace = async (ws) => {
    try {
      showToast("Duplicating workspace...");
      const res = await duplicateWorkspace(ws.id);
      if (res.status === "success") {
        showToast("Workspace duplicated successfully!");
        setWorkspaceRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to duplicate workspace", "error");
    }
  };

  const handleConfirmDeleteWorkspace = async () => {
    if (!wsToDelete) return;
    try {
      await deleteWorkspace(wsToDelete.id);
      showToast(`Workspace "${wsToDelete.name.toUpperCase()}" deleted permanently.`);
      setWsToDelete(null);
      setWorkspaceRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete workspace", "error");
    }
  };

  const getQualityColor = (score) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const filteredWorkspaces = workspaces.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-[#080b11] text-[#e2e8f0] text-xs">
      {/* 1. Left Sidebar */}
      <aside className="w-80 shrink-0 border-r border-slate-900 bg-[#0c1017]/85 backdrop-blur-md p-5 flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xs font-extrabold uppercase tracking-widest text-white leading-tight">
                  AI-Data-Analytics-Agent
                </h1>
                <p className="text-[9px] text-slate-500">Intelligent Analysis Platform</p>
              </div>
            </div>

            {/* Dark/Light Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-lg border border-slate-800 bg-[#0c1017] hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
              title="Toggle Dark/Light Mode"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Ctrl+K Search Bar Trigger */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-850 bg-slate-950/40 text-slate-500 hover:border-slate-800 hover:text-slate-400 transition-all text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Search workspaces...
            </span>
            <kbd className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">Ctrl+K</kbd>
          </button>

          <WorkspaceList
            activeWorkspaceId={activeWorkspaceId}
            onWorkspaceActivated={handleWorkspaceActivated}
            refreshTrigger={workspaceRefreshTrigger}
            onRenameWorkspace={(ws) => { setWsToRename(ws); setRenameVal(ws.name); }}
            onDuplicateWorkspace={handleDuplicateWorkspace}
            onDeleteWorkspace={(ws) => setWsToDelete(ws)}
          />

          <UploadPanel
            workspaces={workspaces}
            setUploadInfo={handleWorkspaceActivated}
            onUploadSuccess={() => setWorkspaceRefreshTrigger((prev) => prev + 1)}
            showToast={showToast}
          />

          {activeWorkspace && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  Scheduled Jobs
                </span>
                <button 
                  onClick={() => setShowScheduleModal(true)}
                  className="p-1 rounded bg-[#0f172a] hover:bg-slate-800 border border-slate-800 text-blue-400 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              <div className="max-h-[130px] overflow-y-auto space-y-1.5 pr-1">
                {schedules.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic px-1">No scheduled reports.</p>
                ) : (
                  schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-[#0f172a]/60 border border-slate-800 rounded">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-300 truncate text-[11px]">{s.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">Next: {s.next_run || "N/A"}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-900/60 text-center">
          <p className="text-[9px] text-slate-500 font-medium">AI-Data-Analytics-Agent Platform v1.2.0 • Gemini 3.5 Flash</p>
        </div>
      </aside>

      {/* 2. Center Panel */}
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {activeWorkspace ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight uppercase">
                  WORKSPACE: {activeWorkspace.name}
                </h2>
                <p className="text-[10px] text-slate-400">
                  DuckDB Engine • Source: {activeWorkspace.file_name}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openExportWizard("pdf")}
                  className="bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  PDF Report
                </button>
                <button
                  onClick={() => openExportWizard("pptx")}
                  className="bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-orange-400" />
                  PPTX Slides
                </button>
                <button
                  onClick={() => { exportWorkspaceDocx(activeWorkspaceId); showToast("Generating DOCX document..."); }}
                  className="bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-400" />
                  DOCX Report
                </button>
                <button
                  onClick={() => { exportWorkspaceHtml(activeWorkspaceId); showToast("Generating HTML file..."); }}
                  className="bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-red-400" />
                  HTML Report
                </button>
                <button
                  onClick={() => { exportWorkspaceCsv(activeWorkspaceId); showToast("Downloading CSV..."); }}
                  className="bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-green-400" />
                  CSV Data
                </button>
                <button
                  onClick={() => openExportWizard("excel")}
                  className="bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  Excel Data
                </button>
              </div>
            </div>

            <ChatPanel workspaceId={activeWorkspaceId} setResponse={setResponse} />
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500">
              <Bot className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">No active workspace</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Upload or select a dataset inside the Left Sidebar to initiate analytics.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 3. Right Sidebar */}
      {activeWorkspace && (
        <aside className="w-80 shrink-0 border-l border-slate-900 bg-[#0c1017]/85 backdrop-blur-md p-5 overflow-y-auto space-y-5">
          {/* Data Quality Score Card */}
          {profile && profile.profile && (
            <div className="glass-panel p-4 border border-slate-800/80 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" />
                Data Quality Score
              </h3>
              
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full border-2 border-slate-800 flex items-center justify-center shrink-0 bg-slate-950">
                  <span className={`text-xs font-extrabold ${getQualityColor(profile.profile.overall_score)}`}>
                    {Math.round(profile.profile.overall_score)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-350">
                    Rating: {profile.profile.overall_score >= 80 ? "Premium" : profile.profile.overall_score >= 50 ? "Moderate" : "Poor"}
                  </p>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Audited empty rows, duplicates, and numeric outliers.
                  </p>
                </div>
              </div>

              {profile.profile.issues && profile.profile.issues.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-850">
                  <p className="text-[9px] font-bold text-slate-400">Issues Logged:</p>
                  <ul className="text-[9px] text-slate-400 space-y-0.5">
                    {profile.profile.issues.map((iss, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-red-400 shrink-0">•</span>
                        <span>{iss}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Data Cleaning Recommendations Card */}
          {profile && profile.profile && (
            <div className="glass-panel p-4 border border-slate-800/80 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wand2 className="h-4 w-4 text-indigo-400" />
                Data Cleaning Control
              </h3>
              
              {profile.profile.recommendations && profile.profile.recommendations.length > 0 ? (
                <>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    Select recommended corrections to apply:
                  </p>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {profile.profile.recommendations.map((rec) => (
                      <label 
                        key={rec.id} 
                        className="flex items-start gap-2 p-2 bg-[#0c1017] border border-slate-900 rounded hover:border-slate-800 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCleaningActions.includes(rec.id)}
                          onChange={() => {
                            setSelectedCleaningActions((prev) =>
                              prev.includes(rec.id)
                                ? prev.filter((id) => id !== rec.id)
                                : [...prev, rec.id]
                            );
                          }}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                        />
                        <div className="text-[9px]">
                          <span className="font-semibold text-slate-200">{rec.description}</span>
                          <span className="block text-[8px] text-slate-500 mt-0.5">Impact: {rec.impact}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleApplyCleaningFromSidebar}
                    disabled={selectedCleaningActions.length === 0 || cleaningLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-1.5 rounded transition-colors text-[10px] flex items-center justify-center gap-1.5"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {cleaningLoading ? "Cleaning..." : "Apply Selected Fixes"}
                  </button>
                </>
              ) : (
                <div className="text-[10px] text-slate-500 italic p-2.5 bg-slate-950/20 border border-slate-900 rounded">
                  No issues found! Your dataset is clean and ready.
                </div>
              )}
            </div>
          )}

          {/* Dataset Profile Card */}
          {profile && profile.profile && (
            <div className="glass-panel p-4 border border-slate-800/80 space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-400" />
                Schema View
              </h3>
              
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {profile.profile.columns.map((c) => (
                  <div key={c.name} className="flex items-center justify-between border-b border-slate-900/60 py-1 text-[10px]">
                    <span className="font-bold text-slate-300 truncate max-w-[120px]">{c.name}</span>
                    <span className="text-slate-500 font-mono text-[9px]">{c.dtype}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Versions Rollback Card */}
          {versions.length > 0 && (
            <div className="glass-panel p-4 border border-slate-800/80 space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-orange-400" />
                Version Rollbacks
              </h3>
              
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {versions.map((v) => (
                  <div key={v.id} className="p-2 bg-slate-950/40 border border-slate-900 rounded flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-blue-400">Version {v.version_num}</span>
                      <span className="text-slate-500 text-[9px]">{v.created_at.split(" ")[0]}</span>
                    </div>
                    <p className="text-slate-400 text-[9px] leading-tight">{v.description}</p>
                    <button
                      onClick={() => handleRollback(v.version_num)}
                      className="w-full bg-[#0f172a] border border-slate-800 hover:bg-slate-800 text-[9px] text-slate-300 font-bold py-1 rounded transition-colors"
                    >
                      Rollback
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports History */}
          {reports.length > 0 && (
            <div className="glass-panel p-4 border border-slate-800/80 space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-yellow-400" />
                Reports Archive
              </h3>
              
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                {reports.map((rep) => (
                  <div key={rep.id} className="flex items-center justify-between p-2 bg-[#0c1017] border border-slate-900 rounded text-[9px]">
                    <div className="min-w-0 pr-1">
                      <p className="font-bold text-slate-350 truncate">{rep.title}</p>
                      <p className="text-[8px] text-slate-500">{rep.created_at}</p>
                    </div>
                    <a 
                      href={`http://127.0.0.1:8000/${rep.file_path}`} 
                      download 
                      target="_blank"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* 4. Scheduled Report Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Schedule Auto-Reports
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-300">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sales summary Mon 9AM"
                  value={schName}
                  onChange={(e) => setSchName(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-300">SQL Report Query</label>
                <textarea
                  rows="3"
                  placeholder="SELECT * FROM current_table ORDER BY sales DESC LIMIT 10"
                  value={schQuery}
                  onChange={(e) => setSchQuery(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-300">Frequency</label>
                <select
                  value={schFreq}
                  onChange={(e) => setSchFreq(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                >
                  <option value="daily">Daily Report (Interval)</option>
                  <option value="weekly">Weekly (Mon 9AM)</option>
                  <option value="monthly">Monthly (1st Day 9AM)</option>
                  <option value="cron">Custom (Cron Expression)</option>
                </select>
              </div>

              {schFreq === "cron" && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-300">Cron Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. */5 * * * * (every 5 mins)"
                    value={schCron}
                    onChange={(e) => setSchCron(e.target.value)}
                    className="bg-[#0b0f19] border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              <button
                onClick={handleCreateSchedule}
                disabled={!schName || !schQuery}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Schedule Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Rename Workspace Modal */}
      {wsToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-sm rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setWsToRename(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              Rename Workspace
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-300">New Display Name</label>
                <input
                  type="text"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  className="bg-[#0b0f19] border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleRenameWorkspace}
                  disabled={!renameVal.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => setWsToRename(null)}
                  className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Workspace Deletion Modal */}
      {wsToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setWsToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-100">
                Confirm Workspace Deletion
              </h3>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to permanently delete workspace: <strong>{wsToDelete.name.toUpperCase()}</strong>?
              <br /><br />
              <strong>Associated dataset:</strong> {wsToDelete.file_name}
              <br />
              <strong>Files to be deleted:</strong>
              <ul className="list-disc list-inside mt-1.5 space-y-1 font-mono text-[10px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-900">
                <li>Original data: uploads/raw/{wsToDelete.file_name}</li>
                <li>All data versions: cleaned_{wsToDelete.name}_v*.csv</li>
                <li>RAG Embeddings index: ws_{wsToDelete.id}.index</li>
                <li>Database: DuckDB table & SQLite metadata</li>
              </ul>
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeleteWorkspace}
                className="flex-1 bg-red-650 hover:bg-red-550 text-white font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => setWsToDelete(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Major Data Cleaning Confirmation Modal */}
      {showCleaningConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowCleaningConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-100">
                Confirm Major Operations
              </h3>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              You are about to run <strong>{selectedCleaningActions.length}</strong> major cleaning operations on your dataset.
              <br /><br />
              This will create a new version of the dataset on disk, update DuckDB tables, and refresh the active schema. You can rollback to any previous version if needed.
            </p>

            <div className="flex gap-3">
              <button
                onClick={executeCleaning}
                className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Confirm & Clean
              </button>
              <button
                onClick={() => setShowCleaningConfirmModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Search Workspaces Modal (Ctrl+K) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[420px]">
            <div className="p-4 border-b border-slate-850 flex items-center gap-2 shrink-0">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search workspaces by name or source dataset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => { setShowSearchModal(false); setSearchQuery(""); }}
                className="text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredWorkspaces.length === 0 ? (
                <p className="text-xs text-slate-550 italic p-3 text-center">No workspaces match your query.</p>
              ) : (
                filteredWorkspaces.map(w => {
                  const isAct = w.id === activeWorkspaceId;
                  return (
                    <div
                      key={w.id}
                      onClick={() => { handleWorkspaceActivated(w); setShowSearchModal(false); setSearchQuery(""); }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isAct 
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-400" 
                          : "bg-slate-900/40 border-slate-850 hover:bg-slate-850/60 text-slate-300 hover:text-white"
                      }`}
                    >
                      <p className="font-bold text-[11px] uppercase">{w.name}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Dataset: {w.file_name} • Ingested: {w.created_at || "N/A"}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Export Report Wizard Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xs font-bold text-slate-100 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Download className="h-4 w-4 text-blue-500" />
              Export Report Wizard
            </h3>

            {exportStep === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block mb-1">Include Sections:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 bg-[#0c1017] border border-slate-900 rounded hover:border-slate-800 transition-colors cursor-pointer text-[10px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_dataset_summary}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_dataset_summary: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Dataset Summary
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#0c1017] border border-slate-900 rounded hover:border-slate-800 transition-colors cursor-pointer text-[10px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_insights}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_insights: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      AI Insights
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#0c1017] border border-slate-900 rounded hover:border-slate-800 transition-colors cursor-pointer text-[10px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_sql}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_sql: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Generated SQL
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#0c1017] border border-slate-900 rounded hover:border-slate-800 transition-colors cursor-pointer text-[10px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_tables}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_tables: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Result Tables
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#0c1017] border border-slate-900 rounded hover:border-slate-800 transition-colors cursor-pointer text-[10px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_charts}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_charts: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Plotly Charts
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block mb-1">Export Scope:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="radio"
                        name="scope"
                        checked={exportConfig.scope === "current"}
                        onChange={() => setExportConfig({ ...exportConfig, scope: "current" })}
                        className="text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Current Query
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="radio"
                        name="scope"
                        checked={exportConfig.scope === "session"}
                        onChange={() => setExportConfig({ ...exportConfig, scope: "session" })}
                        className="text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Entire Chat Session
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-350 block mb-1">Format:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="radio"
                        name="format"
                        checked={exportConfig.format === "pdf"}
                        onChange={() => setExportConfig({ ...exportConfig, format: "pdf" })}
                        className="text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      PDF
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="radio"
                        name="format"
                        checked={exportConfig.format === "pptx"}
                        onChange={() => setExportConfig({ ...exportConfig, format: "pptx" })}
                        className="text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      PPTX
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="radio"
                        name="format"
                        checked={exportConfig.format === "excel"}
                        onChange={() => setExportConfig({ ...exportConfig, format: "excel" })}
                        className="text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-3.5 w-3.5"
                      />
                      Excel
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setExportStep(2)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Next: Preview
                  </button>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-lg space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-300 border-b border-slate-850 pb-1.5 uppercase tracking-wider">
                    Report Preview Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-slate-400">
                    <div>Scope:</div>
                    <div className="font-bold text-slate-200 uppercase">{exportConfig.scope}</div>
                    
                    <div>Format:</div>
                    <div className="font-bold text-slate-200 uppercase">{exportConfig.format}</div>
                    
                    <div>Query Count:</div>
                    <div className="font-bold text-slate-200">{getPreviewCounts().queryCount}</div>
                    
                    <div>Included Tables:</div>
                    <div className="font-bold text-slate-200">
                      {exportConfig.include_tables ? getPreviewCounts().tableCount : 0}
                    </div>
                    
                    <div>Included Charts:</div>
                    <div className="font-bold text-slate-200">
                      {exportConfig.include_charts ? getPreviewCounts().chartCount : 0}
                    </div>
                  </div>
                  
                  <div className="text-[9px] text-slate-550 pt-2 border-t border-slate-850 leading-tight">
                    <span className="font-semibold block mb-0.5">Sections to export:</span>
                    {Object.keys(exportConfig)
                      .filter(k => k.startsWith("include_") && exportConfig[k])
                      .map(k => k.replace("include_", "").replace(/_/g, " "))
                      .join(", ")}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleWizardExport}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Confirm & Export
                  </button>
                  <button
                    onClick={() => setExportStep(1)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-350 font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating toast notifications */}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2 shrink-0">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`border px-4 py-2.5 rounded-lg text-xs shadow-xl flex items-center gap-2 animate-bounce ${
              t.type === "error" 
                ? "bg-red-950/90 border-red-500/30 text-red-400" 
                : "bg-emerald-950/90 border-emerald-500/30 text-emerald-450"
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${t.type === "error" ? "bg-red-500" : "bg-emerald-450"}`} />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
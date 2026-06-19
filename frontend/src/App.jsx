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
  exportReportWizard,
  uploadFile
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
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldAlert,
  BarChart3
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
  const [showCleaningModal, setShowCleaningModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Dataset Upload / Replacement States
  const [duplicateWorkspace, setDuplicateWorkspace] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadRecommendations, setUploadRecommendations] = useState(null);
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState(null);
  const [uploadSelectedActions, setUploadSelectedActions] = useState([]);

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
        setShowCleaningModal(false);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to apply cleaning actions.", "error");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handleIngestFile = async (selectedFile, replaceId = null) => {
    setUploadLoading(true);
    setDuplicateWorkspace(null);

    try {
      if (replaceId) {
        await deleteWorkspace(replaceId);
        showToast("Old workspace replaced. Ingesting new dataset...");
      }

      const result = await uploadFile(selectedFile);
      handleWorkspaceActivated(result);
      setWorkspaceRefreshTrigger((prev) => prev + 1);
      showToast("Dataset ingested successfully!");

      if (result.recommendations && result.recommendations.length > 0 && !result.cleaning_approved) {
        setUploadRecommendations(result.recommendations);
        setUploadWorkspaceId(result.workspace_id);
        setUploadSelectedActions(result.recommendations.map(r => r.id));
      }
    } catch (err) {
      console.error(err);
      const message = err?.response?.data?.detail || err?.message || "Upload failed";
      showToast(`Upload failed: ${message}`, "error");
    } finally {
      setUploadLoading(false);
      setFileToUpload(null);
    }
  };

  const handleApplyUploadCleaning = async () => {
    if (!uploadWorkspaceId) return;
    setUploadLoading(true);
    try {
      const res = await cleanWorkspace(uploadWorkspaceId, uploadSelectedActions);
      if (res.status === "success") {
        showToast("Data cleaning successfully applied!");
        handleWorkspaceActivated(res.workspace);
        setUploadRecommendations(null);
        setWorkspaceRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to apply cleaning action.", "error");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRejectUploadCleaning = () => {
    setUploadRecommendations(null);
    showToast("Dataset loaded in raw state.");
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
    <div className="min-h-screen flex bg-brand-bg text-[#e2e8f0] text-xs">
      {/* 1. Left Sidebar */}
      <aside className={`transition-all duration-300 relative shrink-0 border-r border-brand-border bg-brand-sidebar backdrop-blur-md flex flex-col h-screen sticky top-0 overflow-visible ${sidebarCollapsed ? 'w-16 px-2 py-4 gap-3' : 'w-80 p-4 gap-4'}`}>
        {/* Collapse Toggle Handle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 z-20 p-1 rounded-full border border-brand-border bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-brand-lime shadow-md transition-all cursor-pointer"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {/* Header */}
        <div className={`flex items-center justify-between px-1 shrink-0 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-brand-lime flex items-center justify-center shadow-lg shadow-brand-lime/20 animate-pulse">
              <Bot className="h-5 w-5 text-black" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xs font-black uppercase tracking-widest text-white leading-tight">
                  AI-Analytics
                </h1>
                <p className="text-[9px] text-brand-dimmed">Intelligent Data Platform</p>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            /* Dark/Light Toggle */
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-lg border border-brand-border bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white transition-all cursor-pointer"
              title="Toggle Dark/Light Mode"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-brand-lime" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="shrink-0">
          <button
            onClick={() => setShowSearchModal(true)}
            className={`w-full flex items-center rounded-lg border border-brand-border bg-brand-input text-brand-dimmed hover:border-brand-muted/30 hover:text-brand-muted transition-all cursor-pointer ${
              sidebarCollapsed ? 'justify-center py-2 px-1' : 'justify-between px-3 py-2 text-[11px]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-brand-lime" />
              {!sidebarCollapsed && "Search workspaces..."}
            </span>
            {!sidebarCollapsed && (
              <kbd className="text-[9px] bg-brand-card px-1.5 py-0.5 rounded border border-brand-border text-brand-dimmed">Ctrl+K</kbd>
            )}
          </button>
        </div>

        {/* Workspace List Section */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <WorkspaceList
            activeWorkspaceId={activeWorkspaceId}
            onWorkspaceActivated={handleWorkspaceActivated}
            refreshTrigger={workspaceRefreshTrigger}
            onRenameWorkspace={(ws) => { setWsToRename(ws); setRenameVal(ws.name); }}
            onDuplicateWorkspace={handleDuplicateWorkspace}
            onDeleteWorkspace={(ws) => setWsToDelete(ws)}
            collapsed={sidebarCollapsed}
          />
        </div>

        {/* Dataset Replacement Warning Card */}
        {!sidebarCollapsed && duplicateWorkspace && (
          <div className="shrink-0 glass-panel p-4 border border-brand-border bg-brand-card/90 flex flex-col gap-2 max-h-[150px] overflow-y-auto scrollbar-thin">
            <div className="flex items-center gap-2 text-brand-warning">
              <AlertTriangle className="h-4.5 w-4.5 text-brand-warning shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider">Confirm Replacement</span>
            </div>
            <p className="text-[10px] text-brand-muted leading-relaxed">
              A dataset named <strong className="text-white">{duplicateWorkspace.file_name}</strong> already exists as <strong className="text-white">{duplicateWorkspace.name.toUpperCase()}</strong>.
              Replacing it will permanently delete existing metadata, charts, reports, and version history.
            </p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleIngestFile(fileToUpload, duplicateWorkspace.id)}
                disabled={uploadLoading}
                className="flex-1 bg-brand-error hover:bg-red-500 text-white font-bold py-1.5 rounded text-[10px] transition-colors cursor-pointer text-center"
              >
                Overwrite
              </button>
              <button
                onClick={() => { setDuplicateWorkspace(null); setFileToUpload(null); }}
                disabled={uploadLoading}
                className="flex-1 bg-brand-input border border-brand-border hover:bg-brand-card text-brand-muted font-bold py-1.5 rounded text-[10px] transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="shrink-0">
          <UploadPanel
            workspaces={workspaces}
            onIngestStart={(file) => handleIngestFile(file)}
            onDuplicateDetected={(dup, file) => { setDuplicateWorkspace(dup); setFileToUpload(file); }}
            uploadLoading={uploadLoading}
            collapsed={sidebarCollapsed}
            fileToUpload={fileToUpload}
            setFileToUpload={setFileToUpload}
          />
        </div>

        {/* Scheduled Jobs Section */}
        {activeWorkspace && (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            <div className={`flex items-center justify-between shrink-0 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-muted flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-lime" />
                {!sidebarCollapsed && "Scheduled Jobs"}
              </span>
              {!sidebarCollapsed && (
                <button 
                  onClick={() => setShowScheduleModal(true)}
                  className="p-1 rounded bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-lime transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>

            {!sidebarCollapsed && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {schedules.length === 0 ? (
                  <p className="text-[10px] text-brand-dimmed italic px-1">No scheduled reports.</p>
                ) : (
                  schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-brand-card/60 border border-brand-border rounded">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-300 truncate text-[11px]">{s.name}</p>
                        <p className="text-[9px] text-brand-dimmed truncate">Next: {s.next_run || "N/A"}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="text-brand-muted hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 pt-2 border-t border-brand-border text-center">
          <p className="text-[9px] text-brand-dimmed font-medium truncate">
            {sidebarCollapsed ? "v1.2" : "Platform v1.2.0 • Powered by Gemini & DuckDB"}
          </p>
        </div>
      </aside>

      {/* 2. Center Panel */}
      <main className="flex-1 overflow-y-auto p-6 space-y-5 bg-brand-bg">
        {activeWorkspace ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-4">
              <div>
                <h2 className="text-sm font-black text-white tracking-tight uppercase flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-lime animate-pulse" />
                  WORKSPACE: {activeWorkspace.name}
                </h2>
                <p className="text-[10px] text-brand-muted">
                  DuckDB Engine • Source: {activeWorkspace.file_name}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => openExportWizard("pdf")}
                  className="bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-brand-lime" />
                  PDF Report
                </button>
                <button
                  onClick={() => openExportWizard("pptx")}
                  className="bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-orange-400" />
                  PPTX Slides
                </button>
                <button
                  onClick={() => { exportWorkspaceDocx(activeWorkspaceId); showToast("Generating DOCX document..."); }}
                  className="bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-400" />
                  DOCX Report
                </button>
                <button
                  onClick={() => { exportWorkspaceHtml(activeWorkspaceId); showToast("Generating HTML file..."); }}
                  className="bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-red-400" />
                  HTML Report
                </button>
                <button
                  onClick={() => { exportWorkspaceCsv(activeWorkspaceId); showToast("Downloading CSV..."); }}
                  className="bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-brand-lime" />
                  CSV Data
                </button>
                <button
                  onClick={() => openExportWizard("excel")}
                  className="bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border text-[10px] px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  Excel Data
                </button>
              </div>
            </div>

            {/* KPI Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="glass-panel p-4 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Rows Loaded</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {profile?.row_count?.toLocaleString() || activeWorkspace.row_count?.toLocaleString() || "0"}
                </span>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <Layers className="h-8 w-8" />
                </div>
              </div>
              <div className="glass-panel p-4 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Columns</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {profile?.column_count || "0"}
                </span>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <Database className="h-8 w-8" />
                </div>
              </div>
              <div className="glass-panel p-4 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Data Quality</span>
                <span className={`text-xl font-extrabold mt-1 block ${getQualityColor(profile?.overall_score || activeWorkspace.overall_score)}`}>
                  {profile?.overall_score !== undefined 
                    ? `${Math.round(profile.overall_score)}%` 
                    : activeWorkspace.overall_score !== undefined && activeWorkspace.overall_score !== null
                      ? `${Math.round(activeWorkspace.overall_score)}%`
                      : "N/A"
                  }
                </span>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <Activity className="h-8 w-8" />
                </div>
              </div>
              <div className="glass-panel p-4 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Reports & Jobs</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {(reports?.length || 0) + (schedules?.length || 0)}
                </span>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <FileText className="h-8 w-8" />
                </div>
              </div>
            </div>

            <ChatPanel workspaceId={activeWorkspaceId} setResponse={setResponse} />

            {/* Additional Content Grid below AI Analytics Console */}
            {profile && profile.profile && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                {/* 1. Dataset Schema View Card */}
                <div className="glass-panel p-4 border border-brand-border flex flex-col min-w-0">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 border-b border-brand-border/60 pb-2 mb-3">
                    <Layers className="h-4 w-4 text-brand-lime" />
                    Dataset Schema View
                  </h3>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {profile.profile.columns.map((c) => (
                      <div key={c.name} className="flex items-center justify-between border-b border-brand-border/40 py-1.5 text-[10px]">
                        <span className="font-bold text-slate-300 truncate max-w-[150px]">{c.name}</span>
                        <span className="text-brand-dimmed font-mono text-[9px] font-medium">{c.dtype}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Version Rollbacks Card */}
                <div className="glass-panel p-4 border border-brand-border flex flex-col min-w-0">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 border-b border-brand-border/60 pb-2 mb-3">
                    <Clock className="h-4 w-4 text-brand-lime" />
                    Version Rollbacks
                  </h3>
                  {versions.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {versions.map((v) => (
                        <div key={v.id} className="p-2.5 bg-brand-input border border-brand-border rounded flex flex-col gap-1 text-[10px]">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-brand-lime">Version {v.version_num}</span>
                            <span className="text-brand-dimmed text-[9px]">{v.created_at.split(" ")[0]}</span>
                          </div>
                          <p className="text-brand-muted text-[9px] leading-tight">{v.description}</p>
                          <button
                            onClick={() => handleRollback(v.version_num)}
                            className="w-full mt-1 bg-brand-card border border-brand-border hover:bg-brand-card-hover text-[9px] text-slate-200 font-bold py-1 rounded transition-colors cursor-pointer"
                          >
                            Rollback
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-brand-dimmed italic p-3 bg-brand-input/40 border border-brand-border rounded text-center">
                      No versions available yet.
                    </div>
                  )}
                </div>

                {/* 3. Reports Archive Card */}
                <div className="glass-panel p-4 border border-brand-border flex flex-col min-w-0">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 border-b border-brand-border/60 pb-2 mb-3">
                    <FileSpreadsheet className="h-4 w-4 text-brand-lime" />
                    Reports Archive
                  </h3>
                  {reports.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {reports.map((rep) => (
                        <div key={rep.id} className="flex items-center justify-between p-2 bg-brand-input border border-brand-border rounded text-[9px]">
                          <div className="min-w-0 pr-1">
                            <p className="font-bold text-slate-355 truncate">{rep.title}</p>
                            <p className="text-[8px] text-brand-dimmed">{rep.created_at}</p>
                          </div>
                          <a 
                            href={`http://127.0.0.1:8000/${rep.file_path}`} 
                            download 
                            target="_blank"
                            className="text-brand-lime hover:text-brand-lime-hover transition-colors cursor-pointer p-1 rounded hover:bg-brand-card"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-brand-dimmed italic p-3 bg-brand-input/40 border border-brand-border rounded text-center">
                      No reports generated.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Global Landing Area with stats KPI cards when no workspace is active */
          <div className="h-full flex flex-col justify-center max-w-4xl mx-auto py-12 space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex h-12 w-12 rounded-2xl bg-brand-card border border-brand-border items-center justify-center text-brand-lime shadow-lg shadow-brand-lime/10">
                <Bot className="h-6 w-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase text-gradient">
                Intelligent Data Analytics
              </h2>
              <p className="text-xs text-brand-muted max-w-md mx-auto">
                Unlock insights from your datasets using natural language queries, automated data cleaning, and premium visualization reports.
              </p>
            </div>

            {/* Global KPI stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="glass-panel p-5 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Total Workspaces</span>
                <span className="text-2xl font-black text-white mt-2 block">{workspaces.length}</span>
                <p className="text-[9px] text-brand-dimmed mt-1">Active data workspaces loaded</p>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <Layers className="h-10 w-10" />
                </div>
              </div>
              <div className="glass-panel p-5 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Total Rows Analyzed</span>
                <span className="text-2xl font-black text-white mt-2 block">
                  {workspaces.reduce((acc, w) => acc + (w.row_count || 0), 0).toLocaleString()}
                </span>
                <p className="text-[9px] text-brand-dimmed mt-1">Rows loaded across all datasets</p>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <Database className="h-10 w-10" />
                </div>
              </div>
              <div className="glass-panel p-5 border border-brand-border relative overflow-hidden group">
                <span className="text-[10px] text-brand-muted font-semibold uppercase tracking-wider block">Avg Quality Score</span>
                <span className="text-2xl font-black text-brand-lime mt-2 block">
                  {workspaces.filter(w => w.overall_score !== null && w.overall_score !== undefined).length > 0
                    ? `${Math.round(workspaces.reduce((acc, w) => acc + (w.overall_score || 0), 0) / workspaces.filter(w => w.overall_score !== null && w.overall_score !== undefined).length)}%`
                    : "100%"
                  }
                </span>
                <p className="text-[9px] text-brand-dimmed mt-1">Average data profile health score</p>
                <div className="absolute right-4 bottom-4 text-brand-lime/15 group-hover:text-brand-lime/30 transition-colors">
                  <Activity className="h-10 w-10" />
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 border border-brand-border text-center space-y-4">
              <p className="text-xs text-brand-muted">
                To get started, upload raw CSV, JSON or Excel files, or click any workspace in the sidebar.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="px-4 py-2 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="h-4 w-4 text-brand-lime" />
                  Search Workspaces (Ctrl+K)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Right Sidebar */}
      {activeWorkspace && (
        <aside className="w-80 shrink-0 border-l border-brand-border bg-brand-sidebar backdrop-blur-md p-5 h-screen sticky top-0 overflow-y-auto space-y-5">
          {!profile || !profile.profile ? (
            <div className="space-y-5">
              {/* Shimmer 1: Quality Score */}
              <div className="glass-panel p-4 border border-brand-border space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-brand-border animate-pulse" />
                  <div className="h-3 w-24 bg-brand-border rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full border border-brand-border bg-brand-card animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-16 bg-brand-border rounded animate-pulse" />
                    <div className="h-2 w-28 bg-brand-border rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Data Quality Score Card */}
              {profile && profile.profile && (
                <div className="glass-panel p-4 border border-brand-border space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-brand-lime" />
                    Data Quality Score
                  </h3>
                  
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-full border-2 border-brand-border flex items-center justify-center shrink-0 bg-brand-input">
                      <span className={`text-xs font-extrabold ${getQualityColor(profile.profile.overall_score)}`}>
                        {Math.round(profile.profile.overall_score)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200">
                        Rating: {profile.profile.overall_score >= 80 ? "Premium" : profile.profile.overall_score >= 50 ? "Moderate" : "Poor"}
                      </p>
                      <p className="text-[9px] text-brand-muted leading-tight">
                        Audited empty rows, duplicates, and numeric outliers.
                      </p>
                    </div>
                  </div>

                  {profile.profile.recommendations && profile.profile.recommendations.length > 0 ? (
                    <button
                      onClick={() => setShowCleaningModal(true)}
                      className="w-full mt-2 bg-brand-lime hover:bg-brand-lime-hover text-black font-black uppercase py-1.5 rounded transition-colors text-[10px] flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-brand-lime/10"
                    >
                      <Wand2 className="h-3.5 w-3.5 animate-pulse" />
                      Clean Dataset ({profile.profile.recommendations.length} Fixes)
                    </button>
                  ) : (
                    <div className="text-[9px] text-brand-dimmed italic p-2 bg-brand-input/40 border border-brand-border rounded font-medium text-center">
                      Dataset is clean and optimized!
                    </div>
                  )}

                  {profile.profile.issues && profile.profile.issues.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-brand-border/60">
                      <p className="text-[9px] font-bold text-brand-muted">Issues Logged:</p>
                      <ul className="text-[9px] text-brand-muted space-y-0.5 max-h-[120px] overflow-y-auto pr-1">
                        {profile.profile.issues.map((iss, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-red-500 shrink-0">•</span>
                            <span>{iss}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Dataset Summary Card */}
              <div className="glass-panel p-4 border border-brand-border space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-brand-lime" />
                  Dataset Summary
                </h3>
                
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between border-b border-brand-border/40 pb-1.5">
                    <span className="text-brand-muted">File Name</span>
                    <span className="font-semibold text-slate-200 truncate max-w-[150px]" title={activeWorkspace.file_name || "Unknown"}>
                      {activeWorkspace.file_name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/40 pb-1.5">
                    <span className="text-brand-muted">Total Rows</span>
                    <span className="font-bold text-slate-100">
                      {profile.profile.row_count ? profile.profile.row_count.toLocaleString() : "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/40 pb-1.5">
                    <span className="text-brand-muted">Total Columns</span>
                    <span className="font-bold text-slate-100">
                      {profile.profile.column_count || "Unknown"}
                    </span>
                  </div>
                  
                  {/* Columns Data Type Breakdown */}
                  <div className="pt-1">
                    <p className="text-[9px] font-bold text-brand-muted mb-1.5">Column Type Breakdown:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-brand-input/40 border border-brand-border/40 p-1.5 rounded flex flex-col items-center">
                        <span className="text-brand-lime font-black text-xs">
                          {profile.profile.columns.filter(c => c.dtype.includes('int') || c.dtype.includes('float')).length}
                        </span>
                        <span className="text-[8px] text-brand-muted uppercase font-bold tracking-wider mt-0.5">Numeric</span>
                      </div>
                      <div className="bg-brand-input/40 border border-brand-border/40 p-1.5 rounded flex flex-col items-center">
                        <span className="text-blue-400 font-black text-xs">
                          {profile.profile.columns.filter(c => !c.dtype.includes('int') && !c.dtype.includes('float')).length}
                        </span>
                        <span className="text-[8px] text-brand-muted uppercase font-bold tracking-wider mt-0.5">Categorical/Text</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dataset Structural Graph Card */}
              <div className="glass-panel p-4 border border-brand-border space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 border-b border-brand-border/40 pb-2">
                  <BarChart3 className="h-4 w-4 text-brand-lime" />
                  Dataset Structural Graph
                </h3>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {profile.profile.columns.map((col, idx) => {
                    const fillPercent = Math.round((1 - col.null_percent) * 100);
                    const nullPercent = Math.round(col.null_percent * 100);
                    
                    // Cardinality relative to total rows
                    const totalRows = profile.profile.row_count || 1;
                    const cardinalityPercent = Math.min(100, Math.round((col.unique_count / totalRows) * 100));

                    return (
                      <div key={idx} className="bg-brand-card/30 p-2 rounded border border-brand-border/30 space-y-1.5 hover:border-brand-border transition-colors">
                        {/* Name and Data Type */}
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-200">
                          <span className="truncate max-w-[120px]" title={col.name}>{col.name}</span>
                          <span className="text-[7.5px] font-mono px-1 py-0.5 bg-brand-input border border-brand-border/60 rounded text-brand-muted uppercase">
                            {col.dtype}
                          </span>
                        </div>
                        
                        {/* Completeness Bar (Data Density) */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[7px] text-brand-dimmed">
                            <span>Completeness Profile</span>
                            <span>{fillPercent}% Filled</span>
                          </div>
                          <div className="h-1.5 w-full bg-brand-input border border-brand-border/40 rounded-full overflow-hidden flex">
                            <div 
                              className="h-full bg-brand-lime transition-all" 
                              style={{ width: `${fillPercent}%` }} 
                              title={`Populated: ${fillPercent}%`}
                            />
                            <div 
                              className="h-full bg-red-500 transition-all" 
                              style={{ width: `${nullPercent}%` }} 
                              title={`Missing: ${nullPercent}%`}
                            />
                          </div>
                        </div>

                        {/* Cardinality Bar (Unique Values Ratio) */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[7px] text-brand-dimmed">
                            <span>Cardinality: {col.unique_count ?? 'N/A'} unique</span>
                            <span>{cardinalityPercent}% ratio</span>
                          </div>
                          <div className="h-1.5 w-full bg-brand-input border border-brand-border/40 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all" 
                              style={{ width: `${cardinalityPercent}%` }} 
                              title={`Unique: ${col.unique_count} (${cardinalityPercent}% ratio)`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Graph Legends */}
                <div className="pt-1.5 border-t border-brand-border/40 flex justify-between items-center text-[7.5px] text-brand-muted flex-wrap gap-1">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-lime inline-block" />
                    <span>Populated</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                    <span>Missing</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                    <span>Cardinality</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      )}


      {/* 4. Scheduled Report Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-lime animate-pulse" />
              Schedule Auto-Reports
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-brand-muted">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sales summary Mon 9AM"
                  value={schName}
                  onChange={(e) => setSchName(e.target.value)}
                  className="bg-brand-input border border-brand-border text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-lime"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-brand-muted">SQL Report Query</label>
                <textarea
                  rows="3"
                  placeholder="SELECT * FROM current_table ORDER BY sales DESC LIMIT 10"
                  value={schQuery}
                  onChange={(e) => setSchQuery(e.target.value)}
                  className="bg-brand-input border border-brand-border text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-lime font-mono resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-brand-muted">Frequency</label>
                <select
                  value={schFreq}
                  onChange={(e) => setSchFreq(e.target.value)}
                  className="bg-brand-input border border-brand-border text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-lime cursor-pointer"
                >
                  <option value="daily">Daily Report (Interval)</option>
                  <option value="weekly">Weekly (Mon 9AM)</option>
                  <option value="monthly">Monthly (1st Day 9AM)</option>
                  <option value="cron">Custom (Cron Expression)</option>
                </select>
              </div>

              {schFreq === "cron" && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-brand-muted">Cron Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. */5 * * * * (every 5 mins)"
                    value={schCron}
                    onChange={(e) => setSchCron(e.target.value)}
                    className="bg-brand-input border border-brand-border text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-lime font-mono"
                  />
                </div>
              )}

              <button
                onClick={handleCreateSchedule}
                disabled={!schName || !schQuery}
                className="w-full bg-brand-lime hover:bg-brand-lime-hover disabled:bg-brand-border disabled:text-brand-dimmed text-black font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Schedule Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Rename Workspace Modal */}
      {wsToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-brand-card border border-brand-border w-full max-w-sm rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setWsToRename(null)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              Rename Workspace
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-brand-muted">New Display Name</label>
                <input
                  type="text"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  className="bg-brand-input border border-brand-border text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-lime"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleRenameWorkspace}
                  disabled={!renameVal.trim()}
                  className="flex-1 bg-brand-lime hover:bg-brand-lime-hover disabled:bg-brand-border disabled:text-brand-dimmed text-black text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Rename
                </button>
                <button
                  onClick={() => setWsToRename(null)}
                  className="flex-1 bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setWsToDelete(null)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer"
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
              <ul className="list-disc list-inside mt-1.5 space-y-1 font-mono text-[10px] text-brand-muted bg-brand-input p-2.5 rounded border border-brand-border">
                <li>Original data: uploads/raw/{wsToDelete.file_name}</li>
                <li>All data versions: cleaned_{wsToDelete.name}_v*.csv</li>
                <li>RAG Embeddings index: ws_{wsToDelete.id}.index</li>
                <li>Database: DuckDB table & SQLite metadata</li>
              </ul>
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeleteWorkspace}
                className="flex-1 bg-red-650 hover:bg-red-550 text-white font-medium py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => setWsToDelete(null)}
                className="flex-1 bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted font-medium py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Major Data Cleaning Confirmation Modal */}
      {showCleaningConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowCleaningConfirmModal(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-6 w-6 text-brand-lime animate-pulse" />
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
                className="flex-1 bg-brand-lime hover:bg-brand-lime-hover text-black font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Confirm & Clean
              </button>
              <button
                onClick={() => setShowCleaningConfirmModal(false)}
                className="flex-1 bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted font-medium py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Search Workspaces Modal (Ctrl+K) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-brand-card border border-brand-border w-full max-w-lg rounded-xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[420px]">
            <div className="p-4 border-b border-brand-border flex items-center gap-2 shrink-0">
              <Search className="h-4 w-4 text-brand-lime" />
              <input
                type="text"
                placeholder="Search workspaces by name or source dataset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-slate-200 placeholder-brand-dimmed focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => { setShowSearchModal(false); setSearchQuery(""); }}
                className="text-brand-muted hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredWorkspaces.length === 0 ? (
                <p className="text-xs text-brand-dimmed italic p-3 text-center">No workspaces match your query.</p>
              ) : (
                filteredWorkspaces.map(w => {
                  const isAct = w.id === activeWorkspaceId;
                  return (
                    <div
                      key={w.id}
                      onClick={() => { handleWorkspaceActivated(w); setShowSearchModal(false); setSearchQuery(""); }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isAct 
                          ? "bg-brand-lime/10 border-brand-lime text-brand-lime" 
                          : "bg-brand-input border-brand-border hover:bg-brand-card-hover text-brand-muted hover:text-slate-200"
                      }`}
                    >
                      <p className="font-bold text-[11px] uppercase">{w.name}</p>
                      <p className="text-[9px] text-brand-dimmed mt-0.5">Dataset: {w.file_name} • Ingested: {w.created_at || "N/A"}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xs font-bold text-slate-100 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Download className="h-4 w-4 text-brand-lime" />
              Export Report Wizard
            </h3>

            {exportStep === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="font-semibold text-brand-muted block mb-1">Include Sections:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 bg-brand-input border border-brand-border rounded hover:border-brand-muted/30 transition-colors cursor-pointer text-[10px] text-slate-350">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_dataset_summary}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_dataset_summary: e.target.checked })}
                        className="rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Dataset Summary
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-brand-input border border-brand-border rounded hover:border-brand-muted/30 transition-colors cursor-pointer text-[10px] text-slate-350">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_insights}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_insights: e.target.checked })}
                        className="rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      AI Insights
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-brand-input border border-brand-border rounded hover:border-brand-muted/30 transition-colors cursor-pointer text-[10px] text-slate-355">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_sql}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_sql: e.target.checked })}
                        className="rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Generated SQL
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-brand-input border border-brand-border rounded hover:border-brand-muted/30 transition-colors cursor-pointer text-[10px] text-slate-350">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_tables}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_tables: e.target.checked })}
                        className="rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Result Tables
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-brand-input border border-brand-border rounded hover:border-brand-muted/30 transition-colors cursor-pointer text-[10px] text-slate-350">
                      <input
                        type="checkbox"
                        checked={exportConfig.include_charts}
                        onChange={(e) => setExportConfig({ ...exportConfig, include_charts: e.target.checked })}
                        className="rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Plotly Charts
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-brand-muted block mb-1">Export Scope:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-350">
                      <input
                        type="radio"
                        name="scope"
                        checked={exportConfig.scope === "current"}
                        onChange={() => setExportConfig({ ...exportConfig, scope: "current" })}
                        className="text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Current Query
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-350">
                      <input
                        type="radio"
                        name="scope"
                        checked={exportConfig.scope === "session"}
                        onChange={() => setExportConfig({ ...exportConfig, scope: "session" })}
                        className="text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Entire Chat Session
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-brand-muted block mb-1">Format:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-350">
                      <input
                        type="radio"
                        name="format"
                        checked={exportConfig.format === "pdf"}
                        onChange={() => setExportConfig({ ...exportConfig, format: "pdf" })}
                        className="text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      PDF
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-350">
                      <input
                        type="radio"
                        name="format"
                        checked={exportConfig.format === "pptx"}
                        onChange={() => setExportConfig({ ...exportConfig, format: "pptx" })}
                        className="text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      PPTX
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-350">
                      <input
                        type="radio"
                        name="format"
                        checked={exportConfig.format === "excel"}
                        onChange={() => setExportConfig({ ...exportConfig, format: "excel" })}
                        className="text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-3.5 w-3.5"
                      />
                      Excel
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setExportStep(2)}
                    className="flex-1 bg-brand-lime hover:bg-brand-lime-hover text-black font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Next: Preview
                  </button>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-brand-input border border-brand-border rounded-lg space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-300 border-b border-brand-border pb-1.5 uppercase tracking-wider">
                    Report Preview Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-brand-muted">
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
                  
                  <div className="text-[9px] text-brand-dimmed pt-2 border-t border-brand-border leading-tight">
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
                    className="flex-1 bg-brand-lime hover:bg-brand-lime-hover text-black font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Confirm & Export
                  </button>
                  <button
                    onClick={() => setExportStep(1)}
                    className="flex-1 bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted font-semibold py-2 rounded-lg transition-colors text-xs cursor-pointer text-center"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. Data Cleaning Control Modal */}
      {showCleaningModal && profile && profile.profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-brand-card border border-brand-border w-full max-w-lg rounded-xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setShowCleaningModal(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2 border-b border-brand-border pb-3 shrink-0">
              <Wand2 className="h-5 w-5 text-brand-lime animate-pulse" />
              Data Cleaning Control Panel
            </h3>

            {profile.profile.recommendations && profile.profile.recommendations.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] text-brand-muted leading-tight font-medium">
                    Select recommended corrections to apply:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedCleaningActions(profile.profile.recommendations.map(r => r.id));
                      }}
                      className="text-[9px] font-bold text-brand-lime hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-brand-border text-[9px]">|</span>
                    <button
                      onClick={() => setSelectedCleaningActions([])}
                      className="text-[9px] font-bold text-brand-muted hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 mb-4">
                  {profile.profile.recommendations.map((rec) => (
                    <label 
                      key={rec.id} 
                      className="flex items-start gap-3 p-3 bg-brand-input border border-brand-border rounded-lg hover:border-brand-muted/20 transition-all cursor-pointer group"
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
                        className="mt-0.5 rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-bg h-4 w-4 accent-brand-lime cursor-pointer shrink-0"
                      />
                      <div className="text-[11px] min-w-0">
                        <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">{rec.description}</span>
                        <div className="grid grid-cols-2 gap-2 mt-1.5 text-[9px] text-brand-dimmed">
                          <span><strong>Impact:</strong> {rec.impact}</span>
                          <span><strong>Affected Rows:</strong> {rec.affected_rows}</span>
                        </div>
                        {rec.reasoning && (
                          <p className="text-[9px] text-brand-dimmed mt-1 italic"><strong>Reasoning:</strong> {rec.reasoning}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleApplyCleaningFromSidebar}
                  disabled={selectedCleaningActions.length === 0 || cleaningLoading}
                  className="w-full bg-brand-lime hover:bg-brand-lime-hover disabled:bg-brand-border disabled:text-brand-dimmed text-black font-black uppercase py-2 rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-lg hover:shadow-brand-lime/10"
                >
                  <Wand2 className="h-4 w-4" />
                  {cleaningLoading ? "Cleaning Data..." : `Apply ${selectedCleaningActions.length} Selected Fixes`}
                </button>
              </div>
            ) : (
              <div className="text-xs text-brand-dimmed italic p-5 bg-brand-input/40 border border-brand-border rounded-lg font-medium text-center">
                No issues found! Your dataset is clean and ready.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 11. Upload Data Cleaning Recommendations Confirmation Modal */}
      {uploadRecommendations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#17171A] border border-brand-border w-full max-w-lg rounded-xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            <button
              onClick={handleRejectUploadCleaning}
              className="absolute top-4 right-4 text-brand-muted hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 shrink-0">
              <ShieldAlert className="h-6 w-6 text-brand-lime" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Action Required: Clean Dataset
              </h3>
            </div>

            <p className="text-xs text-brand-muted mb-4 font-medium shrink-0">
              We detected major data quality issues. Choose which corrections to apply:
            </p>

            <div className="overflow-y-auto space-y-2 mb-6 pr-2 flex-1 min-h-0">
              {uploadRecommendations.map((rec) => (
                <label
                  key={rec.id}
                  className="flex items-start gap-3 p-3 bg-brand-input border border-brand-border rounded-lg hover:border-brand-muted/30 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={uploadSelectedActions.includes(rec.id)}
                    onChange={() => {
                      setUploadSelectedActions((prev) =>
                        prev.includes(rec.id)
                          ? prev.filter((id) => id !== rec.id)
                          : [...prev, rec.id]
                      );
                    }}
                    className="mt-0.5 rounded text-brand-lime focus:ring-brand-lime border-brand-border bg-brand-card h-4 w-4 accent-brand-lime"
                  />
                  <div>
                    <div className="text-xs font-black text-white">
                      {rec.description}
                    </div>
                    <div className="text-[10px] text-brand-dimmed mt-0.5 font-medium">
                      Impact: {rec.impact}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                onClick={handleApplyUploadCleaning}
                disabled={uploadLoading}
                className="flex-1 bg-brand-lime hover:bg-brand-lime-hover text-black font-bold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                {uploadLoading ? "Applying..." : "Apply Selected Fixes"}
              </button>
              <button
                onClick={handleRejectUploadCleaning}
                disabled={uploadLoading}
                className="flex-1 bg-[#1F1F24] border border-brand-border hover:bg-[#2A2A2F] text-brand-muted font-bold py-2 rounded-lg transition-colors text-xs cursor-pointer"
              >
                Skip Major Fixes
              </button>
            </div>
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
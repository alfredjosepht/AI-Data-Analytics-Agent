import { useState } from "react";
import { uploadFile, cleanWorkspace, deleteWorkspace } from "../services/api";
import { Upload, X, ShieldAlert, AlertTriangle } from "lucide-react";

function UploadPanel({ workspaces = [], setUploadInfo, onUploadSuccess, showToast }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [selectedActions, setSelectedActions] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [duplicateWorkspace, setDuplicateWorkspace] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadClick = () => {
    if (!file) return;
    
    // Check if filename or workspace name already exists
    const fileBase = file.name.split(".")[0].lower().replace(/ /g, "_");
    const existing = workspaces.find(
      (w) => w.file_name.toLowerCase() === file.name.toLowerCase() ||
             w.name.toLowerCase() === fileBase
    );
    
    if (existing) {
      setDuplicateWorkspace(existing);
      setShowReplaceModal(true);
    } else {
      executeUpload();
    }
  };

  const executeUpload = async (replaceId = null) => {
    setLoading(true);
    setRecommendations(null);
    setShowReplaceModal(false);

    try {
      if (replaceId) {
        // Delete old workspace first as replacement
        await deleteWorkspace(replaceId);
        showToast?.("Old workspace replaced. Ingesting new dataset...");
      }

      const result = await uploadFile(file);
      setUploadInfo(result);
      onUploadSuccess?.();
      showToast?.("Dataset ingested successfully!");

      if (result.recommendations && result.recommendations.length > 0 && !result.cleaning_approved) {
        setRecommendations(result.recommendations);
        setCurrentWorkspaceId(result.workspace_id);
        setSelectedActions(result.recommendations.map(r => r.id));
      }
    } catch (err) {
      console.error(err);
      const message = err?.response?.data?.detail || err?.message || "Upload failed";
      alert(`Upload failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (actionId) => {
    setSelectedActions((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId]
    );
  };

  const handleApplyCleaning = async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const res = await cleanWorkspace(currentWorkspaceId, selectedActions);
      if (res.status === "success") {
        showToast?.("Data cleaning successfully applied!");
        setUploadInfo(res.workspace);
        setRecommendations(null);
        onUploadSuccess?.();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to apply cleaning action.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCleaning = () => {
    setRecommendations(null);
    showToast?.("Dataset loaded in raw state.");
  };

  return (
    <div className="glass-panel p-6 border border-slate-800 flex flex-col justify-between min-h-[220px]">
      <div>
        <h2 className="text-lg font-bold mb-1 text-gradient">
          Ingest Dataset
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          CSV, Excel, TSV, Parquet or documents (PDF, DOCX, TXT)
        </p>

        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-lg p-5 bg-[#0f172a]/40 transition-colors cursor-pointer relative group">
          <Upload className="h-7 w-7 text-slate-400 group-hover:text-blue-400 mb-1.5 transition-colors" />
          <span className="text-xs text-slate-300 font-medium text-center truncate w-full max-w-[200px]">
            {file ? file.name : "Click to browse files"}
          </span>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,.tsv,.json,.parquet,.txt,.pdf,.docx"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      </div>

      <button
        onClick={handleUploadClick}
        disabled={!file || loading}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
      >
        {loading ? "Processing..." : "Ingest File"}
      </button>

      {/* Dataset Replacement Confirmation Modal */}
      {showReplaceModal && duplicateWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowReplaceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="text-sm font-bold text-slate-100">
                Confirm Dataset Replacement
              </h3>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              A dataset named <strong>{duplicateWorkspace.file_name}</strong> already exists in your workspaces as <strong>{duplicateWorkspace.name.toUpperCase()}</strong>.
              <br /><br />
              Replacing it will permanently delete the existing workspace metadata, charts, reports, and version history.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => executeUpload(duplicateWorkspace.id)}
                className="flex-1 bg-red-650 hover:bg-red-550 text-white font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Yes, Overwrite
              </button>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleaning Recommendations Confirmation Modal */}
      {recommendations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={handleRejectCleaning}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="h-6 w-6 text-yellow-500" />
              <h3 className="text-sm font-bold text-slate-100">
                Action Required: Clean Dataset
              </h3>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              We detected major data inconsistencies. Choose which corrections to apply:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-2">
              {recommendations.map((rec) => (
                <label
                  key={rec.id}
                  className="flex items-start gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedActions.includes(rec.id)}
                    onChange={() => handleCheckboxChange(rec.id)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-950 h-4 w-4"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {rec.description}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Impact: {rec.impact}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApplyCleaning}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Apply Selected Fixes
              </button>
              <button
                onClick={handleRejectCleaning}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors text-xs"
              >
                Skip Major Fixes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPanel;
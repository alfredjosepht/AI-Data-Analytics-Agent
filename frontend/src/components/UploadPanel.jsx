import { useRef } from "react";
import { Upload, FileUp } from "lucide-react";

function UploadPanel({ 
  workspaces = [], 
  onIngestStart, 
  onDuplicateDetected, 
  uploadLoading = false, 
  collapsed = false,
  fileToUpload,
  setFileToUpload
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFileToUpload(selected);
      if (collapsed) {
        // Auto-trigger duplicate check for collapsed mode
        handleUploadClick(selected);
      }
    }
  };

  const handleUploadClick = (targetFile = fileToUpload) => {
    const activeFile = targetFile || fileToUpload;
    if (!activeFile) return;
    
    // Check if filename or workspace name already exists
    const fileBase = activeFile.name.split(".")[0].toLowerCase().replace(/ /g, "_");
    const existing = workspaces.find(
      (w) => w.file_name.toLowerCase() === activeFile.name.toLowerCase() ||
             w.name.toLowerCase() === fileBase
    );
    
    if (existing) {
      onDuplicateDetected?.(existing, activeFile);
    } else {
      onIngestStart?.(activeFile);
    }
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadLoading}
          className="p-2.5 rounded-lg border border-brand-border bg-brand-card hover:bg-brand-card-hover hover:border-brand-lime text-brand-muted hover:text-brand-lime transition-all cursor-pointer relative shadow-sm"
          title="Ingest Dataset"
        >
          <Upload className="h-4.5 w-4.5" />
          {uploadLoading && (
            <span className="absolute inset-0 rounded-lg border border-brand-lime animate-ping" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx,.tsv,.json,.parquet,.txt,.pdf,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 border border-brand-border flex flex-col justify-between relative overflow-hidden group">
      <div>
        <h2 className="text-xs font-black uppercase tracking-wider text-brand-lime mb-1 flex items-center gap-1.5 shrink-0">
          <FileUp className="h-4 w-4" />
          Ingest Dataset
        </h2>
        <p className="text-[10px] text-brand-dimmed mb-3 font-medium shrink-0">
          CSV, Excel, TSV, Parquet or documents (PDF, DOCX)
        </p>

        <div className="flex flex-col items-center justify-center border border-dashed border-brand-border hover:border-brand-lime rounded-lg p-3.5 bg-brand-input hover:bg-brand-card/40 transition-colors cursor-pointer relative group/drop min-h-[75px]">
          <Upload className="h-5 w-5 text-brand-muted group-hover/drop:text-brand-lime mb-1 transition-colors shrink-0" />
          <span className="text-[10px] text-brand-muted font-semibold text-center truncate w-full max-w-[200px] group-hover/drop:text-white shrink-0">
            {fileToUpload ? fileToUpload.name : "Click or drag files here"}
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
        onClick={() => handleUploadClick()}
        disabled={!fileToUpload || uploadLoading}
        className="mt-3 w-full bg-brand-card border border-brand-border text-brand-muted hover:text-white hover:border-brand-lime hover:shadow-[0_0_15px_rgba(184,255,44,0.2)] disabled:bg-brand-input disabled:text-brand-dimmed disabled:border-brand-border text-xs font-black uppercase py-2 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
      >
        {uploadLoading ? "Processing..." : "Ingest File"}
      </button>
    </div>
  );
}

export default UploadPanel;
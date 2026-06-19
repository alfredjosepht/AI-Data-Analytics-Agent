import { useState, useMemo, useRef } from "react";
import { Table, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

function ResultTable({ data }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [columnWidths, setColumnWidths] = useState({});
  const resizingRef = useRef(null);

  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter((row) =>
      headers.some((header) =>
        String(row[header] ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm, headers]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      const aIsUnassigned = String(aVal || "").includes("⚠️ Unassigned");
      const bIsUnassigned = String(bVal || "").includes("⚠️ Unassigned");
      if (aIsUnassigned && bIsUnassigned) return 0;
      if (aIsUnassigned) return 1;
      if (bIsUnassigned) return -1;

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const isNumeric = typeof aVal === "number" && typeof bVal === "number";
      if (isNumeric) {
        return sortConfig.direction === "ascending" ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === "ascending"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Drag-and-drop Column Resizing Logic
  const startResize = (e, header) => {
    e.preventDefault();
    resizingRef.current = {
      header,
      startX: e.clientX,
      startWidth: columnWidths[header] || 140
    };
    document.addEventListener("mousemove", doResize);
    document.addEventListener("mouseup", stopResize);
  };

  const doResize = (e) => {
    if (!resizingRef.current) return;
    const { header, startX, startWidth } = resizingRef.current;
    const currentX = e.clientX;
    const newWidth = Math.max(70, startWidth + (currentX - startX));
    setColumnWidths((prev) => ({
      ...prev,
      [header]: newWidth
    }));
  };

  const stopResize = () => {
    resizingRef.current = null;
    document.removeEventListener("mousemove", doResize);
    document.removeEventListener("mouseup", stopResize);
  };

  return (
    <div className="glass-panel p-5 border border-brand-border space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-brand-lime/10 flex items-center justify-center border border-brand-lime/20">
            <Table className="h-3.5 w-3.5 text-brand-lime" />
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">
            Query Results ({sortedData.length} records)
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-brand-dimmed" />
            <input
              type="text"
              placeholder="Search cells..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-brand-input border border-brand-border text-xs rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-brand-dimmed focus:outline-none focus:border-brand-lime/55 w-36 sm:w-44 transition-all"
            />
          </div>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-brand-input border border-brand-border text-[10px] rounded-lg px-2 py-1.5 text-brand-muted focus:outline-none focus:border-brand-lime/50 cursor-pointer"
          >
            {[5, 10, 20, 50].map((num) => (
              <option key={num} value={num}>
                {num} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-border max-h-[300px]">
        <table className="w-full text-left border-collapse text-[11px] table-layout-fixed">
          <thead>
            <tr className="bg-[#111113]/95 border-b border-brand-border sticky top-0 z-10">
              {headers.map((h) => (
                <th
                  key={h}
                  style={{ width: columnWidths[h] || "auto", minWidth: "80px", position: "relative" }}
                  className="p-2.5 font-black uppercase text-brand-muted select-none cursor-pointer hover:bg-brand-card hover:text-white transition-colors text-[10px] tracking-wider"
                  onClick={() => requestSort(h)}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{h}</span>
                    <ArrowUpDown className="h-3 w-3 text-brand-dimmed group-hover:text-white shrink-0" />
                  </div>
                  {/* Resizing drag handle */}
                  <div
                    onMouseDown={(e) => startResize(e, h)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-lime/60 transition-colors z-20"
                    onClick={(e) => e.stopPropagation()} // Prevent sort trigger
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border bg-[#17171A]/40">
            {paginatedData.map((row, i) => (
              <tr key={i} className="hover:bg-brand-lime/5 hover:border-l-2 hover:border-l-brand-lime transition-all border-l-2 border-l-transparent">
                {headers.map((h) => (
                  <td key={h} className="p-2.5 text-slate-300 font-mono truncate max-w-[200px]" title={row[h] !== null && row[h] !== undefined ? String(row[h]) : "NULL"}>
                    {row[h] !== null && row[h] !== undefined ? (
                      String(row[h])
                    ) : (
                      <span className="text-brand-dimmed italic opacity-50">NULL</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-brand-dimmed font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded-lg border border-brand-border bg-brand-card text-brand-muted hover:text-white hover:border-brand-lime disabled:opacity-45 disabled:hover:text-brand-muted disabled:hover:border-brand-border transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg border border-brand-border bg-brand-card text-brand-muted hover:text-white hover:border-brand-lime disabled:opacity-45 disabled:hover:text-brand-muted disabled:hover:border-brand-border transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultTable;
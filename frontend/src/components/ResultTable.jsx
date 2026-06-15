import { useState, useMemo } from "react";
import { Table, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

function ResultTable({ data }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

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

  return (
    <div className="glass-panel p-5 border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Table className="h-4.5 w-4.5 text-blue-400" />
          <h3 className="text-xs font-bold text-slate-300">
            Query Results ({sortedData.length} records)
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#0f172a] border border-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#0f172a] border border-slate-800 text-[10px] rounded-lg px-2 py-1.5 text-slate-350 focus:outline-none"
          >
            {[5, 10, 20, 50].map((num) => (
              <option key={num} value={num}>
                {num} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-900">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-850">
              {headers.map((h) => (
                <th
                  key={h}
                  onClick={() => requestSort(h)}
                  className="p-2.5 font-semibold text-slate-300 select-none cursor-pointer hover:bg-slate-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {h}
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 bg-slate-950/40">
            {paginatedData.map((row, i) => (
              <tr key={i} className="hover:bg-slate-900/30 transition-colors">
                {headers.map((h) => (
                  <td key={h} className="p-2.5 text-slate-300 font-mono">
                    {row[h] !== null && row[h] !== undefined ? String(row[h]) : <span className="text-slate-600">NULL</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
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
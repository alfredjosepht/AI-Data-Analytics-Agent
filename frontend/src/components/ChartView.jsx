import { useEffect, useRef, useState } from "react";
import { generateCustomChart, exportChartBackend } from "../services/api";
import { Sparkles, Download } from "lucide-react";

function ChartView({ chart, resultsData }) {
  const chartRef = useRef(null);
  const [currentChart, setCurrentChart] = useState(chart);
  const [selectedType, setSelectedType] = useState("");

  useEffect(() => {
    if (chart) {
      setCurrentChart(chart);
      setSelectedType(chart.recommendation?.recommended || "bar");
    }
  }, [chart]);

  useEffect(() => {
    if (currentChart && chartRef.current && window.Plotly) {
      window.Plotly.newPlot(
        chartRef.current,
        currentChart.data,
        {
          ...currentChart.layout,
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#e2e8f0", family: "Inter, sans-serif" }
        },
        { 
          responsive: true, 
          displayModeBar: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d']
        }
      );
    }
  }, [currentChart]);

  const handleChartTypeChange = async (type) => {
    setSelectedType(type);
    if (!resultsData || resultsData.length === 0) return;
    try {
      const res = await generateCustomChart(resultsData, type);
      if (res.status === "success" && res.chart) {
        setCurrentChart(res.chart);
      }
    } catch (err) {
      console.error("Failed to regenerate chart", err);
    }
  };

  const handleDownload = async (format) => {
    if (!resultsData || resultsData.length === 0) return;
    try {
      const rec = currentChart.recommendation || {};
      const xCol = rec.x || null;
      const yCol = rec.y || null;
      await exportChartBackend(resultsData, selectedType, xCol, yCol, format);
    } catch (err) {
      console.error(`Failed to download chart as ${format}`, err);
    }
  };

  if (!currentChart) return null;

  const chartTypes = ["bar", "line", "pie", "scatter", "area", "histogram", "box", "heatmap"];

  return (
    <div className="glass-panel p-6 mt-6 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 border-b border-slate-900 pb-3">
        <div>
          <h3 className="text-sm font-bold text-gradient-emerald flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Interactive Visualization
          </h3>
          <p className="text-[10px] text-slate-500">Powered by Plotly.js & Vector Exporter</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-1">
              <Download className="h-3 w-3" />
              Download:
            </span>
            <button
              onClick={() => handleDownload("png")}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              PNG
            </button>
            <button
              onClick={() => handleDownload("svg")}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              SVG
            </button>
            <button
              onClick={() => handleDownload("pdf")}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              PDF
            </button>
          </div>
          
          <div className="w-[1px] h-3 bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500">Chart style:</label>
            <select
              value={selectedType}
              onChange={(e) => handleChartTypeChange(e.target.value)}
              className="bg-[#0f172a] border border-slate-800 text-[11px] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {chartTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "box" ? "Box Plot" : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {currentChart.recommendation && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-medium">
            AI Suggestion: {currentChart.recommendation.recommended.toUpperCase()}
          </span>
          {currentChart.recommendation.x && (
            <span className="text-[8px] text-slate-500 font-mono">
              Columns: {currentChart.recommendation.x} x {currentChart.recommendation.y || "count"}
            </span>
          )}
        </div>
      )}
      
      <div ref={chartRef} className="w-full min-h-[400px] overflow-hidden" />
    </div>
  );
}

export default ChartView;
import { useEffect, useRef, useState } from "react";
import { generateCustomChart, exportChartBackend } from "../services/api";
import { Sparkles, Download, Maximize2, Minimize2, Check, BarChart3 } from "lucide-react";

function ChartView({ chart, resultsData }) {
  const chartRef = useRef(null);
  const [currentChart, setCurrentChart] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (chart) {
      let styledData = [];
      if (chart.data) {
        styledData = chart.data.map((trace, i) => {
          const updatedTrace = { ...trace };
          const themeGreen = "#B8FF2C";
          const themeGrey = "#71717A";
          const themeMuted = "#3F3F46";
          
          if (updatedTrace.type === "pie") {
            if (Array.isArray(updatedTrace.labels) && Array.isArray(updatedTrace.values)) {
              const zipped = updatedTrace.labels.map((lbl, idx) => ({
                label: lbl,
                value: updatedTrace.values[idx]
              })).filter(item => !String(item.label || "").includes("⚠️ Unassigned"));
              
              updatedTrace.labels = zipped.map(item => item.label);
              updatedTrace.values = zipped.map(item => item.value);
            } else if (Array.isArray(updatedTrace.x) && Array.isArray(updatedTrace.y)) {
              const zipped = updatedTrace.x.map((xVal, idx) => ({
                xVal,
                yVal: updatedTrace.y[idx]
              })).filter(item => !String(item.xVal || "").includes("⚠️ Unassigned"));
              
              updatedTrace.x = zipped.map(item => item.xVal);
              updatedTrace.y = zipped.map(item => item.yVal);
            }
            if (!updatedTrace.marker) updatedTrace.marker = {};
            updatedTrace.marker.colors = [
              themeGreen, "#84CC16", "#C7FF3D", "#2A2A2F", "#1F1F24", "#A1A1AA"
            ];
          } else {
            if (Array.isArray(updatedTrace.x)) {
              const xColors = updatedTrace.x.map(xVal => 
                String(xVal || "").includes("⚠️ Unassigned") ? themeGrey : themeGreen
              );
              if (!updatedTrace.marker) updatedTrace.marker = {};
              updatedTrace.marker.color = xColors;
              
              if (updatedTrace.type === "bar") {
                const patterns = updatedTrace.x.map(xVal => 
                  String(xVal || "").includes("⚠️ Unassigned") ? "/" : ""
                );
                updatedTrace.marker.pattern = { shape: patterns };
                updatedTrace.marker.line = {
                  color: updatedTrace.x.map(xVal => String(xVal || "").includes("⚠️ Unassigned") ? "#A1A1AA" : "#2563eb"),
                  width: updatedTrace.x.map(xVal => String(xVal || "").includes("⚠️ Unassigned") ? 1.5 : 1.0)
                };
              }
            } else {
              const colorVal = i === 0 ? themeGreen : i === 1 ? themeGrey : themeMuted;
              if (!updatedTrace.marker) updatedTrace.marker = {};
              updatedTrace.marker.color = colorVal;
            }
            
            if (updatedTrace.line) {
              updatedTrace.line = { ...updatedTrace.line, color: themeGreen };
            }
          }
          return updatedTrace;
        });
      }

      setCurrentChart({
        ...chart,
        data: styledData
      });
      setSelectedType(chart.recommendation?.recommended || "bar");
    } else {
      setCurrentChart(null);
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
          font: { color: "#e2e8f0", family: "Inter, sans-serif" },
          xaxis: {
            ...currentChart.layout?.xaxis,
            gridcolor: "rgba(255, 255, 255, 0.05)",
            zerolinecolor: "rgba(255, 255, 255, 0.1)"
          },
          yaxis: {
            ...currentChart.layout?.yaxis,
            gridcolor: "rgba(255, 255, 255, 0.05)",
            zerolinecolor: "rgba(255, 255, 255, 0.1)"
          }
        },
        { 
          responsive: true, 
          displayModeBar: false // Disable default toolbar to use our premium options
        }
      );
    }
  }, [currentChart]);

  // Handle Plotly resizing on fullscreen toggle
  useEffect(() => {
    if (chartRef.current && window.Plotly && currentChart) {
      const resizeTimer = setTimeout(() => {
        window.Plotly.Plots.resize(chartRef.current);
      }, 100);
      return () => clearTimeout(resizeTimer);
    }
  }, [isFullscreen, currentChart]);

  const handleChartTypeChange = async (type) => {
    setSelectedType(type);
    if (!resultsData || resultsData.length === 0) return;
    try {
      const res = await generateCustomChart(resultsData, type);
      if (res.status === "success" && res.chart) {
        // Apply theme color scale overrides
        const styledData = res.chart.data.map((trace, i) => {
          const updatedTrace = { ...trace };
          const themeGreen = "#B8FF2C";
          const themeGrey = "#71717A";
          const themeMuted = "#3F3F46";
          if (updatedTrace.type === "pie") {
            if (Array.isArray(updatedTrace.labels) && Array.isArray(updatedTrace.values)) {
              const zipped = updatedTrace.labels.map((lbl, idx) => ({
                label: lbl,
                value: updatedTrace.values[idx]
              })).filter(item => !String(item.label || "").includes("⚠️ Unassigned"));
              
              updatedTrace.labels = zipped.map(item => item.label);
              updatedTrace.values = zipped.map(item => item.value);
            } else if (Array.isArray(updatedTrace.x) && Array.isArray(updatedTrace.y)) {
              const zipped = updatedTrace.x.map((xVal, idx) => ({
                xVal,
                yVal: updatedTrace.y[idx]
              })).filter(item => !String(item.xVal || "").includes("⚠️ Unassigned"));
              
              updatedTrace.x = zipped.map(item => item.xVal);
              updatedTrace.y = zipped.map(item => item.yVal);
            }
            if (!updatedTrace.marker) updatedTrace.marker = {};
            updatedTrace.marker.colors = [
              themeGreen, "#84CC16", "#C7FF3D", "#2A2A2F", "#1F1F24", "#A1A1AA"
            ];
          } else {
            if (Array.isArray(updatedTrace.x)) {
              const xColors = updatedTrace.x.map(xVal => 
                String(xVal || "").includes("⚠️ Unassigned") ? themeGrey : themeGreen
              );
              if (!updatedTrace.marker) updatedTrace.marker = {};
              updatedTrace.marker.color = xColors;
              
              if (updatedTrace.type === "bar") {
                const patterns = updatedTrace.x.map(xVal => 
                  String(xVal || "").includes("⚠️ Unassigned") ? "/" : ""
                );
                updatedTrace.marker.pattern = { shape: patterns };
                updatedTrace.marker.line = {
                  color: updatedTrace.x.map(xVal => String(xVal || "").includes("⚠️ Unassigned") ? "#A1A1AA" : "#2563eb"),
                  width: updatedTrace.x.map(xVal => String(xVal || "").includes("⚠️ Unassigned") ? 1.5 : 1.0)
                };
              }
            } else {
              const colorVal = i === 0 ? themeGreen : themeGrey;
              if (!updatedTrace.marker) updatedTrace.marker = {};
              updatedTrace.marker.color = colorVal;
            }
            if (updatedTrace.line) {
              updatedTrace.line = { ...updatedTrace.line, color: themeGreen };
            }
          }
          return updatedTrace;
        });
        setCurrentChart({
          ...res.chart,
          data: styledData
        });
      }
    } catch (err) {
      console.error("Failed to regenerate chart", err);
    }
  };

  const handleDownload = async (format) => {
    if (!resultsData || resultsData.length === 0) return;
    setIsExporting(true);
    try {
      const rec = currentChart.recommendation || {};
      const xCol = rec.x || null;
      const yCol = rec.y || null;
      await exportChartBackend(resultsData, selectedType, xCol, yCol, format);
    } catch (err) {
      console.error(`Failed to download chart as ${format}`, err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentChart) return null;

  const chartTypes = ["bar", "line", "pie", "scatter", "area", "histogram", "box", "heatmap"];

  return (
    <div 
      className={`${
        isFullscreen 
          ? "fixed inset-0 z-50 flex flex-col bg-[#0A0A0B]/98 backdrop-blur-md p-6 overflow-hidden" 
          : "glass-panel p-5 mt-4 border border-brand-border relative group"
      } transition-all duration-300`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 border-b border-brand-border pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-brand-lime/10 flex items-center justify-center border border-brand-lime/20">
            <BarChart3 className="h-3.5 w-3.5 text-brand-lime" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              Interactive Visualization
            </h3>
            <p className="text-[9px] text-brand-dimmed font-medium">Powered by Plotly Engine & Vector Exporter</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Download options */}
          <div className="flex items-center gap-1 bg-brand-input border border-brand-border rounded-lg p-0.5">
            <span className="text-[9px] text-brand-dimmed px-1.5 font-bold flex items-center gap-1">
              <Download className="h-2.5 w-2.5 text-brand-lime" />
              Download:
            </span>
            <button
              onClick={() => handleDownload("png")}
              className="px-2 py-0.5 rounded-md hover:bg-brand-card hover:text-white text-[9px] text-brand-muted font-bold transition-all cursor-pointer"
            >
              PNG
            </button>
            <button
              onClick={() => handleDownload("svg")}
              className="px-2 py-0.5 rounded-md hover:bg-brand-card hover:text-white text-[9px] text-brand-muted font-bold transition-all cursor-pointer"
            >
              SVG
            </button>
            <button
              onClick={() => handleDownload("pdf")}
              className="px-2 py-0.5 rounded-md hover:bg-brand-card hover:text-white text-[9px] text-brand-muted font-bold transition-all cursor-pointer"
            >
              PDF
            </button>
          </div>
          
          <div className="w-[1px] h-3 bg-brand-border hidden sm:block" />

          {/* Chart selector & fullscreen toggles */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-brand-dimmed font-semibold">Style:</span>
            <select
              value={selectedType}
              onChange={(e) => handleChartTypeChange(e.target.value)}
              className="bg-brand-input border border-brand-border text-[10px] font-bold rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-brand-lime cursor-pointer"
            >
              {chartTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "box" ? "Box Plot" : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 rounded-lg border border-brand-border bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-brand-lime transition-all cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
      
      {currentChart.recommendation && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-[8px] bg-brand-lime/10 text-brand-lime border border-brand-lime/25 px-2 py-0.5 rounded font-black tracking-wider uppercase">
            AI Suggestion: {currentChart.recommendation.recommended.toUpperCase()}
          </span>
          {currentChart.recommendation.x && (
            <span className="text-[9px] text-brand-dimmed font-mono font-medium">
              Columns: {currentChart.recommendation.x} x {currentChart.recommendation.y || "count"}
            </span>
          )}
        </div>
      )}
      
      <div className="text-[10px] text-brand-dimmed italic mb-3 font-medium">
        Grey bar indicates rows with missing dimension values
      </div>

      <div 
        ref={chartRef} 
        className={`w-full overflow-hidden ${isFullscreen ? "flex-1 min-h-[500px]" : "min-h-[350px]"}`} 
      />
    </div>
  );
}

export default ChartView;
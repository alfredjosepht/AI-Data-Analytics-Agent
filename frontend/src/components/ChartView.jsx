import { useEffect, useRef, useState } from "react";
import { generateCustomChart } from "../services/api";

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

  if (!currentChart) return null;

  const chartTypes = ["bar", "line", "pie", "scatter", "area", "histogram", "box", "heatmap"];

  return (
    <div className="glass-panel p-6 mt-6 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gradient-emerald">
            Interactive Visualization
          </h3>
          <p className="text-xs text-slate-400">Powered by Plotly.js</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Chart style:</label>
          <select
            value={selectedType}
            onChange={(e) => handleChartTypeChange(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 text-sm rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {chartTypes.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div ref={chartRef} className="w-full min-h-[400px] overflow-hidden" />
    </div>
  );
}

export default ChartView;
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import pandas as pd

router = APIRouter()


class ChartGenerateRequest(BaseModel):
    data: List[Dict[str, Any]]
    chart_type: str
    x_col: Optional[str] = None
    y_col: Optional[str] = None


@router.post("/generate")
def generate_chart(request: ChartGenerateRequest):
    if not request.data:
        raise HTTPException(status_code=400, detail="Data cannot be empty")
        
    df = pd.DataFrame(request.data)
    cols = list(df.columns)
    
    x_col = request.x_col or cols[0]
    y_col = request.y_col or (cols[1] if len(cols) > 1 else cols[0])
    
    try:
        x_data = df[x_col].tolist()
        y_data = df[y_col].tolist() if y_col in df.columns else None
        
        layout = {
            "title": f"{y_col} by {x_col}" if y_col else f"Distribution of {x_col}",
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "font": {"color": "#e2e8f0", "family": "Inter, system-ui, sans-serif"},
            "xaxis": {"title": str(x_col), "gridcolor": "#334155", "zerolinecolor": "#475569"},
            "yaxis": {"title": str(y_col) if y_col else "Count", "gridcolor": "#334155", "zerolinecolor": "#475569"},
            "margin": {"t": 50, "b": 50, "l": 50, "r": 20},
            "height": 400
        }
        
        traces = []
        c_type = request.chart_type.lower()
        
        if c_type == "pie":
            traces.append({
                "labels": x_data,
                "values": y_data,
                "type": "pie",
                "marker": {"colors": ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]},
                "textinfo": "percent+label"
            })
            layout.pop("xaxis", None)
            layout.pop("yaxis", None)
        elif c_type == "line":
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "scatter",
                "mode": "lines+markers",
                "line": {"color": "#3b82f6", "width": 3},
                "marker": {"size": 6, "color": "#60a5fa"},
                "name": str(y_col)
            })
        elif c_type == "area":
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "scatter",
                "mode": "lines",
                "fill": "tozeroy",
                "line": {"color": "#10b981"},
                "name": str(y_col)
            })
        elif c_type == "scatter":
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "scatter",
                "mode": "markers",
                "marker": {"size": 10, "color": "#f59e0b", "opacity": 0.8},
                "name": str(y_col)
            })
        elif c_type == "histogram":
            traces.append({
                "x": x_data,
                "type": "histogram",
                "marker": {"color": "#8b5cf6"},
                "opacity": 0.75
            })
        elif c_type == "box":
            traces.append({
                "y": x_data,
                "type": "box",
                "marker": {"color": "#ec4899"}
            })
        elif c_type == "heatmap":
            numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
            if len(numeric_cols) >= 2:
                corr = df[numeric_cols].corr().values.tolist()
                traces.append({
                    "x": numeric_cols,
                    "y": numeric_cols,
                    "z": corr,
                    "type": "heatmap",
                    "colorscale": "Viridis"
                })
                layout["title"] = "Correlation Heatmap"
            else:
                traces.append({
                    "x": x_data,
                    "y": y_data,
                    "type": "bar",
                    "marker": {"color": "#3b82f6"}
                })
        else:
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "bar",
                "marker": {"color": "#3b82f6", "line": {"color": "#2563eb", "width": 1}},
                "name": str(y_col)
            })

        return {
            "status": "success",
            "chart": {
                "data": traces,
                "layout": layout,
                "recommendation": {
                    "recommended": c_type,
                    "alternatives": ["bar", "line", "pie", "scatter", "area", "histogram", "box", "heatmap"]
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate custom chart: {e}")


class ChartExportRequest(BaseModel):
    data: List[Dict[str, Any]]
    chart_type: str
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    format: str = "png" # png, svg, pdf


@router.post("/export")
def export_chart(request: ChartExportRequest):
    if not request.data:
        raise HTTPException(status_code=400, detail="Data cannot be empty")
        
    from backend.agents.visualization_agent.chart_exporter import ChartExporter
    try:
        fmt = request.format.lower()
        if fmt not in ["png", "svg", "pdf"]:
            raise HTTPException(status_code=400, detail="Unsupported format. Choose png, svg, or pdf.")
            
        img_path = ChartExporter.generate_chart_image(
            data_list=request.data,
            chart_type=request.chart_type,
            x_col=request.x_col,
            y_col=request.y_col,
            output_format=fmt
        )
        
        if not img_path or not os.path.exists(img_path):
            raise HTTPException(status_code=500, detail="Failed to generate chart file")

        media_types = {
            "png": "image/png",
            "svg": "image/svg+xml",
            "pdf": "application/pdf"
        }
        
        return FileResponse(
            img_path, 
            media_type=media_types[fmt], 
            filename=f"chart.{fmt}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
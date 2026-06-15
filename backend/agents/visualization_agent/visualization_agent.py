import pandas as pd
from backend.agents.chart_recommender import ChartRecommender


class VisualizationAgent:

    @staticmethod
    def create_chart(df):
        if len(df.columns) < 2:
            return None

        # Get recommendation
        rec = ChartRecommender.recommend(df)
        chart_type = rec.get("recommended", "bar")
        x_col = rec.get("x", df.columns[0])
        y_col = rec.get("y", df.columns[1])

        # Prepare data for Plotly
        x_data = df[x_col].tolist()
        y_data = df[y_col].tolist() if y_col in df.columns else None

        # Standard layout theme (glassmorphism/dark mode friendly color schemes)
        layout = {
            "title": f"{y_col} by {x_col}" if y_col else f"Distribution of {x_col}",
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "font": {"color": "#e2e8f0", "family": "Inter, system-ui, sans-serif"},
            "xaxis": {
                "title": str(x_col),
                "gridcolor": "#334155",
                "zerolinecolor": "#475569"
            },
            "yaxis": {
                "title": str(y_col) if y_col else "Count",
                "gridcolor": "#334155",
                "zerolinecolor": "#475569"
            },
            "margin": {"t": 50, "b": 50, "l": 50, "r": 20},
            "height": 400
        }

        traces = []

        if chart_type == "pie":
            traces.append({
                "labels": x_data,
                "values": y_data,
                "type": "pie",
                "marker": {"colors": ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]},
                "textinfo": "percent+label"
            })
            layout.pop("xaxis", None)
            layout.pop("yaxis", None)

        elif chart_type == "line":
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "scatter",
                "mode": "lines+markers",
                "line": {"color": "#3b82f6", "width": 3},
                "marker": {"size": 6, "color": "#60a5fa"},
                "name": str(y_col)
            })

        elif chart_type == "area":
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "scatter",
                "mode": "lines",
                "fill": "tozeroy",
                "line": {"color": "#10b981"},
                "name": str(y_col)
            })

        elif chart_type == "scatter":
            traces.append({
                "x": x_data,
                "y": y_data,
                "type": "scatter",
                "mode": "markers",
                "marker": {"size": 10, "color": "#f59e0b", "opacity": 0.8},
                "name": str(y_col)
            })

        elif chart_type == "histogram":
            traces.append({
                "x": x_data,
                "type": "histogram",
                "marker": {"color": "#8b5cf6"},
                "opacity": 0.75
            })

        elif chart_type == "box":
            traces.append({
                "y": x_data,
                "type": "box",
                "marker": {"color": "#ec4899"}
            })

        elif chart_type == "heatmap":
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
            "data": traces,
            "layout": layout,
            "recommendation": rec
        }

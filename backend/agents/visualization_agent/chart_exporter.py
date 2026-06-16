import os
import uuid
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Headless mode
import matplotlib.pyplot as plt

class ChartExporter:

    @staticmethod
    def generate_chart_image(data_list, chart_type, x_col=None, y_col=None, output_format="png"):
        """
        Generates a chart using matplotlib and returns the path to the saved image.
        """
        if not data_list:
            return None

        df = pd.DataFrame(data_list)
        cols = list(df.columns)
        
        # Determine X and Y columns
        x_col = x_col or cols[0]
        y_col = y_col or (cols[1] if len(cols) > 1 else cols[0])
        
        # Clean chart type
        chart_type = (chart_type or "bar").lower().replace(" plot", "").strip()

        # Create plot
        fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
        
        # Color palettes
        colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"]

        try:
            if chart_type == "pie":
                # For pie charts, group smaller categories if there are too many
                pie_data = df.groupby(x_col)[y_col].sum().reset_index() if y_col in df.columns else df[x_col].value_counts().reset_index()
                pie_data.columns = ['labels', 'values']
                labels = [str(l)[:15] for l in pie_data['labels']]
                values = pie_data['values'].tolist()
                
                ax.pie(
                    values, 
                    labels=labels, 
                    autopct='%1.1f%%', 
                    colors=colors[:len(values)],
                    startangle=90, 
                    textprops={'fontsize': 8, 'color': '#1e293b'}
                )
                ax.axis('equal')
                ax.set_title(f"Distribution of {y_col or x_col}", fontsize=11, fontweight='bold', color='#1e293b', pad=15)

            elif chart_type == "line":
                x_vals = df[x_col].tolist()
                y_vals = df[y_col].tolist() if y_col in df.columns else [1]*len(df)
                ax.plot(x_vals, y_vals, marker='o', color='#2563eb', linewidth=2.5, markersize=5, label=y_col)
                ax.set_xlabel(str(x_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_ylabel(str(y_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_title(f"{y_col} over {x_col}", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                ax.grid(True, linestyle='--', alpha=0.5, color='#cbd5e1')
                plt.xticks(rotation=30, ha='right', fontsize=8)

            elif chart_type == "area":
                x_vals = df[x_col].tolist()
                y_vals = df[y_col].tolist() if y_col in df.columns else [1]*len(df)
                ax.fill_between(x_vals, y_vals, color='#10b981', alpha=0.3)
                ax.plot(x_vals, y_vals, color='#10b981', linewidth=2, label=y_col)
                ax.set_xlabel(str(x_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_ylabel(str(y_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_title(f"{y_col} Area Chart", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                ax.grid(True, linestyle='--', alpha=0.5, color='#cbd5e1')
                plt.xticks(rotation=30, ha='right', fontsize=8)

            elif chart_type == "scatter":
                x_vals = df[x_col].tolist()
                y_vals = df[y_col].tolist() if y_col in df.columns else [1]*len(df)
                ax.scatter(x_vals, y_vals, color='#f59e0b', s=45, alpha=0.8, edgecolors='#d97706')
                ax.set_xlabel(str(x_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_ylabel(str(y_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_title(f"Scatter: {y_col} vs {x_col}", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                ax.grid(True, linestyle='--', alpha=0.5, color='#cbd5e1')

            elif chart_type == "histogram":
                # Distribution of x_col
                vals = df[x_col].dropna().tolist()
                ax.hist(vals, bins=min(15, len(set(vals))), color='#8b5cf6', edgecolor='#7c3aed', alpha=0.75)
                ax.set_xlabel(str(x_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_ylabel("Count / Frequency", fontsize=9, fontweight='semibold', color='#475569')
                ax.set_title(f"Histogram of {x_col}", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                ax.grid(True, linestyle='--', alpha=0.5, color='#cbd5e1')

            elif chart_type == "box":
                # Boxplot of numerical columns
                numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
                if numeric_cols:
                    box_data = [df[c].dropna().tolist() for c in numeric_cols[:4]] # Limit to 4 cols
                    ax.boxplot(box_data, tick_labels=[str(c)[:12] for c in numeric_cols[:4]], patch_artist=True,
                               boxprops=dict(facecolor='#ec4899', color='#db2777'),
                               medianprops=dict(color='#9d174d', linewidth=2))
                    ax.set_title("Distribution Box Plot", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                    ax.grid(True, linestyle='--', alpha=0.3, color='#cbd5e1')
                else:
                    ax.text(0.5, 0.5, "No numeric columns for box plot", ha='center', va='center')

            elif chart_type == "heatmap":
                numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
                if len(numeric_cols) >= 2:
                    corr = df[numeric_cols].corr()
                    im = ax.imshow(corr.values, cmap='coolwarm', vmin=-1, vmax=1)
                    fig.colorbar(im, ax=ax)
                    ax.set_xticks(np.arange(len(numeric_cols)))
                    ax.set_yticks(np.arange(len(numeric_cols)))
                    ax.set_xticklabels([str(c)[:10] for c in numeric_cols], rotation=15, ha='right', fontsize=8)
                    ax.set_yticklabels([str(c)[:10] for c in numeric_cols], fontsize=8)
                    ax.set_title("Correlation Heatmap", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                    # Loop over data dimensions and create text annotations.
                    for i in range(len(numeric_cols)):
                        for j in range(len(numeric_cols)):
                            ax.text(j, i, f"{corr.values[i, j]:.2f}", ha="center", va="center", color="black", fontsize=8)
                else:
                    ax.text(0.5, 0.5, "Not enough numeric columns for heatmap", ha='center', va='center')

            else:  # Default Bar Chart
                x_vals = [str(v)[:15] for v in df[x_col]]
                y_vals = df[y_col].tolist() if y_col in df.columns else [1]*len(df)
                ax.bar(x_vals, y_vals, color='#2563eb', edgecolor='#1d4ed8', alpha=0.85)
                ax.set_xlabel(str(x_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_ylabel(str(y_col), fontsize=9, fontweight='semibold', color='#475569')
                ax.set_title(f"{y_col} by {x_col}", fontsize=11, fontweight='bold', color='#1e293b', pad=12)
                ax.grid(True, linestyle='--', alpha=0.5, color='#cbd5e1')
                plt.xticks(rotation=30, ha='right', fontsize=8)

        except Exception as e:
            ax.clear()
            ax.text(0.5, 0.5, f"Rendering Error:\n{str(e)}", ha='center', va='center', color='red', fontsize=10)

        # Style polishing
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#cbd5e1')
        ax.spines['bottom'].set_color('#cbd5e1')
        ax.tick_params(colors='#475569')

        plt.tight_layout()

        # Save to temp file
        os.makedirs("exports", exist_ok=True)
        img_id = uuid.uuid4().hex[:8]
        filename = f"temp_chart_{img_id}.{output_format}"
        out_path = os.path.join("exports", filename)
        
        fig.savefig(out_path, format=output_format, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return out_path

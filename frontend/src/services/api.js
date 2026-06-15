import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await API.post("/upload/", formData);
  return response.data;
};

export const askQuestion = async (question) => {
  const response = await API.post("/chat/", { question });
  return response.data;
};

export const listWorkspaces = async () => {
  const response = await API.get("/workspaces/");
  return response.data;
};

export const getWorkspace = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}`);
  return response.data;
};

export const profileWorkspace = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/profile`);
  return response.data;
};

export const getActiveWorkspace = async () => {
  const response = await API.get(`/workspaces/active`);
  return response.data;
};

export const activateWorkspace = async (workspaceId) => {
  const response = await API.post(`/workspaces/${workspaceId}/activate`);
  return response.data;
};

export const approveCleaning = async (workspaceId) => {
  const response = await API.post(`/workspaces/${workspaceId}/approve_cleaning`);
  return response.data;
};

export const cleanWorkspace = async (workspaceId, approvedActions) => {
  const response = await API.post(`/workspaces/${workspaceId}/clean`, { approved_actions: approvedActions });
  return response.data;
};

export const getWorkspaceVersions = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/versions`);
  return response.data;
};

export const rollbackWorkspaceVersion = async (workspaceId, versionNum) => {
  const response = await API.post(`/workspaces/${workspaceId}/versions/${versionNum}/rollback`);
  return response.data;
};

export const createSchedule = async (workspaceId, name, query, frequency, cronExpr = "") => {
  const response = await API.post(`/schedule-report`, {
    workspace_id: workspaceId,
    name,
    query,
    frequency,
    cron_expr: cronExpr || null
  });
  return response.data;
};

export const listSchedules = async (workspaceId = null) => {
  const url = workspaceId ? `/reports/scheduled?workspace_id=${workspaceId}` : `/reports/scheduled`;
  const response = await API.get(url);
  return response.data;
};

export const deleteSchedule = async (scheduleId) => {
  const response = await API.delete(`/reports/scheduled/${scheduleId}`);
  return response.data;
};

export const listReports = async (workspaceId = null) => {
  const url = workspaceId ? `/reports?workspace_id=${workspaceId}` : `/reports`;
  const response = await API.get(url);
  return response.data;
};

export const generateCustomChart = async (data, chartType, xCol = null, yCol = null) => {
  const response = await API.post(`/chart/generate`, {
    data,
    chart_type: chartType,
    x_col: xCol,
    y_col: yCol
  });
  return response.data;
};

export const exportWorkspacePdf = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/export/pdf`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportWorkspacePptx = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/export/pptx`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_presentation.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportWorkspaceCsv = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/export/csv`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_export.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportWorkspaceExcel = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/export/excel`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_export.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
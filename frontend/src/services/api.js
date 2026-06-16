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

export const renameWorkspace = async (workspaceId, name) => {
  const response = await API.post(`/workspaces/${workspaceId}/rename`, { name });
  return response.data;
};

export const deleteWorkspace = async (workspaceId) => {
  const response = await API.delete(`/workspaces/${workspaceId}`);
  return response.data;
};

export const duplicateWorkspace = async (workspaceId) => {
  const response = await API.post(`/workspaces/${workspaceId}/duplicate`);
  return response.data;
};

export const getChatHistory = async (workspaceId) => {
  const response = await API.get(`/chat/workspaces/${workspaceId}/chat_history`);
  return response.data;
};

export const clearChatHistory = async (workspaceId) => {
  const response = await API.delete(`/chat/workspaces/${workspaceId}/chat_history`);
  return response.data;
};

export const deleteChatMessage = async (chatId) => {
  const response = await API.delete(`/chat/chat_history/${chatId}`);
  return response.data;
};

export const exportWorkspaceDocx = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/export/docx`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_report.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportWorkspaceHtml = async (workspaceId) => {
  const response = await API.get(`/workspaces/${workspaceId}/export/html`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_report.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportChatHistory = async (workspaceId, format) => {
  const response = await API.get(`/chat/workspaces/${workspaceId}/chat_history/export?format=${format}`, {
    responseType: "blob",
  });
  
  let type = "text/plain";
  let ext = "txt";
  if (format === "pdf") {
    type = "application/pdf";
    ext = "pdf";
  } else if (format === "docx") {
    type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    ext = "docx";
  }

  const blob = new Blob([response.data], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat_history_workspace_${workspaceId}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportChartBackend = async (data, chartType, xCol, yCol, format) => {
  const response = await API.post(`/chart/export`, {
    data,
    chart_type: chartType,
    x_col: xCol,
    y_col: yCol,
    format
  }, { responseType: "blob" });

  let type = "image/png";
  if (format === "svg") type = "image/svg+xml";
  else if (format === "pdf") type = "application/pdf";

  const blob = new Blob([response.data], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chart.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const getChatMessages = async (workspaceId) => {
  const response = await API.get(`/chat/workspaces/${workspaceId}/chat_messages`);
  return response.data;
};

export const exportReportWizard = async (workspaceId, config) => {
  const response = await API.post(`/workspaces/${workspaceId}/export_report`, config, {
    responseType: "blob"
  });
  
  let type = "application/pdf";
  let ext = "pdf";
  if (config.format === "pptx") {
    type = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    ext = "pptx";
  } else if (config.format === "excel") {
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }
  
  const blob = new Blob([response.data], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace_${workspaceId}_custom_report.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
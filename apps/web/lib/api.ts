import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.message || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export const harApi = {
  // Upload HAR file
  upload: (content: string, fileName: string) =>
    api.post<any, any>('/har/upload', { content, fileName }),

  // List all HAR files
  list: () => api.get<any, any>('/har'),

  // Get file info
  getFile: (uuid: string) => api.get<any, any>(`/har/${uuid}`),

  // Delete file
  delete: (uuid: string) => api.delete<any, any>(`/har/${uuid}`),

  // Get analysis status
  getStatus: (uuid: string) => api.get<any, any>(`/har/${uuid}/status`),

  // Get full analysis
  getAnalysis: (uuid: string) => api.get<any, any>(`/har/${uuid}/analysis`),

  // Get paginated entries with filters
  getEntries: (uuid: string, params: Record<string, any>) =>
    api.get<any, any>(`/har/${uuid}/entries`, { params }),

  // Get single entry
  getEntry: (uuid: string, index: number) =>
    api.get<any, any>(`/har/${uuid}/entries/${index}`),

  // Search
  search: (uuid: string, query: string, fields: string[]) =>
    api.get<any, any>(`/har/${uuid}/search`, { params: { q: query, fields: fields.join(',') } }),

  // Export
  export: (uuid: string, format: string, entries?: number[]) =>
    api.get<any, any>(`/har/${uuid}/export`, {
      params: { format, entries: entries?.join(',') },
    }),

  // Compare
  compare: (uuidA: string, uuidB: string) =>
    api.post<any, any>('/har/compare', { uuidA, uuidB }),
};

export const groqApi = {
  // Get available models
  getModels: () => api.get<any, any>('/groq/models'),

  // Analyze HAR with AI
  analyze: (uuid: string, body: { prompt?: string; model: string; analysisType?: string }) =>
    api.post<any, any>(`/groq/analyze/${uuid}`, body),

  // Chat about HAR
  chat: (uuid: string, messages: any[], model: string) =>
    api.post<any, any>(`/groq/chat/${uuid}`, { messages, model }),
};

export default api;

import apiService from "./apiService";

// Lead import management client (backend: /api/lead-imports). The workbook is
// re-sent on each step (inspect -> validate -> commit) so the server keeps no
// temporary files; identity/company come from the JWT only.

const form = (file, options) => {
  const f = new FormData();
  f.append("file", file);
  if (options) f.append("options", JSON.stringify(options));
  return f;
};
const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const leadImportApi = {
  inspect: async (file) => (await apiService.post("/lead-imports/inspect", form(file), multipart)).data,
  validate: async (file, options) => (await apiService.post("/lead-imports/validate", form(file, options), multipart)).data,
  commit: async (file, options, onProgress) =>
    (
      await apiService.post("/lead-imports/commit", form(file, options), {
        ...multipart,
        onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
      })
    ).data,
  summary: async () => (await apiService.get("/lead-imports/summary")).data,
  batches: async (page = 1, limit = 10) => (await apiService.get("/lead-imports/batches", { params: { page, limit } })).data,
  batch: async (id) => (await apiService.get(`/lead-imports/batches/${id}`)).data,
  rows: async (id, params) => (await apiService.get(`/lead-imports/batches/${id}/rows`, { params })).data,
};

export const importErrorMessage = (err, fallback = "Something went wrong.") => err?.response?.data?.message || err?.message || fallback;

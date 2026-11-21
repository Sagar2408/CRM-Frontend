// Process Person follow-up workspace API calls: right URL / verb / body, bearer token, and - the bug
// this replaces - a non-2xx answer is an Error, never a silent success.
import {
  createProcessFollowUpEntryApi,
  updateProcessFollowUpEntryApi,
  createProcessMeetingApi,
  getProcessClientDetailsApi,
  updateProcessClientDetailsApi,
  getProcessDocumentTypesApi,
  createProcessDocumentTypeApi,
  renameProcessDocumentTypeApi,
  deleteProcessDocumentTypeApi,
  rejectProcessClientApi,
  moveProcessClientToFinalApi,
} from "./processService";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const base = process.env.REACT_APP_API_BASE_URL;

beforeEach(() => {
  localStorage.setItem("token", "tok");
  global.fetch = jest.fn().mockResolvedValue(reply(200, {}));
});
afterEach(() => localStorage.clear());

const last = () => {
  const [url, init] = global.fetch.mock.calls[global.fetch.mock.calls.length - 1];
  return { url: String(url).replace(String(base), ""), init };
};

describe("follow-up writes", () => {
  test("create -> POST /process-history/process-followup/create with bearer token and JSON body", async () => {
    const payload = { fresh_lead_id: 10, comments: "x" };
    await createProcessFollowUpEntryApi(payload);
    const { url, init } = last();
    expect(url).toBe("/process-history/process-followup/create");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  test("update -> PUT .../entry/:id ; meeting, reject and final hit their own endpoints", async () => {
    await updateProcessFollowUpEntryApi(5, { comments: "y" });
    expect(last()).toMatchObject({ url: "/process-history/process-followup/entry/5", init: { method: "PUT" } });
    await createProcessMeetingApi({ a: 1 });
    expect(last().url).toBe("/process-history/process-followp/create-meeting");
    await rejectProcessClientApi({ a: 1 });
    expect(last().url).toBe("/process-history/process-followup/reject");
    await moveProcessClientToFinalApi({ a: 1 });
    expect(last().url).toBe("/processed/create");
  });

  test("a 400 with field errors becomes an Error carrying them (not a silent success)", async () => {
    global.fetch.mockResolvedValue(reply(400, { message: "Invalid request body.", errors: [{ field: "follow_up_date", message: "'follow_up_date' must be YYYY-MM-DD" }] }));
    await expect(createProcessFollowUpEntryApi({})).rejects.toThrow(/Invalid request body\..*follow_up_date/);
  });

  test("a 500 / unreadable body falls back to the default message and keeps the status", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    const err = await createProcessFollowUpEntryApi({}).catch((e) => e);
    expect(err.message).toBe("Failed to save the follow-up");
    expect(err.status).toBe(500);
  });

  test("a network failure rejects", async () => {
    global.fetch.mockRejectedValue(new Error("offline"));
    await expect(createProcessFollowUpEntryApi({})).rejects.toThrow("offline");
  });
});

describe("client details", () => {
  test("GET / PUT client details by customer id", async () => {
    global.fetch.mockResolvedValue(reply(200, { client: { id: 3, education: "MBA" } }));
    await expect(getProcessClientDetailsApi(3)).resolves.toEqual({ id: 3, education: "MBA" });
    expect(last().url).toBe("/processperson/customers/3/client-details");
    await updateProcessClientDetailsApi(3, { state: "Goa" });
    expect(last()).toMatchObject({ url: "/processperson/customers/3/client-details", init: { method: "PUT" } });
    expect(JSON.parse(last().init.body)).toEqual({ state: "Goa" });
  });

  test("a 404 (someone else's client) is an error the page can show", async () => {
    global.fetch.mockResolvedValue(reply(404, { message: "Client not found." }));
    await expect(getProcessClientDetailsApi(9)).rejects.toThrow("Client not found.");
  });
});

describe("document types", () => {
  test("list / add / rename / delete", async () => {
    global.fetch.mockResolvedValue(reply(200, { documents: [{ id: 1, name: "Passport" }] }));
    await expect(getProcessDocumentTypesApi()).resolves.toEqual([{ id: 1, name: "Passport" }]);
    expect(last().url).toBe("/processperson/document-types");
    await createProcessDocumentTypeApi("Visa");
    expect(last()).toMatchObject({ url: "/processperson/document-types", init: { method: "POST" } });
    expect(JSON.parse(last().init.body)).toEqual({ name: "Visa" });
    await renameProcessDocumentTypeApi(4, "Visa copy");
    expect(last()).toMatchObject({ url: "/processperson/document-types/4", init: { method: "PUT" } });
    await deleteProcessDocumentTypeApi(4);
    expect(last()).toMatchObject({ url: "/processperson/document-types/4", init: { method: "DELETE" } });
  });

  test("a duplicate name is reported with the server message", async () => {
    global.fetch.mockResolvedValue(reply(409, { message: "A document type with this name already exists." }));
    await expect(createProcessDocumentTypeApi("Passport")).rejects.toThrow("already exists");
  });
});

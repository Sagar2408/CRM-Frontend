import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import LeadImportDashboard from "./LeadImportDashboard";
import { leadImportApi } from "../../services/leadImportApi";

// axios (pulled in by apiService) ships ESM this CRA/jest setup cannot parse,
// so the API layer is replaced by a controllable fake.
jest.mock("../../services/leadImportApi", () => ({
  leadImportApi: {
    inspect: jest.fn(),
    validate: jest.fn(),
    commit: jest.fn(),
    summary: jest.fn(),
    batches: jest.fn(),
    batch: jest.fn(),
    rows: jest.fn(),
  },
  importErrorMessage: (e, f) => e?.response?.data?.message || e?.message || f,
}));

const BATCH = {
  id: 7, sourceId: 1, workbookName: "Master Leads.xlsx", sheetName: "Leads", uploadedAt: "2026-11-10T09:30:00.000Z", completedAt: "2026-11-10T09:31:00.000Z",
  uploadedBy: "Alice Admin", totalRows: 200, inserted: 100, duplicates: 100, skipped: 0, failed: 0, status: "completed", startRow: null, error: null,
};
const SHEET = (over = {}) => ({
  name: "Leads", empty: false, totalRows: 200, headers: ["Sr No", "Full Name", "Email Address", "Mobile"],
  previewRows: [{ rowNumber: 2, cells: ["1", "Lead 1", "lead1@example.com", "9876510001"] }, { rowNumber: 3, cells: ["2", "Lead 2", "lead2@example.com", "9876510002"] }],
  suggestedMapping: { name: "Full Name", email: "Email Address", phone: "Mobile" }, suggestedIdentifier: "Sr No", matchedSourceId: null, ...over,
});
const INSPECT = (over = {}) => ({
  workbookName: "Master Leads.xlsx", fileHash: "h", previouslyImported: null, sheets: [SHEET()],
  sources: [{ id: 1, label: "Master list", workbookName: "Master Leads.xlsx", sheetName: "Leads", keyMode: "serial", identifierColumn: "Sr No", lastImportAt: "2026-11-10T09:31:00.000Z" }], ...over,
});
const excel = (name = "Master Leads.xlsx", size = 1000) => {
  const f = new File(["x"], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

beforeEach(() => {
  jest.clearAllMocks();
  leadImportApi.summary.mockResolvedValue({ totalImports: 2, totalRows: 300, newLeads: 200, duplicatesSkipped: 100, latest: BATCH });
  leadImportApi.batches.mockResolvedValue({ batches: [BATCH, { ...BATCH, id: 6, workbookName: "First.xlsx", inserted: 100, duplicates: 0, status: "completed_with_errors", failed: 3 }], total: 2, page: 1, limit: 10 });
  leadImportApi.inspect.mockResolvedValue(INSPECT());
});

const openWizard = async () => {
  render(<LeadImportDashboard />);
  await screen.findByText("First.xlsx");
  fireEvent.click(screen.getByRole("button", { name: "Upload New Leads" }));
  return screen.findByRole("dialog", { name: "Upload New Leads" });
};
const choose = async (dialog, file = excel()) => {
  fireEvent.change(within(dialog).getByTestId("li-file"), { target: { files: [file] } });
};

describe("Import dashboard", () => {
  test("summary cards, latest import, history table and the Upload New Leads button", async () => {
    render(<LeadImportDashboard />);
    await screen.findByText("First.xlsx");
    expect(screen.getByTestId("card-imports")).toHaveTextContent("Total Imports2");
    expect(screen.getByTestId("card-rows")).toHaveTextContent("Total Rows Uploaded300");
    expect(screen.getByTestId("card-new")).toHaveTextContent("New Leads Imported200");
    expect(screen.getByTestId("card-dup")).toHaveTextContent("Duplicate Rows Skipped100");
    const latest = screen.getByRole("region", { name: "Latest import" });
    expect(within(latest).getByText("Master Leads.xlsx")).toBeInTheDocument();
    expect(within(latest).getByText("Completed")).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Import history" });
    for (const h of ["Workbook", "Sheet", "Uploaded", "Uploaded by", "Total rows", "New leads", "Duplicates", "Failed", "Status"]) {
      expect(within(history).getByText(h)).toBeInTheDocument();
    }
    expect(within(history).getByText("Completed with errors")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload New Leads" })).toBeInTheDocument();
  });

  test("empty state and load error", async () => {
    leadImportApi.summary.mockResolvedValue({ totalImports: 0, totalRows: 0, newLeads: 0, duplicatesSkipped: 0, latest: null });
    leadImportApi.batches.mockResolvedValue({ batches: [], total: 0, page: 1, limit: 10 });
    const { unmount } = render(<LeadImportDashboard />);
    expect(await screen.findByText("No imports yet.")).toBeInTheDocument();
    expect(screen.getByText(/No workbook has been imported yet/)).toBeInTheDocument();
    unmount();
    leadImportApi.summary.mockRejectedValue(new Error("boom"));
    render(<LeadImportDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  test("View Details shows the import and its row-wise results with a status filter", async () => {
    leadImportApi.batch.mockResolvedValue({ ...BATCH, mapping: { name: "Full Name" }, source: { id: 1, label: "Master list", keyMode: "serial", identifierColumn: "Sr No" } });
    leadImportApi.rows.mockResolvedValue({ rows: [{ rowNumber: 2, status: "inserted", reason: null, name: "Lead 1", leadKey: "1", clientLeadId: 5 }, { rowNumber: 9, status: "failed", reason: "Invalid email address", name: "Bad", leadKey: "8" }], total: 2, page: 1, limit: 25 });
    render(<LeadImportDashboard />);
    await screen.findByText("First.xlsx");
    fireEvent.click(screen.getByLabelText("View details for Master Leads.xlsx"));
    const dialog = await screen.findByRole("dialog", { name: "Import details" });
    expect(await within(dialog).findByText("Invalid email address")).toBeInTheDocument();
    expect(within(dialog).getByText("Alice Admin")).toBeInTheDocument();
    expect(within(dialog).getByText('Column "Sr No"')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Failed" }));
    await waitFor(() => expect(leadImportApi.rows).toHaveBeenLastCalledWith(7, { page: 1, limit: 25, status: "failed" }));
  });
});

describe("Upload wizard", () => {
  test("rejects non-Excel and oversized files without calling the server", async () => {
    const dialog = await openWizard();
    await choose(dialog, new File(["a,b"], "leads.csv"));
    expect(await within(dialog).findByText(/Only Excel files/)).toBeInTheDocument();
    await choose(dialog, excel("big.xlsx", 11 * 1024 * 1024));
    expect(await within(dialog).findByText(/10MB or smaller/)).toBeInTheDocument();
    expect(leadImportApi.inspect).not.toHaveBeenCalled();
  });

  test("shows preview, sheet picker for multi-sheet workbooks, and suggested mapping/identifier", async () => {
    leadImportApi.inspect.mockResolvedValue(INSPECT({ sheets: [SHEET(), SHEET({ name: "Second", totalRows: 5, suggestedIdentifier: null, suggestedMapping: { name: "Full Name" } })] }));
    const dialog = await openWizard();
    await choose(dialog);
    expect(await within(dialog).findByText("Master Leads.xlsx")).toBeInTheDocument();
    expect(within(dialog).getByText(/Preview \(first 2 of 200 rows\)/)).toBeInTheDocument();
    expect(within(dialog).getByText("lead1@example.com")).toBeInTheDocument();
    const sheet = within(dialog).getByLabelText("Sheet");
    expect(within(sheet).getAllByRole("option").map((o) => o.textContent)).toEqual(["Leads (200 rows)", "Second (5 rows)"]);
    expect(within(dialog).getByLabelText("Map Name")).toHaveValue("Full Name");
    expect(within(dialog).getByLabelText("Identifier column")).toHaveValue("Sr No");
    fireEvent.change(sheet, { target: { value: "Second" } });
    expect(within(dialog).getByLabelText("Identifier column")).toHaveValue(""); // no serial column => ask for starting row
    expect(within(dialog).getByLabelText("Starting row")).toBeInTheDocument();
  });

  test("without a serial column the Admin must give a starting row (no silent duplicate import)", async () => {
    leadImportApi.inspect.mockResolvedValue(INSPECT({ sheets: [SHEET({ suggestedIdentifier: null })] }));
    const dialog = await openWizard();
    await choose(dialog);
    await within(dialog).findByLabelText("Starting row");
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/starting row/i);
    expect(leadImportApi.validate).not.toHaveBeenCalled();
    leadImportApi.validate.mockResolvedValue({ sheet: "Leads", counts: { total: 200, new: 100, duplicate: 0, failed: 0, skipped: 100 }, issues: [], issuesTruncated: false });
    fireEvent.change(within(dialog).getByLabelText("Starting row"), { target: { value: "101" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    await within(dialog).findByText("Before starting row");
    expect(leadImportApi.validate.mock.calls[0][1]).toMatchObject({ sheet: "Leads", startRow: 101, sourceMode: "new" });
    expect(leadImportApi.validate.mock.calls[0][1].identifierColumn).toBeUndefined();
  });

  test("Name mapping is required", async () => {
    const dialog = await openWizard();
    await choose(dialog);
    await within(dialog).findByLabelText("Map Name");
    fireEvent.change(within(dialog).getByLabelText("Map Name"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Name/);
    expect(leadImportApi.validate).not.toHaveBeenCalled();
  });

  test("preselects the matching existing source and lets the Admin choose a new one; warns on a previously imported file", async () => {
    leadImportApi.inspect.mockResolvedValue(INSPECT({ previouslyImported: { batchId: 7, at: "2026-11-10T09:31:00.000Z", inserted: 100 }, sheets: [SHEET({ matchedSourceId: 1 })] }));
    const dialog = await openWizard();
    await choose(dialog);
    expect(await within(dialog).findByText(/already imported on/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Existing source")).toHaveValue("existing:1");
    leadImportApi.validate.mockResolvedValue({ sheet: "Leads", counts: { total: 200, new: 100, duplicate: 100, failed: 0, skipped: 0 }, issues: [], issuesTruncated: false });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    await within(dialog).findByText("New leads to import");
    expect(leadImportApi.validate.mock.calls[0][1]).toMatchObject({ sourceMode: "existing", sourceId: 1, identifierColumn: "Sr No" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    fireEvent.click(within(dialog).getByLabelText("This is a new source"));
    fireEvent.change(within(dialog).getByLabelText("Source name"), { target: { value: "Another list" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    await waitFor(() => expect(leadImportApi.validate).toHaveBeenCalledTimes(2));
    expect(leadImportApi.validate.mock.calls[1][1]).toMatchObject({ sourceMode: "new", sourceLabel: "Another list" });
  });

  test("review lists invalid rows and duplicates, then import shows the inserted/skipped/duplicate/failed summary", async () => {
    leadImportApi.validate.mockResolvedValue({
      sheet: "Leads", counts: { total: 10, new: 6, duplicate: 2, failed: 2, skipped: 0 },
      issues: [{ rowNumber: 4, status: "failed", reason: "Invalid email address", name: "Bad Email", key: "3" }, { rowNumber: 5, status: "duplicate", reason: "Already imported from this source", name: "Old", key: "4" }], issuesTruncated: false,
    });
    leadImportApi.commit.mockResolvedValue({ batchId: 9, sourceId: 1, status: "completed_with_errors", summary: { total: 10, inserted: 6, duplicate: 2, skipped: 0, failed: 2 } });
    const onViewDetails = jest.fn();
    render(<LeadImportDashboard />);
    await screen.findByText("First.xlsx");
    fireEvent.click(screen.getByRole("button", { name: "Upload New Leads" }));
    const dialog = await screen.findByRole("dialog", { name: "Upload New Leads" });
    await choose(dialog);
    await within(dialog).findByLabelText("Map Name");
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    expect(await within(dialog).findByText("Invalid email address")).toBeInTheDocument();
    expect(within(dialog).getByText("Already imported from this source")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Import 6 new leads" }));
    await within(dialog).findByText(/completed with some rows not imported/i);
    expect(leadImportApi.commit.mock.calls[0][1]).toMatchObject({ sheet: "Leads", identifierColumn: "Sr No" });
    for (const label of ["Inserted", "Duplicates skipped", "Skipped (before start)", "Failed"]) expect(within(dialog).getByText(label)).toBeInTheDocument();
    expect(within(dialog).getByText("New leads are now available in Lead Assign.")).toBeInTheDocument();
    expect(leadImportApi.summary.mock.calls.length).toBeGreaterThan(1); // dashboard refreshed
    expect(onViewDetails).not.toHaveBeenCalled();
  });

  test("nothing new => import is disabled; server errors are shown", async () => {
    leadImportApi.validate.mockResolvedValue({ sheet: "Leads", counts: { total: 100, new: 0, duplicate: 100, failed: 0, skipped: 0 }, issues: [], issuesTruncated: false });
    const dialog = await openWizard();
    await choose(dialog);
    await within(dialog).findByLabelText("Map Name");
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    expect(await within(dialog).findByRole("button", { name: "Nothing new to import" })).toBeDisabled();

    leadImportApi.validate.mockRejectedValue({ response: { data: { message: "Another import for this source is already running." } } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Review import" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("already running");
  });
});

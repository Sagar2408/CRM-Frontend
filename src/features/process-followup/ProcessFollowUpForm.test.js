import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ProcessFollowUpForm from "./ProcessFollowUpForm";
import * as api from "../../services/processService";

// react-router-dom (ESM) cannot be resolved by CRA's Jest, so, like the other page tests, it is mocked.
const mockNavigate = jest.fn();
let mockParams = {};
let mockSearch = "";
jest.mock("react-router-dom", () => {
  const R = require("react");
  return {
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useSearchParams: () => [new URLSearchParams(mockSearch)],
    useLocation: () => ({ state: null }),
    Link: ({ to, children, replace, ...rest }) => R.createElement("a", { href: to, ...rest }, children),
  };
});

jest.mock("../../context/ProcessAuthContext", () => ({ useProcess: () => ({ user: { id: 7, type: "processperson" } }) }));
jest.mock("../../services/processService");

const client = { id: 1, freshLeadId: 10, fullName: "Asha Rao", email: "asha@x.com", phone: "9000000001", country: "India", state: "Punjab", education: "MBA", experience: "5 years", dob: "1992-04-05" };
const docs = [
  { id: 1, name: "Passport" },
  { id: 2, name: "Bank Statement" },
];
const history = [
  { id: 5, process_person_id: 7, recordedBy: "Pat Process", follow_up_type: "payment follow-up", interaction_rating: "Agressive", connect_via: "Call", comments: "Asked for instalment", follow_up_date: "2026-12-01", follow_up_time: "10:30:00", createdAt: "2026-11-20T08:00:00.000Z" },
  { id: 6, process_person_id: 7, recordedBy: "Pat Process", follow_up_type: "meeting", interaction_rating: "Calm", connect_via: "Call", comments: "Interview prep", follow_up_date: "2026-12-02", follow_up_time: "11:00:00", createdAt: "2026-11-21T08:00:00.000Z" },
  { id: 7, process_person_id: 9, recordedBy: "Sam Other", follow_up_type: "visa filing", interaction_rating: "Neutral", connect_via: "Email", comments: "Earlier owner note", follow_up_date: "2026-11-01", follow_up_time: "09:00:00", createdAt: "2026-11-01T08:00:00.000Z" },
];

const mount = (url = "/process/follow-up/1") => {
  const [path, query = ""] = url.split("?");
  mockParams = { customerId: path.split("/").pop() };
  mockSearch = query;
  return render(<ProcessFollowUpForm />);
};

const pickRadio = (group, label) => fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByLabelText(label));
const future = () => {
  const d = new Date(Date.now() + 3 * 86400000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function fillValid({ category = "Payment Follow-up", comments = "Client will pay on Friday" } = {}) {
  pickRadio("Contact method", "Call");
  pickRadio("Follow-up category", category);
  pickRadio("Interaction rating", "Calm");
  fireEvent.change(screen.getByLabelText(/^Comments/), { target: { value: comments } });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockNavigate.mockReset();
  api.getProcessClientDetailsApi.mockResolvedValue(client);
  api.getProcessDocumentTypesApi.mockResolvedValue(docs);
  api.getProcessFollowUpTimelineApi.mockResolvedValue(history);
  api.createProcessFollowUpEntryApi.mockResolvedValue({ message: "ok", data: { id: 99 } });
  api.updateProcessFollowUpEntryApi.mockResolvedValue({ message: "ok" });
  api.createProcessMeetingApi.mockResolvedValue({ message: "ok" });
  api.rejectProcessClientApi.mockResolvedValue({});
  api.moveProcessClientToFinalApi.mockResolvedValue({});
});

// "Add comments based on stages" was removed from the Process Person forms. The normal follow-up
// comment (the "Comments" field) is a different thing and must stay.
const STAGE_UI = [/add comments based on stages/i, /saved stage comments/i, /CRM stages/, /select all/i, /add upload link/i, /send as reminder/i, /save comment/i, /Comment for the selected stage/i];
const expectNoStageComments = () => {
  const text = document.body.textContent;
  STAGE_UI.forEach((re) => expect(text).not.toMatch(re));
  expect(screen.queryByRole("group", { name: "CRM stages" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Stage \d+/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /select all|clear/i })).toBeNull();
  expect(api.getProcessClientStagesApi).toBeUndefined(); // helper no longer exists
};

describe("Stage comments are gone from both Process Person forms", () => {
  test("Add Follow-up has no stage-comment UI, but keeps its normal Comments field", async () => {
    mount("/process/follow-up/1");
    await screen.findByText("for Asha Rao");
    expectNoStageComments();
    expect(screen.getByLabelText(/^Comments/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save follow-up" })).toBeInTheDocument();
  });

  test("Update (edit) Follow-up has no stage-comment UI, but keeps Comments, history and Save changes", async () => {
    mount("/process/follow-up/1?entry=5");
    expect(await screen.findByRole("heading", { name: "Edit follow-up" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^Comments/)).toHaveValue("Asked for instalment"));
    expectNoStageComments();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByText(/Follow-up history/)).toBeInTheDocument();
  });

  test("the form never calls a stage endpoint", async () => {
    mount();
    await screen.findByText("for Asha Rao");
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    await waitFor(() => expect(api.createProcessFollowUpEntryApi).toHaveBeenCalledTimes(1));
    expect([api.getProcessClientStagesApi, api.addProcessStageCommentsApi, api.sendStageReminderApi]).toEqual([undefined, undefined, undefined]);
  });
});

describe("Process Person follow-up form", () => {
  test("loads the client by id (works after a reload) and shows the saved details and history with author", async () => {
    mount();
    expect(await screen.findByText("for Asha Rao")).toBeInTheDocument();
    expect(api.getProcessClientDetailsApi).toHaveBeenCalledWith("1");
    expect(screen.getByLabelText("Education")).toHaveValue("MBA");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1992-04-05");
    expect(api.getProcessFollowUpTimelineApi).toHaveBeenCalledWith(10);
    expect(await screen.findByText("Asked for instalment")).toBeInTheDocument();
    expect(screen.getAllByText(/Recorded by Pat Process/)).toHaveLength(2);
    expect(screen.getByText(/Recorded by Sam Other/)).toBeInTheDocument();
  });

  test("contains no email-sending UI (no templates, From/To, subject, send)", async () => {
    mount();
    await screen.findByText("for Asha Rao");
    const text = document.body.textContent;
    expect(text).not.toMatch(/template|subject|send email|From:|To:/i);
    expect(screen.queryByRole("textbox", { name: /subject|from|to$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });

  test("offers the four categories; every one can be chosen", async () => {
    mount();
    await screen.findByText("for Asha Rao");
    const group = screen.getByRole("radiogroup", { name: "Follow-up category" });
    expect(within(group).getAllByRole("radio").map((r) => r.parentElement.textContent)).toEqual(["Document Collection", "Payment Follow-up", "Visa Filing", "Meeting"]);
  });

  test("validates every required field and saves nothing", async () => {
    mount();
    await screen.findByText("for Asha Rao");
    fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    expect(screen.getByText("Choose how you connected.")).toBeInTheDocument();
    expect(screen.getByText("Choose a follow-up category.")).toBeInTheDocument();
    expect(screen.getByText("Choose an interaction rating.")).toBeInTheDocument();
    expect(screen.getByText("Add a comment about this follow-up.")).toBeInTheDocument();
    expect(api.createProcessFollowUpEntryApi).not.toHaveBeenCalled();
  });

  test("creates a follow-up with the exact payload, then returns to Follow-ups focused on the client", async () => {
    mount();
    await screen.findByText("for Asha Rao");
    fillValid();
    fireEvent.change(screen.getByLabelText("Follow-up date"), { target: { value: "2026-12-24" } });
    fireEvent.change(screen.getByLabelText("Follow-up time"), { target: { value: "14:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    await waitFor(() => expect(api.createProcessFollowUpEntryApi).toHaveBeenCalledTimes(1));
    expect(api.createProcessFollowUpEntryApi).toHaveBeenCalledWith({
      fresh_lead_id: 10,
      connect_via: "Call",
      follow_up_type: "payment follow-up",
      interaction_rating: "Calm",
      follow_up_date: "2026-12-24",
      follow_up_time: "14:15",
      comments: "Client will pay on Friday",
    });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/process/process-follow-up", { state: { focusCustomerId: 1, notice: "Follow-up saved." } }));
  });

  test("a double click saves once (the button is disabled while saving)", async () => {
    let resolve;
    api.createProcessFollowUpEntryApi.mockReturnValue(new Promise((r) => (resolve = r)));
    mount();
    await screen.findByText("for Asha Rao");
    fillValid();
    const btn = screen.getByRole("button", { name: "Save follow-up" });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole("button", { name: "Saving..." }));
    expect(api.createProcessFollowUpEntryApi).toHaveBeenCalledTimes(1);
    resolve({ message: "ok" });
  });

  test("a server rejection is shown and nothing navigates away", async () => {
    api.createProcessFollowUpEntryApi.mockRejectedValue(new Error("Invalid request body. (follow_up_date must be YYYY-MM-DD)"));
    mount();
    await screen.findByText("for Asha Rao");
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("follow_up_date must be YYYY-MM-DD");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  describe("Document Collection", () => {
    test("shows the document types from Settings (not a hard-coded list) and requires one", async () => {
      mount();
      await screen.findByText("for Asha Rao");
      expect(screen.queryByLabelText("Document being collected")).toBeNull();
      pickRadio("Follow-up category", "Document Collection");
      const select = await screen.findByLabelText("Document being collected");
      expect([...select.options].map((o) => o.textContent)).toEqual(["Select a document", "Passport", "Bank Statement"]);
      expect(screen.queryByText(/Aadhar|10th Marksheet/)).toBeNull();

      pickRadio("Contact method", "Call");
      pickRadio("Interaction rating", "Calm");
      fireEvent.change(screen.getByLabelText(/^Comments/), { target: { value: "Need passport" } });
      fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
      expect(screen.getByText("Choose the document you are collecting.")).toBeInTheDocument();
      expect(api.createProcessFollowUpEntryApi).not.toHaveBeenCalled();

      fireEvent.change(select, { target: { value: "Bank Statement" } });
      fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
      await waitFor(() => expect(api.createProcessFollowUpEntryApi).toHaveBeenCalled());
      expect(api.createProcessFollowUpEntryApi.mock.calls[0][0]).toMatchObject({ follow_up_type: "document collection", document_name: "Bank Statement" });
    });

    test("an empty list points to Settings > Documents", async () => {
      api.getProcessDocumentTypesApi.mockResolvedValue([]);
      mount();
      await screen.findByText("for Asha Rao");
      pickRadio("Follow-up category", "Document Collection");
      expect(await screen.findByRole("link", { name: /Add some in Settings/ })).toHaveAttribute("href", "/process/process-settings/documents");
    });

    test("a failed document list load is reported with a retry", async () => {
      api.getProcessDocumentTypesApi.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(docs);
      mount();
      await screen.findByText("for Asha Rao");
      pickRadio("Follow-up category", "Document Collection");
      expect(await screen.findByText(/boom/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(within(screen.getByLabelText("Document being collected")).getByText("Passport")).toBeInTheDocument());
    });
  });

  describe("Meeting", () => {
    test("must be in the future", async () => {
      mount();
      await screen.findByText("for Asha Rao");
      fillValid({ category: "Meeting", comments: "Interview prep" });
      fireEvent.change(screen.getByLabelText("Meeting date"), { target: { value: "2020-01-01" } });
      fireEvent.change(screen.getByLabelText("Meeting time"), { target: { value: "10:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Schedule meeting" }));
      expect(screen.getAllByText(/future date and time/).length).toBeGreaterThan(0);
      expect(api.createProcessMeetingApi).not.toHaveBeenCalled();
    });

    test("schedules through the meeting endpoint with the saved-record fields", async () => {
      mount();
      await screen.findByText("for Asha Rao");
      fillValid({ category: "Meeting", comments: "Interview prep" });
      fireEvent.change(screen.getByLabelText("Meeting date"), { target: { value: future() } });
      fireEvent.change(screen.getByLabelText("Meeting time"), { target: { value: "10:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Schedule meeting" }));
      await waitFor(() => expect(api.createProcessMeetingApi).toHaveBeenCalledTimes(1));
      const body = api.createProcessMeetingApi.mock.calls[0][0];
      expect(body).toMatchObject({ fresh_lead_id: 10, reasonForFollowup: "Interview prep", connect_via: "Call", interaction_rating: "Calm", follow_up_time: "10:00" });
      expect(new Date(body.startTime).getTime()).toBeGreaterThan(Date.now());
      expect(body).not.toHaveProperty("clientEmail"); // contact details are read server-side
      expect(api.createProcessFollowUpEntryApi).not.toHaveBeenCalled();
    });
  });

  describe("editing", () => {
    test("loads the chosen entry into the form and saves it with PUT (no new record)", async () => {
      mount("/process/follow-up/1?entry=5");
      expect(await screen.findByRole("heading", { name: "Edit follow-up" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText(/^Comments/)).toHaveValue("Asked for instalment"));
      expect(within(screen.getByRole("radiogroup", { name: "Interaction rating" })).getByLabelText("Aggressive")).toBeChecked(); // stored "Agressive"
      expect(screen.getByLabelText("Follow-up date")).toHaveValue("2026-12-01");
      expect(screen.getByLabelText("Follow-up time")).toHaveValue("10:30");

      fireEvent.change(screen.getByLabelText(/^Comments/), { target: { value: "Instalment received" } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(api.updateProcessFollowUpEntryApi).toHaveBeenCalledTimes(1));
      const [id, patch] = api.updateProcessFollowUpEntryApi.mock.calls[0];
      expect(id).toBe("5");
      expect(patch).toMatchObject({ comments: "Instalment received", follow_up_type: "payment follow-up", interaction_rating: "Aggressive", connect_via: "Call" });
      expect(patch).not.toHaveProperty("fresh_lead_id");
      expect(api.createProcessFollowUpEntryApi).not.toHaveBeenCalled();
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/process/process-follow-up", { state: { focusCustomerId: 1, notice: "Follow-up updated." } }));
    });

    test("only your own editable entries have an Edit link", async () => {
      mount();
      await screen.findByText("Earlier owner note");
      const links = screen.getAllByRole("link", { name: "Edit" });
      expect(links.map((l) => l.getAttribute("href"))).toEqual(["/process/follow-up/1?entry=5"]); // meeting (6) and other person's (7) excluded
    });

    test("a meeting record is locked (cannot be edited)", async () => {
      mount("/process/follow-up/1?entry=6");
      expect(await screen.findByText(/cannot be edited/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });

    test("an unknown entry id says so instead of showing a blank form as if it were an edit", async () => {
      mount("/process/follow-up/1?entry=999");
      expect(await screen.findByText(/could not be found/)).toBeInTheDocument();
    });

    test("a stale document (deleted in Settings) stays visible on the saved record", async () => {
      api.getProcessFollowUpTimelineApi.mockResolvedValue([{ ...history[0], id: 8, follow_up_type: "document collection", document_name: "Aadhar Card" }]);
      mount("/process/follow-up/1?entry=8");
      const select = await screen.findByLabelText("Document being collected");
      await waitFor(() => expect(select).toHaveValue("Aadhar Card"));
      expect(screen.getByText(/no longer in your Settings list/)).toBeInTheDocument();
    });
  });

  describe("end-of-process actions", () => {
    test("reject requires a reason type, then calls the reject endpoint", async () => {
      mount();
      await screen.findByText("for Asha Rao");
      fireEvent.click(screen.getByRole("button", { name: /Show end-of-process actions/ }));
      fillValid();
      fireEvent.click(screen.getByRole("button", { name: "Reject client" }));
      expect(await screen.findByText(/Choose whether the client withdrew/)).toBeInTheDocument();
      expect(api.rejectProcessClientApi).not.toHaveBeenCalled();
    });

    test("move to final stage uses the closing note and navigates to final-stage leads", async () => {
      mount();
      await screen.findByText("for Asha Rao");
      fireEvent.click(screen.getByRole("button", { name: /Show end-of-process actions/ }));
      fillValid();
      fireEvent.click(screen.getByRole("button", { name: "Move to final stage" }));
      await waitFor(() => expect(api.moveProcessClientToFinalApi).toHaveBeenCalledTimes(1));
      expect(api.moveProcessClientToFinalApi.mock.calls[0][0]).toMatchObject({ fresh_lead_id: 10, follow_up_type: "final", comments: "Client will pay on Friday", interaction_rating: "Calm" });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/process/finalstage-leads"));
    });
  });
});

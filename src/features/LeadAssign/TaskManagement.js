import React, { useEffect, useState, useContext, useRef } from "react";
import { Alert, soundManager } from "../modal/alert";
import { useApi } from "../../context/ApiContext";
import { ThemeContext } from "../../features/admin/ThemeContext";
import SidebarToggle from "../admin/SidebarToggle";
import "../../styles/leadassign.css";
import "../../styles/alert.css";
import { useLoading } from "../../context/LoadingContext";
import AdminSpinner from "../spinner/AdminSpinner";
import { useProcessService } from "../../context/ProcessServiceContext";

// Tab key -> label. The key is sent verbatim as the `status` query param and
// mapped to ClientLead.status on the server (see LEAD_STATUS_FILTERS in
// CRM-Backend/controllers/ClientLead.controller.js).
export const STATUS_TABS = [
  { key: "all", label: "All", countKey: "all" },
  { key: "new", label: "New", countKey: "New" },
  { key: "fresh", label: "Fresh", countKey: "Assigned" },
  { key: "followup", label: "Followup", countKey: "Follow-Up" },
  { key: "converted", label: "Converted", countKey: "Converted" },
  { key: "closed", label: "Closed", countKey: "Closed" },
  { key: "meeting", label: "Meeting", countKey: "Meeting" },
];

const TaskManagement = () => {
  const { getAllProcessPersons, createProcesstoConverted } = useProcessService();
  const {
    fetchAllClients,
    reassignLead,
    fetchExecutivesAPI,
    assignLeadAPI,
    createFreshLeadAPI,
    createLeadAPI,
    updateClientLead,
    deleteClientLead,
    triggerDashboardRefresh,
  } = useApi();
  const { theme } = useContext(ThemeContext);
  const { isLoading, variant, showLoader, hideLoader } = useLoading();

  // Assignment target
  const [viewMode, setViewMode] = useState("executive"); // "executive" | "process"
  const [executives, setExecutives] = useState([]);
  const [processPersons, setProcessPersons] = useState([]);
  const [selectedExecutive, setSelectedExecutive] = useState("");
  const [selectedProcess, setSelectedProcess] = useState("");

  // Lead list (server-side filtered + paginated)
  const [statusTab, setStatusTab] = useState("all");
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Selection survives pagination within one tab: id -> lead
  const [selected, setSelected] = useState({});
  const [expandedLeads, setExpandedLeads] = useState({});
  const [isAssigning, setIsAssigning] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem("adminSidebarExpanded") === "false"
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const requestSeq = useRef(0);
  const totalPages = Math.max(1, Math.ceil(totalLeads / leadsPerPage));
  const selectedList = Object.values(selected);
  const isProcessMode = viewMode === "process";

  // ---- alerts -------------------------------------------------------------
  const generateId = () => Math.random().toString(36).substr(2, 9);
  const showAlert = (message, type = "info", title = "", duration = 5000, confirm = null) => {
    const id = generateId();
    setAlerts((prev) => [
      ...prev,
      { id, message, type, title: title || type.charAt(0).toUpperCase() + type.slice(1), duration, confirm },
    ]);
    soundManager.playSound(type);
    if (duration) {
      setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), duration);
    }
  };
  const closeAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  // ---- sidebar ------------------------------------------------------------
  useEffect(() => {
    const updateSidebarState = () => {
      const isExpanded = localStorage.getItem("adminSidebarExpanded") === "true";
      setSidebarCollapsed(!isExpanded);
    };
    window.addEventListener("sidebarToggle", updateSidebarState);
    updateSidebarState();
    return () => window.removeEventListener("sidebarToggle", updateSidebarState);
  }, []);

  // ---- employees ----------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        setExecutives((await fetchExecutivesAPI()) || []);
      } catch (error) {
        console.error("❌ Failed to load executives:", error);
      }
    })();
  }, [fetchExecutivesAPI]);

  useEffect(() => {
    (async () => {
      try {
        const persons = await getAllProcessPersons();
        setProcessPersons(persons?.processPersons || []);
      } catch (err) {
        console.error("Failed to load process persons", err);
      }
    })();
  }, [getAllProcessPersons]);

  // ---- debounce search ----------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (next !== prev) setCurrentPage(1);
        return next;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ---- load the current tab/page from the server -------------------------
  // One request per (tab, page, size, search). A sequence number discards
  // responses that arrive after the user has already switched tab, so rows from
  // one status can never appear under another.
  useEffect(() => {
    const seq = ++requestSeq.current;
    (async () => {
      setListLoading(true);
      try {
        const data = await fetchAllClients({
          status: statusTab,
          page: currentPage,
          limit: leadsPerPage,
          ...(search ? { search } : {}),
        });
        if (seq !== requestSeq.current) return;
        setLeads(Array.isArray(data?.leads) ? data.leads : []);
        setTotalLeads(data?.pagination?.total ?? data?.total ?? 0);
        setStatusCounts(data?.statusCounts || {});
      } catch (error) {
        if (seq !== requestSeq.current) return;
        console.error("Error fetching leads:", error);
        setLeads([]);
        setTotalLeads(0);
      } finally {
        if (seq === requestSeq.current) setListLoading(false);
      }
    })();
  }, [fetchAllClients, statusTab, currentPage, leadsPerPage, search, reloadKey]);

  // ---- handlers -----------------------------------------------------------
  const resetSelection = () => setSelected({});

  const handleStatusTab = (key) => {
    if (key === statusTab) return;
    setStatusTab(key);
    setCurrentPage(1);
    resetSelection();
  };

  const handleModeChange = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    resetSelection();
    // Process Persons can only receive Converted leads — jump straight there.
    if (mode === "process") handleStatusTab("converted");
  };

  const isSelectable = (lead) => !isProcessMode || lead.status === "Converted";

  const toggleLead = (lead) => {
    if (!isSelectable(lead)) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[lead.id]) delete next[lead.id];
      else next[lead.id] = lead;
      return next;
    });
  };

  const selectableOnPage = leads.filter(isSelectable);
  const allOnPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((l) => selected[l.id]);

  const togglePage = () => {
    setSelected((prev) => {
      const next = { ...prev };
      if (allOnPageSelected) selectableOnPage.forEach((l) => delete next[l.id]);
      else selectableOnPage.forEach((l) => (next[l.id] = l));
      return next;
    });
  };

  const handleReset = () => {
    resetSelection();
    setSelectedExecutive("");
    setSelectedProcess("");
    setSearchInput("");
    setSearch("");
    setCurrentPage(1);
  };

  const refreshList = () => setReloadKey((k) => k + 1);

  const assignToExecutive = async () => {
    const target = executives.find((e) => String(e.id) === selectedExecutive);
    if (!target || !target.username) {
      showAlert("Invalid executive selected.", "warning");
      return;
    }
    const targetName = target.username;
    let successCount = 0;
    let failCount = 0;

    for (const lead of selectedList) {
      const phone = String(lead.phone).replace(/[eE]+([0-9]+)/gi, "");
      const leadPayload = {
        name: lead.name,
        email: lead.email || "default@example.com",
        phone,
        source: lead.source || "Unknown",
        clientLeadId: Number(lead.id),
        assignedToExecutive: targetName,
      };
      try {
        if (!lead.assignedToExecutive) {
          const createdLead = await createLeadAPI(leadPayload);
          if (!createdLead?.id) throw new Error("Lead creation failed");
          await assignLeadAPI(Number(createdLead.clientLeadId), targetName);
          await createFreshLeadAPI({
            leadId: createdLead.id,
            name: createdLead.name,
            email: createdLead.email,
            phone: String(createdLead.phone),
            assignedTo: targetName,
            assignedToId: target.id,
            assignDate: new Date().toISOString(),
          });
        } else {
          await reassignLead(lead.id, targetName);
        }
        triggerDashboardRefresh();
        successCount++;
      } catch (err) {
        console.error(`❌ Error processing lead ID ${lead.id}:`, err);
        failCount++;
      }
    }
    return { successCount, failCount, targetName };
  };

  const assignToProcessPerson = async () => {
    const target = processPersons.find((p) => String(p.id) === selectedProcess);
    if (!target) {
      showAlert("Invalid process person selected.", "warning");
      return null;
    }
    const resp = await createProcesstoConverted({
      processPersonId: Number(selectedProcess),
      clientLeadIds: selectedList.map((l) => Number(l.id)),
    });
    const done = (resp.imported || 0) + (resp.reassigned || 0);
    return {
      successCount: done,
      failCount: (resp.skipped || 0) + (resp.errors?.filter((e) => e.clientLeadId).length || 0),
      targetName: target.fullName,
      errors: resp.errors || [],
    };
  };

  const handleAssign = async () => {
    if (isAssigning) return;
    if (isProcessMode ? !selectedProcess : !selectedExecutive) {
      showAlert(`Please select a ${isProcessMode ? "process person" : "executive"} first.`, "warning");
      return;
    }
    if (selectedList.length === 0) {
      showAlert("Please select at least one lead.", "warning");
      return;
    }

    setIsAssigning(true);
    try {
      showLoader("Assigning leads...", "admin");
      const result = isProcessMode ? await assignToProcessPerson() : await assignToExecutive();
      if (!result) return;
      const { successCount, failCount, targetName, errors } = result;

      if (successCount > 0 && failCount === 0) {
        showAlert(`${successCount} lead(s) assigned to ${targetName}.`, "success");
      } else if (successCount > 0) {
        showAlert(`${successCount} assigned to ${targetName}, ${failCount} failed.`, "warning");
      } else {
        const reason = errors?.[0]?.reason ? ` (${errors[0].reason})` : "";
        showAlert(`Assignment failed${reason}.`, "error");
      }
      resetSelection();
      setSelectedExecutive("");
      setSelectedProcess("");
      refreshList();
    } catch (err) {
      console.error("Assignment failed", err);
      showAlert(err?.message || "Assignment failed.", "error");
    } finally {
      hideLoader();
      setIsAssigning(false);
    }
  };

  // ---- edit / delete ------------------------------------------------------
  const toggleExpandLead = (leadId) =>
    setExpandedLeads((prev) => ({ ...prev, [leadId]: !prev[leadId] }));

  const handleEditClick = (lead) => {
    setEditingLead({ ...lead });
    setIsEditModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingLead(null);
  };
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingLead((prev) => ({ ...prev, [name]: value }));
  };
  const handleSaveEdit = async () => {
    if (!editingLead) return;
    try {
      await updateClientLead(editingLead.id, editingLead);
      setLeads((prev) => prev.map((l) => (l.id === editingLead.id ? { ...l, ...editingLead } : l)));
      showAlert("Lead updated successfully.", "success");
      handleCloseModal();
    } catch (error) {
      console.error("❌ Error updating lead:", error);
      showAlert("Failed to update lead.", "error");
    }
  };
  const handleDeleteClick = (leadId) => {
    const confirmDelete = () => {
      deleteClientLead(leadId)
        .then(() => {
          setSelected((prev) => {
            const next = { ...prev };
            delete next[leadId];
            return next;
          });
          showAlert("Lead deleted successfully.", "success");
          refreshList();
        })
        .catch((error) => {
          console.error("❌ Error deleting lead:", error);
          showAlert("Failed to delete lead.", "error");
        });
    };
    showAlert("Are you sure you want to delete this lead?", "warning", "Confirm Deletion", 0, confirmDelete);
  };

  const employeeList = isProcessMode ? processPersons : executives;
  const employeeValue = isProcessMode ? selectedProcess : selectedExecutive;
  const setEmployee = (v) => (isProcessMode ? setSelectedProcess(v) : setSelectedExecutive(v));

  const tabCount = (tab) => statusCounts[tab.countKey] ?? 0;

  return (
    <div className={`f-lead-content ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <SidebarToggle />
      <div className="leads-dashboard" data-theme={theme}>
        {isLoading && variant === "admin" && <AdminSpinner text="Loading Lead Assign..." />}
        <Alert alerts={alerts} onClose={closeAlert} />

        <div className="Logo">Lead Assign</div>

        {/* 1 + 2: who receives the leads */}
        <div className="la-panel">
          <div className="la-step">
            <span className="la-step-title">1. Assign to</span>
            <div className="la-segmented" role="tablist" aria-label="Assignment type">
              {[
                ["executive", "Executive"],
                ["process", "Process Person"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === mode}
                  className={`la-seg-btn ${viewMode === mode ? "active" : ""}`}
                  onClick={() => handleModeChange(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="la-step">
            <label className="la-step-title" htmlFor="la-employee">
              2. Select {isProcessMode ? "process person" : "executive"}
            </label>
            <select
              id="la-employee"
              className="la-select"
              value={employeeValue}
              onChange={(e) => setEmployee(e.target.value)}
            >
              <option value="">
                {isProcessMode ? "Choose a process person" : "Choose an executive"}
              </option>
              {employeeList.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {isProcessMode ? emp.fullName : emp.username}
                </option>
              ))}
            </select>
          </div>
          <div className="la-step la-actions">
            <span className="la-step-title">4. Assign</span>
            <div className="la-action-row">
              <button
                type="button"
                className="la-btn la-btn-primary"
                onClick={handleAssign}
                disabled={isAssigning}
              >
                Assign{selectedList.length ? ` (${selectedList.length})` : ""}
              </button>
              <button type="button" className="la-btn" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
        {isProcessMode && (
          <div className="la-hint">
            Process Persons can receive Converted leads only, whoever converted them.
          </div>
        )}

        {/* 3: which leads */}
        <div className="la-filter-bar">
          <span className="la-step-title">3. Pick leads</span>
          <div className="lead-filter-buttons la-tabs" role="tablist" aria-label="Lead status">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={statusTab === tab.key}
                className={`lead-filter-btn ${statusTab === tab.key ? "active" : ""}`}
                onClick={() => handleStatusTab(tab.key)}
              >
                {tab.label} <span className="la-count">{tabCount(tab)}</span>
              </button>
            ))}
          </div>
          <div className="la-list-controls">
            <input
              type="search"
              className="la-search"
              placeholder="Search name, email or phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search leads"
            />
            <select
              className="la-select la-select-sm"
              value={leadsPerPage}
              onChange={(e) => {
                setLeadsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Leads per page"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        <div className="scrollable-container">
          <div className="leads-table">
            <div className="la-list-header">
              <label className="la-select-all">
                <input
                  type="checkbox"
                  className="lead-checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  disabled={selectableOnPage.length === 0}
                  aria-label="Select all leads on this page"
                />
                Select all on this page
              </label>
              <span>
                {totalLeads} lead{totalLeads === 1 ? "" : "s"} · {selectedList.length} selected
              </span>
            </div>

            {!listLoading && leads.length === 0 && (
              <div className="la-empty">No leads found for this filter.</div>
            )}

            {leads.map((lead) => {
              const selectable = isSelectable(lead);
              const assignedLabel = isProcessMode
                ? lead.assignedToProcess || "Not assigned"
                : lead.assignedToExecutive || "Unassigned";
              return (
                <div key={lead.id} className={`lead-row ${selected[lead.id] ? "la-row-selected" : ""}`}>
                  <div className="lead-details">
                    <div className="lead-info-container">
                      <input
                        type="checkbox"
                        className="lead-checkbox"
                        checked={!!selected[lead.id]}
                        onChange={() => toggleLead(lead)}
                        disabled={!selectable}
                        title={selectable ? "" : "Only Converted leads can go to a Process Person"}
                        aria-label={`Select ${lead.name}`}
                      />
                      <span className="container-icon">👤</span>
                      <div className="admin-lead-info">
                        <span>
                          <strong>{lead.name}</strong>
                          <span className="la-status-badge">{lead.status}</span>
                        </span>
                        <span>
                          {lead.email}
                          {!expandedLeads[lead.id] && (
                            <button className="see-more-btn-inline" onClick={() => toggleExpandLead(lead.id)}>
                              See more...
                            </button>
                          )}
                        </span>
                        {expandedLeads[lead.id] && (
                          <div>
                            <span>Phone No: {lead.phone}</span>
                            <span>Education: {lead.education || "N/A"}</span>
                            <span>Experience: {lead.experience || "N/A"}</span>
                            <span>State: {lead.state || "N/A"}</span>
                            <span>Country: {lead.country || "N/A"}</span>
                            <span>DOB: {lead.dob || "N/A"}</span>
                            <span>Lead Assign Date: {lead.leadAssignDate || "N/A"}</span>
                            <span>
                              Country Preference: {lead.countryPreference || "N/A"}
                              <button className="see-more-btn-inline" onClick={() => toggleExpandLead(lead.id)}>
                                See less...
                              </button>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="lead-source">{lead.source || "Unknown"}</div>
                    <div className="lead-assign" title={isProcessMode ? "Process Person" : "Executive"}>
                      {assignedLabel}
                    </div>
                    <div className="lead-actions">
                      <button className="edit" onClick={() => handleEditClick(lead)}>
                        Edit
                      </button>
                      <button className="delete" onClick={() => handleDeleteClick(lead.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalLeads > 0 && (
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                Prev
              </button>
              <span className="page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </div>
        {isEditModalOpen && editingLead && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Edit Lead</h2>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={editingLead.name}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={editingLead.email || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Phone:</label>
                <input
                  type="text"
                  name="phone"
                  value={editingLead.phone}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Education:</label>
                <input
                  type="text"
                  name="education"
                  value={editingLead.education || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Experience:</label>
                <input
                  type="text"
                  name="experience"
                  value={editingLead.experience || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>State:</label>
                <input
                  type="text"
                  name="state"
                  value={editingLead.state || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Country:</label>
                <input
                  type="text"
                  name="country"
                  value={editingLead.country || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Date of Birth (DOB):</label>
                <input
                  type="date"
                  name="dob"
                  value={editingLead.dob || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Lead Assign Date:</label>
                <input
                  type="date"
                  name="leadAssignDate"
                  value={editingLead.leadAssignDate || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Country Preference:</label>
                <input
                  type="text"
                  name="countryPreference"
                  value={editingLead.countryPreference || ""}
                  onChange={handleEditChange}
                />
              </div>
              <div className="modal-actions">
                <button onClick={handleSaveEdit}>Save</button>
                <button onClick={handleCloseModal}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManagement;

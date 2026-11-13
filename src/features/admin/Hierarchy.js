import "../../styles/orgHierarchy.css";
import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Users,
  User,
  UserCheck,
  Crown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  X,
} from "lucide-react";
import { useApi } from "../../context/ApiContext";
import SidebarToggle from "./SidebarToggle";
import { ThemeContext } from "./ThemeContext";

// Role -> display data. Levels shown on cards come from the API (computed from
// real reporting lines), not from this table.
export const ROLE_META = {
  Admin: { icon: Crown, tone: "admin", label: "Admin" },
  Manager: { icon: Users, tone: "manager", label: "Manager" },
  HR: { icon: User, tone: "hr", label: "HR" },
  Executive: { icon: UserCheck, tone: "executive", label: "Executive" },
  ProcessPerson: { icon: User, tone: "process", label: "Process Person" },
};
const metaOf = (role) => ROLE_META[role] || { icon: User, tone: "default", label: role };

const MIN_SCALE = 0.2;
const MAX_SCALE = 1.6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const flatten = (roots) => {
  const map = new Map();
  const visit = (n) => {
    if (!n || map.has(n.key)) return; // defensive: never render a node twice
    map.set(n.key, n);
    (n.children || []).forEach(visit);
  };
  roots.forEach(visit);
  return map;
};

const NodeCard = ({ node, selected, expanded, onSelect, onToggle }) => {
  const meta = metaOf(node.role);
  const Icon = meta.icon;
  const hasKids = node.children && node.children.length > 0;
  return (
    <div className={`oh-card oh-tone-${meta.tone} ${selected ? "oh-selected" : ""}`}>
      <button
        type="button"
        className="oh-card-main"
        onClick={() => onSelect(node)}
        aria-pressed={selected}
        aria-label={`${node.name}, ${meta.label}`}
      >
        <span className="oh-card-icon"><Icon size={18} /></span>
        <span className="oh-card-text">
          <span className="oh-card-name" title={node.name}>{node.name}</span>
          <span className="oh-card-role">{meta.label}</span>
          <span className="oh-card-level">
            {node.level ? `Level ${node.level}` : "Unassigned"}
            {node.team ? ` · ${node.team}` : ""}
          </span>
        </span>
      </button>
      {hasKids && (
        <button
          type="button"
          className="oh-toggle"
          onClick={() => onToggle(node.key)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {node.children.length}
        </button>
      )}
    </div>
  );
};

const Branch = ({ node, expandedSet, selectedKey, onSelect, onToggle }) => {
  const expanded = expandedSet.has(node.key);
  return (
    <li>
      <NodeCard
        node={node}
        selected={selectedKey === node.key}
        expanded={expanded}
        onSelect={onSelect}
        onToggle={onToggle}
      />
      {expanded && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Branch key={c.key} node={c} expandedSet={expandedSet} selectedKey={selectedKey} onSelect={onSelect} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
};

const Hierarchy = () => {
  const { theme } = useContext(ThemeContext);
  const { fetchOrganizationHierarchyAPI, hierarchyLoading, organizationHierarchy } = useApi();
  const data = organizationHierarchy && !Array.isArray(organizationHierarchy) ? organizationHierarchy : null;
  const roots = useMemo(() => data?.hierarchy || [], [data]);
  const unassigned = useMemo(() => data?.unassigned || [], [data]);
  const nodeMap = useMemo(() => flatten([...roots, ...unassigned]), [roots, unassigned]);

  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [selectedKey, setSelectedKey] = useState(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchOrganizationHierarchyAPI();
        if (!res) setLoadError(true);
      } catch {
        setLoadError(true);
      }
    })();
  }, [fetchOrganizationHierarchyAPI]);

  // Small organisations open fully; large ones show down to Level 2 (the Admin's direct reports) so the chart stays readable.
  useEffect(() => {
    if (!data) return;
    const all = [...nodeMap.values()];
    const open = all.length <= 40 ? all : all.filter((n) => n.level && n.level <= 1);
    setExpanded(new Set(open.map((n) => n.key)));
  }, [data, nodeMap]);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const cv = canvasRef.current;
    if (!vp || !cv || !vp.clientWidth || !cv.scrollWidth) return;
    const scale = clamp(Math.min(vp.clientWidth / cv.scrollWidth, vp.clientHeight / cv.scrollHeight, 1), MIN_SCALE, 1);
    setView({ scale, x: Math.max(0, (vp.clientWidth - cv.scrollWidth * scale) / 2), y: 8 });
  }, []);

  // Fit when data first arrives and whenever the set of open branches changes.
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fit, roots, expanded]);

  const zoomBy = useCallback((factor) => {
    setView((v) => {
      const vp = viewportRef.current;
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      if (!vp) return { ...v, scale };
      // zoom around the viewport centre
      const cx = vp.clientWidth / 2;
      const cy = vp.clientHeight / 2;
      const k = scale / v.scale;
      return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  // wheel: ctrl/cmd = zoom, otherwise pan. Needs a non-passive listener to stop page scroll.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [data, zoomBy]);

  const onPointerDown = (e) => {
    if (e.target.closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const toggle = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const expandAll = () => setExpanded(new Set([...nodeMap.keys()]));
  const collapseAll = () => setExpanded(new Set(roots.map((r) => r.key)));
  const select = useCallback((node) => setSelectedKey(node.key), []);

  const selected = selectedKey ? nodeMap.get(selectedKey) : null;
  const total = data?.summary?.total || 0;
  const unassignedCount = data?.summary?.unassigned || 0;

  const legendRoles = ["Admin", "Manager", "HR", "Executive", "ProcessPerson"];

  return (
    <div className="oh-page" data-theme={theme}>
      <SidebarToggle />
      <header className="oh-header">
        <div>
          <h1 className="oh-title">Organization Hierarchy</h1>
          <p className="oh-sub">
            {data ? `${total} employees` : "Reporting structure"}
            {unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ""}
          </p>
        </div>
        <div className="oh-toolbar" role="toolbar" aria-label="Chart controls">
          <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out"><ZoomOut size={16} /></button>
          <span className="oh-zoom" aria-live="polite">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in"><ZoomIn size={16} /></button>
          <button type="button" onClick={fit} aria-label="Fit to screen"><Maximize2 size={16} /> Fit</button>
          <button type="button" onClick={() => setView({ scale: 1, x: 8, y: 8 })} aria-label="Reset zoom"><RotateCcw size={16} /></button>
          <span className="oh-sep" />
          <button type="button" onClick={expandAll}>Expand all</button>
          <button type="button" onClick={collapseAll}>Collapse all</button>
        </div>
      </header>

      {hierarchyLoading && !data ? (
        <div className="oh-state" role="status">Loading organization hierarchy…</div>
      ) : loadError && !data ? (
        <div className="oh-state oh-state-error" role="alert">Could not load the organization hierarchy.</div>
      ) : !data || (roots.length === 0 && unassigned.length === 0) ? (
        <div className="oh-state">No employees found.</div>
      ) : (
        <div className="oh-body">
          <div className="oh-main">
            <div
              className="oh-viewport"
              ref={viewportRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div
                className="oh-canvas"
                ref={canvasRef}
                style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
              >
                {roots.length === 0 ? (
                  <div className="oh-state">No Admin account found.</div>
                ) : (
                  <ul className="oh-tree">
                    {roots.map((r) => (
                      <Branch key={r.key} node={r} expandedSet={expanded} selectedKey={selectedKey} onSelect={select} onToggle={toggle} />
                    ))}
                  </ul>
                )}
              </div>
              <div className="oh-hint">Drag to pan · Ctrl + scroll to zoom</div>
            </div>

            <section className="oh-unassigned" aria-label="Unassigned Employees">
              <h2>Unassigned Employees <span className="oh-count">{unassignedCount}</span></h2>
              {unassigned.length === 0 ? (
                <p className="oh-empty">Everyone has a reporting manager.</p>
              ) : (
                <div className="oh-unassigned-list">
                  {unassigned.map((u) => (
                    <div key={u.key} className="oh-unassigned-item">
                      <ul className="oh-tree oh-tree-flat">
                        <Branch node={u} expandedSet={expanded} selectedKey={selectedKey} onSelect={select} onToggle={toggle} />
                      </ul>
                      <span className="oh-reason">{u.unassignedReason}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="oh-side">
            <section className="oh-panel">
              <h2>Legend</h2>
              <ul className="oh-legend">
                {legendRoles.map((r) => (
                  <li key={r}>
                    <span className={`oh-swatch oh-tone-${metaOf(r).tone}`} />
                    {metaOf(r).label}
                  </li>
                ))}
              </ul>
              <p className="oh-note">Level = depth in the real reporting chain. Lines connect each employee to their reporting manager.</p>
            </section>

            <section className="oh-panel oh-details" aria-live="polite">
              <div className="oh-details-head">
                <h2>Employee details</h2>
                {selected && (
                  <button type="button" className="oh-close" onClick={() => setSelectedKey(null)} aria-label="Close details"><X size={16} /></button>
                )}
              </div>
              {!selected ? (
                <p className="oh-empty">Select an employee card to see their details.</p>
              ) : (
                <dl className="oh-dl">
                  <dt>Name</dt><dd>{selected.name}</dd>
                  <dt>Username</dt><dd>{selected.username || "—"}</dd>
                  <dt>Role</dt><dd>{metaOf(selected.role).label}</dd>
                  <dt>Level</dt><dd>{selected.level || "Unassigned"}</dd>
                  <dt>Reporting manager</dt>
                  <dd>
                    {selected.reportsTo ? `${selected.reportsTo.name} (${metaOf(selected.reportsTo.role).label})` : selected.unassignedReason || "—"}
                  </dd>
                  {selected.team && (<><dt>Team</dt><dd>{selected.team}</dd></>)}
                  <dt>Team members ({selected.children.length})</dt>
                  <dd>
                    {selected.children.length === 0 ? (
                      "None"
                    ) : (
                      <ul className="oh-members">
                        {selected.children.map((c) => (
                          <li key={c.key}>
                            <button type="button" onClick={() => select(c)}>{c.name}</button>
                            <span>{metaOf(c.role).label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                  {selected.totalReports > selected.children.length && (
                    <><dt>Total in branch</dt><dd>{selected.totalReports}</dd></>
                  )}
                </dl>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Hierarchy;

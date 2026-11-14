import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useMaster } from "../../../context/MasterContext";
import "../../../styles/masterCenter.css";

export const MASTER_NAV = [
  { to: "/master/dashboard", label: "Dashboard" },
  { to: "/master/companies", label: "Companies" },
  { to: "/master/promotions", label: "Promotions" },
  { to: "/master/support", label: "Support" },
];

// One shared shell for every Master page: same header, navigation and logout.
const MasterShell = () => {
  const { logout } = useMaster();
  return (
    <div className="mc-root">
      <header className="mc-topbar">
        <div className="mc-topbar-inner">
          <span className="mc-brand">Master Control Center</span>
          <nav className="mc-nav" aria-label="Master navigation">
            {MASTER_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="mc-btn" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="mc-page">
        <Outlet />
      </main>
    </div>
  );
};

export default MasterShell;

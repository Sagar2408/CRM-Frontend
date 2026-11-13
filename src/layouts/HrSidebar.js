import React from "react";
import PermissionedSidebar from "./PermissionedSidebar";
import { NAV } from "./navConfig";

// GENERAL / EXTERNAL sections, each entry shown only when the Admin enabled its
// Page Access Control key (see navConfig.js).
const HrSidebar = () => <PermissionedSidebar config={NAV.hr} />;

export default HrSidebar;

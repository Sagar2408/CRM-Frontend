import React from "react";
import Messages from "../features/Messaging/Messages";
import RequireMessaging from "../features/Messaging/RequireMessaging";
import { Routes, Route } from "react-router-dom";
import ProcessReportCard from "../features/process-client/ProcessReportCard";
import NewsComponent from "../features/executive/NewsComponent";
import ClientRoutes from "./ClientRoutes";
import CustomerRoutes from "./CustomerRoutes";
import InvoicePage from "../features/Invoice/InvoicePage";
import SettingRoutes from "./SettingRoutes";
import NotificationRoutes from "./NotificationRoutes";
import ChatBotRoutes from "./ChatBotRoutes";
import ClientDash from "../features/process-client/ClientDash";
import ProcessSetting from "../features/process-client/ProcessSettings";
import ClientSetting from "../features/process-client/ClientSetting";
import ClientUpload from "../features/process-client/ClientUpload";
import CreateClient from "../features/process-client/CreateClient";
import AllClient from "../features/process-client/AllClient";
import { useProcess } from "../context/ProcessAuthContext"; // ✅ Make sure to import it
import "../styles/process.css";
import ProcessLayout from "../layouts/ProcessLayout";
import ProcessFreshlead from "../features/freshLeads/ProcessFreshlead";
import ProcessFollowUpRoutes from "./ProcessFollowupRoutes";
import ProcessFinalRoutes from "./ProcessFinalRoutes";
import RejectedLeadRoutes from "./RejectedLeadRoutes";
import ProcessMeetingRoutes from "./ProcessMeetingRoutes";
import ProcessCreateTemplate from "../features/process-client/ProcessCreateTemplate";
import ProcessNotification from "../features/process-client/ProcessNotification";

const ProcessRoutes = () => {
  const { user } = useProcess(); // ✅ Now it's correctly used inside the component

  return (
    
    <>
   {/* <SidebarandNavbar/> */}
      <Routes>
         <Route path="/" element={<ProcessLayout />}>

           <Route index element={<><ProcessReportCard /><NewsComponent /></>} />
           <Route path="freshlead" element={<ProcessFreshlead />} />
                     <Route path="process-follow-up/*" element={<ProcessFollowUpRoutes  />} />  
                     <Route path="clients/*" element={<ClientRoutes />} />
                     <Route path="customer/*" element={<CustomerRoutes />} />
                               <Route path="rejected-leads/*" element={<RejectedLeadRoutes />} />
                     <Route path="finalstage-leads/*" element={<ProcessFinalRoutes />} />
                     <Route path="schedule/*" element={<ProcessMeetingRoutes />} />
                      <Route path="invoice" element={<InvoicePage />}/>
                               <Route path="settings/*" element={<SettingRoutes />} />
                               <Route path="notification/*" element={  <NotificationRoutes />
                               }/>
                               <Route path="chat/*" element={<ChatBotRoutes />} />
                               <Route path="messaging" element={<RequireMessaging><Messages /></RequireMessaging>} />
                             <Route path="process-settings" element={<ProcessSetting />} />   
        <Route path="client/dashboard" element={<ClientDash />} />
        <Route path="client/settings" element={<ClientSetting />} />
        <Route path="client/upload" element={<ClientUpload />} />
               <Route path="client/notifications" element={< ProcessNotification />} />
        {user?.type === "processperson" && (
          <>
           <Route path="client/upload/:id" element={<ClientUpload />} />
             <Route path="client/dashboard/:id" element={<ClientDash />} />
            <Route path="client/create-client" element={<CreateClient />} />
            <Route path="client/all-clients" element={<AllClient />} />
         <Route path="client/create-template" element={<ProcessCreateTemplate />} />
          </>
        )}
         </Route>
      </Routes>
    </>
  );
};

export default ProcessRoutes;
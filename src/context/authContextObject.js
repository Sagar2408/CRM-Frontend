import { createContext } from "react";

// The AuthContext object lives in its own module so that other providers (e.g.
// ExecutiveActivityContext) can read the signed-in user without importing
// AuthContext.js, which pulls in the router, toasts and the auth services.
export const AuthContext = createContext();

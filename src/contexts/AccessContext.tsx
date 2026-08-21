import { createContext, useContext } from "react";

/* eslint-disable react-refresh/only-export-components -- context and access hooks belong together */

export type AccessRole = "owner" | "demo";

const AccessContext = createContext<AccessRole>("demo");

export const AccessProvider = AccessContext.Provider;

export const useAccessRole = () => useContext(AccessContext);
export const useIsDemo = () => useAccessRole() === "demo";

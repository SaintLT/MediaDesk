import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ConfigError from "@/pages/ConfigError";
import { isConfigured } from "@/lib/supabase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isConfigured ? <App /> : <ConfigError />}</StrictMode>,
);

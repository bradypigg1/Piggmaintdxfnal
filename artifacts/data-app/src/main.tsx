import { createRoot } from "react-dom/client";
import App from "./App";
import { installErrorSuppressor } from "./lib/install-error-suppressor";
import "./index.css";

installErrorSuppressor();

createRoot(document.getElementById("root")!).render(<App />);

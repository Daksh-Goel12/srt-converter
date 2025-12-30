import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./disable-effects.css";

createRoot(document.getElementById("root")!).render(<App />);

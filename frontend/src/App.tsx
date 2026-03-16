import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { DashboardPage } from "@/pages/dashboard";
import { RunsPage } from "@/pages/runs";
import { SummariesPage } from "@/pages/summaries";
import { SettingsPage } from "@/pages/settings";
import { SetupPage } from "@/pages/setup";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/summaries" element={<SummariesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

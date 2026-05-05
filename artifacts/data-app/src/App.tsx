import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import NotFound from "@/pages/not-found";
import Workspace from "@/pages/workspace";
import Dashboard from "@/pages/dashboard";
import Parts from "@/pages/parts";
import Inventory from "@/pages/inventory";
import Tools from "@/pages/tools";
import Maintenance from "@/pages/maintenance";
import Documents from "@/pages/documents";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex min-w-0">
        <Switch>
          <Route path="/" component={Workspace} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/parts" component={Parts} />
          <Route path="/tools" component={Tools} />
          <Route path="/maintenance" component={Maintenance} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/documents" component={Documents} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route, useLocation } from "wouter";
import { useEffect, type ComponentType } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import ProjectView from "@/pages/ProjectView";
import LoginPage from "@/pages/Login";
import UsersPage from "@/pages/Users";
import { useCurrentUser } from "@/hooks/use-auth";

function Router() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Switch>
      <Route path="/login">
        {() => <LoginRoute user={user} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute user={user} component={UsersPage} />}
      </Route>
      <Route path="/">
        {() => <ProtectedRoute user={user} component={Home} />}
      </Route>
      <Route path="/projects/:id">
        {() => <ProtectedRoute user={user} component={ProjectView} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedRoute({ user, component: Component }: { user: any; component: ComponentType }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);
  if (!user) return null;
  return <Component />;
}

function LoginRoute({ user }: { user: any }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);
  if (user) return null;
  return <LoginPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, Link } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import { ThemeProvider } from "@/hooks/use-theme";
import Layout from "./components/layout/Layout";
import { SEO } from "./components/SEO";
import { appRoutes } from "./lib/app/page-registry";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <SWRConfig value={{ fetcher }}>
        <Layout>
          <Switch>
            {appRoutes.map((page) => (
              <Route key={page.key} path={page.path} component={page.component} />
            ))}
            <Route>
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
                <SEO page="notFound" />
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Error
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Page not found
                </h1>
                <p className="text-sm text-muted-foreground">
                  The route may have moved or no longer exists.
                </p>
                <Link
                  href="/"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Back home
                </Link>
              </div>
            </Route>
          </Switch>
        </Layout>
        <Toaster />
      </SWRConfig>
    </ThemeProvider>
  </StrictMode>,
);

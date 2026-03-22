import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, Link } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import { ThemeProvider } from "@/hooks/use-theme";
import Layout from "./components/layout/Layout";
import { SEO } from "./components/SEO";

const Home = lazy(() => import("./pages/Home"));
const IPChecker = lazy(() => import("./components/tools/IPChecker"));
const DNSLookup = lazy(() => import("./components/tools/DNSLookup"));
const SubnetCalculator = lazy(() => import("./components/tools/SubnetCalculator"));
const PingTool = lazy(() => import("./components/tools/PingTool"));
const TraceRouteTool = lazy(() => import("./components/tools/TraceRouteTool"));
const HttpTlsInspector = lazy(() => import("./components/tools/HttpTlsInspector"));
const WhoisLookup = lazy(() => import("./components/tools/WhoisLookup"));
const PortScanner = lazy(() => import("./components/tools/PortScanner"));
const DNSPropagationChecker = lazy(
  () => import("./components/tools/DNSPropagationChecker"),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <SWRConfig value={{ fetcher }}>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/ip-checker" component={IPChecker} />
            <Route path="/dns-lookup" component={DNSLookup} />
            <Route path="/subnet-calc" component={SubnetCalculator} />
            <Route path="/ping" component={PingTool} />
            <Route path="/trace" component={TraceRouteTool} />
            <Route path="/http-inspector" component={HttpTlsInspector} />
            <Route path="/whois" component={WhoisLookup} />
            <Route path="/port-scan" component={PortScanner} />
            <Route path="/dns-propagation" component={DNSPropagationChecker} />
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

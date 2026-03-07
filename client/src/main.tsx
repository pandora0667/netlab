import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { HelmetProvider } from 'react-helmet-async';
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import Layout from "./components/layout/Layout";

const Home = lazy(() => import("./pages/Home"));
const IPChecker = lazy(() => import("./components/tools/IPChecker"));
const DNSLookup = lazy(() => import("./components/tools/DNSLookup"));
const SubnetCalculator = lazy(() => import("./components/tools/SubnetCalculator"));
const PingTool = lazy(() => import("./components/tools/PingTool"));
const WhoisLookup = lazy(() => import("./components/tools/WhoisLookup"));
const PortScanner = lazy(() => import("./components/tools/PortScanner"));
const DNSPropagationChecker = lazy(
  () => import("./components/tools/DNSPropagationChecker"),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <SWRConfig value={{ fetcher }}>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/ip-checker" component={IPChecker} />
            <Route path="/dns-lookup" component={DNSLookup} />
            <Route path="/subnet-calc" component={SubnetCalculator} />
            <Route path="/ping" component={PingTool} />
            <Route path="/whois" component={WhoisLookup} />
            <Route path="/port-scan" component={PortScanner} />
            <Route path="/dns-propagation" component={DNSPropagationChecker} />
            <Route>404 Page Not Found</Route>
          </Switch>
        </Layout>
        <Toaster />
      </SWRConfig>
    </HelmetProvider>
  </StrictMode>,
);

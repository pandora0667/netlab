import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { HelmetProvider } from 'react-helmet-async';
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import Home from "./pages/Home";
import Layout from "./components/layout/Layout";
import IPChecker from "./components/tools/IPChecker";
import DNSLookup from "./components/tools/DNSLookup";
import SubnetCalculator from "./components/tools/SubnetCalculator";
import PingTool from "./components/tools/PingTool";
import WhoisLookup from "./components/tools/WhoisLookup";
import PortScanner from "./components/tools/PortScanner";
import DNSPropagationChecker from "./components/tools/DNSPropagationChecker";

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

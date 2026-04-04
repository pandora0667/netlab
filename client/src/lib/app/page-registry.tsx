import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  getRoutableSitePages,
  type SitePageKey,
} from "../../../../shared/catalog/site-catalog";

type RoutablePageKey = Exclude<SitePageKey, "notFound">;
type RoutablePageComponent = LazyExoticComponent<ComponentType>;

const pageComponents: Record<RoutablePageKey, RoutablePageComponent> = {
  home: lazy(() => import("../../pages/Home")),
  ipChecker: lazy(() => import("../../components/tools/IPChecker")),
  dnsLookup: lazy(() => import("../../components/tools/DNSLookup")),
  subnetCalculator: lazy(() => import("../../components/tools/SubnetCalculator")),
  pingTool: lazy(() => import("../../components/tools/PingTool")),
  traceTool: lazy(() => import("../../components/tools/TraceRouteTool")),
  networkEngineering: lazy(
    () => import("../../components/tools/NetworkEngineeringWorkbench"),
  ),
  httpInspector: lazy(() => import("../../components/tools/HttpTlsInspector")),
  websiteSecurity: lazy(
    () => import("../../components/tools/WebsiteSecurityReport"),
  ),
  whoisLookup: lazy(() => import("../../components/tools/WhoisLookup")),
  dnsPropagation: lazy(
    () => import("../../components/tools/DNSPropagationChecker"),
  ),
  portScanner: lazy(() => import("../../components/tools/PortScanner")),
  emailSecurity: lazy(
    () => import("../../components/tools/EmailSecurityChecker"),
  ),
};

export const appRoutes = getRoutableSitePages().map((page) => ({
  key: page.key,
  path: page.path,
  component: pageComponents[page.key as RoutablePageKey],
}));

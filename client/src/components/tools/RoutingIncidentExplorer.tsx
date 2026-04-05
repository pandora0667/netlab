import NetworkEngineeringWorkbench from "./NetworkEngineeringWorkbench";

export default function RoutingIncidentExplorer() {
  return (
    <NetworkEngineeringWorkbench
      initialTab="incident"
      seoPage="routingIncidentExplorer"
      title="Routing Incident Explorer"
      description="Replay recent BGP announcements, withdrawals, AS-path drift, origin changes, and ROA evidence around a public route."
    />
  );
}

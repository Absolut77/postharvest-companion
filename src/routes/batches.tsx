import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/batches")({
  head: () => ({ meta: [{ title: "Batches — PostHarvest Companion" }] }),
  component: () => <Outlet />,
});

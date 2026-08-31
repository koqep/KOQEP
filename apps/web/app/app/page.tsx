import { Suspense } from "react";
import AppShell from "../components/AppShell";

export default function AppPage() {
  return (
    <Suspense>
      <AppShell />
    </Suspense>
  );
}

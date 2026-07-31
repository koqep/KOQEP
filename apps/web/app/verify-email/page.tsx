import { Suspense } from "react";
import VerifyEmailView from "../components/VerifyEmailView";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}

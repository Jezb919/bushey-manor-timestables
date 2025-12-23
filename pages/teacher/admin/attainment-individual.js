import dynamic from "next/dynamic";

// ✅ Entire page is client-only, so Next.js won't prerender it at build time
const AttainmentIndividualClient = dynamic(
  () => import("../../../components/AttainmentIndividualClient"),
  { ssr: false }
);

export default function AttainmentIndividualPage() {
  return <AttainmentIndividualClient />;
}

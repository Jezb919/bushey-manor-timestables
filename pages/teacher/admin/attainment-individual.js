import dynamic from "next/dynamic";

// ✅ Client-only to avoid prerender issues on Vercel
const AttainmentIndividualClient = dynamic(
  () => import("./AttainmentIndividualClient"),
  { ssr: false }
);

export default function AttainmentIndividualPage() {
  return <AttainmentIndividualClient />;
}

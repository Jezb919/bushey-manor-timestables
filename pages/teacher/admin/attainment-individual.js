import dynamic from "next/dynamic";

const AttainmentIndividualClient = dynamic(
  () => import("./AttainmentIndividualClient"),
  { ssr: false }
);

export default function AttainmentIndividualPage() {
  return <AttainmentIndividualClient />;
}

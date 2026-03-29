import { redirect } from "next/navigation";

export default function ConfigurePage({ params }: { params: { configId: string } }) {
  redirect(`/?config=${params.configId}`);
}

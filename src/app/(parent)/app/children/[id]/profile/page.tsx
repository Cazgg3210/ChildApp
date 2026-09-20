import { redirect } from "next/navigation";

export default async function ProfileIndexPage({ params }: PageProps<"/app/children/[id]/profile">) {
  const { id } = await params;
  redirect(`/app/children/${id}/profile/emergency`);
}

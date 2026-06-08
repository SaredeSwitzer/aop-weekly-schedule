import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ALLOWED_EMAILS = [
  process.env.ADMIN_EMAIL_1,
  process.env.ADMIN_EMAIL_2,
].filter(Boolean) as string[];

export const metadata = { title: "Admin — AOP Shala NYC" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const userEmails = user?.emailAddresses.map((e) => e.emailAddress) ?? [];
  if (ALLOWED_EMAILS.length > 0 && !userEmails.some((e) => ALLOWED_EMAILS.includes(e))) {
    redirect("/");
  }

  return <>{children}</>;
}

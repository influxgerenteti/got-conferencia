import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Topbar } from "@/components/topbar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSession())) redirect("/login?next=/admin");

  return (
    <>
      <Topbar />
      <main className="wrap">{children}</main>
    </>
  );
}

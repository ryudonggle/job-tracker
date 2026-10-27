import Nav from "@/components/Nav";
import { currentRole } from "@/lib/role";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav role={(await currentRole()) ?? "guest"} />
      <main className="page">{children}</main>
    </>
  );
}

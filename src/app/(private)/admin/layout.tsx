import { BackHome } from "@/components/BackHome";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackHome />
      {children}
    </>
  );
}

import { Marca, NavLinks } from "@/components/layout/NavLinks";

/** Menu lateral fixo, visível a partir de 1024px. Abaixo disso o menu vive na gaveta (MobileNav). */
export function AppSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
      <Marca />
      <NavLinks />
    </aside>
  );
}

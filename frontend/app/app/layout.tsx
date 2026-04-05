"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavContent } from "@/components/layout/NavContent";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen">

        {/* Desktop sidebar — hidden below md breakpoint */}
        <aside
          className="hidden md:flex w-56 flex-shrink-0 flex-col"
          style={{ background: "#111827" }}
        >
          <NavContent />
        </aside>

        <div className="flex flex-col flex-1 min-w-0">

          {/* Mobile-only header with hamburger */}
          <div
            className="flex md:hidden items-center px-4 py-3 flex-shrink-0"
            style={{ background: "#111827", borderBottom: "1px solid #1f2937" }}
          >
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button aria-label="Abrir menu de navegação">
                  <Menu className="text-white w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-0" style={{ background: "#111827" }}>
                <NavContent onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span
              className="ml-3 font-extrabold tracking-[2.5px]"
              style={{ color: "#f9fafb", fontSize: 15 }}
            >
              SUGARCANE
            </span>
          </div>

          {/* Main content */}
          <main
            className={cn(
              "flex-1 overflow-auto min-w-0",
              pathname === "/app/dashboard" ? "" : "p-4 md:p-8 lg:p-10"
            )}
            style={{ background: "#f4f6f9" }}
          >
            {children}
          </main>

        </div>
      </div>
    </TooltipProvider>
  );
}

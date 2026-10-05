"use client";

import { useRouter } from "next/navigation";
import { LogOut, Moon, Shield, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  email: string;
  initials: string;
  role?: string;
}

export function UserMenu({ email, initials, role }: UserMenuProps) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const nome = email.split("@")[0];

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menu do usuário ${nome}`}
          className="flex items-center gap-2.5 rounded-md border-l border-border pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="hidden sm:block">
            <span className="block text-right text-[13px] font-medium text-foreground">{nome}</span>
            <span className="block text-right text-[11px] text-muted-foreground">{email}</span>
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{nome}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggle} className="cursor-pointer">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </DropdownMenuItem>
        {role === "admin" && (
          <DropdownMenuItem onClick={() => router.push("/app/admin")} className="cursor-pointer">
            <Shield className="size-4" />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} variant="destructive" className="cursor-pointer">
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

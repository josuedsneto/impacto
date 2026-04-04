"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
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
}

export function UserMenu({ email, initials }: UserMenuProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          className="flex items-center gap-2.5 pl-4 cursor-pointer select-none"
          style={{ borderLeft: "1px solid #e5e7eb" }}
        >
          <div>
            <p className="font-medium text-right" style={{ fontSize: 13, color: "#374151" }}>
              {email.split("@")[0]}
            </p>
            <p className="text-right" style={{ fontSize: 11, color: "#9ca3af" }}>
              {email}
            </p>
          </div>
          <div
            className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              background: "#1e3a5f",
              color: "#93c5fd",
              fontSize: 12,
            }}
          >
            {initials}
          </div>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{email.split("@")[0]}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 focus:text-red-600 cursor-pointer"
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

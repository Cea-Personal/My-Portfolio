"use client";

import { usePathname } from "next/navigation";
import { OwnerSignOutButton } from "@/components/auth/owner-sign-out-button";

const links = [
  ["Today", "/dashboard"],
  ["Jobs", "/jobs"],
  ["Applications", "/applications"],
  ["Interviews", "/interviews"],
  ["Freelance", "/freelance"],
  ["Career Brain", "/career-brain"],
  ["Portfolio", "/"],
  ["Writing", "/blogs"]
] as const;

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  return (
    <nav className="workspace-navigation" aria-label="Private workspace">
      <a className="workspace-brand" href="/dashboard">
        Basil · Career OS
      </a>
      <div className="workspace-primary-links">
        {links.map(([label, href]) => (
          <a key={href} href={href} aria-current={active(href) ? "page" : undefined}>
            {label}
          </a>
        ))}
      </div>
      <a
        className="workspace-admin-link"
        href="/settings"
        aria-current={active("/settings") ? "page" : undefined}
      >
        Settings / Admin
      </a>
      <OwnerSignOutButton />
    </nav>
  );
}

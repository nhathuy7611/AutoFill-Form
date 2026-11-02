import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoFill-Form — Google Form Auto-Filler",
  description: "Automate Google Form filling with configurable ratios and rate limiting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scrollbar-thin">
      <body className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground font-heading">
                AF
              </div>
              <span className="font-heading text-lg font-semibold tracking-tight">
                AutoFill<span className="text-primary">Form</span>
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <NavLink href="/">Filler</NavLink>
              <NavLink href="/history">History</NavLink>
            </div>
          </nav>
        </header>

        {/* Main */}
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
          AutoFill-Form &mdash; For internal testing purposes only &bull; Respect Google ToS
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}

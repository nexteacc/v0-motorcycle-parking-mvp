"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, LogOut, List, Clock } from "lucide-react"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/vehicles", label: "Vehicles", icon: List },
    { href: "/entry", label: "Check In", icon: LogIn },
    { href: "/exit", label: "Check Out", icon: LogOut },
    { href: "/history", label: "History", icon: Clock },
  ]

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 backdrop-blur-md z-40"
      style={{
        paddingBottom: `env(safe-area-inset-bottom, 0px)`,
      }}
    >
      <div className="flex items-center justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (pathname.startsWith(href) && href !== "/history")
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center py-3 px-2 transition-colors ${
                isActive ? "text-primary border-t-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

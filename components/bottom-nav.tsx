"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, LogOut, List, Clock } from "lucide-react"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/vehicles", label: "车辆", icon: List },
    { href: "/entry", label: "入场", icon: LogIn },
    { href: "/exit", label: "出场", icon: LogOut },
    { href: "/history", label: "历史", icon: Clock },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 backdrop-blur-md z-40">
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

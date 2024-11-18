import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuContent,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const networkTools = [
  { href: "/ip-checker", label: "IP Checker" },
  { href: "/dns-lookup", label: "DNS Lookup" },
  { href: "/subnet-calc", label: "Subnet Calculator" },
  { href: "/ping", label: "Ping Tool" },
  { href: "/whois", label: "WHOIS Lookup" },
];

const utilities = [
  { href: "/ssl-checker", label: "SSL Checker (Coming Soon)" },
  { href: "/traceroute", label: "Traceroute (Coming Soon)" },
  { href: "/port-scanner", label: "Port Scanner (Coming Soon)" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const isActive = (href: string) => location === href;

  return (
    <nav className="flex-1">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold hover:text-primary transition-colors">
          Netlab
        </Link>

        <NavigationMenu className="hidden md:block">
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href="/" className={`
                px-4 py-2 text-sm font-medium transition-colors
                hover:text-primary
                ${location === "/" ? 'text-primary' : 'text-muted-foreground'}
              `}>
                Home
              </Link>
            </NavigationMenuItem>
            
            <NavigationMenuItem>
              <NavigationMenuTrigger>Network Tools</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[300px] gap-2 p-4">
                  {networkTools.map((tool) => (
                    <li key={tool.href}>
                      <Link
                        href={tool.href}
                        className={`
                          block px-4 py-2 text-sm transition-colors
                          hover:bg-accent hover:text-accent-foreground rounded-md
                          ${isActive(tool.href) ? 'bg-accent/50 text-accent-foreground' : ''}
                        `}
                      >
                        {tool.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Utilities</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[300px] gap-2 p-4">
                  {utilities.map((tool) => (
                    <li key={tool.href} className="opacity-50 cursor-not-allowed">
                      <span className="block px-4 py-2 text-sm rounded-md">
                        {tool.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isOpen ? "close" : "menu"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.div>
          </AnimatePresence>
        </Button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="md:hidden border-t mt-2"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="py-4 space-y-4">
              <Link
                href="/"
                className={`
                  block px-4 py-2 text-sm transition-colors rounded-md
                  hover:bg-accent hover:text-accent-foreground
                  ${location === "/" ? 'bg-accent/50 text-accent-foreground' : ''}
                `}
                onClick={() => setIsOpen(false)}
              >
                Home
              </Link>

              <div className="px-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Network Tools</h3>
                <div className="space-y-1">
                  {networkTools.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className={`
                        block px-4 py-2 text-sm transition-colors rounded-md
                        hover:bg-accent hover:text-accent-foreground
                        ${isActive(tool.href) ? 'bg-accent/50 text-accent-foreground' : ''}
                      `}
                      onClick={() => setIsOpen(false)}
                    >
                      {tool.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="px-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Utilities</h3>
                <div className="space-y-1">
                  {utilities.map((tool) => (
                    <span
                      key={tool.href}
                      className="block px-4 py-2 text-sm rounded-md opacity-50 cursor-not-allowed"
                    >
                      {tool.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

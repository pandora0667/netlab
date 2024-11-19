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

interface Tool {
  href: string;
  label: string;
}

const networkTools: Tool[] = [
  { href: "/ip-checker", label: "IP Checker" },
  { href: "/dns-lookup", label: "DNS Lookup" },
  { href: "/subnet-calc", label: "Subnet Calculator" },
  { href: "/ping", label: "Ping Tool" },
  { href: "/whois", label: "WHOIS Lookup" },
];

const utilities: Tool[] = [
  { href: "/ssl-checker", label: "SSL Checker" },
  { href: "/traceroute", label: "Traceroute (Coming Soon)" },
  { href: "/port-scanner", label: "Port Scanner (Coming Soon)" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const isActive = (href: string): boolean => location === href;

  const handleMenuToggle = (): void => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (): void => {
    setIsOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-gradient-to-r from-background to-muted backdrop-blur-sm" role="banner">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <Link href="/" onClick={handleNavigation} className="text-2xl font-bold hover:text-primary transition-all duration-200">
            <span aria-label="Netlab Home">Netlab</span>
          </Link>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={handleMenuToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isOpen ? "close" : "menu"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </motion.div>
            </AnimatePresence>
          </Button>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden md:block">
            <NavigationMenuList className="flex space-x-4">
              <NavigationMenuItem>
                <Link 
                  href="/" 
                  onClick={handleNavigation}
                  className={`
                    px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                    hover:bg-accent hover:text-accent-foreground
                    ${location === "/" ? 'bg-accent/50 text-accent-foreground' : ''}
                  `}
                  aria-current={location === "/" ? "page" : undefined}
                >
                  Home
                </Link>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuTrigger aria-label="Network Tools">
                  Network Tools
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[300px] gap-2 p-4" role="menu">
                    {networkTools.map((tool) => (
                      <li key={tool.href} role="menuitem">
                        <Link
                          href={tool.href}
                          onClick={handleNavigation}
                          className={`
                            block px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                            hover:bg-accent hover:text-accent-foreground
                            ${isActive(tool.href) ? 'bg-accent/50 text-accent-foreground' : ''}
                          `}
                          aria-current={isActive(tool.href) ? "page" : undefined}
                        >
                          {tool.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger aria-label="Utilities">
                  Utilities
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[300px] gap-2 p-4" role="menu">
                    {utilities.map((tool) => (
                      <li key={tool.href} role="menuitem" aria-disabled="true" className="opacity-50 cursor-not-allowed">
                        <span className="block px-4 py-2 rounded-md text-sm font-medium">
                          {tool.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <motion.nav
              className="md:hidden border-t"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="navigation"
              aria-label="Mobile navigation"
            >
              <div className="py-4">
                <motion.div
                  className="flex flex-col space-y-2"
                  initial="closed"
                  animate="open"
                  variants={{
                    open: {
                      transition: { staggerChildren: 0.05 }
                    },
                    closed: {
                      transition: { staggerChildren: 0.05, staggerDirection: -1 }
                    }
                  }}
                >
                  <motion.div
                    variants={{
                      open: { opacity: 1, y: 0 },
                      closed: { opacity: 0, y: -10 }
                    }}
                  >
                    <Link
                      href="/"
                      onClick={handleNavigation}
                      className={`
                        block px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                        hover:bg-accent hover:text-accent-foreground
                        ${location === "/" ? 'bg-accent/50 text-accent-foreground' : ''}
                      `}
                      aria-current={location === "/" ? "page" : undefined}
                    >
                      Home
                    </Link>
                  </motion.div>

                  <div className="px-4 py-2">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Network Tools</h3>
                    {networkTools.map((tool) => (
                      <motion.div
                        key={tool.href}
                        variants={{
                          open: { opacity: 1, y: 0 },
                          closed: { opacity: 0, y: -10 }
                        }}
                      >
                        <Link
                          href={tool.href}
                          onClick={handleNavigation}
                          className={`
                            block px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                            hover:bg-accent hover:text-accent-foreground
                            ${isActive(tool.href) ? 'bg-accent/50 text-accent-foreground' : ''}
                          `}
                          aria-current={isActive(tool.href) ? "page" : undefined}
                        >
                          {tool.label}
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <div className="px-4 py-2">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Utilities</h3>
                    {utilities.map((tool) => (
                      <motion.div
                        key={tool.href}
                        variants={{
                          open: { opacity: 1, y: 0 },
                          closed: { opacity: 0, y: -10 }
                        }}
                      >
                        <span 
                          className="block px-4 py-2 rounded-md text-sm font-medium opacity-50"
                          aria-disabled="true"
                        >
                          {tool.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
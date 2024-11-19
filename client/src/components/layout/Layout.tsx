import { ReactNode, Suspense } from "react";
import { Link, useLocation } from "wouter";
import Navigation from "./Navigation";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Loader2 } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

interface Breadcrumb {
  path: string;
  label: string;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  
  const getBreadcrumbs = (): Breadcrumb[] => {
    const paths = location.split('/').filter(Boolean);
    if (paths.length === 0) return [{ path: '/', label: 'Home' }];
    
    return [
      { path: '/', label: 'Home' },
      ...paths.map((path, index) => ({
        path: '/' + paths.slice(0, index + 1).join('/'),
        label: path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ')
      }))
    ];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      
      {/* Breadcrumbs */}
      <div className="border-b">
        <nav className="container mx-auto px-4 py-2" aria-label="Breadcrumb">
          <ol className="flex space-x-2 text-sm text-muted-foreground">
            {getBreadcrumbs().map((crumb, index, array) => (
              <li key={crumb.path} className="flex items-center">
                {index > 0 && <span className="mx-2" aria-hidden="true">/</span>}
                <Link 
                  href={crumb.path}
                  className="hover:text-primary transition-all duration-200"
                  aria-current={index === array.length - 1 ? "page" : undefined}
                >
                  {crumb.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <motion.main 
            className="container mx-auto px-4 py-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            role="main"
          >
            {children}
          </motion.main>
        </Suspense>
      </ErrorBoundary>

      <footer className="border-t bg-muted/30" role="contentinfo">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">About Netlab</h3>
              <p className="text-sm text-muted-foreground">
                Professional network tools suite for administrators and developers. Simplify your network management with our comprehensive toolkit.
              </p>
            </div>

            <nav className="space-y-4" aria-label="Documentation">
              <h3 className="font-semibold text-lg">Documentation</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/docs/getting-started" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    Getting Started
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="/docs/examples" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    Examples
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="space-y-4" aria-label="Resources">
              <h3 className="font-semibold text-lg">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/tutorials" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    Tutorials
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/faqs" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    FAQs
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="space-y-4" aria-label="Connect">
              <h3 className="font-semibold text-lg">Connect</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/contact" className="text-muted-foreground hover:text-primary transition-all duration-200">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <a 
                    href="https://github.com"
                    className="text-muted-foreground hover:text-primary transition-all duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub (opens in new tab)"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://twitter.com"
                    className="text-muted-foreground hover:text-primary transition-all duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Twitter (opens in new tab)"
                  >
                    Twitter
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Netlab. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

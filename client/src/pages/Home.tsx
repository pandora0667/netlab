import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Network, Globe, Search, Activity, Users, Zap } from "lucide-react";
import { SEO } from "../components/SEO";

const features = [
  {
    title: "IP Checker",
    description: "Check your public IP address and location details instantly",
    icon: "🌐",
    href: "/ip-checker"
  },
  {
    title: "DNS Lookup",
    description: "Query DNS records for any domain with comprehensive results",
    icon: "🔍",
    href: "/dns-lookup"
  },
  {
    title: "DNS Propagation Checker",
    description: "Test DNS propagation across global nameservers",
    icon: "🌍",
    href: "/dns-propagation"
  },
  {
    title: "Subnet Calculator",
    description: "Calculate network details from IP and subnet mask",
    icon: "🧮",
    href: "/subnet-calc"
  },
  {
    title: "Ping Tool",
    description: "Test connectivity to any host with detailed statistics",
    icon: "📡",
    href: "/ping"
  },
  {
    title: "WHOIS Lookup",
    description: "Get detailed domain and IP registration information",
    icon: "📋",
    href: "/whois"
  }
];

const statistics = [
  {
    icon: <Network className="h-6 w-6" />,
    value: "10+",
    label: "Network Tools"
  },
  {
    icon: <Users className="h-6 w-6" />,
    value: "5,000+",
    label: "Active Users"
  },
  {
    icon: <Zap className="h-6 w-6" />,
    value: "99.9%",
    label: "Uptime"
  }
];

const testimonials = [
  {
    quote: "Netlab has streamlined our network management process significantly.",
    author: "Sarah Chen",
    role: "Network Engineer"
  },
  {
    quote: "The best suite of network tools I've used. Simple yet powerful.",
    author: "Michael Rodriguez",
    role: "System Administrator"
  },
  {
    quote: "Essential tools for any IT professional. Highly recommended!",
    author: "David Kim",
    role: "DevOps Engineer"
  }
];

export default function Home() {
  const [, setLocation] = useLocation();

  const handleFeatureClick = (href: string) => {
    setLocation(href);
  };

  return (
    <>
      <SEO page="home" />
      <div className="space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              Welcome to Netlab
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simplify your network management with Netlab's powerful tools
            </p>
            <Button
              size="lg"
              onClick={() => handleFeatureClick("/ip-checker")}
              className="mt-4"
            >
              Get Started
            </Button>
          </motion.div>
        </section>

        {/* Featured Tools Section */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-center">Featured Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  onClick={() => handleFeatureClick(feature.href)}
                >
                  <Card className="p-6 h-full hover:shadow-lg transition-all duration-300 cursor-pointer group">
                    <motion.div
                      className="text-4xl mb-4 transform transition-transform duration-300 group-hover:scale-110"
                    >
                      {feature.icon}
                    </motion.div>
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors duration-200">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Statistics Section */}
        <section className="py-12 bg-muted/30 rounded-lg">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">Why Choose Netlab?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {statistics.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="text-center space-y-2"
                >
                  <div className="flex justify-center text-primary">{stat.icon}</div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-12">
          <h2 className="text-3xl font-bold text-center mb-8">What Users Say</h2>
          <Carousel className="w-full max-w-3xl mx-auto">
            <CarouselContent>
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index}>
                  <Card className="p-8 text-center">
                    <blockquote className="text-lg mb-4">
                      "{testimonial.quote}"
                    </blockquote>
                    <cite className="not-italic">
                      <div className="font-semibold">{testimonial.author}</div>
                      <div className="text-muted-foreground">{testimonial.role}</div>
                    </cite>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>
      </div>
    </>
  );
}

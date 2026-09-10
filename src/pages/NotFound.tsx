import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="dot-grid flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div className="animate-float-y text-6xl">🧭</div>
      <h1 className="mt-6 font-display text-5xl font-bold tracking-tight">404</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Cette page n'existe pas — mais le cartable t'attend à l'accueil.
      </p>
      <Button asChild className="mt-6 rounded-full font-bold shadow-sm">
        <Link to="/">
          Retour à l'accueil
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </motion.div>
  );
}

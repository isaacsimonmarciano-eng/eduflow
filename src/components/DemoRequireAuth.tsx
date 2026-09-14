import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDemo } from "@/demo/store";
import { Lock, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

export function DemoRequireAuth({
  children,
  title = "Connecte-toi pour continuer",
  description = "Cette page est réservée aux membres connectés de la classe (démo locale).",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { isAuthenticated, state } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();

  // Demo store is synchronous (localStorage), no loading state needed.
  // We keep a tiny check to avoid flash if state not yet hydrated (always ready).
  if (state.users.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <Lock className="size-5 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Mode démo : entre ton prénom + e-mail, tout reste sur cet appareil. Aucune connexion nécessaire.
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => navigate(signInHref)}>
              Se connecter (démo)
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
              Retour à l'accueil
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}

export function DemoRedirectIfAuthenticated({ to = "/dashboard" }: { to?: string }) {
  const { isAuthenticated } = useDemo();
  if (isAuthenticated) return <Navigate to={to} replace />;
  return null;
}

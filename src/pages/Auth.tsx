import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { GraduationCap, Loader2, Lock, School } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { motion } from "framer-motion";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

const HIGHLIGHTS = [
  {
    emoji: "🎓",
    soft: "#f0fdf4",
    title: "Ta classe, ton espace",
    text: "Les résumés et les devoirs sont réservés à ta classe.",
  },
  {
    emoji: "⭐",
    soft: "#fffbeb",
    title: "Le délégué aux commandes",
    text: "Le premier élève de la classe connecté devient délégué.",
  },
  {
    emoji: "🔒",
    soft: "#eef2ff",
    title: "Vérification réelle",
    text: "Tes identifiants sont vérifiés par EcoleDirecte à chaque connexion.",
  },
];

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [identifiant, setIdentifiant] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn("ecoledirecte", {
        identifiant,
        motdepasse,
        flow: "signIn",
      });
      navigate(redirect);
    } catch (err) {
      console.error("EcoleDirecte sign-in error:", err);
      setError(
        err instanceof Error ? err.message : "Connexion impossible. Réessaie.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="dot-grid flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-base text-primary-foreground shadow-sm">
            🎒
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Cartable Vivant
          </span>
        </Link>
      </header>

      {/* Split panel */}
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Left: themed panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground/80 shadow-sm">
            ✨ Réservé aux élèves — connexion via ton compte scolaire
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight">
            Connecte-toi avec{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">EcoleDirecte</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3.5 rounded-full bg-emerald-300/70 sm:bottom-1.5"
              />
            </span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Utilise les mêmes identifiants que sur le site de ton école. Ton
            prénom, ton nom et ta classe sont importés automatiquement — et tu
            retrouves les élèves de ta classe.
          </p>
          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="pop-card flex items-center gap-3.5 p-4"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-sm"
                  style={{ backgroundColor: item.soft }}
                >
                  {item.emoji}
                </span>
                <div>
                  <p className="font-display text-sm font-bold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: sign-in card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto w-full max-w-md"
        >
          <Card className="pop-card rounded-3xl border shadow-md">
            <CardHeader className="text-center">
              <div className="mb-1 flex justify-center">
                <div className="animate-float-y flex size-16 items-center justify-center rounded-3xl bg-emerald-100 text-3xl shadow-md">
                  🎓
                </div>
              </div>
              <CardTitle className="font-display text-xl">
                Connexion EcoleDirecte
              </CardTitle>
              <CardDescription>
                Mêmes identifiants que le site de ton école
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="grid gap-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="identifiant"
                    className="flex items-center gap-1.5 text-sm font-bold"
                  >
                    <GraduationCap className="size-4 text-emerald-600" />
                    Identifiant EcoleDirecte
                  </label>
                  <Input
                    id="identifiant"
                    value={identifiant}
                    onChange={(e) => setIdentifiant(e.target.value)}
                    placeholder="prenom.nom"
                    autoComplete="username"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="motdepasse"
                    className="flex items-center gap-1.5 text-sm font-bold"
                  >
                    <Lock className="size-4 text-emerald-600" />
                    Mot de passe
                  </label>
                  <Input
                    id="motdepasse"
                    type="password"
                    value={motdepasse}
                    onChange={(e) => setMotdepasse(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="gap-2 rounded-full font-bold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Vérification auprès d'EcoleDirecte…
                    </>
                  ) : (
                    <>
                      <School className="size-4" />
                      Se connecter
                    </>
                  )}
                </Button>

                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  Ton mot de passe n'est jamais enregistré : il sert uniquement
                  à te vérifier auprès d'EcoleDirecte, à chaque connexion.
                </p>
              </CardContent>
            </form>
            <CardFooter className="justify-center border-t bg-muted/60 py-3">
              <p className="text-center text-xs text-muted-foreground">
                Besoin d'aide ? Tes identifiants sont ceux reçus à la rentrée.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}

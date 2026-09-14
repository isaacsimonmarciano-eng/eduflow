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
import { api } from "@/convex/_generated/api";
import { GraduationCap, Loader2, Lock, Mail, Send } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { useAction } from "convex/react";

function AuthEmail() {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const startEmail = useAction(api.authEd.startEmailSignIn);

  // Dummy: the email magic link flow is triggered server-side by the provider
  // (we reuse the same nonce for consistency). Not exposed to the client.
  void startEmail;

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailSent, setCheckEmailSent] = useState(false);

  // Connect via Email QR Code UI
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Trigger email magic link flow. The nonce is consumed by the EcoleDirecte
      // provider identity so the auth handshake stays identical.
      const { nonce } = await startEmail({
        email,
        displayName,
      });
      await signIn("ecoledirecte", { nonce, flow: "signIn" });
      navigate("/dashboard");
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error ? err.message : "La connexion a échoué. Réessaie.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="dot-grid flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <a
          href="/"
          className="flex items-center gap-2.5 text-foreground hover:text-foreground/70 transition"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-base text-primary-foreground shadow-sm">
            🎒
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Cartable Vivant
          </span>
        </a>
      </header>

      {/* Split panel */}
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground/80 shadow-sm">
            ✨ Sans compte EcoleDirecte
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight">
            Rejoin la classe
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Pas d'identifiants EcoleDirecte ? Inscris-toi avec ton prénom et
            ton e-mail. Isaac te validera ensuite.
          </p>
        </motion.div>

        {/* Right */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto w-full max-w-md"
        >
          <Card className="pop-card rounded-3xl border shadow-md">
            <CardHeader className="text-center">
              <div className="mb-1 flex justify-center">
                <div className="animate-float-y flex size-16 items-center justify-center rounded-3xl bg-indigo-100 text-3xl shadow-md">
                  <Mail className="size-8 text-indigo-600" />
                </div>
              </div>
              <CardTitle className="font-display text-xl">
                Inscris-toi par e-mail
              </CardTitle>
              <CardDescription>
                Isaac Marciano sera notifié pour valider ton entrée dans la
                classe.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="grid gap-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="email"
                    className="flex items-center gap-1.5 text-sm font-bold"
                  >
                    <GraduationCap className="size-4 text-indigo-600" />
                    Prénom / surnom
                  </label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Prénom ou pseudo"
                    autoComplete="name"
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="email"
                    className="flex items-center gap-1.5 text-sm font-bold"
                  >
                    <Mail className="size-4 text-indigo-600" />
                    E-mail
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ton@email.com"
                    autoComplete="email"
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
                  disabled={isLoading || !email || !displayName}
                  className="gap-2 rounded-full font-bold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Envoi de l'e-mail…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Je m'inscris
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
            <CardFooter className="justify-center border-t bg-muted/60 py-3">
              <p className="text-center text-xs text-muted-foreground">
                L'e-mail sert uniquement à t'identifier. Isaac valide les
                inscriptions manuellement.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function Auth2(props: { redirectAfterAuth?: string }) {
  return (
    <Suspense>
      <AuthEmail />
    </Suspense>
  );
}

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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, Mic, Sparkles, UserX } from "lucide-react";
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

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le code. Réessaie.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("Le code saisi est incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Connexion invité impossible : ${
          error instanceof Error ? error.message : "erreur inconnue"
        }`,
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
            ✨ Espace élèves & délégués
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight">
            Les cours,{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">jour par jour</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3.5 rounded-full bg-amber-300/70 sm:bottom-1.5"
              />
            </span>
            , rien que ça.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Connecte-toi pour lire les résumés de la classe — ou publier le
            tien, dicté à voix haute après le cours.
          </p>
          <div className="mt-8 space-y-3">
            {[
              {
                emoji: "🎙️",
                color: "#eef2ff",
                title: "Dicte en vrac",
                text: "Mots-clés, phrases rapides… l'IA s'occupe du reste.",
              },
              {
                emoji: "📐",
                color: "#f0fdfa",
                title: "Résumés colorés par matière",
                text: "Chaque cours daté, trié, prêt pour les révisions.",
              },
              {
                emoji: "🚀",
                color: "#fffbeb",
                title: "Toute la classe suit",
                text: "Même absent, on retrouve le cours du jour.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="pop-card flex items-center gap-3.5 p-4"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-sm"
                  style={{ backgroundColor: item.color }}
                >
                  {item.emoji}
                </span>
                <div>
                  <p className="font-display text-sm font-bold">
                    {item.title}
                  </p>
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
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <div className="mb-1 flex justify-center">
                    <div className="animate-float-y flex size-16 items-center justify-center rounded-3xl bg-primary text-3xl text-primary-foreground shadow-md">
                      🎒
                    </div>
                  </div>
                  <CardTitle className="font-display text-xl">
                    Bienvenue dans le cartable !
                  </CardTitle>
                  <CardDescription>
                    Entre ton email pour te connecter ou créer ton accès
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pl-9"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={isLoading}
                        aria-label="Recevoir mon code"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}

                    <div className="mt-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                            Ou
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 w-full rounded-full font-bold"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Continuer en invité
                      </Button>
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        Parfait pour essayer sans compte — tu pourras publier
                        tes premiers résumés tout de suite.
                      </p>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="mt-4 text-center">
                  <div className="mb-1 flex justify-center">
                    <div className="animate-float-y flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl shadow-sm">
                      ✉️
                    </div>
                  </div>
                  <CardTitle className="font-display text-xl">
                    Vérifie ta boîte mail
                  </CardTitle>
                  <CardDescription>
                    On t'a envoyé un code à {step.email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            otp.length === 6 &&
                            !isLoading
                          ) {
                            const form = (e.target as HTMLElement).closest(
                              "form",
                            );
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-center text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      Code non reçu ?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => setStep("signIn")}
                      >
                        Essaie encore
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full rounded-full font-bold"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Vérification…
                        </>
                      ) : (
                        <>
                          Vérifier le code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Utiliser un autre email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="rounded-b-3xl border-t bg-muted/60 px-6 py-3 text-center text-xs text-muted-foreground">
              {step === "signIn" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mic className="size-3.5 text-primary" />
                  <Sparkles className="size-3.5 text-amber-500" />
                  Résumés de cours grâce à l'IA
                </span>
              ) : (
                "Code valable 15 minutes"
              )}
            </div>
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

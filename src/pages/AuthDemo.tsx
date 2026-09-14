import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GraduationCap, Loader2, Mail, Send, WifiOff } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { motion } from "framer-motion";
import { useDemo } from "@/demo/store";

function AuthDemoInner() {
  const demo = useDemo();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("returnTo") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo.isAuthenticated) navigate(redirect);
  }, [demo.isAuthenticated, navigate, redirect]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !displayName.trim()) {
      setError("Renseigne ton prénom et ton e-mail.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Adresse e-mail invalide.");
      return;
    }
    setIsLoading(true);
    try {
      demo.signInLocal(displayName.trim(), email.trim().toLowerCase());
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
      setIsLoading(false);
    }
  };

  return (
    <div className="dot-grid flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-base text-primary-foreground shadow-sm">🎒</div>
          <span className="font-display text-lg font-bold tracking-tight">Cartable Vivant</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">DÉMO</span>
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="hidden lg:block">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
            <WifiOff className="size-3.5" /> Mode démo — fonctionne sans Wi-Fi
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight">
            Connecte-toi avec <span className="relative whitespace-nowrap"><span className="relative z-10">ton e-mail</span><span aria-hidden className="absolute inset-x-0 bottom-1 z-0 h-3.5 rounded-full bg-indigo-300/60 sm:bottom-1.5" /></span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">En mode démo, pas de mot de passe ni de Convex. Ton prénom + e-mail te connectent instantanément sur cet appareil (localStorage).</p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            💡 <span className="font-bold">Astuce présentation :</span> coupe le Wi-Fi, recharge la page (⌘R), connecte-toi et montre tout : Cours, Devoirs, Questions, Ma classe — zéro écran d'erreur.
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }} className="mx-auto w-full max-w-md">
          <Card className="pop-card rounded-3xl border shadow-md">
            <CardHeader className="text-center">
              <div className="mb-1 flex justify-center">
                <div className="animate-float-y flex size-16 items-center justify-center rounded-3xl bg-indigo-100 text-3xl shadow-md">✉️</div>
              </div>
              <CardTitle className="font-display text-xl">Connexion par e-mail <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">DÉMO</span></CardTitle>
              <CardDescription>Ton prénom + ton e-mail, c'est tout (hors-ligne)</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="grid gap-4">
                <div className="grid gap-1.5">
                  <label htmlFor="displayName" className="flex items-center gap-1.5 text-sm font-bold"><GraduationCap className="size-4 text-indigo-600" /> Prénom / pseudo</label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Isaac" autoComplete="name" disabled={isLoading} required />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-bold"><Mail className="size-4 text-indigo-600" /> E-mail</label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="isaac@demo.local" autoComplete="email" disabled={isLoading} required />
                </div>
                {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" disabled={isLoading} className="gap-2 rounded-full font-bold">
                  {isLoading ? <><Loader2 className="size-4 animate-spin" /> Connexion...</> : <><Send className="size-4" /> Rejoindre la classe</>}
                </Button>
                <p className="text-center text-xs leading-relaxed text-muted-foreground">En démo, l'e-mail n'est pas vérifié — tu peux utiliser <span className="font-mono">lea@demo.local</span> ou n'importe quel e-mail.</p>
              </CardContent>
            </form>
            <CardFooter className="justify-center border-t bg-muted/60 py-3">
              <p className="text-center text-xs text-muted-foreground">Déjà inscrit ? Entre le même e-mail pour te reconnecter.</p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthDemo(props: { redirectAfterAuth?: string }) {
  return (
    <Suspense>
      <AuthDemoInner />
    </Suspense>
  );
}

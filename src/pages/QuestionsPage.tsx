import Questions from "@/components/Questions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export default function QuestionsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/dashboard")} aria-label="Retour au tableau de bord">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-lg text-primary-foreground shadow-sm">💬</div>
            <div>
              <p className="font-display text-lg font-bold">Questions</p>
              <p className="text-xs text-muted-foreground">Espace d'entraide de la classe</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <Questions />
      </main>
    </div>
  );
}

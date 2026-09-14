import QuestionsDemo from "@/components/QuestionsDemo";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useDemo } from "@/demo/store";

export default function QuestionsDemoPage() {
  const demo = useDemo();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">🎒</div><span className="font-display font-bold">Cartable Vivant</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">DÉMO</span></Link>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { demo.signOut(); navigate("/"); }}><LogOut className="size-4" /></Button>
        </div>
      </header>
      <OfflineBanner />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <QuestionsDemo />
      </main>
    </div>
  );
}

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SUBJECTS } from "@/lib/subjects";
import {
  ArrowRight,
  BookOpenCheck,
  ListTodo,
  Mic,
  PenLine,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

const STEPS = [
  {
    icon: Mic,
    color: "#4f46e5",
    soft: "#eef2ff",
    title: "1. Dicte le cours",
    text: "À la fin du cours, le délégué écrit ou colle ses notes de dictaphone : mots-clés, phrases en vrac, peu importe.",
  },
  {
    icon: Sparkles,
    color: "#d97706",
    soft: "#fffbeb",
    title: "2. L'IA rédige",
    text: "En un clic, les notes deviennent un résumé clair : un titre, quelques phrases et les points clés à retenir.",
  },
  {
    icon: BookOpenCheck,
    color: "#0d9488",
    soft: "#f0fdfa",
    title: "3. La classe lit",
    text: "Le résumé est publié dans la matière du jour. Chaque élève retrouve le cours, jour par jour, même absent.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-base text-primary-foreground shadow-sm">
              🎒
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              Cartable Vivant
            </span>
          </div>
          <Button
            asChild
            className="rounded-full font-bold shadow-sm"
          >
            <Link to="/auth">
              Ouvrir mon cartable
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="dot-grid relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground/80 shadow-sm">
              🎓 Connexion avec EcoleDirecte — fait par les délégués, pour les élèves
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Les cours,{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">jour par jour</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 z-0 h-3.5 rounded-full bg-amber-300/70 sm:bottom-1.5"
                />
              </span>{" "}
              pour toute la classe.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Le délégué dicte ce qu'il a retenu du cours. L'IA le transforme en
              résumé clair, coloré et facile à relire — rangé par matière, daté,
              prêt pour les révisions.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full font-bold shadow-md"
            >
              <Link to="/auth">
                Se connecter avec EcoleDirecte
                <ArrowRight className="size-4" />
              </Link>
            </Button>
              <a
                href="#comment"
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-bold text-foreground/85 shadow-sm transition-colors hover:bg-accent"
              >
                Voir comment ça marche
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4 text-primary" />
                Réservé à ta classe
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PenLine className="size-4 text-teal-600" />
                Résumés vérifiés avant publication
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListTodo className="size-4 text-amber-600" />
                Le récap des devoirs inclus
              </span>
            </div>
          </motion.div>

          {/* Mock summary card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotate: 1.5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div
              aria-hidden
              className="animate-float-y absolute -left-6 -top-5 z-10 rounded-2xl border border-border bg-card px-3 py-2 text-xl shadow-md"
            >
              🎙️
            </div>
            <div
              aria-hidden
              className="animate-float-y absolute -right-4 top-16 z-10 rounded-2xl border border-border bg-card px-3 py-2 text-xl shadow-md [animation-delay:1.2s]"
            >
              📐
            </div>
            <div className="pop-card overflow-hidden">
              <div className="h-2 w-full bg-indigo-600" />
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
                    📐 mardi 14 janvier
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    ✅ publié
                  </span>
                </div>
                <h3 className="mt-3 font-display text-xl font-bold">
                  Le théorème de Thalès
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                  Aujourd'hui on a appris à utiliser le théorème de Thalès pour
                  calculer des longueurs dans les triangles semblables…
                </p>
                <ul className="mt-4 grid gap-2">
                  {[
                    "Des triangles semblables, des proportions",
                    "Bien respecter l'ordre des sommets",
                    "Contrôle prévu la semaine prochaine",
                  ].map((k, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                        {i + 1}
                      </span>
                      <span className="text-foreground/85">{k}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-2xl bg-indigo-50/70 p-3.5 text-xs leading-relaxed text-indigo-900/80">
                  <span className="mr-1">🎙️</span>
                  Notes dictées : « Thalès, triangles semblables, exercice 34,
                  contrôle la semaine prochaine… »
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Homework recap teaser */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <motion.div {...fadeUp} transition={{ duration: 0.45 }} className="pop-card overflow-hidden">
          <div className="grid items-center gap-0 lg:grid-cols-2">
            <div className="p-6 sm:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                📋 Nouveau · Le récap des devoirs
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
                Plus un seul devoir oublié
              </h2>
              <p className="mt-3 max-w-md text-muted-foreground">
                Chaque devoir est noté avec son emoji, sa matière et sa date. Coche
                quand c'est fait, et vois qui de la classe l'a déjà bouclé.
              </p>
              <div className="mt-6 space-y-2.5">
                {[
                  { emoji: "📐", text: "Maths · exercices 12 à 15 p. 84", done: true, soft: "#eef2ff" },
                  { emoji: "📖", text: "Français · lire le chapitre 5", done: false, soft: "#fff1f2" },
                  { emoji: "🧪", text: "Physique · le compte-rendu de TP", done: false, soft: "#fff7ed" },
                ].map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, duration: 0.35 }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base shadow-sm"
                      style={{ backgroundColor: item.soft }}
                    >
                      {item.done ? "✅" : item.emoji}
                    </span>
                    <span className={`flex-1 text-sm font-bold ${item.done ? "line-through text-muted-foreground" : ""}`}>
                      {item.text}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.done ? "fait" : "à faire"}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="dot-grid hidden h-full items-center justify-center bg-muted/40 p-10 lg:flex">
              <div className="animate-float-y text-7xl">🗂️</div>
            </div>
      </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="comment" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
          <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Trois étapes, zéro prise de tête
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Le rituel du délégué devient un jeu d'enfant — et toute la classe
            profite des résumés.
          </p>
        </motion.div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              {...fadeUp}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="pop-card pop-card-hover p-6"
            >
              <div
                className="flex size-12 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: step.color }}
              >
                <step.icon className="size-6" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Subject mosaic */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
          <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Chaque matière a sa couleur
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Les résumés sont rangés par matière et triés par date. Un coup d'œil
            suffit pour retrouver le cours d'hier.
          </p>
        </motion.div>
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mt-8 flex flex-wrap justify-center gap-2.5"
        >
          {SUBJECTS.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5"
              style={{ color: s.color }}
            >
              <span
                className="flex size-6 items-center justify-center rounded-full text-xs"
                style={{ backgroundColor: s.soft }}
              >
                {s.emoji}
              </span>
              {s.label}
            </span>
          ))}
        </motion.div>
      </section>

      {/* CTA band */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-md sm:px-12"
        >
          <div className="dot-grid absolute inset-0 opacity-30" aria-hidden />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Prêt à ouvrir le cartable de ta classe ?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/85">
              Connecte-toi avec ton compte EcoleDirecte et publie ton premier
              résumé dès le prochain cours.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-6 rounded-full font-bold shadow-sm"
            >
              <Link to="/auth">
                Commencer maintenant
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span className="inline-flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
              🎒
            </span>
            Cartable Vivant — le site du délégué
          </span>
          <span>Fait avec ❤️ pour les élèves</span>
        </div>
      </footer>
    </div>
  );
}

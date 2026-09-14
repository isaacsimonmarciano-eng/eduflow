import { useMemo, useState } from "react";
import { BookOpen, ClipboardList, MessageCircleQuestion, Users } from "lucide-react";
import { SUBJECTS } from "@/lib/subjects";

type View = "cours" | "devoirs" | "questions" | "classe";

const demoLessons = [
  {
    subjectKey: "maths",
    title: "Fonctions dérivées",
    summary:
      "La dérivée permet d'étudier les variations d'une fonction. On relie le signe de la dérivée aux intervalles où la fonction est croissante ou décroissante.",
    date: "14 septembre",
  },
  {
    subjectKey: "histoire-geo",
    title: "La mondialisation",
    summary:
      "Le cours présente les principaux flux, les acteurs de la mondialisation et les grands pôles de puissance.",
    date: "12 septembre",
  },
];

const demoHomework = [
  { subject: "Mathématiques", text: "Exercices 24 à 28 page 91", due: "Demain" },
  { subject: "Français", text: "Lire le chapitre 4", due: "Jeudi" },
  { subject: "Physique-Chimie", text: "Contrôle : circuits électriques", due: "Vendredi" },
];

const demoQuestions = [
  { subject: "Mathématiques", title: "Quelqu'un a compris la question 3 ?", answers: 2 },
  { subject: "SVT", title: "Il faut apprendre tout le schéma ?", answers: 1 },
];

export default function OfflineDemo() {
  const [view, setView] = useState<View>("cours");
  const [selected, setSelected] = useState("maths");

  const selectedSubject = useMemo(
    () => SUBJECTS.find((subject) => subject.key === selected) ?? SUBJECTS[0],
    [selected],
  );

  const nav = [
    { key: "cours" as const, label: "Cours", icon: BookOpen },
    { key: "devoirs" as const, label: "Devoirs", icon: ClipboardList },
    { key: "questions" as const, label: "Questions", icon: MessageCircleQuestion },
    { key: "classe" as const, label: "Ma classe", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-lg text-primary-foreground">🎒</div>
            <div>
              <h1 className="font-display text-lg font-bold">Cartable Vivant</h1>
              <p className="text-xs text-muted-foreground">Mode présentation hors-ligne</p>
            </div>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">Démo locale</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-primary">Demain</p>
          <h2 className="mt-1 text-2xl font-bold">Tu as Maths, Français et Physique-Chimie</h2>
          <p className="mt-2 text-sm text-muted-foreground">Les derniers résumés de la classe sont prêts à relire.</p>
        </section>

        <nav className="my-6 flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1 shadow-sm" aria-label="Navigation de démonstration">
          {nav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                view === key ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>

        {view === "cours" && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Cours</h2>
                <p className="text-sm text-muted-foreground">Aperçu de l'espace de révision partagé.</p>
              </div>
              <button className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Importer</button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3">
              {SUBJECTS.map((subject) => (
                <button
                  key={subject.key}
                  onClick={() => setSelected(subject.key)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${selected === subject.key ? "text-white" : "bg-card"}`}
                  style={selected === subject.key ? { backgroundColor: subject.color } : undefined}
                >
                  {subject.emoji} {subject.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {demoLessons.filter((lesson) => lesson.subjectKey === selected).length > 0 ? (
                demoLessons
                  .filter((lesson) => lesson.subjectKey === selected)
                  .map((lesson) => (
                    <article key={lesson.title} className="rounded-3xl border bg-card p-5 shadow-sm">
                      <p className="text-xs font-semibold text-muted-foreground">{lesson.date}</p>
                      <h3 className="mt-2 text-xl font-bold">{lesson.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{lesson.summary}</p>
                    </article>
                  ))
              ) : (
                <div className="rounded-3xl border bg-card p-8 text-center md:col-span-2">
                  <div className="text-4xl">{selectedSubject.emoji}</div>
                  <h3 className="mt-3 font-bold">Aucun résumé de démonstration en {selectedSubject.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Le vrai site affichera ici les cours publiés par la classe.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "devoirs" && (
          <div>
            <h2 className="text-2xl font-bold">Devoirs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Chacun peut suivre ce qu'il a terminé.</p>
            <div className="mt-5 space-y-3">
              {demoHomework.map((item) => (
                <div key={item.text} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="size-5 rounded-full border-2 border-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.subject}</p>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{item.due}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "questions" && (
          <div>
            <h2 className="text-2xl font-bold">Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Un espace d'entraide pour toute la classe.</p>
            <div className="mt-5 space-y-3">
              {demoQuestions.map((question) => (
                <article key={question.title} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <p className="text-xs font-bold text-primary">{question.subject}</p>
                  <h3 className="mt-2 font-bold">{question.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{question.answers} réponse{question.answers > 1 ? "s" : ""}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === "classe" && (
          <div>
            <h2 className="text-2xl font-bold">Ma classe</h2>
            <p className="mt-1 text-sm text-muted-foreground">Les membres de la classe et les outils de synchronisation.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {["Isaac Marciano", "Camille D.", "Léo B.", "Sarah M.", "Nathan R.", "Emma C."].map((name, index) => (
                <div key={name} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted font-bold">{name.charAt(0)}</div>
                    <div>
                      <p className="font-bold">{name}</p>
                      <p className="text-xs text-muted-foreground">{index === 0 ? "Moi" : "Élève"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

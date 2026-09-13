/**
 * Unofficial EcoleDirecte login client (server-side).
 *
 * Reproduces the flow of the official web/mobile app against the private API:
 *  1. Bootstrap — GET login.awp?gtk=1 to obtain the GTK cookie / X-GTK header.
 *  2. Login — POST login.awp with the `data=<urlencoded json>` form wrapper
 *     carrying { identifiant, motdepasse, isReLogin: false, uuid: "", fa: [] }.
 *  3. Read the JSON body `code`: 200 = OK, 250 = 2FA, 505 = bad credentials,
 *     516/535 = blocked, 517 = maintenance.
 *  4. If 250 without TOTP: "double authentification" by secret question —
 *     the question + candidate answers are shown to the user. Because Convex
 *     actions are stateless, the pending session state (cookies + GTK) is
 *     handed to the client and sent back for phase 2, which submits the
 *     chosen answer (doubleauth.awp?verbe=post → cn/cv proof) then replays
 *     the login with { cn, cv, fa: [{ cn, cv, uniq: false }] }.
 *  5. Extract the student account (type "E"): id, name, class label.
 *
 * NOTE: this is an unofficial, undocumented endpoint. It can change or be
 * blocked at any time — failures surface as friendly login errors.
 */

const API_BASE = "https://api.ecoledirecte.com";
const API_VERSION = "v3";
const APP_VERSION = "4.101.4";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export type EdProfile = {
  edUserId: string;
  firstName: string;
  lastName: string;
  className: string;
  classId: string | undefined;
};

export type EdChoice = { label: string; value: string };

/** Session state handed to the client between phase 1 and phase 2. */
export type EdPending = {
  cookies: Record<string, string>;
  xGtk?: string;
};

export type EdStartResult =
  | { ok: true; profile: EdProfile }
  | { ok: false; twoFa: false; message: string }
  | {
      ok: false;
      twoFa: true;
      message: undefined;
      pending: string; // JSON.stringify(EdPending)
      question: string;
      choices: EdChoice[];
    };

export type EdFinishResult =
  | { ok: true; profile: EdProfile }
  | { ok: false; message: string };

/** Minimal cookie-jar + GTK state for one login attempt chain. */
class EdSession {
  cookies = new Map<string, string>();
  xGtk: string | undefined;
  private xToken: string | undefined;

  ingest(headers: Headers) {
    const raw =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : (headers.get("set-cookie") ?? "").split(/,(?=[^;]+?=)/);
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const gtk = headers.get("X-GTK");
    if (gtk) this.xGtk = gtk;
    const token = headers.get("X-Token");
    if (token) this.xToken = token;
  }

  headers(): Record<string, string> {
    const h: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "fr-FR,fr;q=0.9",
      Referer: "https://www.ecoledirecte.com/",
      Origin: "https://www.ecoledirecte.com",
    };
    const cookie = [...this.cookies.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookie) h["Cookie"] = cookie;
    if (this.xGtk) h["X-GTK"] = this.xGtk;
    if (this.xToken) h["X-Token"] = this.xToken;
    return h;
  }

  async post(
    url: string,
    data: Record<string, unknown>,
  ): Promise<{ code: number; message?: string; data: Record<string, unknown> }> {
    const payload = JSON.stringify(data);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(payload)}`,
      redirect: "manual",
    });
    this.ingest(res.headers);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      code: typeof body.code === "number" ? body.code : 0,
      message: typeof body.message === "string" ? body.message : undefined,
      data: (body.data ?? {}) as Record<string, unknown>,
    };
  }

  toPending(): string {
    return JSON.stringify({
      cookies: Object.fromEntries(this.cookies),
      xGtk: this.xGtk,
    } satisfies EdPending);
  }

  static fromPending(pending: string): EdSession {
    const parsed = JSON.parse(pending) as EdPending;
    const s = new EdSession();
    for (const [k, v] of Object.entries(parsed.cookies ?? {})) {
      s.cookies.set(k, v);
    }
    s.xGtk = parsed.xGtk;
    return s;
  }
}

async function bootstrap(session: EdSession): Promise<void> {
  const res = await fetch(
    `${API_BASE}/${API_VERSION}/login.awp?gtk=1&v=${APP_VERSION}`,
    { headers: session.headers(), redirect: "manual" },
  );
  session.ingest(res.headers);
  await res.text().catch(() => "");
}

/** Decode a UTF-8 base64 string (questions / propositions are base64-encoded). */
function decodeB64(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const bin = atob(value);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    // Manual UTF-8 decode (TextDecoder is not guaranteed in every runtime).
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i]!;
      if (b < 0x80) {
        out += String.fromCharCode(b);
        i += 1;
      } else if (b < 0xe0) {
        out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f));
        i += 2;
      } else if (b < 0xf0) {
        out += String.fromCharCode(
          ((b & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f),
        );
        i += 3;
      } else {
        const cp =
          ((b & 0x07) << 18) |
          ((bytes[i + 1]! & 0x3f) << 12) |
          ((bytes[i + 2]! & 0x3f) << 6) |
          (bytes[i + 3]! & 0x3f);
        out += String.fromCodePoint(cp);
        i += 4;
      }
    }
    return out;
  } catch {
    return value; // not base64 — return as-is
  }
}

function friendlyError(code: number, message?: string): string {
  if (code === 505) return "Identifiant ou mot de passe incorrect.";
  if (code === 516 || code === 535) {
    return "Ton compte EcoleDirecte est bloqué. Contacte ton établissement.";
  }
  if (code === 517) {
    return "EcoleDirecte est en maintenance, réessaie plus tard.";
  }
  return (
    message ||
    "EcoleDirecte n'a pas répondu comme prévu. Réessaie dans un instant."
  );
}

/**
 * Phase A: verify credentials. If the account requires the secret-question
 * double auth, return the question + candidate choices plus the pending
 * session state so the UI can ask the user, then call
 * `ecoleDirecteFinish` with the chosen answer.
 */
export async function ecoleDirecteStart(
  identifiant: string,
  motdepasse: string,
): Promise<EdStartResult> {
  const session = new EdSession();
  try {
    await bootstrap(session);

    const first = await session.post(
      `${API_BASE}/${API_VERSION}/login.awp?v=${APP_VERSION}`,
      { identifiant, motdepasse, isReLogin: false, uuid: "", fa: [] },
    );

    if (first.code === 200) {
      const profile = await extractStudentProfile(session, first);
      if (!profile) {
        return {
          ok: false,
          twoFa: false,
          message:
            "Connexion réussie, mais aucun compte élève n'a été trouvé. Ce site est réservé aux élèves.",
        };
      }
      return { ok: true, profile };
    }

    if (first.code === 250) {
      if (first.data.totp === true) {
        return {
          ok: false,
          twoFa: false,
          message:
            "Ton compte EcoleDirecte est protégé par une double authentification à code (TOTP). Désactive-la dans « Mon compte » sur EcoleDirecte, puis réessaie.",
        };
      }

      // Fetch the secret question + candidate answers.
      const challenge = await session.post(
        `${API_BASE}/${API_VERSION}/connexion/doubleauth.awp?verbe=get&v=${APP_VERSION}`,
        {},
      );
      const question = decodeB64(challenge.data.question);
      const propositions = Array.isArray(challenge.data.propositions)
        ? challenge.data.propositions
        : [];

      if (challenge.code !== 200 || !question || propositions.length === 0) {
        return {
          ok: false,
          twoFa: false,
          message:
            challenge.message ||
            "EcoleDirecte demande une vérification d'identité mais la question n'a pas pu être chargée. Connecte-toi une fois sur le site EcoleDirecte, puis réessaie.",
        };
      }

      const choices: EdChoice[] = propositions
        .filter((p): p is string => typeof p === "string")
        .map((value) => ({ label: decodeB64(value) ?? value, value }));

      return {
        ok: false,
        twoFa: true,
        message: undefined,
        pending: session.toPending(),
        question,
        choices,
      };
    }

    return { ok: false, twoFa: false, message: friendlyError(first.code, first.message) };
  } catch {
    return {
      ok: false,
      twoFa: false,
      message:
        "Impossible de joindre EcoleDirecte. Vérifie ta connexion et réessaie.",
    };
  }
}

/**
 * Phase B: submit the answer to the secret question within the pending
 * session, then replay the login with the challenge proof (cn/cv).
 */
export async function ecoleDirecteFinish(
  identifiant: string,
  motdepasse: string,
  pending: string,
  choixValue: string,
): Promise<EdFinishResult> {
  try {
    const session = EdSession.fromPending(pending);

    const answer = await session.post(
      `${API_BASE}/${API_VERSION}/connexion/doubleauth.awp?verbe=post&v=${APP_VERSION}`,
      { choix: choixValue },
    );
    const cn = typeof answer.data.cn === "string" ? answer.data.cn : undefined;
    const cv = typeof answer.data.cv === "string" ? answer.data.cv : undefined;

    if (answer.code !== 200 || !cn || !cv) {
      return {
        ok: false,
        message:
          answer.message ||
          "Réponse incorrecte à la question de vérification. Réessaie.",
      };
    }

    // Replay the login with the challenge proof.
    const replay = await session.post(
      `${API_BASE}/${API_VERSION}/login.awp?v=${APP_VERSION}`,
      {
        identifiant,
        motdepasse,
        isReLogin: false,
        cn,
        cv,
        uuid: "",
        fa: [{ cn, cv, uniq: false }],
      },
    );
    if (replay.code !== 200) {
      return { ok: false, message: friendlyError(replay.code, replay.message) };
    }

    const profile = await extractStudentProfile(session, replay);
    if (!profile) {
      return {
        ok: false,
        message:
          "Connexion réussie, mais aucun compte élève n'a été trouvé. Ce site est réservé aux élèves.",
      };
    }
    return { ok: true, profile };
  } catch {
    return {
      ok: false,
      message:
        "La vérification d'identité a échoué. Réessaie dans un instant.",
    };
  }
}

async function extractStudentProfile(
  session: EdSession,
  body: { code: number; data: Record<string, unknown> },
): Promise<EdProfile | null> {
  const data = body.data;
  const accounts = data.accounts;
  if (!Array.isArray(accounts)) return null;

  const student = accounts.find(
    (a) => a && typeof a === "object" && (a as Record<string, unknown>).type === "E",
  ) as Record<string, unknown> | undefined;
  if (!student) return null;

  const edUserId = student.id != null ? String(student.id) : "";
  if (!edUserId) return null;

  const p = (student.profile ?? {}) as Record<string, unknown>;
  const firstName = str(p.prenom) ?? str(student.prenom) ?? "";
  const lastName = str(p.nom) ?? str(student.nom) ?? "";

  let className = "";
  let classId: string | undefined;
  const classe = p.classe;
  if (typeof classe === "string") {
    className = classe;
  } else if (classe && typeof classe === "object") {
    const c = classe as Record<string, unknown>;
    if (typeof c.libelle === "string") className = c.libelle;
    if (c.id != null) classId = String(c.id);
  }
  if (!className && typeof p.classeLibelle === "string") {
    className = p.classeLibelle;
  }
  if (!className && typeof student.className === "string") {
    className = student.className;
  }

  // Best-effort: fetch the full profile if the class is still missing.
  if (!className) {
    try {
      const deep = await session.post(
        `${API_BASE}/${API_VERSION}/eleves/${edUserId}.awp?verbe=get&v=${APP_VERSION}`,
        {},
      );
      const classe2 = deep.data.classe;
      if (typeof classe2 === "string" && classe2) className = classe2;
      else if (classe2 && typeof classe2 === "object") {
        const libelle = (classe2 as Record<string, unknown>).libelle;
        if (typeof libelle === "string") className = libelle;
      }
      if (!className && typeof deep.data.classeLibelle === "string") {
        className = deep.data.classeLibelle;
      }
      if (deep.data.classeId != null) classId = String(deep.data.classeId);
    } catch {
      // Non-blocking: the class stays unknown.
    }
  }

  return { edUserId, firstName, lastName, className, classId };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

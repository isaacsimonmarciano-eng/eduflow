/**
 * Unofficial EcoleDirecte login client (server-side).
 *
 * Reproduces the flow of the official web app against the private API:
 *  1. Bootstrap — GET login.awp?gtk=1 → GTK cookie (the X-GTK header value is
 *     actually the GTK cookie; the response carries it in `Set-Cookie`).
 *  2. Login — POST login.awp with the `data=<urlencoded json>` form wrapper
 *     carrying { identifiant, motdepasse, isReLogin: false, uuid: "", fa: [] }.
 *  3. Read the JSON body `code`: 200 = OK, 250 = 2FA, 505 = bad credentials,
 *     516/535 = blocked, 517 = maintenance, 520 = charter required.
 *  4. If 250 without TOTP: "double authentification" by secret question —
 *     the response issues a 2FA-Token (header) + cookies that must be replayed
 *     on doubleauth.awp (verbe=get for the question, verbe=post for the answer,
 *     sent WITHOUT the GTK header) and on the final login replay, which carries
 *     { cn, cv } both at top level and inside the fa list.
 *  5. EcoleDirecte can chain several questions in one login; each answer loops
 *     through doubleauth again. A documented quirk: a login replay that answers
 *     250 with a fresh question may then be followed by a spurious 505 on the
 *     next replay with an fa list — retried once without the fa list, as the
 *     official client does.
 *  6. Extract the student identity — a `typeCompte: "E"` account, a child of a
 *     `typeCompte: "1"` family account, then complete name/class from
 *     `eleves/<id>.awp`.
 *
 * NOTE: this is an unofficial, undocumented endpoint. It can change or be
 * blocked at any time — failures surface as friendly login errors.
 */

const API_BASE = "https://api.ecoledirecte.com";
const API_VERSION = "v3";
const APP_VERSION = "4.101.4";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 30_000;

export type EdProfile = {
  edUserId: string;
  firstName: string;
  lastName: string;
  className: string;
  classId: string | undefined;
};

export type EdChoice = { label: string; value: string };

export type EdStartResult =
  | { ok: true; profile: EdProfile }
  | { ok: false; twoFa: true; message: undefined; pending: string; question: string; choices: EdChoice[] }
  | { ok: false; twoFa: false; message: string };

/** `finish` can either complete, fail, or surface ANOTHER chained question. */
export type EdFinishResult =
  | { ok: true; profile: EdProfile }
  | { ok: false; message: string }
  | { ok: false; message: string; pending: string; question: string; choices: EdChoice[] };

/**
 * Serializable snapshot of one login-attempt chain: cookies + GTK + the
 * answered factors (fa). Handed to the client between question rounds and
 * sent back so Convex (stateless) can resume the exact session.
 */
export type EdPending = {
  cookies: Record<string, string>;
  xGtk?: string;
  xToken?: string;
  twoFaToken?: string;
  answeredFactors: { cn: string; cv: string; uniq: boolean }[];
  /** How many questions have been answered — bounds a server that keeps asking. */
  answeredCount: number;
};

type EdCode = {
  code: number;
  message?: string;
  token?: string;
  data: Record<string, unknown>;
};

/** Minimal cookie-jar + GTK + 2FA state for one login attempt chain. */
class EdSession {
  cookies = new Map<string, string>();
  xGtk: string | undefined;
  xToken: string | undefined;
  twoFaToken: string | undefined;

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
    const twoFa = headers.get("2FA-Token");
    if (twoFa) this.twoFaToken = twoFa;
  }

  gtkValue(): string | undefined {
    return this.xGtk ?? this.cookies.get("GTK");
  }

  headers(opts: { includeGtk?: boolean } = {}): Record<string, string> {
    const h: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "fr-FR,fr;q=0.9",
    };
    const cookie = [...this.cookies.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookie) h["Cookie"] = cookie;
    if ((opts.includeGtk ?? true) && this.gtkValue()) {
      h["X-GTK"] = this.gtkValue()!;
    }
    if (this.xToken) h["X-Token"] = this.xToken;
    if (this.twoFaToken) h["2FA-Token"] = this.twoFaToken;
    return h;
  }

  async post(
    url: string,
    data: Record<string, unknown>,
    opts: { includeGtk?: boolean } = {},
  ): Promise<EdCode> {
    const payload = JSON.stringify(data);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...this.headers(opts),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(payload)}`,
        redirect: "manual",
        signal: controller.signal,
      });
      this.ingest(res.headers);
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      // The pending 2FA / session token can also arrive in the body — keep it
      // so the double-auth answer and the follow-up calls present it.
      if (typeof body.token === "string" && body.token) {
        this.xToken = body.token;
      }
      return {
        code: typeof body.code === "number" ? body.code : 0,
        message: typeof body.message === "string" ? body.message : undefined,
        token: typeof body.token === "string" ? body.token : undefined,
        data: (body.data ?? {}) as Record<string, unknown>,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  toPending(answeredFactors: { cn: string; cv: string; uniq: boolean }[], answeredCount: number): string {
    return JSON.stringify({
      cookies: Object.fromEntries(this.cookies),
      xGtk: this.xGtk,
      xToken: this.xToken,
      twoFaToken: this.twoFaToken,
      answeredFactors,
      answeredCount,
    } satisfies EdPending);
  }

  static fromPending(pending: string): { session: EdSession; pending: EdPending } {
    const parsed = JSON.parse(pending) as EdPending;
    const s = new EdSession();
    for (const [k, v] of Object.entries(parsed.cookies ?? {})) {
      s.cookies.set(k, v);
    }
    s.xGtk = parsed.xGtk;
    s.xToken = parsed.xToken;
    s.twoFaToken = parsed.twoFaToken;
    return { session: s, pending: parsed };
  }
}

/**
 * Bootstrap a fresh GTK.
 *
 * EcoleDirecte issues a brand-new cookie set on every `login.awp?gtk=1` call,
 * and it only accepts a login POST that carries the GTK/session cookies of the
 * MOST RECENT bootstrap. So this has to be replayed right before every login
 * POST — including the final replay that completes a double auth. Skipping it
 * makes the API answer code 505 ("identifiant et/ou mot de passe invalide !")
 * even when the credentials and the challenge answer are perfectly correct.
 */
async function bootstrap(session: EdSession): Promise<void> {
  // Drop the cached header value so X-GTK falls back to the freshly issued cookie.
  session.xGtk = undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_BASE}/${API_VERSION}/login.awp?gtk=1&v=${APP_VERSION}`,
      { headers: session.headers(), redirect: "manual", signal: controller.signal },
    );
    session.ingest(res.headers);
    // Some bootstrap responses carry the GTK in the body instead of a cookie.
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.token === "string" && body.token) {
      session.xGtk = body.token;
    }
  } finally {
    clearTimeout(timer);
  }
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
  if (code === 520) {
    return "Tu dois d'abord accepter la charte d'utilisation sur le site EcoleDirecte.";
  }
  if (message) return `${message} (code ${code})`;
  return "EcoleDirecte n'a pas répondu comme prévu. Réessaie dans un instant.";
}

const MAX_CHAINED_CHALLENGES = 3;

type LoginOutcome =
  | { kind: "authenticated"; profile: EdProfile }
  | { kind: "question"; question: string; choices: EdChoice[] }
  | { kind: "error"; message: string };

/**
 * Submit one login POST. Handles the full double-auth loop (including chained
 * questions) on top of the shared session. `fa` starts empty and accumulates
 * answered factors, mirroring the official client.
 */
async function performLogin(
  session: EdSession,
  identifiant: string,
  motdepasse: string,
  answeredFactors: { cn: string; cv: string; uniq: boolean }[],
  answeredCount: number,
): Promise<LoginOutcome> {
  const payload: Record<string, unknown> = {
    identifiant,
    motdepasse,
    isReLogin: false,
    uuid: "",
    fa: answeredFactors,
  };

  const res = await session.post(
    `${API_BASE}/${API_VERSION}/login.awp?v=${APP_VERSION}`,
    payload,
  );

  if (res.code === 200) {
    const profile = await extractStudentProfile(session, res);
    if (!profile) {
      return {
        kind: "error",
        message:
          "Connexion réussie, mais aucun compte élève n'a été trouvé. Ce site est réservé aux élèves.",
      };
    }
    return { kind: "authenticated", profile };
  }

  if (res.code === 250) {
    if (res.data.totp === true) {
      return {
        kind: "error",
        message:
          "Ton compte EcoleDirecte est protégé par une double authentification à code (TOTP). Désactive-la dans « Mon compte » sur EcoleDirecte, puis réessaie.",
      };
    }

    // Fetch the secret question + candidate answers (no GTK header on
    // doubleauth.awp, per the official client's behaviour).
    const challenge = await session.post(
      `${API_BASE}/${API_VERSION}/connexion/doubleauth.awp?verbe=get&v=${APP_VERSION}`,
      {},
      { includeGtk: false },
    );
    const question = decodeB64(challenge.data.question);
    const propositions = Array.isArray(challenge.data.propositions)
      ? challenge.data.propositions
      : [];

    if (challenge.code !== 200 || !question || propositions.length === 0) {
      return {
        kind: "error",
        message:
          challenge.message ||
          "EcoleDirecte demande une vérification d'identité mais la question n'a pas pu être chargée. Connecte-toi une fois sur le site EcoleDirecte, puis réessaie.",
      };
    }

    const choices: EdChoice[] = propositions
      .filter((p): p is string => typeof p === "string")
      .map((value) => ({ label: decodeB64(value) ?? value, value }));

    return { kind: "question", question, choices };
  }

  return { kind: "error", message: friendlyError(res.code, res.message) };
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
  try {
    const session = new EdSession();
    await bootstrap(session);

    const first = await performLogin(session, identifiant, motdepasse, [], 0);

    if (first.kind === "authenticated") {
      return { ok: true, profile: first.profile };
    }
    if (first.kind === "question") {
      return {
        ok: false,
        twoFa: true,
        message: undefined,
        pending: session.toPending([], 0),
        question: first.question,
        choices: first.choices,
      };
    }
    return { ok: false, twoFa: false, message: first.message };
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
 * Chained questions are handled: if the replay asks another question, return
 * it with the updated pending state.
 */
export async function ecoleDirecteFinish(
  identifiant: string,
  motdepasse: string,
  pending: string,
  choixValue: string,
): Promise<EdFinishResult> {
  try {
    const { session, pending: state } = EdSession.fromPending(pending);

    if (state.answeredCount >= MAX_CHAINED_CHALLENGES) {
      return {
        ok: false,
        message:
          "Trop de questions de vérification successives. Connecte-toi une fois sur le site EcoleDirecte, puis réessaie ici.",
      };
    }

    const answer = await session.post(
      `${API_BASE}/${API_VERSION}/connexion/doubleauth.awp?verbe=post&v=${APP_VERSION}`,
      { choix: choixValue },
      { includeGtk: false },
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

    // The web app merges the answered challenge into the credentials object
    // (`doLogin({...credentials, cn, cv})`) and its auth service appends the
    // remembered-factor list — so cn/cv go both at top level and in `fa`.
    const answeredFactors = [
      ...state.answeredFactors.filter((f) => f.cn !== cn),
      { cn, cv, uniq: false },
    ].slice(-10);

    // Fresh GTK + fresh session cookies before the replay: the answer was
    // accepted, but this login POST is only honoured on the newest bootstrap.
    await bootstrap(session);

    let replay = await session.post(
      `${API_BASE}/${API_VERSION}/login.awp?v=${APP_VERSION}`,
      {
        identifiant,
        motdepasse,
        isReLogin: false,
        cn,
        cv,
        uuid: "",
        fa: answeredFactors,
      },
    );

    // Documented quirk: with a non-empty fa list, EcoleDirecte can answer a
    // CORRECT challenge with "Identifiant et/ou mot de passe invalide !" (505).
    // The official client then retries once from a clean bootstrap, without
    // replaying the remembered-factor list.
    if (replay.code === 505 && answeredFactors.length > 0) {
      await bootstrap(session);
      replay = await session.post(
        `${API_BASE}/${API_VERSION}/login.awp?v=${APP_VERSION}`,
        { identifiant, motdepasse, isReLogin: false, uuid: "", fa: [] },
      );
    }

    if (replay.code === 200) {
      const profile = await extractStudentProfile(session, replay);
      if (!profile) {
        return {
          ok: false,
          message:
            "Connexion réussie, mais aucun compte élève n'a été trouvé. Ce site est réservé aux élèves.",
        };
      }
      return { ok: true, profile };
    }

    if (replay.code === 250) {
      // Another chained question — refresh the 2FA token from this response
      // (ingest already ran) and fetch the new challenge.
      if (replay.data.totp === true) {
        return {
          ok: false,
          message:
            "Ton compte EcoleDirecte est protégé par une double authentification à code (TOTP). Désactive-la dans « Mon compte » sur EcoleDirecte, puis réessaie.",
        };
      }
      const challenge = await session.post(
        `${API_BASE}/${API_VERSION}/connexion/doubleauth.awp?verbe=get&v=${APP_VERSION}`,
        {},
        { includeGtk: false },
      );
      const question = decodeB64(challenge.data.question);
      const propositions = Array.isArray(challenge.data.propositions)
        ? challenge.data.propositions
        : [];
      if (challenge.code !== 200 || !question || propositions.length === 0) {
        return {
          ok: false,
          message:
            challenge.message ||
            "EcoleDirecte demande une autre vérification d'identité mais la question n'a pas pu être chargée. Connecte-toi une fois sur le site EcoleDirecte, puis réessaie.",
        };
      }
      const choices: EdChoice[] = propositions
        .filter((p): p is string => typeof p === "string")
        .map((value) => ({ label: decodeB64(value) ?? value, value }));
      return {
        ok: false,
        message: "EcoleDirecte demande une autre vérification d'identité.",
        pending: session.toPending(answeredFactors, state.answeredCount + 1),
        question,
        choices,
      };
    }

    // Nothing else can be salvaged on a fresh bootstrap: surface the failure.
    if (replay.code === 505) {
      return {
        ok: false,
        message:
          "EcoleDirecte a refusé la reconnexion après la vérification d'identité. Réessaie la question, ou reconnecte-toi depuis le début.",
      };
    }
    return { ok: false, message: friendlyError(replay.code, replay.message) };
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
  body: EdCode,
): Promise<EdProfile | null> {
  const data = body.data;
  const accounts = (Array.isArray(data.accounts) ? data.accounts : [])
    .map(asRecord)
    .filter((a): a is Record<string, unknown> => a !== undefined);

  // Two shapes carry a student identity:
  //  - a student account itself: `typeCompte: "E"` (its own id IS the student id)
  //  - a family account: `typeCompte: "1"`, whose children live in profile.eleves[]
  let student = accounts.find((a) => accountType(a) === "E");
  if (!student) {
    for (const account of accounts) {
      const profile = asRecord(account.profile);
      const eleves = Array.isArray(profile?.eleves) ? profile.eleves : [];
      const child = eleves
        .map(asRecord)
        .find((e): e is Record<string, unknown> => e !== undefined);
      if (child) {
        student = child;
        break;
      }
    }
  }
  // Last resort: some responses inline the current identity in `data` itself.
  if (!student && idOf(data.id) && (str(data.prenom) || str(data.nom))) {
    student = data;
  }
  if (!student) return null;

  const edUserId = idOf(student.id);
  if (!edUserId) return null;

  const fromAccount = classInfo(student);
  const profile: EdProfile = {
    edUserId,
    firstName: str(student.prenom) ?? "",
    lastName: str(student.nom) ?? "",
    className: fromAccount.label ?? "",
    classId: fromAccount.id,
  };

  // The dedicated student record is the authoritative source for the name and,
  // above all, the class — login accounts often omit it entirely.
  try {
    const deep = await session.post(
      `${API_BASE}/${API_VERSION}/eleves/${edUserId}.awp?verbe=get&v=${APP_VERSION}`,
      { anneeScolaire: "" },
    );
    const d = deep.data;
    profile.firstName = str(d.prenom) ?? profile.firstName;
    profile.lastName = str(d.nom) ?? profile.lastName;
    const fromProfile = classInfo(d);
    if (fromProfile.label) profile.className = fromProfile.label;
    if (fromProfile.id) profile.classId = fromProfile.id;
  } catch {
    // Non-blocking: keep whatever the login response already gave us.
  }

  return profile;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** `typeCompte` is the real discriminator: "E" élève, "1" famille, "P" prof, "A" personnel. */
function accountType(account: Record<string, unknown>): string {
  const raw = account.typeCompte ?? account.type;
  if (typeof raw === "string") return raw.trim().toUpperCase();
  if (typeof raw === "number") return String(raw);
  return "";
}

function idOf(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

/** Class label + id, accepting both the flat (`classeLibelle`) and nested (`classe`) shapes. */
function classInfo(source: Record<string, unknown>): { label?: string; id?: string } {
  const nested = asRecord(source.classe);
  const label =
    str(source.classeLibelle) ??
    str(source.libelle) ??
    str(source.classe) ??
    (nested ? str(nested.libelle) ?? str(nested.code) : undefined);
  const id = idOf(source.classeId) ?? (nested ? idOf(nested.id) : undefined);
  return { label, id };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

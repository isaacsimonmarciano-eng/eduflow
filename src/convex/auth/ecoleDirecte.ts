/**
 * Unofficial EcoleDirecte login client (server-side).
 *
 * Reproduces the flow of the official web/mobile app against the private API:
 *  1. Bootstrap — GET login.awp?gtk=1 to obtain the GTK cookie / X-GTK header.
 *  2. Login — POST login.awp with the `data=<urlencoded json>` form wrapper
 *     carrying { identifiant, motdepasse, isReLogin: false, uuid: "", fa: [] }.
 *  3. Read the JSON body `code`: 200 = OK, 250 = 2FA required, 505 = bad
 *     credentials, 516/535 = blocked, 517 = maintenance.
 *  4. Extract the student account (type "E"): id, name, class label.
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

export type EdLoginResult =
  | { ok: true; profile: EdProfile }
  | { ok: false; message: string };

type RawApiResponse = {
  code?: number;
  token?: string;
  message?: string;
  data?: unknown;
};

export async function ecoleDirecteLogin(
  identifiant: string,
  motdepasse: string,
): Promise<EdLoginResult> {
  const cookies = new Map<string, string>();
  let xGtk: string | undefined;
  let xToken: string | undefined;

  const ingest = (headers: Headers) => {
    const raw =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : (headers.get("set-cookie") ?? "").split(/,(?=[^;]+?=)/);
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const gtk = headers.get("X-GTK");
    if (gtk) xGtk = gtk;
    const token = headers.get("X-Token");
    if (token) xToken = token;
  };

  const baseHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
    };
    const cookie = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) h["Cookie"] = cookie;
    if (xGtk) h["X-GTK"] = xGtk;
    if (xToken) h["X-Token"] = xToken;
    return h;
  };

  try {
    // 1. Bootstrap — GTK cookie.
    const boot = await fetch(
      `${API_BASE}/${API_VERSION}/login.awp?gtk=1&v=${APP_VERSION}`,
      { headers: baseHeaders(), redirect: "manual" },
    );
    ingest(boot.headers);

    // 2. Login POST with the form-urlencoded `data=` wrapper.
    const payload = JSON.stringify({
      identifiant,
      motdepasse,
      isReLogin: false,
      uuid: "",
      fa: [],
    });
    const res = await fetch(
      `${API_BASE}/${API_VERSION}/login.awp?v=${APP_VERSION}`,
      {
        method: "POST",
        headers: {
          ...baseHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(payload)}`,
        redirect: "manual",
      },
    );
    ingest(res.headers);

    const body = (await res.json().catch(() => ({}))) as RawApiResponse;
    const code = typeof body.code === "number" ? body.code : 0;

    if (code === 250) {
      return {
        ok: false,
        message:
          "Ton compte EcoleDirecte est protégé par une double authentification (2FA). Désactive-la dans « Mon compte » sur EcoleDirecte, puis réessaie.",
      };
    }
    if (code === 505) {
      return {
        ok: false,
        message: "Identifiant ou mot de passe incorrect.",
      };
    }
    if (code === 516 || code === 535) {
      return {
        ok: false,
        message: "Ton compte EcoleDirecte est bloqué. Contacte ton établissement.",
      };
    }
    if (code === 517) {
      return {
        ok: false,
        message: "EcoleDirecte est en maintenance, réessaie plus tard.",
      };
    }
    if (code !== 200) {
      return {
        ok: false,
        message:
          body.message ||
          "EcoleDirecte n'a pas répondu comme prévu. Réessaie dans un instant.",
      };
    }

    // 3. Extract the student profile from the login payload.
    const profile = extractStudentProfile(body);
    if (!profile) {
      return {
        ok: false,
        message:
          "Connexion réussie, mais aucun compte élève n'a été trouvé. Ce site est réservé aux élèves.",
      };
    }

    // 4. Best-effort: fetch the full student profile if the class is missing.
    if (!profile.className) {
      try {
        const deep = await fetch(
          `${API_BASE}/${API_VERSION}/eleves/${profile.edUserId}.awp?verbe=get&v=${APP_VERSION}`,
          { headers: baseHeaders(), redirect: "manual" },
        );
        ingest(deep.headers);
        const deepBody = (await deep.json().catch(() => ({}))) as RawApiResponse;
        const data = (deepBody.data ?? {}) as Record<string, unknown>;
        const classe = data.classe as Record<string, unknown> | string | undefined;
        if (typeof classe === "string" && classe) profile.className = classe;
        else if (classe && typeof classe === "object") {
          const libelle = (classe as Record<string, unknown>).libelle;
          if (typeof libelle === "string") profile.className = libelle;
        }
        if (!profile.className && typeof data.classeLibelle === "string") {
          profile.className = data.classeLibelle;
        }
      } catch {
        // Non-blocking: the class stays unknown.
      }
    }

    return { ok: true, profile };
  } catch {
    return {
      ok: false,
      message:
        "Impossible de joindre EcoleDirecte. Vérifie ta connexion et réessaie.",
    };
  }
}

function extractStudentProfile(body: RawApiResponse): EdProfile | null {
  const data = (body.data ?? {}) as Record<string, unknown>;
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
  if (!className && typeof (student as Record<string, unknown>).className === "string") {
    className = (student as Record<string, unknown>).className as string;
  }

  return {
    edUserId,
    firstName,
    lastName,
    className,
    classId,
  };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

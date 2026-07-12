// Cowork Sync Agent
// Cloudflare Agents SDK(Durable Object) 기반의 실시간 동기화 에이전트.
//
// 한 "룸"(에이전트 인스턴스)에 여러 기기가 WebSocket으로 붙는다:
//  - 로컬 PC는 scripts/sync-up.js 로 Claude Code 트랜스크립트를 업로드
//  - 브라우저들은 세션 목록/정리 메타/채팅을 실시간으로 공유
//  - 채팅(이어서 대화)은 Claude 스트리밍 응답을 모든 기기에 동시에 중계
//  - 리마인더는 Durable Object 알람(this.schedule)으로 예약 후 브로드캐스트
//
// 클라이언트 프로토콜(JSON over WebSocket):
//   수신: {type:"open"|"chat"|"meta"|"remind"|"cancel_remind"|"list_reminders"}
//   송신: welcome / presence / sessions / session_detail / activity
//         chat_user / chat_delta / chat_done / chat_error
//         meta_update / reminder / reminders / error
// "cf_agent_..." 로 시작하는 메시지는 SDK 내부 프로토콜이므로 클라이언트는 무시한다.

import {
  Agent,
  routeAgentRequest,
  type Connection,
  type ConnectionContext,
} from "agents";
import Anthropic from "@anthropic-ai/sdk";

// 바인딩/vars 타입은 `wrangler types`가 생성한 Cloudflare.Env 에서 온다.
// 시크릿(wrangler secret put)은 생성 타입에 없으므로 여기서 보강한다.
export interface Env extends Cloudflare.Env {
  ANTHROPIC_API_KEY?: string;
  SYNC_TOKEN?: string;
  // 설정하면 뷰어(WebSocket/GET)도 이 토큰이 있어야 접근 가능
  VIEW_TOKEN?: string;
}

// 트랜스크립트 메시지(lib/parser.js 출력 형식과 동일)
interface TranscriptBlock {
  type: string;
  text?: string;
  name?: string;
  input?: string;
  output?: string;
  isError?: boolean;
}
interface TranscriptMessage {
  role: string;
  blocks: TranscriptBlock[];
  timestamp: string | null;
  isMeta?: boolean;
}
interface SyncedSession {
  id: string;
  title: string;
  preview: string;
  project: string;
  projectName: string;
  gitBranch: string | null;
  messageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  messages: TranscriptMessage[];
}

const MAX_HISTORY_CHARS = 300_000;

export class CoworkAgent extends Agent<Env> {
  // 동시에 한 개의 채팅 스트림만 처리 (룸 단위)
  private chatBusy = false;

  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      preview TEXT NOT NULL DEFAULT '',
      project TEXT NOT NULL DEFAULT '',
      project_name TEXT NOT NULL DEFAULT '',
      git_branch TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      data TEXT NOT NULL DEFAULT '[]',
      synced_at TEXT
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS meta (
      session_id TEXT PRIMARY KEY,
      favorite INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '',
      folder TEXT NOT NULL DEFAULT '',
      custom_title TEXT NOT NULL DEFAULT ''
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      ts TEXT NOT NULL
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL
    )`;
  }

  // ---------- HTTP (동기화 업로드 등) ----------
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // /agents/cowork-agent/<room>/<action>
    const parts = url.pathname.split("/").filter(Boolean);
    const action = parts[3] || "";

    if (request.method === "GET" && action === "health") {
      return json({ ok: true, room: this.name, sessions: this.sessionCount() });
    }

    if (request.method === "GET" && action === "sessions") {
      return json({ sessions: this.listSessions() });
    }

    if (request.method === "POST" && action === "sync") {
      const denied = this.checkSyncToken(request);
      if (denied) return denied;
      let body: { sessions?: SyncedSession[] };
      try {
        body = await request.json();
      } catch {
        return json({ error: "잘못된 JSON 본문" }, 400);
      }
      const sessions = Array.isArray(body.sessions) ? body.sessions : [];
      let upserted = 0;
      for (const s of sessions) {
        if (!s || typeof s.id !== "string" || !s.id) continue;
        this.upsertSession(s);
        upserted++;
      }
      if (upserted > 0) {
        this.logActivity("sync", `세션 ${upserted}개 동기화됨`);
        this.broadcastJson({ type: "sessions", sessions: this.listSessions() });
        this.broadcastJson({ type: "activity", items: this.listActivity() });
      }
      return json({ ok: true, upserted, total: this.sessionCount() });
    }

    return json({ error: "not found" }, 404);
  }

  private checkSyncToken(request: Request): Response | null {
    const expected = this.env.SYNC_TOKEN;
    if (!expected) return null; // 토큰 미설정 시 개방 (README에서 설정 권장)
    const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (got !== expected) return json({ error: "SYNC_TOKEN 불일치" }, 401);
    return null;
  }

  // ---------- WebSocket ----------
  async onConnect(connection: Connection, _ctx: ConnectionContext) {
    connection.send(
      JSON.stringify({
        type: "welcome",
        room: this.name,
        chatEnabled: Boolean(this.env.ANTHROPIC_API_KEY),
        model: this.env.CLAUDE_MODEL || "claude-opus-4-8",
        sessions: this.listSessions(),
        activity: this.listActivity(),
        presence: this.presence(),
      })
    );
    this.broadcastJson({ type: "presence", count: this.presence() });
  }

  async onClose(connection: Connection) {
    this.broadcastJson({ type: "presence", count: this.presence() }, [connection.id]);
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer | ArrayBufferView) {
    if (typeof message !== "string") return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    try {
      switch (msg.type) {
        case "open":
          return this.handleOpen(connection, String(msg.sessionId || ""));
        case "meta":
          return this.handleMeta(String(msg.sessionId || ""), msg.patch as Record<string, unknown>);
        case "chat":
          return await this.handleChat(String(msg.sessionId || ""), String(msg.text || ""));
        case "remind":
          return await this.handleRemind(Number(msg.seconds), String(msg.note || ""));
        case "cancel_remind":
          await this.cancelSchedule(String(msg.id || ""));
          return this.broadcastReminders();
        case "list_reminders":
          return this.sendReminders(connection);
      }
    } catch (err) {
      connection.send(
        JSON.stringify({ type: "error", message: err instanceof Error ? err.message : String(err) })
      );
    }
  }

  // 세션 상세(트랜스크립트 + 이어진 채팅)를 요청한 기기에만 보낸다
  private handleOpen(connection: Connection, sessionId: string) {
    const rows = this.sql<{ data: string }>`SELECT data FROM sessions WHERE id = ${sessionId}`;
    if (!rows.length) {
      connection.send(JSON.stringify({ type: "error", message: "세션을 찾을 수 없어요" }));
      return;
    }
    const chat = this.sql<{ role: string; text: string; ts: string }>`
      SELECT role, text, ts FROM chat WHERE session_id = ${sessionId} ORDER BY id`;
    connection.send(
      JSON.stringify({
        type: "session_detail",
        sessionId,
        messages: JSON.parse(rows[0].data || "[]"),
        chat,
      })
    );
  }

  // 정리 메타(즐겨찾기/태그/폴더/제목) 변경 → 즉시 전 기기 반영
  private handleMeta(sessionId: string, patch: Record<string, unknown> = {}) {
    const favorite = patch.favorite === undefined ? null : patch.favorite ? 1 : 0;
    const tags = patch.tags === undefined ? null : String(patch.tags);
    const folder = patch.folder === undefined ? null : String(patch.folder);
    const customTitle = patch.customTitle === undefined ? null : String(patch.customTitle);

    this.sql`INSERT INTO meta (session_id) VALUES (${sessionId})
             ON CONFLICT(session_id) DO NOTHING`;
    this.sql`UPDATE meta SET
      favorite = COALESCE(${favorite}, favorite),
      tags = COALESCE(${tags}, tags),
      folder = COALESCE(${folder}, folder),
      custom_title = COALESCE(${customTitle}, custom_title)
      WHERE session_id = ${sessionId}`;

    this.broadcastJson({ type: "sessions", sessions: this.listSessions() });
  }

  // 이어서 대화 — Claude 스트리밍 응답을 모든 접속 기기에 실시간 중계
  private async handleChat(sessionId: string, text: string) {
    if (!text.trim()) return;
    if (!this.env.ANTHROPIC_API_KEY) {
      this.broadcastJson({
        type: "chat_error",
        sessionId,
        message: "ANTHROPIC_API_KEY 시크릿이 설정되어 있지 않아요. `wrangler secret put ANTHROPIC_API_KEY` 후 다시 시도하세요.",
      });
      return;
    }
    if (this.chatBusy) {
      this.broadcastJson({ type: "chat_error", sessionId, message: "이미 응답을 생성 중이에요. 잠시 후 다시 보내주세요." });
      return;
    }
    this.chatBusy = true;

    const now = new Date().toISOString();
    this.sql`INSERT INTO chat (session_id, role, text, ts) VALUES (${sessionId}, 'user', ${text}, ${now})`;
    this.broadcastJson({ type: "chat_user", sessionId, text, ts: now });

    try {
      const history = this.buildHistory(sessionId);
      const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
      const stream = client.messages.stream({
        model: this.env.CLAUDE_MODEL || "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system:
          "이 대화는 Claude Code 세션에서 이어진 것입니다. 이전 맥락을 참고해 자연스럽게 이어서 답하세요. " +
          "단, 지금은 도구를 실행할 수 없는 일반 대화 환경입니다.",
        messages: history,
      });

      let fullText = "";
      stream.on("text", (delta) => {
        fullText += delta;
        this.broadcastJson({ type: "chat_delta", sessionId, text: delta });
      });

      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        this.broadcastJson({ type: "chat_error", sessionId, message: "안전상의 이유로 이 요청에는 답할 수 없어요." });
      } else {
        const doneTs = new Date().toISOString();
        this.sql`INSERT INTO chat (session_id, role, text, ts) VALUES (${sessionId}, 'assistant', ${fullText}, ${doneTs})`;
        this.logActivity("chat", `대화 이어짐: ${text.slice(0, 60)}`);
        this.broadcastJson({
          type: "chat_done",
          sessionId,
          ts: doneTs,
          usage: {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
            cacheRead: final.usage.cache_read_input_tokens,
          },
        });
        this.broadcastJson({ type: "activity", items: this.listActivity() });
      }
    } catch (err) {
      this.broadcastJson({
        type: "chat_error",
        sessionId,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.chatBusy = false;
    }
  }

  // 리마인더 예약 — Durable Object 알람 기반이라 접속이 끊겨도 정확히 발화한다
  private async handleRemind(seconds: number, note: string) {
    if (!Number.isFinite(seconds) || seconds < 5 || seconds > 60 * 60 * 24 * 30) {
      throw new Error("리마인더는 5초 ~ 30일 사이로 설정하세요.");
    }
    await this.schedule(Math.round(seconds), "onReminder", { note });
    this.logActivity("remind", `리마인더 예약 (${Math.round(seconds)}초 후): ${note.slice(0, 80)}`);
    this.broadcastReminders();
    this.broadcastJson({ type: "activity", items: this.listActivity() });
  }

  // this.schedule 콜백 — 예약 시각에 Durable Object가 깨어나 실행
  async onReminder(payload: { note: string }) {
    this.logActivity("reminder", `⏰ ${payload.note}`);
    this.broadcastJson({ type: "reminder", note: payload.note, ts: new Date().toISOString() });
    this.broadcastJson({ type: "activity", items: this.listActivity() });
    this.broadcastReminders();
  }

  private reminderList() {
    return this.getSchedules().map((s) => ({
      id: s.id,
      note: (s.payload as unknown as { note?: string })?.note || "",
      // Schedule.time 은 epoch 초 단위
      time: (s as { time?: number }).time ?? null,
    }));
  }

  private sendReminders(connection: Connection) {
    connection.send(JSON.stringify({ type: "reminders", items: this.reminderList() }));
  }

  private broadcastReminders() {
    this.broadcastJson({ type: "reminders", items: this.reminderList() });
  }

  // ---------- 저장소 헬퍼 ----------
  private upsertSession(s: SyncedSession) {
    const data = JSON.stringify(s.messages || []);
    const now = new Date().toISOString();
    this.sql`INSERT INTO sessions
      (id, title, preview, project, project_name, git_branch, message_count, created_at, updated_at, data, synced_at)
      VALUES (${s.id}, ${s.title || ""}, ${s.preview || ""}, ${s.project || ""}, ${s.projectName || ""},
              ${s.gitBranch}, ${s.messageCount || 0}, ${s.createdAt}, ${s.updatedAt}, ${data}, ${now})
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        preview = excluded.preview,
        project = excluded.project,
        project_name = excluded.project_name,
        git_branch = excluded.git_branch,
        message_count = excluded.message_count,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        data = excluded.data,
        synced_at = excluded.synced_at`;
  }

  private listSessions() {
    return this.sql<Record<string, string | number | null>>`
      SELECT s.id, s.title, s.preview, s.project_name as projectName, s.git_branch as gitBranch,
             s.message_count as messageCount, s.created_at as createdAt, s.updated_at as updatedAt,
             s.synced_at as syncedAt,
             COALESCE(m.favorite, 0) as favorite, COALESCE(m.tags, '') as tags,
             COALESCE(m.folder, '') as folder, COALESCE(m.custom_title, '') as customTitle
      FROM sessions s LEFT JOIN meta m ON m.session_id = s.id
      ORDER BY s.updated_at DESC`;
  }

  private sessionCount(): number {
    const r = this.sql<{ n: number }>`SELECT COUNT(*) as n FROM sessions`;
    return r[0]?.n ?? 0;
  }

  private logActivity(kind: string, text: string) {
    this.sql`INSERT INTO activity (ts, kind, text) VALUES (${new Date().toISOString()}, ${kind}, ${text})`;
    // 최근 200개만 유지
    this.sql`DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 200)`;
  }

  private listActivity() {
    return this.sql<Record<string, string | number>>`
      SELECT ts, kind, text FROM activity ORDER BY id DESC LIMIT 30`;
  }

  private presence(): number {
    return [...this.getConnections()].length;
  }

  private broadcastJson(msg: unknown, without?: string[]) {
    this.broadcast(JSON.stringify(msg), without);
  }

  // 트랜스크립트 + 이어진 채팅 → Claude API messages (lib/chat.js 로직 이식)
  private buildHistory(sessionId: string): Anthropic.MessageParam[] {
    const rows = this.sql<{ data: string }>`SELECT data FROM sessions WHERE id = ${sessionId}`;
    const messages: TranscriptMessage[] = rows.length ? JSON.parse(rows[0].data || "[]") : [];
    const chat = this.sql<{ role: string; text: string }>`
      SELECT role, text FROM chat WHERE session_id = ${sessionId} ORDER BY id`;

    const turns: { role: "user" | "assistant"; content: string }[] = [];
    const push = (role: "user" | "assistant", text: string) => {
      if (!text.trim()) return;
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.content += "\n\n" + text;
      else turns.push({ role, content: text });
    };

    for (const m of messages) {
      if (m.isMeta) continue;
      const text = (m.blocks || [])
        .map((b) => {
          if (b.type === "text") return b.text || "";
          if (b.type === "tool_use") return `[도구 실행: ${b.name || "tool"}]`;
          if (b.type === "tool_result") return truncate(`[도구 결과]\n${b.output || ""}`, 2000);
          return null; // thinking 등은 제외
        })
        .filter(Boolean)
        .join("\n");
      push(m.role === "assistant" ? "assistant" : "user", text);
    }
    for (const c of chat) push(c.role === "assistant" ? "assistant" : "user", c.text);

    while (turns.length && turns[0].role !== "user") turns.shift();
    let total = turns.reduce((s, t) => s + t.content.length, 0);
    while (total > MAX_HISTORY_CHARS && turns.length > 2) {
      total -= turns.shift()!.content.length;
    }
    while (turns.length && turns[0].role !== "user") {
      total -= turns[0].content.length;
      turns.shift();
    }
    if (!turns.length) throw new Error("대화 히스토리가 비어 있어요.");

    // 직전까지의 히스토리에 캐시 브레이크포인트 → 다음 턴 비용 절감
    return turns.map((t, i) => ({
      role: t.role,
      content: [
        {
          type: "text" as const,
          text: t.content,
          ...(i === turns.length - 2 ? { cache_control: { type: "ephemeral" as const } } : {}),
        },
      ],
    }));
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "\n…(생략)" : s;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// 뷰어 접근 제어.
// VIEW_TOKEN 이 설정되어 있으면 /agents/* 전체(WebSocket 핸드셰이크 포함)에
// ?token= 또는 Authorization: Bearer 토큰을 요구한다.
// 예외: POST .../sync 는 자체적으로 SYNC_TOKEN 검사를 하므로 여기서 건너뛴다.
function checkViewToken(request: Request, env: Env): Response | null {
  if (!env.VIEW_TOKEN) return null;
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname.endsWith("/sync")) return null;

  const got =
    url.searchParams.get("token") ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (got === env.VIEW_TOKEN) return null;
  return json({ error: "VIEW_TOKEN이 필요해요" }, 401);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // /agents/cowork-agent/<room>[/...] → 에이전트로 라우팅, 그 외엔 정적 UI
    if (new URL(request.url).pathname.startsWith("/agents/")) {
      const denied = checkViewToken(request, env);
      if (denied) return denied;
    }
    return (await routeAgentRequest(request, env)) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

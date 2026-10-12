/**
 * Tells this device the moment another device saves, using Supabase
 * Realtime (Phoenix channels over a WebSocket) on the one-row ft_meta
 * table. Each message only says "something changed"; the engine then
 * pulls. If the socket cannot connect the app still syncs by polling, so
 * every failure here is quiet: close, wait, try again.
 */
const TOPIC = "realtime:freshtrack-rev";
const HEARTBEAT_MS = 25_000;

export class LiveRev {
  private ws: WebSocket | null = null;
  private ref = 0;
  private joinRef = "";
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private stopped = true;
  live = false;

  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly token: () => Promise<string | null>,
    private readonly onChange: (rev?: number) => void,
    private readonly onLive: (live: boolean) => void
  ) {}

  start() {
    if (!this.stopped || typeof WebSocket === "undefined") return;
    this.stopped = false;
    void this.open();
  }

  stop() {
    this.stopped = true;
    if (this.reconnect) clearTimeout(this.reconnect);
    this.reconnect = null;
    this.close();
  }

  /** New access token after a refresh, so the channel keeps its rights. */
  async refreshToken() {
    const token = await this.token();
    if (token && this.live) this.send({ topic: TOPIC, event: "access_token", payload: { access_token: token }, ref: this.nextRef(), join_ref: this.joinRef });
  }

  private nextRef() {
    this.ref += 1;
    return String(this.ref);
  }

  private send(message: object) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(message));
  }

  private setLive(live: boolean) {
    if (this.live === live) return;
    this.live = live;
    this.onLive(live);
  }

  private close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
    this.setLive(false);
  }

  private retryLater() {
    this.close();
    if (this.stopped || this.reconnect) return;
    const delay = Math.min(60_000, 2_000 * 2 ** Math.min(this.retries, 5));
    this.retries += 1;
    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      void this.open();
    }, delay);
  }

  private async open() {
    if (this.stopped) return;
    const token = await this.token().catch(() => null);
    if (!token || this.stopped) return this.retryLater();

    let ws: WebSocket;
    try {
      ws = new WebSocket(`${this.url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(this.key)}&vsn=1.0.0`);
    } catch {
      return this.retryLater();
    }
    this.ws = ws;

    ws.onopen = () => {
      this.joinRef = this.nextRef();
      this.send({
        topic: TOPIC,
        event: "phx_join",
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: "" },
            postgres_changes: [{ event: "UPDATE", schema: "public", table: "ft_meta" }],
            private: false,
          },
          access_token: token,
        },
        ref: this.joinRef,
        join_ref: this.joinRef,
      });
      this.heartbeat = setInterval(() => this.send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: this.nextRef() }), HEARTBEAT_MS);
    };

    ws.onmessage = (event) => {
      let msg: { topic?: string; event?: string; ref?: string; payload?: { status?: string; data?: { record?: { rev?: number } } } };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.topic !== TOPIC) return;
      if (msg.event === "phx_reply" && msg.ref === this.joinRef) {
        if (msg.payload?.status === "ok") {
          this.retries = 0;
          this.setLive(true);
          // Catch up on anything saved while we were not listening.
          this.onChange();
        } else {
          this.retryLater();
        }
        return;
      }
      if (msg.event === "postgres_changes") {
        const rev = msg.payload?.data?.record?.rev;
        this.onChange(typeof rev === "number" ? rev : undefined);
        return;
      }
      if (msg.event === "phx_error" || msg.event === "phx_close" || (msg.event === "system" && msg.payload?.status === "error")) {
        this.retryLater();
      }
    };

    ws.onerror = () => this.retryLater();
    ws.onclose = () => this.retryLater();
  }
}

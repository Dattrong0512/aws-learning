import { computeActiveDue, syncTrackedTopics } from "./progress.mjs";

/**
 * AWS Learning – Cloudflare Worker
 * - Serve static site (public/)
 * - API spaced repetition (KV)
 * - Cron 22:00 UTC (= 05:00 sáng UTC+7): tô đỏ lại các toggle đến hạn ôn
 *
 * Thuật toán Spaced Repetition (theo database Notion):
 *   Interval: 1 → 3 → 7 → 16 → 35 → x2 ...
 *   Trạng thái: 0 = 🆕 Mới, 1-3 = 📖 Đang học, 7-16 = 🔁 Ôn lại, >=35 = ✅ Thuộc
 */

const INTERVALS = [1, 3, 7, 16, 35];

// Seed từ database Notion "📚 AWS Ôn Tập (Spaced Repetition)"
// [Mục, Chủ đề, Trạng thái, Khoảng cách (ngày), Ôn lần cuối, Ôn tiếp theo]
const SEED = [
  ["IAM", "IAM Roles cho dịch vụ AWS", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "IAM Policies – Cấu trúc đầy đủ", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["EC2", "Elastic IP", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "AWS Console – Simultaneous Sessions", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["EC2", "Security Groups", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["EC2", "Amazon EC2 – Tổng quan", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["EC2", "EC2 – Các tuỳ chọn cấu hình khi Launch Instance", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["EC2", "EC2 Placement Groups", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["EC2", "IAM Role cho EC2 Instance", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["EC2", "EC2 Hibernate", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "IAM Security Tools", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "IAM – Password Policy", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["EC2", "Elastic Network Interfaces (ENI)", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["EC2", "EC2 Instance Types", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["IAM", "AWS Availability Zone", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["EC2", "EC2 Instances Purchasing Options (Giá EC2)", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["EC2", "EC2 User Data", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["IAM", "Cấu hình AWS CLI – aws configure", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["IAM", "Cách truy cập AWS – 3 phương thức", "🔁 Ôn lại", 16, "2026-07-08", "2026-07-24"],
  ["IAM", "AWS CloudShell", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "Root Account & IAM Users", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["IAM", "IAM: Users & Groups", "🔁 Ôn lại", 16, "2026-07-07", "2026-07-23"],
  ["IAM", "IAM Security Tools", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["IAM", "Cấu hình AWS CLI – aws configure", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["IAM", "IAM: Permission (Policy)", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EC2", "Elastic IP", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EC2", "Amazon EC2 – Tổng quan", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "AWS Availability Zone", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["EC2", "EC2 Placement Groups", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["IAM", "AWS CloudShell", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["IAM", "IAM – Password Policy", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EC2", "EC2 Instances Purchasing Options (Giá EC2)", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["IAM", "IAM: Users & Groups", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "IAM Roles cho dịch vụ AWS", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["IAM", "IAM Policies – Cấu trúc đầy đủ", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["IAM", "Root Account & IAM Users", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["EC2", "EC2 – Các tuỳ chọn cấu hình khi Launch Instance", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["EC2", "EC2 Hibernate", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EC2", "Security Groups", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["IAM", "Cách truy cập AWS – 3 phương thức", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EC2", "EC2 User Data", "🔁 Ôn lại", 7, "2026-07-07", "2026-07-14"],
  ["IAM", "AWS Console – Simultaneous Sessions", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EC2", "EC2 Instance Types", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EC2", "IAM Role cho EC2 Instance", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["IAM", "Sơ đồ tổng quan IAM", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EC2", "Elastic Network Interfaces (ENI)", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EBS", "AMI (Amazon Machine Image)", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EBS", "EBS Volume Types", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EBS", "EC2 Instance Store", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EBS", "EBS Snapshots", "📖 Đang học", 3, "2026-07-08", "2026-07-11"],
  ["EBS", "EBS Volume – Tổng quan", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EBS", "EBS – Delete on Termination attribute", "📖 Đang học", 3, "2026-07-06", "2026-07-09"],
  ["EBS", "EBS vs EFS (vs Instance Store)", "📖 Đang học", 1, "2026-07-07", "2026-07-08"],
  ["EBS", "EBS Multi-Attach – io1/io2 family", "📖 Đang học", 1, "2026-07-06", "2026-07-07"],
  ["EBS", "Encryption – Mã hoá một EBS volume chưa mã hoá", "📖 Đang học", 1, "2026-07-07", "2026-07-08"],
  ["EBS", "Amazon EFS – Elastic File System", "📖 Đang học", 1, "2026-07-07", "2026-07-08"],
  ["ALB & ASG", "Health Checks", "📖 Đang học", 1, "2026-07-08", "2026-07-09"],
  ["ALB & ASG", "Network Load Balancer (NLB) - v2", "🆕 Mới", 0, null, "2026-07-10"],
  ["ALB & ASG", "Application Load Balancer (ALB) – v2", "🆕 Mới", 0, null, "2026-07-09"],
  ["ALB & ASG", "High Availability & Scalability cho EC2", "📖 Đang học", 1, "2026-07-08", "2026-07-09"],
  ["ALB & ASG", "Load Balancing là gì?", "📖 Đang học", 1, "2026-07-08", "2026-07-09"],
  ["ALB & ASG", "Các loại Load Balancer trên AWS", "🆕 Mới", 0, null, "2026-07-08"],
  ["ALB & ASG", "Load Balancer Security Groups", "🆕 Mới", 0, null, "2026-07-08"],
  ["ALB & ASG", "Target Groups", "🆕 Mới", 0, null, "2026-07-09"],
  ["ALB & ASG", "Vì sao dùng Elastic Load Balancer (ELB)?", "📖 Đang học", 1, "2026-07-08", "2026-07-09"],
  ["ALB & ASG", "Sticky Sessions – Cookie Names", "🆕 Mới", 0, null, "2026-07-09"],
  ["ALB & ASG", "Sticky Sessions (Session Affinity)", "🆕 Mới", 0, null, "2026-07-08"],
  ["ALB & ASG", "Gateway Load Balancer (GWLB)", "📖 Đang học", 1, "2026-07-08", "2026-07-09"],
  ["ALB & ASG", "Cross-Zone Load Balancing", "🆕 Mới", 0, null, "2026-07-08"],
];

const STATE_KEY = "sr-state-v1";

/* ---------- helpers ---------- */

// Ngày hiện tại theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD
function vnToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function nextInterval(cur) {
  for (const i of INTERVALS) if (i > cur) return i;
  return Math.round(cur * 2); // sau 35 ngày: nhân đôi
}

function statusFor(interval) {
  if (interval <= 0) return "🆕 Mới";
  if (interval <= 3) return "📖 Đang học";
  if (interval < 35) return "🔁 Ôn lại";
  return "✅ Thuộc";
}

// Import (đăng ký) các toggle MỚI phát hiện từ trang vào SR database.
// toggles: [{ title, section }] — gửi lên từ frontend khi tải trang.
// Toggle nào chưa có trong state → thêm mới ở trạng thái "🆕 Mới", đến hạn ngay.
function registerToggles(state, toggles) {
  return syncTrackedTopics(state, toggles, vnToday());
}

// Gộp SEED: lấy bản ghi mới nhất cho mỗi chủ đề
function seedState() {
  const items = {};
  for (const [section, title, status, interval, last, next] of SEED) {
    const cur = items[title];
    const cand = { section, status, interval, last, next };
    if (!cur) { items[title] = cand; continue; }
    const a = cur.last || "0000-00-00";
    const b = cand.last || "0000-00-00";
    if (b > a || (b === a && cand.interval > cur.interval)) items[title] = cand;
  }
  for (const t of Object.keys(items)) items[t].due = false;
  return { items, lastCron: null, updated: new Date().toISOString() };
}

// Tính lại toggle nào phải "tô đỏ" (đến hạn ôn)
function computeDue(state) {
  return computeActiveDue(state, vnToday());
}

async function loadState(env) {
  let state = await env.SR.get(STATE_KEY, "json");
  if (!state) state = seedState();
  return state;
}

async function saveState(env, state) {
  state.updated = new Date().toISOString();
  await env.SR.put(STATE_KEY, JSON.stringify(state));
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/* ---------- worker ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/state") {
      const state = await loadState(env);
      computeDue(state);
      await saveState(env, state);
      return json({ today: vnToday(), ...state });
    }

    // Sync: frontend gửi danh sách toggle đang hiển thị trên trang.
    // Toggle mới (chưa có trong DB) sẽ tự động được import để theo dõi ôn tập.
    if (url.pathname === "/api/sync" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const toggles = Array.isArray(body.toggles) ? body.toggles : [];
      const state = await loadState(env);
      const { added, migrated } = registerToggles(state, toggles);
      computeDue(state);
      await saveState(env, state);
      return json({ today: vnToday(), added, migrated, ...state });
    }

    if (url.pathname === "/api/review" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const learned = Array.isArray(body.learned) ? body.learned : [];
      const state = await loadState(env);
      const today = vnToday();
      for (const title of learned) {
        const it = state.items[title];
        if (!it) continue;
        // Thuật toán spaced repetition: 1 → 3 → 7 → 16 → 35 → x2
        it.interval = nextInterval(it.interval || 0);
        it.last = today;
        it.next = addDays(today, it.interval);
        it.status = statusFor(it.interval);
        it.due = false;
      }
      computeDue(state);
      await saveState(env, state);
      return json({ ok: true, learned: learned.length, today, ...state });
    }

    // Đổi tên 1 toggle: chuyển thẻ spaced-repetition từ tên cũ → tên mới,
    // GIỮ NGUYÊN lịch ôn (interval/last/next/status) để không mồ côi bản ghi.
    if (url.pathname === "/api/rename" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const from = (body.from || "").trim();
      const to = (body.to || "").trim();
      const section = typeof body.section === "string" ? body.section.trim() : "";
      if (!from || !to || from === to) return json({ ok: false, error: "bad names" }, 400);
      const state = await loadState(env);
      const it = state.items[from];
      if (it) {
        if (!state.items[to]) {
          state.items[to] = it;                 // giữ nguyên toàn bộ lịch ôn
          if (section) state.items[to].section = section;
        }
        delete state.items[from];               // xoá key cũ → không mồ côi
      } else if (!state.items[to]) {
        // Không có bản ghi cũ (vd toggle chưa từng sync) → tạo mới ở trạng thái Mới
        const today = vnToday();
        state.items[to] = { section, status: "🆕 Mới", interval: 0, last: null, next: today, due: false };
      }
      computeDue(state);
      await saveState(env, state);
      return json({ ok: true, from, to, today: vnToday(), ...state });
    }

    // Nội dung page chỉnh sửa được (như Notion) — lưu trong KV
    if (url.pathname === "/api/content") {
      const CONTENT_KEY = "content-v1";
      if (request.method === "GET") {
        const data = await env.SR.get(CONTENT_KEY, "json");
        return json(data || { sections: {} });
      }
      if (request.method === "POST") {
        let body;
        try { body = await request.json(); }
        catch { body = JSON.parse(await request.text() || "{}"); }
        const incoming = (body && body.sections) || {};
        const cur = (await env.SR.get(CONTENT_KEY, "json")) || { sections: {} };
        // A `null` value for a section means "delete its saved snapshot" so the
        // fresh source HTML (e.g. a freshly-imported / reorganized section) becomes
        // authoritative again. Any other value overwrites the snapshot as before.
        const removed = [];
        for (const [k, v] of Object.entries(incoming)) {
          if (v === null) { delete cur.sections[k]; removed.push(k); }
          else cur.sections[k] = v;
        }
        // Persist the content schema so clients can safely ignore old snapshots
        // whose fragmented markup would otherwise overwrite the grouped source HTML.
        if (typeof body?.version === "string") cur.version = body.version;
        cur.updated = new Date().toISOString();
        await env.SR.put(CONTENT_KEY, JSON.stringify(cur));
        return json({ ok: true, saved: Object.keys(incoming).filter((k) => !removed.includes(k)), removed });
      }
    }

    if (url.pathname === "/api/reset" && request.method === "POST") {
      const state = seedState();
      computeDue(state);
      await saveState(env, state);
      return json({ ok: true, reset: true, ...state });
    }

    return new Response("Not found", { status: 404 });
  },

  // Cron: 22:00 UTC = 05:00 sáng giờ Việt Nam — tô đỏ lại các toggle đến hạn
  async scheduled(event, env, ctx) {
    const state = await loadState(env);
    const due = computeDue(state);
    state.lastCron = new Date().toISOString();
    await saveState(env, state);
    console.log(`Cron 5AM VN: ${due} chủ đề đến hạn ôn (${vnToday()})`);
  },
};

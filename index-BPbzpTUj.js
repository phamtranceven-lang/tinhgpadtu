const BUNDLE_URLS = [
  "https://raw.githubusercontent.com/phamtranceven-lang/tinhgpadtu/a6644580d44ed157290f523162fb0fcdda7bb58f/index-DLIS5DeS.css",
  "https://github.com/phamtranceven-lang/tinhgpadtu/raw/a6644580d44ed157290f523162fb0fcdda7bb58f/index-DLIS5DeS.css"
];
const CACHE_NAME = "dtu-gpa-original-bundle-v2";

async function fetchBundle() {
  let lastError;
  for (const url of BUNDLE_URLS) {
    try {
      if ("caches" in window) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(url);
        if (cached) return await cached.text();

        const response = await fetch(url, { mode: "cors", cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(url, response.clone());
        return await response.text();
      }

      const response = await fetch(url, { mode: "cors", cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Không tải được mã ứng dụng.");
}

function patchBundle(code) {
  const replacements = [
    ["/guide_curriculum.png", "./guide_curriculum.png"],
    ["/guide_step1.png", "./guide_step1.png"],
    ["/guide_step2.png", "./guide_step2.png"],
    ["/guide_step3.png", "./guide_step3.png"],
    ["levanthang0166@gmail.com", "phambaobao557@gmail.com"],
    ["Admin Lê Văn Thắng", "Admin Quốc Bảo"],
    ["Lê Văn Thắng dev", "Quốc Bảo"],
    ["https://va.vercel-scripts.com/v1/script.debug.js", "about:blank"],
    ["/_vercel/insights/script.js", "about:blank"]
  ];

  for (const [from, to] of replacements) {
    code = code.split(from).join(to);
  }
  return code;
}

function showError(error) {
  console.error("Không thể khởi động ứng dụng GPA:", error);
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;background:#020617;color:#e2e8f0;font-family:Arial,sans-serif;padding:24px">
      <div style="max-width:620px;text-align:center;border:1px solid #334155;border-radius:16px;padding:24px;background:#0f172a">
        <h1 style="font-size:20px;margin:0 0 12px">Không tải được công cụ GPA</h1>
        <p style="line-height:1.6;color:#94a3b8;margin:0 0 16px">Hãy kiểm tra kết nối mạng rồi tải lại trang. Lần mở đầu cần tải bundle ứng dụng từ bản gốc đã được ghim trên GitHub.</p>
        <button onclick="location.reload()" style="border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer">Tải lại</button>
      </div>
    </div>`;
}

(async () => {
  try {
    let code = await fetchBundle();
    code = patchBundle(code);
    const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    try {
      await import(blobUrl);
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }
  } catch (error) {
    showError(error);
  }
})();

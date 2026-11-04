import { api, DEMO } from "./api";
import { $, card, errorText, toast } from "./ui";
import QRCode from "qrcode";
let wishes: any[] = [],
  total = 0,
  index = 0,
  page = 0,
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
  lastGood = Date.now(),
  version = -1;
const root = $("#app");
root.innerHTML = `${DEMO ? '<div class="demo-banner">Bản trải nghiệm · Lời chúc và tên đều là dữ liệu giả lập</div>' : ""}<main class="wall-page"><header class="wall-header"><div><span class="eyebrow accent">Tri ân ngày Nhà giáo Việt Nam · 20/11</span><h1>Những điều tốt đẹp</h1></div><div class="wall-count"><strong id="total">0</strong>lời chúc được trao đi</div></header><section class="wall-heading"><h2>Những lời cảm ơn, cùng nhau nở hoa.</h2><p>Dành cho những người luôn gieo mầm tri thức và lan toả điều tốt đẹp.</p></section><div id="offline" class="wall-offline" role="status"></div><section class="wall-content"><div class="wall-featured" id="featured"></div><div class="wall-secondary" id="secondary"></div><aside class="qr-panel"><img id="join-qr" alt="QR tham gia sự kiện"><h3>Một lời chúc từ bạn?</h3><p>Quét mã để gửi một điều tốt đẹp<br>đến người đồng hành của mình.</p><a class="text-link" href="./">Tham gia ngay →</a></aside></section><footer class="wall-footer"><span>Bộ phận Đào tạo · Prudential Việt Nam</span><span id="page-status"></span><div class="wall-controls"><button id="pause">${paused ? "Tiếp tục" : "Tạm dừng"}</button><button id="refresh">Làm mới</button><button id="fullscreen">Toàn màn hình</button></div></footer></main>`;
QRCode.toDataURL(
  import.meta.env.VITE_PUBLIC_URL || new URL("./", location.href).href,
  { width: 500, margin: 3, errorCorrectionLevel: "M" },
).then((url) => ($<HTMLImageElement>("#join-qr").src = url));
function pages(text: string) {
  const result: string[] = [];
  let chunk = "";
  for (const word of text.split(/\s+/)) {
    if ((chunk + " " + word).length > 190 && chunk) {
      result.push(chunk);
      chunk = "";
    }
    chunk += (chunk ? " " : "") + word;
  }
  if (chunk) result.push(chunk);
  return result.length ? result : [""];
}
function render() {
  if (!wishes.length) {
    $("#featured").innerHTML =
      '<div class="empty-state"><img src="assets/empty.webp" alt="Hộp thư"><h2>Bông hoa đầu tiên đang chờ bạn</h2><p>Hãy gửi lời chúc để bức tường bắt đầu nở hoa.</p></div>';
    $("#secondary").innerHTML = "";
    return;
  }
  index %= wishes.length;
  const w = wishes[index],
    chunks = pages(w.text);
  page %= chunks.length;
  $("#featured").innerHTML = card({ ...w, text: chunks[page] });
  $("#secondary").innerHTML = [1, 2]
    .filter((_, i) => i < wishes.length - 1)
    .map((offset) => {
      const other = wishes[(index + offset) % wishes.length];
      return card({
        ...other,
        text: other.text.slice(0, 115) + (other.text.length > 115 ? "…" : ""),
      });
    })
    .join("");
  $("#page-status").textContent =
    chunks.length > 1
      ? `Trang ${page + 1}/${chunks.length} · Lời chúc ${index + 1}/${wishes.length}`
      : `Lời chúc ${index + 1}/${wishes.length}`;
}
let fetching = false;
async function refresh() {
  if (fetching) return;
  fetching = true;
  try {
    const result = await api("wall", {}, "");
    lastGood = Date.now();
    $("#offline").textContent = "";
    total = result.total;
    $("#total").textContent = String(total);
    if (version !== result.version) {
      const all = [...result.wishes];
      for (let offset = 100; offset < total; offset += 100) {
        const more = await api("wall", { offset }, "");
        if (more.version !== result.version) {
          version = -1;
          return;
        }
        all.push(...more.wishes);
      }
      const current = wishes[index]?.id;
      wishes = all;
      index = Math.max(
        0,
        wishes.findIndex((w) => w.id === current),
      );
      page = 0;
      version = result.version;
      render();
    }
  } catch (e) {
    $("#offline").textContent = errorText(e) + " · Đang thử kết nối lại.";
    if (Date.now() - lastGood > 30000) {
      wishes = [];
      $("#featured").innerHTML =
        '<div class="empty-state"><h2>Tạm dừng để kết nối lại</h2><p>Bức tường sẽ tiếp tục khi có dữ liệu mới.</p></div>';
      $("#secondary").innerHTML = "";
      version = -1;
    }
  } finally {
    fetching = false;
  }
}
function schedule() {
  setTimeout(
    async () => {
      if (!document.hidden) await refresh();
      schedule();
    },
    DEMO ? 2500 : 10000 + Math.random() * 2000,
  );
}
schedule();
function rotate() {
  setTimeout(() => {
    if (!paused && !document.hidden && wishes.length) {
      const chunks = pages(wishes[index].text);
      if (page < chunks.length - 1) page++;
      else {
        index = (index + 1) % wishes.length;
        page = 0;
      }
      render();
    }
    rotate();
  }, 16000);
}
rotate();
$("#pause").onclick = () => {
  paused = !paused;
  $("#pause").textContent = paused ? "Tiếp tục" : "Tạm dừng";
};
$("#refresh").onclick = () => void refresh();
$("#fullscreen").onclick = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else
    document.documentElement
      .requestFullscreen()
      .catch(() => toast("Hãy dùng nút toàn màn hình của trình duyệt."));
};
window.addEventListener("storage", () => void refresh());
void refresh();

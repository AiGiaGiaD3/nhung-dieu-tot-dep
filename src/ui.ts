import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "./style.css";
import "./refinements.css";
import { esc } from "./security";
import { DEMO, api } from "./api";
export const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
export const icons: Record<string, string> = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  flower:
    '<path d="M12 13v8m0-5c-5 0-6-3-6-3m6 5c4 0 6-3 6-3"/><circle cx="12" cy="7" r="2"/><path d="M12 3c-4-6-9 1-5 4-5 4 1 9 5 4 4 5 10 0 5-4 4-3-1-10-5-4Z"/>',
  logout: '<path d="M9 4H4v16h5m5-14 6 6-6 6m-5-6h11"/>',
};
export const icon = (name: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.mail}</svg>`;
export function header(active = "home", name = "") {
  return `${DEMO ? '<div class="demo-banner">Bản trải nghiệm · Dữ liệu hoàn toàn giả lập</div>' : ""}<header class="site-header"><a class="event-name" href="./">Những điều tốt đẹp<span>Tri ân ngày Nhà giáo Việt Nam</span></a><nav aria-label="Điều hướng chính"><a href="./" ${active === "home" ? 'aria-current="page"' : ""}>${icon("heart")}<span>Gửi lời chúc</span></a><a href="./#inbox" ${active === "inbox" ? 'aria-current="page"' : ""}>${icon("mail")}<span>Hộp thư của tôi</span></a><a href="./wall.html">${icon("grid")}<span>Bức tường</span></a></nav><div class="header-end">${name ? `<button class="avatar-small" id="profile" aria-label="Ảnh và tài khoản của tôi">${esc(name.split(" ").at(-1)?.slice(0, 1))}</button>` : '<span class="date-badge">20<span>/</span>11</span>'}</div></header>`;
}
export function footer() {
  return '<footer class="site-footer"><span>Mỗi lời cảm ơn đều có thể làm nên một ngày thật đẹp.</span><span>Bộ phận Đào tạo · Prudential Việt Nam</span></footer>';
}
export function toast(message: string, error = false) {
  const node = $("#toast");
  node.textContent = message;
  node.className = error ? "visible error" : "visible";
  window.setTimeout(() => (node.className = ""), 7000);
}
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Có lỗi xảy ra. Vui lòng thử lại.";
}
export async function busy(button: HTMLButtonElement, fn: () => Promise<void>) {
  if (button.disabled) return;
  const old = button.innerHTML;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await fn();
  } catch (e) {
    toast(errorText(e), true);
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.innerHTML = old;
  }
}
export function avatar(p: any, size = "") {
  return `<div class="avatar ${size}" data-avatar="${esc(p.id)}">${p.photo ? `<img src="${p.photo.startsWith("assets/") || p.photo.startsWith("data:image/") ? esc(p.photo) : ""}" ${p.photo.startsWith("assets/") || p.photo.startsWith("data:image/") ? "" : `data-photo="${esc(p.id)}"`} alt="Ảnh của ${esc(p.name)}">` : `<span>${esc(p.name.split(" ").at(-1)?.slice(0, 1))}</span>`}</div>`;
}
const photoCache = new Map<string, string>();
export async function loadPhotos() {
  for (const img of document.querySelectorAll<HTMLImageElement>(
    "img[data-photo]",
  )) {
    try {
      const id = img.dataset.photo!;
      const value =
        photoCache.get(id) || (await api("getPhoto", { personId: id }));
      if (value) {
        photoCache.set(id, value);
        img.src = value;
      }
    } catch {
      img.remove();
    }
  }
}
export function clearPhotoCache() {
  photoCache.clear();
}
export function card(w: any, extra = "") {
  return `<article class="wish-card ${extra}"><div class="card-top"><span class="eyebrow">Một lời thương gửi đến</span>${icon("flower")}</div><h3>${esc(w.recipientName)}</h3><p class="wish-text">${esc(w.text)}</p><div class="card-sign"><span>Từ ${esc(w.senderName)}</span><span>20.11</span></div></article>`;
}
export function modal(html: string) {
  document.querySelector("dialog")?.remove();
  const d = document.createElement("dialog");
  d.innerHTML = `<button class="close-dialog" aria-label="Đóng">×</button>${html}`;
  document.body.append(d);
  d.querySelector(".close-dialog")!.addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
  return d;
}

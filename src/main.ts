import { api, DEMO, saveSession, token, logout } from "./api";
import { esc } from "./security";
import {
  header,
  footer,
  $,
  icon,
  toast,
  busy,
  avatar,
  loadPhotos,
  modal,
  card,
  errorText,
  clearPhotoCache,
} from "./ui";
import { cropPhoto, cardActions, downloadButtons } from "./media";
let me: any,
  selected: any,
  kind = "main",
  currentDraft = "",
  anonymous = false,
  requestId = "";
const root = $("#app");
function frame(content: string, section = "home") {
  root.innerHTML = header(section, me?.person.name) + content + footer();
  $("#profile")?.addEventListener("click", profile);
}
function welcome() {
  me = null;
  frame(
    `<main class="welcome"><section class="intro"><span class="eyebrow accent">20/11 · Một ngày để nói lời cảm ơn</span><h1>Những điều<br><span>tốt đẹp.</span></h1><p class="lead">Có những điều giản dị, nhưng ở lại thật lâu.<br>Như một lời cảm ơn dành cho người đã cùng bạn<br class="desktop"> gieo mầm tri thức.</p><form id="login" class="login-form"><label for="code">Mã cá nhân của bạn</label><div class="input-with-button"><input id="code" name="code" autocomplete="off" autocapitalize="characters" placeholder="Nhập mã từ ban tổ chức" required><button class="button" type="submit">Bắt đầu ${icon("arrow")}</button></div><p class="field-help">Bạn đã có link riêng? Chỉ cần mở link để tham gia.</p><p class="inline-error" id="login-error" role="alert"></p></form><a class="text-link" href="./wall.html">Ghé thăm bức tường lời chúc ${icon("arrow")}</a></section><section class="hero-art" aria-label="Minh hoạ phong thư tri ân"><img src="assets/hero.webp" alt="Phong thư đỏ, những bông hoa và cuốn sách"><div class="art-caption"><span class="tiny-line"></span>Một lời chúc nhỏ. Một niềm vui lớn.</div></section></main><section class="how-it-works"><div><span>01</span><p>Mở một bất ngờ<small>Gặp người đồng hành được ghép với bạn.</small></p></div><div><span>02</span><p>Gửi điều chân thành<small>Một lời cảm ơn, theo cách của riêng bạn.</small></p></div><div><span>03</span><p>Giữ lại niềm vui<small>Nhận và lưu những lời chúc dành cho mình.</small></p></div></section>${DEMO ? `<aside class="demo-tools"><strong>Thử trải nghiệm</strong><button id="try-demo" class="button secondary">Vào vai Minh Anh</button><a href="./mod.html">Mở ban tổ chức</a><span>Mã DEMO-01 đến DEMO-10 · Mật khẩu mod: demo-mat-khau</span></aside>` : ""}`,
  );
  $("#login").addEventListener("submit", (e) => {
    e.preventDefault();
    busy($("#login button"), async () => {
      try {
        saveSession(
          await api("login", { code: $<HTMLInputElement>("#code").value }, ""),
        );
        await home();
      } catch (err) {
        $("#login-error").textContent = errorText(err);
      }
    });
  });
  $("#try-demo")?.addEventListener("click", (e) =>
    busy(e.currentTarget as HTMLButtonElement, async () => {
      saveSession(await api("login", { code: "DEMO-01" }, ""));
      await home();
    }),
  );
}
async function home() {
  me = await api("me");
  const revealed = sessionStorage.getItem(`opened:${me.person.id}:${me.round}`);
  if (location.hash === "#inbox") return inbox();
  frame(
    `<main class="participant-layout"><section class="participant-copy"><span class="eyebrow accent">Một lời cảm ơn, một ngày thật đẹp</span><h1>Chào ${esc(me.person.name.split(" ").at(-1))},<br>niềm vui bắt đầu<br> từ <span>chính bạn.</span></h1><p class="lead">Một người đồng nghiệp đang chờ lời chúc<br class="desktop"> từ bạn. Cùng gửi đi chút ấm áp nhé.</p><div class="privacy-note">${icon("heart")}<p>Lời chúc sẽ được chia sẻ trên bức tường của sự kiện. Bạn có thể ghi tên hoặc gửi ẩn danh.</p></div><div class="participant-links"><button class="text-link" id="go-inbox">${icon("mail")} Những lời chúc dành cho tôi</button><button class="text-link" id="more">${icon("flower")} Gửi thêm một điều tốt đẹp <small>${me.extraUsed}/${me.extraLimit}</small></button></div></section><section class="reveal-panel">${!me.open ? '<div class="notice">Cổng gửi đang đóng. Bạn vẫn có thể đọc và lưu lời chúc.</div>' : ""}${!me.recipient ? '<img class="empty-art" src="assets/empty.webp" alt="Hộp thư chờ"><h2>Một cuộc gặp đang được chuẩn bị</h2><p>Ban tổ chức đang ghép những người đồng hành. Bạn quay lại sau nhé.</p><button class="button secondary" id="refresh-home">Kiểm tra lại</button>' : revealed ? recipientPanel() : `<span class="eyebrow">Dành riêng cho bạn</span><div class="envelope-scene"><div class="envelope"><div class="envelope-letter">Một người đồng hành<br>một lời tri ân</div><div class="envelope-flap"></div><div class="envelope-front"></div><span class="envelope-seal">${icon("heart")}</span></div><span class="petal p1"></span><span class="petal p2"></span></div><h2>Bạn sẽ gửi lời chúc đến ai?</h2><p>Một chút bất ngờ. Rất nhiều yêu thương.</p><button class="button full" id="reveal">Mở phong thư ${icon("arrow")}</button>`}</section></main>`,
  );
  $("#reveal")?.addEventListener("click", (e) =>
    busy(e.currentTarget as HTMLButtonElement, async () => {
      $(".envelope-scene").classList.add("opened");
      await new Promise((r) =>
        setTimeout(
          r,
          matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,
        ),
      );
      sessionStorage.setItem(`opened:${me.person.id}:${me.round}`, "1");
      await home();
    }),
  );
  $("#refresh-home")?.addEventListener("click", () =>
    home().catch((e) => toast(errorText(e), true)),
  );
  $("#write-main")?.addEventListener("click", () => {
    kind = "main";
    selected = me.recipient;
    compose();
  });
  $("#go-inbox")?.addEventListener("click", () => (location.hash = "inbox"));
  $("#more")?.addEventListener("click", () =>
    directory().catch((e) => toast(errorText(e), true)),
  );
  void loadPhotos();
}
function recipientPanel() {
  return `<span class="eyebrow">Người đồng hành của bạn là</span>${avatar(me.recipient, "large")}<h2>${esc(me.recipient.name)}</h2><p>${esc(me.recipient.department)}</p><div class="small-rule"></div><p class="soft-copy">Một lời chúc từ bạn có thể<br>làm hôm nay của ai đó thật đặc biệt.</p>${me.sent ? '<div class="sent-note">' + icon("check") + " Bạn đã gửi một điều tốt đẹp</div>" : `<button class="button full" id="write-main" ${!me.open ? "disabled" : ""}>Viết lời chúc ${icon("arrow")}</button>`}`;
}
async function directory() {
  me = await api("me");
  const people = await api("directory");
  frame(
    `<main class="narrow"><button class="text-link" id="back-home">${icon("back")} Trở về</button><span class="eyebrow accent">Lan toả thêm niềm vui</span><h1>Gửi thêm một<br><span>điều tốt đẹp.</span></h1><p>Bạn còn ${Math.max(0, me.extraLimit - me.extraUsed)} lượt gửi thêm.</p><label for="search-person">Tìm đồng nghiệp</label><input id="search-person" type="search" placeholder="Nhập tên hoặc đơn vị"><div id="person-list" class="person-list"></div></main>`,
  );
  const render = () => {
    const q =
      $<HTMLInputElement>("#search-person").value.toLocaleLowerCase("vi");
    const list = people.filter(
      (p: any) =>
        p.id !== me.recipient?.id &&
        `${p.name} ${p.department}`.toLocaleLowerCase("vi").includes(q),
    );
    $("#person-list").innerHTML =
      list
        .map(
          (p: any) =>
            `<button class="person-option" data-person="${esc(p.id)}" ${me.extraUsed >= me.extraLimit || !me.open ? "disabled" : ""}>${avatar(p)}<span>${esc(p.name)}<small>${esc(p.department)}</small></span>${icon("arrow")}</button>`,
        )
        .join("") || "<p>Chưa tìm thấy đồng nghiệp phù hợp.</p>";
    document.querySelectorAll<HTMLButtonElement>("[data-person]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = people.find((p: any) => p.id === b.dataset.person);
          kind = "extra";
          compose();
        }),
    );
    void loadPhotos();
  };
  $("#search-person").addEventListener("input", render);
  $("#back-home").onclick = () => void home();
  render();
}
function draftKey() {
  return `draft:${me.person.id}:${selected.id}:${kind}:${me.round}`;
}
function compose() {
  const draft = JSON.parse(sessionStorage.getItem(draftKey()) || "null");
  currentDraft = draft?.text || "";
  anonymous = draft?.anonymous || false;
  requestId = draft?.requestId || crypto.randomUUID();
  frame(
    `<main class="compose-layout"><section><button class="text-link" id="back-home">${icon("back")} Trở về</button><span class="eyebrow accent">Lời chân thành luôn đẹp nhất</span><h1>Gửi một lời,<br><span>giữ một niềm vui.</span></h1><div class="recipient-inline">${avatar(selected)}<div>Gửi đến<strong>${esc(selected.name)}</strong><small>${esc(selected.department)}</small></div></div><img class="compose-art" src="assets/success.webp" alt="Một bông hoa nở từ phong thư"></section><form class="compose-form" id="wish-form"><label for="wish">Bạn muốn nhắn gửi điều gì?</label><textarea id="wish" placeholder="Cảm ơn bạn vì…" required maxlength="1000" rows="7">${esc(currentDraft)}</textarea><div class="counter"><span>Một lời chúc ngắn, một niềm vui thật dài.</span><span id="counter">${[...currentDraft].length}/500</span></div><div class="suggestions"><span>Một chút gợi ý</span><button type="button" data-suggest="Cảm ơn bạn vì luôn ">Cảm ơn bạn vì…</button><button type="button" data-suggest="Điều mình trân trọng ở bạn là ">Mình trân trọng…</button><button type="button" data-suggest="Chúc bạn luôn ">Chúc bạn luôn…</button></div><fieldset><legend>Bạn muốn ký tên thế nào?</legend><label class="radio-card"><input type="radio" name="identity" value="named" ${anonymous ? "" : "checked"}><span>Ghi tên tôi<small>${esc(me.person.name)}</small></span></label><label class="radio-card"><input type="radio" name="identity" value="anonymous" ${anonymous ? "checked" : ""}><span>Gửi ẩn danh<small>Một người đồng nghiệp</small></span></label></fieldset><p class="field-help" id="anonymous-note">${anonymous ? "Người nhận và bức tường không thấy tên bạn. Ban tổ chức vẫn có thể kiểm tra khi cần." : "Tên bạn sẽ xuất hiện trên thiệp và bức tường."}</p><p class="field-help">Lời chúc được công khai ngay sau khi gửi. Bạn xem lại một lần nhé.</p><button class="button full" type="submit">Xem trước lời chúc ${icon("arrow")}</button></form></main>`,
  );
  $("#back-home").onclick = () => void home();
  const save = () => {
    currentDraft = $<HTMLTextAreaElement>("#wish").value;
    anonymous =
      $<HTMLInputElement>("input[name=identity]:checked").value === "anonymous";
    sessionStorage.setItem(
      draftKey(),
      JSON.stringify({ text: currentDraft, anonymous, requestId }),
    );
    $("#counter").textContent = `${[...currentDraft].length}/500`;
    $("#anonymous-note").textContent = anonymous
      ? "Người nhận và bức tường không thấy tên bạn. Ban tổ chức vẫn có thể kiểm tra khi cần."
      : "Tên bạn sẽ xuất hiện trên thiệp và bức tường.";
  };
  $("#wish").addEventListener("input", save);
  document
    .querySelectorAll("input[name=identity]")
    .forEach((x) => x.addEventListener("change", save));
  document.querySelectorAll<HTMLButtonElement>("[data-suggest]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = $<HTMLTextAreaElement>("#wish");
        if (!t.value) {
          t.value = b.dataset.suggest!;
          save();
        }
        t.focus();
      }),
  );
  $("#wish-form").addEventListener("submit", (e) => {
    e.preventDefault();
    save();
    if (!currentDraft.trim() || [...currentDraft.trim()].length > 500)
      return toast("Lời chúc cần từ 1 đến 500 ký tự.", true);
    preview();
  });
  void loadPhotos();
}
function preview() {
  const w = {
    recipientName: selected.name,
    text: currentDraft.trim(),
    senderName: anonymous ? "Một người đồng nghiệp" : me.person.name,
  };
  const d = modal(
    `<span class="eyebrow accent">Một chút chân thành sắp được gửi đi</span><h2>Lời chúc của bạn</h2>${card(w)}<div class="button-row"><button class="button secondary" id="edit-wish">Sửa lại</button><button class="button" id="send-wish">Gửi lời chúc ${icon("arrow")}</button></div><p class="field-help" id="send-status" role="status"></p>`,
  );
  $("#edit-wish").onclick = () => d.close();
  $("#send-wish").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, async () => {
      $("#send-status").textContent = "Đang gửi lời chúc…";
      try {
        await api("send", {
          recipientId: selected.id,
          text: currentDraft.trim(),
          anonymous,
          kind,
          round: me.round,
          requestId,
        });
        sessionStorage.removeItem(draftKey());
        d.close();
        success();
      } catch (err) {
        $("#send-status").textContent =
          errorText(err) + " Bản nháp của bạn vẫn được giữ lại.";
        throw err;
      }
    });
}
function success() {
  frame(
    `<main class="success-page"><img src="assets/success.webp" alt="Bông hoa tri ân"><span class="eyebrow accent">Một điều tốt đẹp vừa được trao đi</span><h1>Lời chúc đã<br><span>đến nơi.</span></h1><p>Cảm ơn bạn đã làm ngày hôm nay<br>của ${esc(selected.name)} thêm ấm áp.</p><div class="button-row"><button class="button" id="inbox-success">Mở hộp thư của tôi ${icon("mail")}</button><button class="button secondary" id="home-success">Trở về</button></div></main>`,
  );
  $("#inbox-success").onclick = () => (location.hash = "inbox");
  $("#home-success").onclick = () => void home();
}
async function inbox() {
  if (!me) me = await api("me");
  const wishes = await api("inbox");
  frame(
    `<main class="inbox-page"><div class="section-heading"><div><span class="eyebrow accent">Những điều ấm áp dành riêng cho bạn</span><h1>Hộp thư <span>của tôi.</span></h1><p>${wishes.length ? `${wishes.length} lời chúc, gửi bằng tất cả sự chân thành.` : "Niềm vui đôi khi đến chậm một chút."}</p></div><button class="button secondary" id="refresh-inbox">Làm mới</button></div>${wishes.length ? `<div class="inbox-grid">${wishes.map((w: any) => `<button class="card-button" data-wish="${esc(w.id)}" aria-label="Mở lời chúc từ ${esc(w.senderName)}">${card(w)}<span class="open-card">Mở và lưu thiệp ${icon("arrow")}</span></button>`).join("")}</div>` : '<div class="empty-state"><img src="assets/empty.webp" alt="Hộp thư chờ"><h2>Một lời chúc đang trên đường đến</h2><p>Trong lúc chờ, hãy gửi một điều tốt đẹp đến người đồng hành của bạn.</p><a class="button" href="./">Gửi lời chúc</a></div>'}</main>`,
    "inbox",
  );
  document.querySelectorAll<HTMLButtonElement>("[data-wish]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = wishes.find((x: any) => x.id === b.dataset.wish);
        modal(
          `<span class="eyebrow accent">Dành riêng cho ${esc(me.person.name)}</span>${card(w)}${downloadButtons()}`,
        );
        cardActions(w);
      }),
  );
  $("#refresh-inbox").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, inbox);
}
function profile() {
  const d = modal(
    `<h2>Một gương mặt thân quen</h2><p>Ảnh giúp đồng nghiệp nhận ra bạn. Ảnh được lưu riêng cho sự kiện và không đưa lên bức tường công khai.</p>${avatar(me.person, "large")}<label class="button secondary full file-label">Chọn ảnh chân dung<input type="file" id="my-photo" accept="image/jpeg,image/png,image/webp"></label><div class="button-row"><button class="button secondary" id="remove-photo">Xoá ảnh của tôi</button><button class="text-link" id="logout">Đăng xuất ${icon("logout")}</button></div>`,
  );
  $("#logout").onclick = logout;
  $("#my-photo").onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    d.close();
    try {
      const photo = await cropPhoto(file);
      await api("setPhoto", { personId: me.person.id, photo });
      clearPhotoCache();
      await home();
      toast("Ảnh của bạn đã được cập nhật.");
    } catch (err) {
      toast(errorText(err), true);
    }
  };
  $("#remove-photo").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, async () => {
      await api("setPhoto", { personId: me.person.id, photo: "" });
      clearPhotoCache();
      d.close();
      await home();
    });
  void loadPhotos();
}
window.addEventListener("hashchange", () => {
  if (new URLSearchParams(location.hash.slice(1)).has("code")) {
    void start();
    return;
  }
  if (token()) {
    (location.hash === "#inbox" ? inbox() : home()).catch((e) =>
      toast(errorText(e), true),
    );
  }
});
let lastInbox = "";
setInterval(async () => {
  if (
    !document.hidden &&
    location.hash === "#inbox" &&
    token() &&
    !document.querySelector("dialog")
  ) {
    try {
      const list = await api("inbox");
      const signature = JSON.stringify(list);
      if (lastInbox && signature !== lastInbox) await inbox();
      lastInbox = signature;
    } catch {
      /* User can refresh; keep current content. */
    }
  }
}, 30000);
async function start() {
  const params = new URLSearchParams(location.hash.slice(1));
  const code = params.get("code");
  if (code) {
    history.replaceState(null, "", location.pathname);
    try {
      saveSession(await api("login", { code }, ""));
    } catch (e) {
      welcome();
      toast(errorText(e), true);
      return;
    }
  }
  if (token()) {
    try {
      await home();
    } catch (e) {
      welcome();
      toast(errorText(e), true);
    }
  } else welcome();
}
void start();

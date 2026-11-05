import { api, DEMO, token, saveSession, logout } from "./api";
import { esc, makeCode, hash } from "./security";
import { parsePeople, matchPhoto, normalizeCode } from "./core.mjs";
import {
  $,
  icon,
  toast,
  busy,
  avatar,
  loadPhotos,
  modal,
  errorText,
  clearPhotoCache,
} from "./ui";
import { compressCenter, cropPhoto, downloadBlob } from "./media";
import QRCode from "qrcode";
let state: any,
  tab = "overview";
let pendingRefresh: Promise<void> | null = null,
  refreshGeneration = 0,
  viewEdited = false;
let codes: any[] = JSON.parse(sessionStorage.getItem("ndtd-issued") || "[]");
const root = $("#app");
const tabs: Record<string, string> = {
  overview: "Tổng quan",
  people: "Người tham gia",
  photos: "Ảnh chân dung",
  pair: "Ghép người & mã QR",
  wishes: "Lời chúc",
  settings: "Cài đặt sự kiện",
};
function login() {
  root.innerHTML = `${DEMO ? '<div class="demo-banner">Bản trải nghiệm · Mật khẩu: demo-mat-khau</div>' : ""}<main class="admin-login"><a class="event-name" href="./">Những điều tốt đẹp<span>Dành cho ban tổ chức</span></a><h1 style="margin-top:35px">Chào người gieo<br><span>niềm vui.</span></h1><p>Đăng nhập để chuẩn bị và đồng hành cùng sự kiện.</p><form id="mod-login"><label for="password">Mật khẩu quản trị</label><input id="password" type="password" autocomplete="current-password" required><label style="margin-top:12px;font-weight:400"><input id="show-password" type="checkbox"> Hiện mật khẩu</label><button class="button full">Đăng nhập ${icon("arrow")}</button><p id="login-error" class="inline-error" role="alert"></p></form></main>`;
  $("#show-password").onchange = () => {
    $<HTMLInputElement>("#password").type = $<HTMLInputElement>(
      "#show-password",
    ).checked
      ? "text"
      : "password";
  };
  $("#mod-login").onsubmit = (e) => {
    e.preventDefault();
    void busy($<HTMLButtonElement>("#mod-login button"), async () => {
      try {
        saveSession(
          await api(
            "modLogin",
            { password: $<HTMLInputElement>("#password").value },
            "",
          ),
        );
        await render();
      } catch (err) {
        $("#login-error").textContent = errorText(err);
      }
    });
  };
}
async function render() {
  await refreshState(true);
}
function refreshState(force = false): Promise<void> {
  if (pendingRefresh && !force) return pendingRefresh;
  const generation = ++refreshGeneration;
  const request = api("admin")
    .then((next) => {
      // A read started before a saved change must not replace the newer result.
      if (generation !== refreshGeneration) return;
      const changed = !state || state.version !== next.version;
      state = next;
      if (
        force ||
        (changed &&
          !viewEdited &&
          !document.querySelector('dialog[open], [aria-busy="true"]'))
      )
        draw();
      else if (changed && $("#refresh-admin"))
        $("#refresh-admin").textContent = "Có cập nhật · Làm mới";
    })
    .catch((error) => {
      if (generation === refreshGeneration) throw error;
    })
    .finally(() => {
      if (pendingRefresh === request) pendingRefresh = null;
    });
  pendingRefresh = request;
  return request;
}
function refreshError(error: any) {
  if (error.code === "AUTH" || !token()) {
    ++refreshGeneration;
    state = undefined;
    saveSession(null);
    login();
  } else if ($("#refresh-admin"))
    $("#refresh-admin").textContent = "Chưa cập nhật · Thử lại";
  toast(errorText(error), true);
}
function draw() {
  viewEdited = false;
  root.innerHTML = `${DEMO ? '<div class="demo-banner">Bản trải nghiệm · Mọi thay đổi chỉ nằm trên trình duyệt này</div>' : ""}<div class="admin-shell"><aside class="admin-sidebar"><a href="./" class="event-name">Những điều tốt đẹp<span>Không gian ban tổ chức</span></a>${Object.entries(
    tabs,
  )
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${key === tab ? "active" : ""}">${label}</button>`,
    )
    .join(
      "",
    )}<button id="refresh-admin">Làm mới dữ liệu</button><a href="./wall.html" target="_blank" rel="noopener">Mở bức tường ↗</a><button id="logout">Đăng xuất</button><div class="sidebar-bottom">Tri ân ngày Nhà giáo Việt Nam<br>20/11 · Bộ phận Đào tạo</div></aside><main class="admin-main"><div class="admin-heading"><div><h1>${tabs[tab]}</h1><p>Mỗi chi tiết nhỏ, cùng làm nên một sự kiện ấm áp.</p></div><span class="status-pill ${state.settings.open ? "" : "closed"}">● ${state.settings.open ? "Cổng gửi đang mở" : "Cổng gửi đang đóng"}</span></div><div id="admin-content"></div></main></div>`;
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!token()) {
          refreshError(new Error("Phiên đã hết hạn. Vui lòng đăng nhập lại."));
          return;
        }
        tab = b.dataset.tab!;
        draw();
        void refreshState().catch(refreshError);
      }),
  );
  root.oninput = root.onchange = () => {
    viewEdited = true;
  };
  $("#refresh-admin").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, () =>
      render().catch(refreshError),
    );
  $("#logout").onclick = logout;
  (({ overview, people, photos, pair, wishes, settings })[tab] || overview)();
  void loadPhotos();
}
function overview() {
  const sent = new Set(
      state.receipts
        .filter(
          (w: any) => w.kind === "main" && w.round === state.settings.round,
        )
        .map((w: any) => w.sender),
    ).size,
    received = new Set(state.wishes.map((w: any) => w.recipientId)).size,
    withPhotos = state.people.filter((p: any) => p.photo).length;
  $("#admin-content").innerHTML = `<div class="stat-grid">${[
    ["Người tham gia", state.people.length, "Đồng nghiệp cùng sẻ chia"],
    ["Đã gửi lời chúc chính", sent, "Gửi đi một điều chân thành"],
    ["Tổng lời chúc", state.wishes.length, "Những điều tốt đẹp được trao"],
    ["Đã nhận lời chúc", received, "Những niềm vui được đón nhận"],
  ]
    .map(
      (x) =>
        `<section class="stat"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></section>`,
    )
    .join(
      "",
    )}</div><div class="admin-columns"><section class="panel"><h2>Hành trình lan toả</h2><p>${sent}/${state.people.length} đồng nghiệp đã gửi lời chúc chính.</p><div class="progress-track"><i style="width:${state.people.length ? (sent / state.people.length) * 100 : 0}%"></i></div><ul class="checklist"><li>Ảnh chân dung <small>${withPhotos}/${state.people.length} đã sẵn sàng</small></li><li>Ghép người <small>${state.assignments.length} phân công</small></li><li>Lời chúc gửi thêm <small>${state.wishes.filter((w: any) => w.kind === "extra").length} lời</small></li><li>Đã ẩn khỏi tường <small>${state.wishes.filter((w: any) => w.hidden).length} lời</small></li></ul></section><section class="panel"><span class="eyebrow accent">Sẵn sàng cho một ngày thật đẹp</span><h2>Cùng mở cánh cửa niềm vui</h2><p>Kiểm tra danh sách, ảnh và mã cá nhân trước khi mở cổng. Khi đóng cổng, mọi người vẫn có thể đọc và lưu thiệp.</p><button class="button" id="toggle-gate">${state.settings.open ? "Đóng cổng gửi" : "Mở cổng gửi"} ${icon("arrow")}</button></section></div><section class="panel"><h2>Đồng nghiệp chưa gửi lời chúc chính</h2><p>${
    state.people
      .filter(
        (p: any) =>
          !state.receipts.some(
            (w: any) =>
              w.sender === p.id &&
              w.kind === "main" &&
              w.round === state.settings.round,
          ),
      )
      .map((p: any) => esc(p.name))
      .join(" · ") || "Tất cả đã gửi lời chúc. Cảm ơn mọi người!"
  }</p></section>`;
  $("#toggle-gate").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, async () => {
      await api("settings", { open: !state.settings.open });
      await render();
    });
}
function people() {
  $("#admin-content").innerHTML =
    `<div class="toolbar"><button class="button" id="import">Nhập từ Excel</button><input type="search" id="people-search" aria-label="Tìm người tham gia" placeholder="Tìm tên hoặc mã nhân viên"><button class="button secondary" id="refresh-people">Làm mới</button></div><div class="table-wrap"><table><thead><tr><th>Mã nhân viên</th><th>Người tham gia</th><th>Đơn vị</th><th>Thao tác</th></tr></thead><tbody id="people-body"></tbody></table></div><p class="field-help">Không xoá người đã thuộc vòng ghép hoặc đã có lời chúc. Mã truy cập chỉ xuất sau khi nhập hoặc cấp lại.</p>`;
  const draw = () => {
    const q = $<HTMLInputElement>("#people-search").value.toLocaleLowerCase();
    $("#people-body").innerHTML =
      state.people
        .filter((p: any) =>
          `${p.name} ${p.employee}`.toLocaleLowerCase().includes(q),
        )
        .map(
          (p: any) =>
            `<tr><td>${esc(p.employee)}</td><td><div class="person-cell">${avatar(p)}<span>${esc(p.name)}<small>${p.isDemo ? "Dữ liệu mẫu" : ""}</small></span></div></td><td>${esc(p.department)}</td><td><button data-edit="${esc(p.id)}">Sửa</button><button data-code="${esc(p.id)}">Cấp lại mã</button><button data-delete="${esc(p.id)}">Xoá</button></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="4">Chưa có người tham gia phù hợp.</td></tr>';
    document
      .querySelectorAll<HTMLButtonElement>("[data-edit]")
      .forEach((b) => (b.onclick = () => editPerson(b.dataset.edit!)));
    document.querySelectorAll<HTMLButtonElement>("[data-code]").forEach(
      (b) =>
        (b.onclick = () =>
          void busy(b, async () => {
            if (!confirm("Cấp mã mới sẽ thu hồi mã và phiên cũ. Tiếp tục?"))
              return;
            const p = state.people.find((p: any) => p.id === b.dataset.code),
              code = makeCode();
            await api("rotateCode", {
              personId: p.id,
              codeHash: await hash(normalizeCode(code)),
            });
            keepCodes([{ ...p, code }]);
            toast("Đã cấp mã mới. Vào Ghép người & mã QR để xuất.");
          })),
    );
    document.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach(
      (b) =>
        (b.onclick = () =>
          void busy(b, async () => {
            if (confirm("Xoá người chưa ghép này khỏi danh sách?")) {
              await api("removePerson", { personId: b.dataset.delete });
              await render();
            }
          })),
    );
    void loadPhotos();
  };
  $("#people-search").oninput = draw;
  $("#import").onclick = importPeople;
  $("#refresh-people").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, () =>
      render().catch(refreshError),
    );
  draw();
}
function keepCodes(items: any[]) {
  for (const p of items) codes = [...codes.filter((x) => x.id !== p.id), p];
  sessionStorage.setItem("ndtd-issued", JSON.stringify(codes));
}
function editPerson(id: string) {
  const p = state.people.find((p: any) => p.id === id);
  const d = modal(
    `<h2>Thông tin đồng nghiệp</h2><form id="edit-person"><label>Họ tên<input id="edit-name" value="${esc(p.name)}" maxlength="100" required></label><label>Đơn vị<input id="edit-dept" value="${esc(p.department)}" maxlength="100"></label><button class="button">Lưu thay đổi</button></form>`,
  );
  $("#edit-person").onsubmit = (e) => {
    e.preventDefault();
    void busy($<HTMLButtonElement>("#edit-person button"), async () => {
      await api("updatePerson", {
        personId: id,
        name: $<HTMLInputElement>("#edit-name").value,
        department: $<HTMLInputElement>("#edit-dept").value,
      });
      d.close();
      await render();
    });
  };
}
function importPeople() {
  let parsed: any;
  const d = modal(
    '<h2>Đưa những người đồng hành đến đây</h2><p>Sao chép các cột từ Excel rồi dán bên dưới: Mã nhân viên, Họ tên, Đơn vị (không bắt buộc).</p><label for="tsv">Danh sách từ Excel</label><textarea id="tsv" rows="6" placeholder="NV001&#9;Nguyễn Minh Anh&#9;Đào tạo"></textarea><button class="button secondary" id="preview-import">Kiểm tra danh sách</button><div id="import-result"></div>',
  );
  $("#preview-import").onclick = () => {
    parsed = parsePeople($<HTMLTextAreaElement>("#tsv").value);
    const dup = parsed.rows.filter((p: any) =>
      state.people.some((x: any) => x.employee === p.employee),
    );
    parsed.errors.push(...dup.map((p: any) => `Mã ${p.employee} đã tồn tại.`));
    $("#import-result").innerHTML = parsed.errors.length
      ? `<ul class="error-list">${parsed.errors.map((e: string) => `<li>${esc(e)}</li>`).join("")}</ul>`
      : `<div class="import-preview"><table><tbody>${parsed.rows.map((p: any) => `<tr><td>${esc(p.employee)}</td><td>${esc(p.name)}</td><td>${esc(p.department)}</td></tr>`).join("")}</tbody></table></div><button class="button full" id="apply-import">Nhập ${parsed.rows.length} người</button>`;
    $("#apply-import")?.addEventListener("click", (e) =>
      busy(e.currentTarget as HTMLButtonElement, async () => {
        const entries = await Promise.all(
          parsed.rows.map(async (p: any) => {
            const code = makeCode();
            return { ...p, code, codeHash: await hash(normalizeCode(code)) };
          }),
        );
        const result = await api("import", {
          people: entries.map(({ code, ...p }) => p),
        });
        keepCodes(
          result.map((p: any, i: number) => ({ ...p, code: entries[i].code })),
        );
        d.close();
        await render();
        toast("Đã nhập danh sách. Hãy xuất CSV mã trước khi đóng tab này.");
      }),
    );
  };
}
function photos() {
  $("#admin-content").innerHTML =
    `<section class="panel"><h2>Mỗi gương mặt, một người đồng hành</h2><p>Đặt tên ảnh theo mã nhân viên hoặc họ tên. Mã nhân viên được ưu tiên. Tên trùng sẽ cần chọn lại. Ảnh lô được cắt vuông ở giữa; có thể chỉnh khung từng ảnh sau đó.</p><label class="button file-label">Chọn nhiều ảnh<input id="bulk-photos" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><div id="photo-review"></div></section><section class="panel"><h2>Ảnh hiện tại</h2><div class="table-wrap"><table><tbody>${state.people.map((p: any) => `<tr><td>${avatar(p)}</td><td>${esc(p.name)}<br><small>${esc(p.employee)}</small></td><td><label class="button secondary file-label">Chỉnh / thay<input data-photo-person="${esc(p.id)}" type="file" accept="image/jpeg,image/png,image/webp"></label>${p.photo ? `<button data-recrop="${esc(p.id)}">Cắt lại ảnh</button>` : ""}<button data-remove-photo="${esc(p.id)}">Xoá ảnh</button></td></tr>`).join("")}</tbody></table></div></section>`;
  $("#bulk-photos").onchange = async (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    const entries: any[] = [];
    for (const file of files) {
      try {
        entries.push({
          file,
          data: await compressCenter(file),
          matches: matchPhoto(file.name, state.people),
        });
      } catch (err) {
        toast(errorText(err), true);
      }
    }
    $("#photo-review").innerHTML =
      entries
        .map(
          (x, i) =>
            `<div class="photo-row"><img src="${x.data}" alt="Xem trước ảnh ${esc(x.file.name)}"><span>${esc(x.file.name)}${x.matches.length === 1 ? "" : " · Cần chọn người"}</span><select aria-label="Người nhận ảnh ${esc(x.file.name)}" data-match="${i}"><option value="">Bỏ qua ảnh này</option>${state.people.map((p: any) => `<option value="${esc(p.id)}" ${x.matches.length === 1 && x.matches[0].id === p.id ? "selected" : ""}>${esc(p.employee)} · ${esc(p.name)}</option>`).join("")}</select></div>`,
        )
        .join("") +
      `<button class="button" id="apply-photos" style="margin-top:20px">Áp dụng ảnh đã chọn</button><p id="upload-progress" role="status"></p>`;
    $("#apply-photos").onclick = (e) =>
      void busy(e.currentTarget as HTMLButtonElement, async () => {
        const selections = Array.from(
          document.querySelectorAll<HTMLSelectElement>("[data-match]"),
        ).filter((s) => s.value && !s.disabled);
        if (new Set(selections.map((s) => s.value)).size !== selections.length)
          throw new Error(
            "Có nhiều ảnh cùng chọn một người. Hãy sửa trước khi áp dụng.",
          );
        let done = 0;
        for (const select of selections) {
          $("#upload-progress").textContent =
            `Đang tải ${done + 1}/${selections.length}…`;
          await api("setPhoto", {
            personId: select.value,
            photo: entries[Number(select.dataset.match)].data,
          });
          done++;
          select.disabled = true;
        }
        clearPhotoCache();
        toast(`Đã cập nhật ${done} ảnh.`);
        await render();
      });
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-recrop]")
    .forEach((button) => {
      button.onclick = () =>
        void busy(button, async () => {
          const source = await api("getPhoto", {
            personId: button.dataset.recrop,
          });
          const blob = await (await fetch(source)).blob();
          const photo = await cropPhoto(
            new File([blob], "portrait", { type: blob.type }),
          );
          await api("setPhoto", { personId: button.dataset.recrop, photo });
          clearPhotoCache();
          await render();
        });
    });
  document.querySelectorAll<HTMLInputElement>("[data-photo-person]").forEach(
    (x) =>
      (x.onchange = async () => {
        const file = x.files?.[0];
        if (!file) return;
        try {
          const photo = await cropPhoto(file);
          await api("setPhoto", { personId: x.dataset.photoPerson, photo });
          clearPhotoCache();
          await render();
        } catch (e) {
          toast(errorText(e), true);
        }
      }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-remove-photo]").forEach(
    (b) =>
      (b.onclick = () =>
        void busy(b, async () => {
          if (confirm("Xoá ảnh chân dung này?")) {
            await api("setPhoto", {
              personId: b.dataset.removePhoto,
              photo: "",
            });
            clearPhotoCache();
            await render();
          }
        })),
  );
}
function csvCell(value: any) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function base() {
  return import.meta.env.VITE_PUBLIC_URL || new URL("./", location.href).href;
}
function personalLink(code: string) {
  return base() + "#code=" + encodeURIComponent(code);
}
async function printQR(personal: boolean) {
  if (personal && !codes.length)
    throw new Error(
      "Chưa có mã trong tab này. Hãy nhập danh sách hoặc cấp lại mã trước.",
    );
  const items = personal
    ? codes.map((p) => ({
        name: p.name,
        code: p.code,
        url: personalLink(p.code),
      }))
    : [
        {
          name: "Những điều tốt đẹp",
          code: "Quét mã và nhập mã cá nhân",
          url: base(),
        },
      ];
  const parts = await Promise.all(
    items.map(
      async (p) =>
        `<article class="print-card"><p>Tri ân 20/11 · Những điều tốt đẹp</p><h3>${esc(p.name)}</h3><img src="${await QRCode.toDataURL(p.url, { width: 360, margin: 3 })}" alt="QR"><code>${esc(p.code)}</code></article>`,
    ),
  );
  document.querySelector(".print-root")?.remove();
  const r = document.createElement("section");
  r.className = "print-root";
  r.style.display = "none";
  r.innerHTML = '<div class="print-cards">' + parts.join("") + "</div>";
  document.body.append(r);
  window.print();
}
function pair() {
  const valid =
    state.assignments.length === state.people.length &&
    state.assignments.every((a: any) => a.sender !== a.recipient) &&
    new Set(state.assignments.map((a: any) => a.recipient)).size ===
      state.people.length;
  $("#admin-content").innerHTML =
    `<section class="panel"><h2>Mỗi người gửi đi, mỗi người nhận lại</h2><p>Phân công có hướng, không ai trúng chính mình. Có thể ghép khi cổng đang đóng. Nếu đã có lời chúc chính, cần kết thúc vòng cũ rõ ràng; các thư cũ vẫn giữ đúng người nhận.</p><button class="button" id="pair-people">${state.assignments.length ? "Ghép lại" : "Ghép ngẫu nhiên"} ${icon("arrow")}</button><p class="notice">${valid && state.people.length ? "Đã kiểm tra: không tự ghép, mỗi người nhận đúng một lần." : `Chưa có vòng ghép đầy đủ · ${state.people.length} người.`}</p></section><section class="panel"><h2>Mã cá nhân & thẻ QR</h2><p>Mã là chìa khoá vào hộp thư. CSV và QR cá nhân chỉ lưu trên máy của bạn. Trong tab này đang có ${codes.length} mã vừa cấp; hãy xuất trước khi đóng tab.</p><div class="toolbar"><button class="button secondary" id="export-csv">Xuất CSV mã cá nhân</button><button class="button secondary" id="print-personal">In QR cá nhân</button><button class="button secondary" id="print-common">In QR chung</button></div></section><section class="panel"><h2>Danh sách phân công</h2><div class="table-wrap"><table><thead><tr><th>Người gửi</th><th>Người nhận</th></tr></thead><tbody>${state.assignments.map((a: any) => `<tr><td>${esc(state.people.find((p: any) => p.id === a.sender)?.name)}</td><td>${esc(state.people.find((p: any) => p.id === a.recipient)?.name)}</td></tr>`).join("")}</tbody></table></div></section>`;
  $("#pair-people").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, async () => {
      let confirmText = "";
      if (
        state.receipts.some(
          (w: any) => w.kind === "main" && w.round === state.settings.round,
        )
      ) {
        confirmText =
          prompt(
            "Đã có lời chúc chính. Nhập KẾT THÚC VÒNG CŨ để tạo vòng mới và giữ thư cũ:",
          ) || "";
        if (confirmText !== "KẾT THÚC VÒNG CŨ") return;
      } else if (
        state.assignments.length &&
        !confirm(
          "Ghép lại sẽ thay đổi người đồng hành của tất cả mọi người. Tiếp tục?",
        )
      )
        return;
      await api("pair", { confirm: confirmText });
      await render();
    });
  $("#export-csv").onclick = () => {
    if (!codes.length)
      return toast("Chưa có mã mới để xuất trong tab này.", true);
    const rows = [
      ["Mã nhân viên", "Họ tên", "Đơn vị", "Mã cá nhân", "Link riêng"],
      ...codes.map((p) => [
        p.employee,
        p.name,
        p.department,
        p.code,
        personalLink(p.code),
      ]),
    ];
    downloadBlob(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      "ma-ca-nhan.csv",
    );
  };
  $("#print-personal").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, () => printQR(true));
  $("#print-common").onclick = (e) =>
    void busy(e.currentTarget as HTMLButtonElement, () => printQR(false));
}
function wishes() {
  $("#admin-content").innerHTML =
    `<div class="toolbar"><input type="search" id="wish-search" aria-label="Tìm lời chúc" placeholder="Tìm người hoặc nội dung"><select id="wish-filter" aria-label="Lọc lời chúc" style="max-width:200px"><option value="all">Tất cả lời chúc</option><option value="hidden">Đã ẩn khỏi tường</option><option value="anonymous">Ẩn danh</option></select></div><section class="panel" id="wish-list"></section>`;
  const draw = () => {
    const q = $<HTMLInputElement>("#wish-search").value.toLowerCase(),
      filter = $<HTMLSelectElement>("#wish-filter").value;
    const list = state.wishes.filter(
      (w: any) =>
        `${w.text} ${w.recipientName} ${w.actualSender}`
          .toLowerCase()
          .includes(q) &&
        (filter !== "hidden" || w.hidden) &&
        (filter !== "anonymous" || w.anonymous),
    );
    $("#wish-list").innerHTML =
      list
        .map(
          (w: any) =>
            `<article class="admin-wish ${w.hidden ? "hidden-wish" : ""}" data-wish-id="${esc(w.id)}"><h3>${esc(w.actualSender)} → ${esc(w.recipientName)}</h3><small>${w.anonymous ? "Ẩn danh · Tác giả chỉ hiển thị với mod" : "Ghi tên"} · ${w.hidden ? "Đang ẩn khỏi tường" : "Đang công khai"}</small><p>${esc(w.text)}</p><div class="toolbar"><button class="button secondary" data-action="${w.hidden ? "show" : "hide"}" data-id="${esc(w.id)}">${w.hidden ? "Hiện lại" : "Ẩn khỏi tường"}</button><button class="button secondary" data-action="delete" data-id="${esc(w.id)}">Xoá lời chúc</button></div></article>`,
        )
        .join("") || "<p>Chưa có lời chúc phù hợp.</p>";
    document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(
      (b) =>
        (b.onclick = () =>
          void busy(b, async () => {
            if (
              b.dataset.action === "delete" &&
              !confirm("Xoá vĩnh viễn lời chúc khỏi hộp thư và bức tường?")
            )
              return;
            await api("moderate", {
              id: b.dataset.id,
              operation: b.dataset.action,
            });
            await render();
          })),
    );
  };
  $("#wish-search").oninput = draw;
  $("#wish-filter").onchange = draw;
  draw();
}
function localTime(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");
}
function settings() {
  const s = state.settings;
  $("#admin-content").innerHTML =
    `<section class="panel"><h2>Nhịp điệu của sự kiện</h2><form id="settings-form" class="settings-grid"><label>Số lời chúc được gửi thêm<input id="extra-limit" type="number" min="0" max="20" value="${s.extraLimit}"></label><label>Trạng thái cổng gửi<select id="gate"><option value="closed" ${!s.open ? "selected" : ""}>Đóng</option><option value="open" ${s.open ? "selected" : ""}>Mở</option></select></label><label>Giờ bắt đầu (Việt Nam)<input type="datetime-local" id="opensAt" value="${localTime(s.opensAt)}"></label><label>Giờ đóng cổng (Việt Nam)<input type="datetime-local" id="closesAt" value="${localTime(s.closesAt)}"></label><label>Hạn đọc và tải thiệp (Việt Nam)<input type="datetime-local" id="expiresAt" value="${localTime(s.expiresAt)}"></label><p class="field-help">Để trống thời gian nếu vận hành thủ công. Đóng cổng vẫn cho đọc và tải thiệp; hết hạn truy cập sẽ đóng cả hộp thư và tường.</p><button class="button">Lưu cài đặt</button></form></section>${DEMO ? '<section class="panel"><h2>Dữ liệu trải nghiệm</h2><p>Xoá dữ liệu mẫu để thử quy trình nhập danh sách từ đầu.</p><button class="button secondary" id="clean-demo">Xoá dữ liệu mẫu</button></section>' : ""}`;
  $("#settings-form").onsubmit = (e) => {
    e.preventDefault();
    void busy($<HTMLButtonElement>("#settings-form button"), async () => {
      const payload: any = {
        extraLimit: Number($<HTMLInputElement>("#extra-limit").value),
        open: $<HTMLSelectElement>("#gate").value === "open",
      };
      for (const k of ["opensAt", "closesAt", "expiresAt"]) {
        const v = $<HTMLInputElement>("#" + k).value;
        payload[k] = v ? new Date(v + ":00+07:00").toISOString() : "";
      }
      await api("settings", payload);
      await render();
      toast("Đã lưu cài đặt.");
    });
  };
  $("#clean-demo")?.addEventListener("click", (e) =>
    busy(e.currentTarget as HTMLButtonElement, async () => {
      if (confirm("Xoá người, ảnh và lời chúc mẫu?")) {
        await api("cleanDemo");
        codes = [];
        sessionStorage.removeItem("ndtd-issued");
        await render();
      }
    }),
  );
}
if (token())
  render().catch((e) => {
    login();
    toast(errorText(e), true);
  });
else login();

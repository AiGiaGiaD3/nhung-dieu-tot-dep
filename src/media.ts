import { modal, $, toast, icon, busy } from "./ui";
export async function cropPhoto(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Ảnh tối đa 8MB. Vui lòng chọn ảnh nhỏ hơn.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Vui lòng chọn ảnh JPG, PNG hoặc WebP.");
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return new Promise((resolve, reject) => {
    const d = modal(
      '<h2>Chọn khung ảnh của bạn</h2><p class="muted">Di chuyển khung để gương mặt ở chính giữa.</p><canvas id="crop" width="512" height="512"></canvas><label>Phóng to<input id="zoom" type="range" min="1" max="3" step="0.05" value="1"></label><label>Trái – phải<input id="cx" type="range" min="0" max="100" value="50"></label><label>Trên – dưới<input id="cy" type="range" min="0" max="100" value="50"></label><button class="button full" id="use-photo">Dùng ảnh này</button>',
    );
    let completed = false;
    const c = $<HTMLCanvasElement>("#crop"),
      ctx = c.getContext("2d")!;
    const draw = () => {
      const z = Number($<HTMLInputElement>("#zoom").value),
        side = Math.min(img.width, img.height) / z,
        x =
          ((img.width - side) * Number($<HTMLInputElement>("#cx").value)) / 100,
        y =
          ((img.height - side) * Number($<HTMLInputElement>("#cy").value)) /
          100;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, x, y, side, side, 0, 0, 512, 512);
    };
    d.querySelectorAll("input").forEach((x) =>
      x.addEventListener("input", draw),
    );
    draw();
    $("#use-photo").onclick = () => {
      let quality = 0.85,
        result = c.toDataURL("image/jpeg", quality);
      while (result.length * 0.75 > 150 * 1024 && quality > 0.25) {
        quality -= 0.1;
        result = c.toDataURL("image/jpeg", quality);
      }
      if (result.length * 0.75 > 150 * 1024) {
        toast("Ảnh vẫn quá lớn. Vui lòng chọn ảnh khác.", true);
        return;
      }
      completed = true;
      resolve(result);
      d.close();
    };
    d.addEventListener("close", () => {
      URL.revokeObjectURL(url);
      if (!completed) reject(new Error("Đã huỷ thay ảnh."));
    });
  });
}
export async function compressCenter(file: File) {
  if (file.size > 8 * 1024 * 1024)
    throw new Error(`${file.name}: ảnh vượt 8MB.`);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(`${file.name}: chỉ nhận JPG, PNG, WebP.`);
  const bitmap = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const s = Math.min(bitmap.width, bitmap.height);
  c.getContext("2d")!.drawImage(
    bitmap,
    (bitmap.width - s) / 2,
    (bitmap.height - s) / 2,
    s,
    s,
    0,
    0,
    512,
    512,
  );
  bitmap.close();
  let q = 0.8,
    result = c.toDataURL("image/jpeg", q);
  while (result.length * 0.75 > 150 * 1024 && q > 0.2) {
    q -= 0.1;
    result = c.toDataURL("image/jpeg", q);
  }
  if (result.length * 0.75 > 150 * 1024)
    throw new Error("Ảnh nén vẫn quá lớn.");
  return result;
}
export function lines(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
) {
  const output: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        output.push(line);
        line = "";
      }
      if (ctx.measureText(word).width <= width) {
        line = word;
        continue;
      }
      for (const char of word) {
        if (ctx.measureText(line + char).width > width) {
          output.push(line);
          line = "";
        }
        line += char;
      }
    }
    output.push(line);
  }
  return output;
}
export async function cardBlob(w: any) {
  await document.fonts.load('400 42px "Be Vietnam Pro"');
  await document.fonts.load('600 42px "Be Vietnam Pro"');
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const x = c.getContext("2d")!;
  x.font = '400 42px "Be Vietnam Pro", Verdana';
  const wrapped = lines(x, w.text, 840);
  x.font = '600 42px "Be Vietnam Pro", Verdana';
  const nameLines = lines(x, w.recipientName, 840);
  c.height = Math.max(
    1350,
    700 + wrapped.length * 66 + (nameLines.length - 1) * 58,
  );
  x.fillStyle = "#fff";
  x.fillRect(0, 0, c.width, c.height);
  const bg = new Image();
  bg.src = "assets/card.webp";
  await bg.decode();
  x.drawImage(bg, 0, 0, 1080, c.height);
  x.fillStyle = "rgba(255,255,255,.65)";
  x.fillRect(0, 0, 1080, c.height);
  x.fillStyle = "#333333";
  x.font = '600 25px "Be Vietnam Pro", Verdana';
  x.fillText("Những điều tốt đẹp", 120, 150);
  x.font = '400 24px "Be Vietnam Pro", Verdana';
  x.fillText("Một lời thương gửi đến", 120, 260);
  x.fillStyle = "#CC1629";
  x.font = '600 42px "Be Vietnam Pro", Verdana';
  nameLines.forEach((s, i) => x.fillText(s, 120, 325 + i * 58));
  x.fillStyle = "#333333";
  x.font = '400 42px "Be Vietnam Pro", Verdana';
  wrapped.forEach((s, i) =>
    x.fillText(s, 120, 440 + (nameLines.length - 1) * 58 + i * 66),
  );
  x.font = '600 25px "Be Vietnam Pro", Verdana';
  const signature = lines(x, `Từ ${w.senderName}`, 840);
  signature.forEach((s, i) => x.fillText(s, 120, c.height - 260 + i * 38));
  x.font = '400 23px "Be Vietnam Pro", Verdana';
  x.fillText("Tri ân ngày Nhà giáo Việt Nam · 20/11", 120, c.height - 150);
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Chưa tạo được thiệp. Hãy thử lại.")),
      "image/png",
    ),
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function cardActions(w: any) {
  $("#download-card")?.addEventListener("click", (e) =>
    busy(e.currentTarget as HTMLButtonElement, async () => {
      downloadBlob(await cardBlob(w), "nhung-dieu-tot-dep.png");
      toast("Thiệp đã sẵn sàng trong tệp tải về.");
    }),
  );
  $("#share-card")?.addEventListener("click", (e) =>
    busy(e.currentTarget as HTMLButtonElement, async () => {
      const file = new File([await cardBlob(w)], "nhung-dieu-tot-dep.png", {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Những điều tốt đẹp" });
      } else {
        const u = URL.createObjectURL(file);
        const d = modal(
          `<h2>Lưu một điều tốt đẹp</h2><p>Chạm giữ ảnh để lưu. Nếu trình duyệt trong Zalo không hỗ trợ, hãy mở trang bằng Safari hoặc Chrome.</p><img class="save-preview" src="${u}" alt="Thiệp lời chúc">`,
        );
        d.addEventListener("close", () => URL.revokeObjectURL(u));
      }
    }),
  );
}
export const downloadButtons = () =>
  `<div class="button-row"><button class="button" id="download-card">${icon("download")} Lưu thiệp PNG</button><button class="button secondary" id="share-card">Lưu / chia sẻ trên điện thoại</button></div>`;

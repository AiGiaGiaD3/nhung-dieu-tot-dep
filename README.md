# Những điều tốt đẹp

Ứng dụng tri ân 20/11 dành cho Bộ phận Đào tạo Prudential Việt Nam. Frontend tĩnh trên GitHub Pages, backend Google Apps Script, dữ liệu trên Google Sheet và ảnh thật trong Drive riêng.

**Trạng thái 05/11/2026:** đã triển khai backend Google và GitHub Pages; đạt 18 kiểm tra backend, 3 E2E demo và 1 E2E thật. Bài tải phân bố trong 10 phút đạt 300/300 lời gửi, 10.329 lượt đọc tường không lỗi; dữ liệu mẫu đã dọn sạch, cổng gửi đóng. Xem [báo cáo kiểm thử và giới hạn](docs/TEST-REPORT.md). Chủ tài khoản xác nhận OAuth In production và đã cấp lại quyền. Không có logo chính thức trong tệp đầu vào nên giao diện chưa đặt logo.

[Trang tham gia](https://aigiagiad3.github.io/nhung-dieu-tot-dep/) · [Bức tường](https://aigiagiad3.github.io/nhung-dieu-tot-dep/wall.html) · [Ban tổ chức](https://aigiagiad3.github.io/nhung-dieu-tot-dep/mod.html)

## Chạy trên máy

Yêu cầu Node.js 24 LTS (bao gồm npm), Git; GitHub CLI chỉ cần khi deploy. Trong thư mục này:

```sh
npm ci
npm run dev:demo
```

Mở `http://127.0.0.1:4173/`. Demo có 10 người hoàn toàn hư cấu. Mã `DEMO-01` đến `DEMO-10`, mật khẩu mod `demo-mat-khau` chỉ dùng cho demo. Có thể mở hai tab để gửi và nhận, dữ liệu lưu trong localStorage cùng trình duyệt; các máy khác nhau không chia sẻ dữ liệu demo.

Truy cập `wall.html` để xem tường, `mod.html` để quản trị. Bản production thiếu URL backend sẽ báo lỗi cấu hình, không chuyển âm thầm sang demo. Demo chỉ cần máy chủ local, không cần Internet sau khi đã cài thư viện và tải tài nguyên.

Trong môi trường Codex của lần xây này, Node đi kèm nhưng chưa có npm trên PATH; đã dùng bản npm chính thức đặt tại `../../work/package/bin/npm-cli.js`. Máy người dùng cài Node chuẩn có thể dùng các lệnh npm bên trên bình thường.

## Kiểm thử

```sh
npm run check
npx playwright install chromium
npm run test:e2e:demo
npm run build:demo
```

Playwright tự dùng Chrome tại đường dẫn Windows chuẩn nếu có, nếu không thì dùng Chromium đã cài. Có thể đặt `CHROME_PATH` cho vị trí khác. Ảnh demo ở `screenshots/`; trace lỗi ở `test-results/`, không được commit. Bài live tự bỏ qua khi chưa có LIVE_URL.

18 bài unit/integration kiểm tra thuật toán, phân quyền, API ẩn danh, retry, lịch, ghi Sheet nguyên tử qua mock, token và ảnh. Ba kịch bản E2E demo bao phủ người gửi, người nhận, mod, XSS, PNG, ảnh lô, QR, 360px, mobile và màn chiếu. Xem `docs/TEST-REPORT.md` để biết kết quả và giới hạn.

## Deploy

Làm các bước đăng nhập một lần trong [docs/DEPLOY.md](docs/DEPLOY.md), sao chép `.env.example` thành `.env` và điền cục bộ. Không gửi mật khẩu hoặc OAuth JSON trong chat.

```sh
npm run deploy
```

Script kiểm tra tài khoản `AiGiaGiaD3`, tạo Sheet và project gắn Sheet, push bằng clasp, cập nhật deployment cũ theo ID, khởi tạo bằng API chủ sở hữu, build, đẩy repo/Pages, chờ workflow, chạy smoke test thật với fixture riêng, dọn fixture và xuất QR. Lần đầu dừng để chủ tài khoản cấp quyền và liên kết Cloud project; chạy lại để tiếp tục từ checkpoint.

Quy trình đã tạo tài nguyên và triển khai trên tài khoản thật. Mỗi lỗi xác thực hoặc bất đồng cấu hình sẽ dừng; không có thông báo deploy thành công nếu health hoặc live test chưa qua. `npm run test:load` là bước nghiệm thu riêng cần chạy trước sự kiện, sau deploy smoke test.

## Kiến trúc và dữ liệu

- `src/core.mjs`: nghiệp vụ dùng chung giữa demo/backend; mỗi người nhận một phân công chính, ngoài ra gửi thêm theo hạn mức.
- `src/main.ts`, `src/mod.ts`, `src/wall.ts`: ba giao diện, hoàn toàn tiếng Việt.
- `src/api.ts`: adapter live và demo; POST text/plain, đọc JSON, timeout/retry có giới hạn.
- `backend/entry.mjs`: xác thực backend, Sheet, Drive, cache và khoá ghi.
- `scripts/`: build, triển khai, fixture, kiểm thử tải, QR, đổi mật khẩu và gỡ sự kiện.
- `public/assets/`: 16 hình WebP AI và bản OG JPEG, đều minh hoạ hoặc nhân vật hư cấu. Prompt lưu trong `docs/IMAGE-PROMPTS.json`.

Sheet `Data` có cột loại bản ghi và JSON cho từng người, lời chúc, phân công, cấu hình và audit. Dữ liệu đã commit được nén và cache riêng tối đa 10 phút; mỗi lần ghi đổi khóa cache để phiên bị thu hồi không dùng dữ liệu cũ. Cache thiếu/hỏng thì đọc lại Sheet. Ghi bằng một `spreadsheets.batchUpdate` với `stringValue` trong `ScriptLock`: cùng một lần cập nhật nguyên tử, không thực thi công thức Excel. Không sửa trực tiếp sheet trong giờ sự kiện. Cách lưu này giúp giữ nguyên tính nhất quán mà không cần database/server riêng; giao diện mod là nơi xem và sửa dữ liệu.

Mã cá nhân ngẫu nhiên tạo bằng Web Crypto/Node crypto; server lưu SHA-256. Link/mã chỉ xuất khi vừa cấp. Mật khẩu mod được bcrypt ở Node và verifier đặt trong Script Properties; backend so sánh, phiên ký HMAC có hạn. Đổi mã thu hồi phiên người đó; đổi mật khẩu thu hồi tất cả phiên.

Ảnh thật được cắt/nén trên trình duyệt, backend kiểm tra định dạng và giới hạn 150KB; Drive folder không public. Public wall không chứa chân dung hay sender ID của lời ẩn danh. Mã nhân viên không dùng để đăng nhập. API người nhận không cho truyền ID khác để đọc hộp thư.

Không ghi mật khẩu/token vào console. Trace/test live và CSV cá nhân chỉ nằm local, không thuộc artifact GitHub Pages. Mã frontend và ảnh minh hoạ có thể public; chưa có dữ liệu nhân sự thật trong repo.

## Các lệnh bảo trì

| Lệnh | Tác dụng |
|---|---|
| `npm run deploy` | Deploy lại, giữ deployment ID/URL |
| `npm run test:e2e:live` | Smoke test trên sự kiện trống; fixture tự dọn |
| `npm run test:load` | 100 người/10 phút + client đọc tường; phải nghiệm thu trước sự kiện |
| `npm run seed:demo` | Seed 10 người/ảnh giả vào sự kiện trống |
| `npm run clean:demo` | Xoá dữ liệu mẫu có đánh dấu, cổng đóng |
| `npm run mod:password` | Đọc MOD_PASSWORD mới trong .env, đổi backend, thu hồi phiên |
| `npm run qr` | Xuất `dist/qr-chung.png` từ PUBLIC_URL thật |
| `npm run reset:data` | Hỏi xác nhận XOÁ TOÀN BỘ, backup local rồi reset |
| `npm run teardown` | Hỏi xác nhận GỠ SỰ KIỆN, reset, gỡ deployments, tắt Pages, trash Sheet/folder |

Đặt `LOAD_USERS=300` để thử 300 người hoặc `LOAD_BURST=1` để thử gửi đồng loạt. Không chạy bài load trên dữ liệu thật: script từ chối nếu sự kiện không trống. Báo cáo ở `.local/load-report.json`. Không chạy seed/load khi người tham gia đã vào sự kiện. Đây là bài đo có giới hạn, không bảo đảm hạ tầng Apps Script luôn chịu được 300 request cùng lúc.

## Kết thúc sự kiện và xoá dữ liệu

1. Đóng cổng trong mod. Cho mọi người đủ thời gian tải thiệp, rồi đặt hạn đọc/hạn xem tường.
2. Nếu cần giữ bản lưu, xuất/cất riêng với quyền truy cập phù hợp; đừng đẩy backup vào GitHub.
3. Chạy `npm run teardown` trong terminal tương tác. Script chỉ xử lý Sheet/folder/deployment của project trong `.local/deployment.json`; giữ lại source code.
4. Vào Drive Trash, kiểm tra đúng Sheet và folder sự kiện rồi xoá vĩnh viễn. Thao tác trash không phải xoá vĩnh viễn. Ảnh thay thế/ảnh bị xoá trước đó cũng cần dọn trong Trash.
5. Xoá `.local/`, CSV/thẻ QR cá nhân đã tải, screenshot/trace live và `.env` nếu không sử dụng nữa. Xoá backup ở mọi nơi đã tạo, gồm bản đồng bộ cloud hoặc Downloads.
6. Thu hồi quyền OAuth không còn dùng trong Google Account; `gh auth logout` / `clasp logout` nếu tài khoản chỉ phục vụ sự kiện. Gỡ repo nếu muốn xoá mã public, sau khi xác định không cần dùng lại.

Gỡ deployment không tự xoá Sheet hoặc Drive. Người đã tải thiệp PNG có thể giữ bản của họ; không thu hồi được tệp từ xa. QR cá nhân/link riêng không chia sẻ lên tường hoặc nhóm công khai.

## Giới hạn vận hành

- OAuth bootstrap và cập nhật deployment giữ URL đã kiểm tra trên tài khoản thật. Bài tải 300 lượt gửi phân bố trong 10 phút đã đạt; đây là client API có retry, không phải chứng nhận 300 thiết bị gửi ngay trong cùng một giây. Kết quả và phương pháp nằm trong docs/TEST-REPORT.md.
- QR demo localhost chỉ minh hoạ bố cục; không dùng in poster sự kiện. QR in thật chỉ được tạo khi có URL public.
- Safari/iPhone, Android/Zalo và Wi-Fi tại địa điểm cần test trên thiết bị/mạng thật. Playwright Chrome không thay thế các kiểm tra đó.
- Thông báo inbox khi mất mạng không có push nền; cập nhật khi mở trang/poll. Tường dùng polling/cache, không WebSocket.
- Xoá lời chúc không hoàn lại lượt gửi: sổ lượt gửi riêng chỉ giữ ID và trạng thái nghiệp vụ, không giữ nội dung đã xoá. Sổ này được xoá khi reset/teardown.
- Logo chưa tích hợp; mã đỏ hiện tại là bảng màu tạm đã duyệt. Font Be Vietnam Pro được self-host, giấy phép trong gói Fontsource (OFL).

Tài liệu nguồn: [quota Apps Script](https://developers.google.com/apps-script/guides/services/quotas), [Apps Script API](https://developers.google.com/apps-script/api/how-tos/execute), [atomic batchUpdate](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate), [clasp](https://github.com/google/clasp).

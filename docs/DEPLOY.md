# Thiết lập và deploy

Tài liệu thiết lập và vận hành. Tài nguyên Google và repository AiGiaGiaD3/nhung-dieu-tot-dep đã được tạo; giữ checkpoint riêng để cập nhật đúng deployment hiện có.

## 1. Máy tính và GitHub

1. Cài Node.js 24 LTS, Git, GitHub CLI (`gh`). Mở terminal trong thư mục dự án.
2. `npm ci`.
3. `gh auth login`: GitHub.com, HTTPS, đăng nhập bằng trình duyệt, tài khoản AiGiaGiaD3.
4. `gh auth status`, `gh api user --jq .login`: phải là AiGiaGiaD3.
5. Sao chép `.env.example` thành `.env`. Tạo MOD_PASSWORD ngẫu nhiên đủ mạnh (tối thiểu 14 ký tự), chỉ lưu trên máy. Repo mặc định `AiGiaGiaD3/nhung-dieu-tot-dep`.

## 2. Google một lần

Để script Node chạy hàm `bootstrap` qua `scripts.run`, Apps Script và OAuth client phải dùng cùng một standard Google Cloud project. Đăng nhập clasp đơn thuần không hoàn thành điều kiện này.

1. Bằng Gmail cá nhân, bật [Apps Script API trong cài đặt người dùng](https://script.google.com/home/usersettings).
2. Trong Google Cloud Console tạo project riêng cho sự kiện, không bật dịch vụ trả phí. Ghi lại project number vào GOOGLE_CLOUD_PROJECT_NUMBER.
3. Bật Google Apps Script API, Google Sheets API và Google Drive API trong project đó.
4. Thiết lập OAuth consent cho ứng dụng do bạn sở hữu; thêm Gmail của bạn vào test users nếu dùng trạng thái Testing. Tạo OAuth client loại Desktop App, tải JSON về thư mục riêng trên máy. Ghi đường dẫn file vào GOOGLE_CREDENTIALS_FILE. File đó không đặt trong `public/` hoặc commit.
5. Chạy `npx clasp login --creds "đường-dẫn-JSON" --extra-scopes "https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive"`. Cờ extra-scopes bổ sung quyền dữ liệu ngay cả khi chưa tạo Apps Script project. Cấp các scope Sheet, Drive, Apps Script và email cần thiết. Không dán token vào chat.
6. Chạy `npm run deploy`. Khi project Apps Script được tạo, script in đường dẫn Settings và dừng. Mở Settings, đổi Google Cloud project number sang project OAuth đã tạo. Đặt `CLOUD_LINK_CONFIRMED=1` trong `.env` sau khi hoàn tất.
7. Chạy deploy lại. Khi Google yêu cầu lần cấp quyền đầu hoặc API executable, mở editor theo thông báo. Kiểm tra deployment API executable chỉ bản thân chủ tài khoản được gọi; Web app chạy **Me**, truy cập **Anyone**. Đăng nhập, cấp quyền rồi tiếp tục chạy lại deploy.

Nếu Google báo ứng dụng chưa xác minh, chỉ tiếp tục khi đúng project bạn vừa tạo và đúng Gmail. Nếu tổ chức chặn quyền, dùng tài khoản cá nhân như thiết kế ban đầu. Chưa có người tham gia nào cần đăng nhập Google.

## OAuth trước ngày sự kiện

Nếu Publishing status còn Testing, Google cấp refresh token có thời hạn 7 ngày cho các scope Drive/Sheets đang dùng. Trước sự kiện 20/11, chủ tài khoản chuyển Google Auth Platform → Audience → Publish app sang In production và đăng nhập clasp lại để lấy quyền theo trạng thái mới. Việc này chỉ áp dụng tài khoản chủ quản trị; người tham gia không đăng nhập Google. Nếu Google yêu cầu xác minh hoặc hiện lỗi, xử lý đúng hướng dẫn thay vì bỏ qua.

Nguồn: https://developers.google.com/identity/protocols/oauth2/

## 3. Sau khi đã thiết lập

`npm run deploy` tự push code và cập nhật deployment đã ghi ở `.local/deployment.json`. Giữ file này trên máy và sao lưu riêng. `.clasp.json`, `.local/` và `.env` đều bị Git ignore. Khi đổi máy, khôi phục những tệp cấu hình riêng đó; nếu thiếu ID script sẽ dừng thay vì tự tạo deployment mới.

Backend build nằm ở `backend-build/`, chỉ thư mục đó được clasp push. Source backend không có mật khẩu. `scripts.run` nhận verifier và secret từ tiến trình Node qua OAuth; không có endpoint web công khai để bootstrap hoặc đổi mật khẩu.

GitHub Actions nhận BACKEND_URL/PUBLIC_URL qua repository variables (không phải secret). Đây là địa chỉ public, không phải thông tin xác thực. Google token và MOD_PASSWORD không được lưu trên Actions.

## 4. Nghiệm thu bắt buộc

Sau Pages thành công, pipeline chạy live smoke test nếu sự kiện trống, xoá dữ liệu mẫu rồi kiểm tra sạch. Nếu đã có dữ liệu, lệnh deploy chỉ kiểm tra backend/quản trị và bỏ qua E2E có ghi fixture để bảo toàn sự kiện. Lệnh test:live chạy riêng vẫn từ chối sự kiện không trống; dùng môi trường staging riêng để nghiệm thu có ghi dữ liệu.

Chạy `npm run test:load` trước khi nhập danh sách thật. Xem `.local/load-report.json`, kiểm tra đối soát đủ số lời, không trùng, p95 và thời gian hoàn tất. Test riêng đợt đồng loạt bằng LOAD_BURST=1. Không báo “đạt 300 người” khi chỉ mới test 100.

Mở link public từ điện thoại 4G, Wi-Fi sự kiện và Zalo. Scan QR từ xa, mở mã cá nhân, gửi/nhận và lưu PNG. Khi có lỗi CORS, không sửa thành `no-cors`: phải đọc được response xác nhận từ backend.

## 5. Sự cố thường gặp

| Thông báo | Cách xử lý |
|---|---|
| Không có gh | Cài GitHub CLI rồi mở terminal mới |
| Sai tài khoản GitHub | `gh auth switch --user AiGiaGiaD3` hoặc đăng nhập lại |
| Apps Script API disabled | Bật API ở cả usersettings và Cloud project |
| OAuth client khác project | Đăng nhập clasp bằng đúng JSON; kiểm tra project number trong editor |
| Không chạy được bootstrap | Kiểm tra API executable, scope, quyền chủ sở hữu và OAuth consent |
| URL backend khác trước | Dừng, kiểm tra deployment ID trong local và editor; không in QR mới vội |
| Live test từ chối vì có dữ liệu | Không xoá người thật để chạy test; dùng staging. Redeploy tự bỏ qua E2E ghi fixture |
| Không có ảnh chân dung | Kiểm tra quyền Drive của chủ tài khoản, file còn tồn tại, không public folder |
| Quota/429/quá nhiều thực thi | Đóng cổng tạm thời, giảm nguồn poll, chờ quota; xem báo cáo tải trước khi mở lại |

Các bước cần chủ tài khoản thao tác phải hoàn tất trước khi quy trình đi tiếp. Không có cách hợp lệ để tự bỏ qua MFA/consent.

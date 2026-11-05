# Báo cáo nghiệm thu — 05/11/2026

Ứng dụng: **Những điều tốt đẹp**. Website: https://aigiagiad3.github.io/nhung-dieu-tot-dep/

**Kết quả cuối trên commit bd7e5e3: đạt 300/300 lượt gửi trong bài phân bố 10 phút, 300 ID duy nhất và đủ 300 lời lưu trong Sheets; 10.329 lượt đọc tường thành công, 0 lỗi đọc.** p50 2.784ms, p95 4.232ms. Đã đối soát không còn người/lời/phân công/sổ lượt thử, cổng gửi đóng. Số liệu tổng hợp không chứa mã cá nhân: [LOAD-TEST-RESULT.json](LOAD-TEST-RESULT.json). Tổng thời gian gồm chuẩn bị phiên và kết thúc vòng đọc là 793.913ms.

## Kiểm thử đã đạt

- TypeScript không lỗi; Vite production build thành công với trang tham gia, tường, mod, quyền riêng tư và quy tắc tham gia.
- **18/18 bài unit/backend mô phỏng đạt.** Bao phủ ghép đôi, phân quyền, mã/phiên, ẩn danh, XSS, quota gửi, idempotency, xoá không hoàn lượt, khoá/ghi nguyên tử, ảnh, cache chia phần cho dữ liệu lớn và phục hồi phần bị mất, thu hồi phiên và thử lại lỗi Google Sheets tạm thời mà không tạo thư trùng.
- **3/3 kịch bản Playwright demo đạt** trên Chrome Windows; bài live được bỏ qua trong lượt demo rồi chạy riêng.
- **1/1 kịch bản E2E trên website và backend thật đạt**, khoảng 2,4 phút ở lượt mới nhất trên bản bd7e5e3: nhập 10 người từ Excel, 10 ảnh lô, ghép một-một không tự ghép, CSV, cổng gửi, link cá nhân, ảnh riêng từ Drive, ghi tên/ẩn danh, hộp thư, PNG, ẩn thư và tường cập nhật. Không có console/page error trong kịch bản.
- Thiệp xuất thật rộng 1080px, cao tối thiểu 1350px; tường đúng 1920×1080; không cuộn ngang tại 360px; có screenshot mobile 390×844.
- Đã dọn và đối soát sạch fixture sau E2E và sau bài tải cuối; cổng gửi đóng.
- OAuth bootstrap, Drive riêng, health và cập nhật deployment giữ nguyên URL đã được kiểm chứng.
- GitHub Actions đã xuất bản thành công. Lấy API status với nonce để tránh phản hồi HTTP cũ báo queued.
- Hai trang thông tin trả HTTP 200 và đã kiểm tra trên Chrome mobile không tràn ngang.
- Nguồn public không phát hiện mẫu secret bị cấm; .env, .local, OAuth JSON và ảnh/dữ liệu nhân sự không được commit.
- 16 WebP + JPEG Open Graph: 269.448 byte; WebP lớn nhất 44.132 byte. Không dùng logo vì chưa có file chính thức.

## Đo tải thực tế và các lỗi đã sửa

Các lần chuẩn bị tải đầu đã phát hiện quota đọc Sheets và tranh chấp bộ đếm đăng nhập. Đã thêm cache dữ liệu đã commit, khóa cache thay theo từng lần ghi, bộ đếm nhanh cho mã cá nhân và giữ giới hạn mật khẩu mod trong Properties. Đã sửa MIME gzip khi giải nén cache trong Apps Script và xác minh trực tiếp.

Lượt 100 người gửi trong 10 phút sau sửa cache: **99/100 thành công, không đạt tiêu chí 100%**. Có 3.480 lượt đọc tường, không lỗi đọc; p50 gửi thành công 2.211ms, p95 3.452ms. Một lần batchUpdate báo service currently unavailable. Đã bổ sung ánh xạ lỗi tạm thời thành BUSY để client thử lại bằng cùng requestId, kèm bài regression không tạo thư trùng. Bộ dữ liệu của lượt này đã dọn sạch.

Lượt 300 người/10 phút trước bản cache chia phần: **293/300 thành công, không đạt**. Có 10.336 lượt đọc thành công và 274 lượt đọc lỗi; p50 gửi thành công 2.571ms, p95 3.737ms. Bảy lượt gửi hết số lần thử lại với BUSY. Chẩn đoán chủ sở hữu ghi nhận quota đọc Sheets; dữ liệu đã dọn sạch và cổng đóng. Đã sửa cache cho snapshot lớn, xuất bản khoá cache sau khi các phần đã sẵn sàng.

Phương pháp: chuẩn bị 300 phiên bằng 6 worker, sau đó phân bố 300 lời chính ngắn trong 600 giây; 300 vòng đọc trang đầu tường, nghỉ 15–17 giây giữa các lần đọc (cộng thời gian request). Không tải chân dung trong bài tải; ảnh được kiểm tra riêng trong E2E. Client Node thử tối đa 5 lần/request, timeout 30 giây; frontend thử tối đa 4 lần với timeout 25 giây. Đối soát số lời đã lưu, ID không trùng, mọi lượt gửi thành công và số lỗi đọc bằng 0 mới tính đạt. Không tương đương 300 thiết bị vật lý hoặc bảo đảm hạ tầng Google ở mọi thời điểm.

Lượt 300 sau sửa cache (commit 7db9d08): **299/300 thành công, vẫn chưa đạt**; 10.313 lượt đọc, 0 lỗi đọc; p50 2.887ms, p95 6.972ms. Một lượt gửi BUSY sau 28.837ms; không có lỗi dịch vụ mới trong LAST_ERROR, cache vẫn đọc được. Đã tăng thời gian chờ khóa ghi từ 1 lên 8 giây để các lượt ghi chờ được khi Sheets chậm tạm thời. Bản sửa khóa bd7e5e3 đã đạt trong lượt kiểm chứng cuối ở đầu báo cáo.

## Ảnh kiểm tra

### Cập nhật tốc độ tab quản trị — 05/11/2026

Trước sửa, mỗi lần chọn tab đều chờ API admin rồi mới dựng giao diện. Sau sửa, tab hiển thị ngay từ dữ liệu trong bộ nhớ và đọc dữ liệu mới ở nền; các lần chuyển nhanh dùng chung một request đang chờ. Phản hồi cũ không ghi đè kết quả sau khi lưu, không tự làm mất nội dung đang nhập/lọc; phiên bị thu hồi chuyển về đăng nhập. Có nút làm mới chung.

TypeScript đạt; 3 kịch bản demo hiện có và 3 kịch bản regression quản trị đều đạt (6/6). Bài regression giữ request backend chưa trả về trong khi chuyển cả 6 tab, xác nhận tiêu đề và nội dung đổi đồng bộ dưới 250ms mỗi tab, kiểm tra cập nhật lời mới, giữ nội dung đang sửa và thu hồi phiên. Lần cập nhật này chỉ thay frontend, không chạy lại bài tải ghi hoặc tạo fixture trên sự kiện thật.

- screenshots/live/mobile-390x844.png
- screenshots/live/wall-1920.png
- screenshots/live/thiep-mau.png
- screenshots/privacy-390.png và screenshots/terms-390.png
- Các ảnh demo ở screenshots/; ảnh live không đưa lên repository.

## Xác nhận tài khoản và giới hạn kiểm thử

- Chủ tài khoản xác nhận OAuth **In production** ngày 05/11/2026; đã đăng nhập lại thành công bằng Gmail quản trị. Trạng thái Publishing do người dùng xác nhận trong Cloud Console, không suy ra từ kết quả E2E.
- Chưa kiểm tra trên thiết bị iPhone/Safari, Android/Zalo hoặc Wi-Fi/4G tại địa điểm sự kiện. Chrome tự động không thay thế các bước đó.
- Chưa chứng nhận gửi 100/300 yêu cầu ghi ngay trong cùng một giây; kịch bản mục tiêu là phân bố gửi trong 10 phút với các lượt đọc tường đồng thời.

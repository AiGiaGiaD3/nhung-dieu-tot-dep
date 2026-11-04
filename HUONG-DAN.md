# Những điều tốt đẹp — Hướng dẫn ban tổ chức

Tài liệu vận hành. Địa chỉ thật và QR sẽ được bổ sung sau Bước 3; hiện ứng dụng đang ở bản demo.

## Chuẩn bị trước ngày diễn ra

1. Mở trang **Ban tổ chức** (`mod.html`) và đăng nhập bằng mật khẩu quản trị.
2. Vào **Người tham gia → Nhập từ Excel**. Sao chép ba cột: mã nhân viên, họ tên, đơn vị. Không cần email hoặc số điện thoại. Nhấn **Kiểm tra danh sách**, sửa các dòng lỗi, rồi nhập.
3. Vào **Ghép người & mã QR → Xuất CSV mã cá nhân** ngay sau khi nhập. Cất file riêng; mã chỉ còn trong tab vừa cấp cho tới khi đóng tab. Không đăng CSV lên nhóm chung.
4. Vào **Ảnh chân dung**, chọn nhiều ảnh. Tên file nên là mã nhân viên, ví dụ `NV001.jpg`. Nếu dùng họ tên và có người trùng tên, chọn đúng người ở bảng xem trước. Kiểm tra khung mặt vuông rồi **Áp dụng ảnh đã chọn**. Từng ảnh có thể thay/chỉnh khung hoặc xoá.
5. Khi danh sách đã đủ, vào **Ghép người & mã QR → Ghép ngẫu nhiên**. Kiểm tra dòng xác nhận mỗi người nhận đúng một lần. Người gửi và người nhận không bắt buộc ghép qua lại; số người lẻ vẫn dùng được.
6. Xuất/in thẻ QR cá nhân để phát riêng. In **QR chung** cho poster hoặc trình chiếu; người quét QR chung cần nhập mã cá nhân. Không dùng QR demo localhost in cho sự kiện thật.
7. Vào **Cài đặt sự kiện**, đặt số lời chúc gửi thêm (mặc định 2), giờ mở/đóng và hạn đọc thiệp. Mốc giờ dùng giờ Việt Nam. Nếu muốn vận hành bằng nút đóng/mở, để trống thời gian.

Đừng đóng tab quản trị trước khi xuất mã vừa cấp. Nếu mất mã, dùng **Cấp lại mã** ở dòng người đó rồi xuất lại; mã cũ sẽ hết hiệu lực.

## Trong ngày sự kiện

1. Dùng máy chiếu mở `wall.html`, nhấn **Toàn màn hình**. Tường có QR chung và cập nhật tự động. Nên dùng máy đang cắm điện và không tự ngủ.
2. Mod giữ trang quản trị ở thiết bị riêng. Nhấn **Mở cổng gửi** sau khi đã ghép đủ người.
3. Người tham gia quét QR riêng, mở phong thư, nhìn người được ghép, viết lời chúc, chọn ghi tên/ẩn danh, xem trước rồi gửi. Chưa có ảnh vẫn có thể tham gia bằng avatar chữ cái.
4. Hộp thư của mỗi người nhận lời chúc; mở thiệp rồi **Lưu thiệp PNG**. Nếu trình duyệt trong Zalo không tải được, chọn **Lưu / chia sẻ trên điện thoại**, hoặc mở trang bằng Chrome/Safari.
5. Theo dõi **Tổng quan** để biết ai chưa gửi chính. Nhắc đồng nghiệp trực tiếp khi cần; ứng dụng không tự gửi email hoặc tin nhắn.
6. Cần xử lý nội dung: vào **Lời chúc**, tìm đúng nội dung rồi **Ẩn khỏi tường**. Thao tác này giữ thư trong hộp thư người nhận. **Hiện lại** đưa thư lên tường trở lại. **Xoá lời chúc** gỡ cả tường lẫn hộp thư và có hộp xác nhận.

Tên thật của lời chúc ẩn danh chỉ hiện trong trang mod. Không chụp hoặc chiếu trang mod lên màn hình chung.

## Ghép lại và thay đổi danh sách

- Chỉ ghép khi cổng đang đóng. Trước khi có lời chính, có thể ghép lại sau khi xác nhận.
- Nếu đã có lời chính, hệ thống yêu cầu nhập **KẾT THÚC VÒNG CŨ**. Đây là tạo vòng ghép mới; thư cũ vẫn nằm ở đúng người nhận cũ. Chỉ dùng khi BTC chủ động tổ chức lại vòng.
- Không thêm/xoá người tuỳ tiện sau khi chốt vòng. Ứng dụng chặn thay danh sách khi đang ghép để tránh làm người khác mất người gửi. Sửa tên/đơn vị và thay ảnh vẫn được.
- Nếu cần thay toàn bộ danh sách, nhờ người phụ trách kỹ thuật dùng quy trình reset sau khi sao lưu; không xoá Sheet bằng tay trong lúc app hoạt động.

## Khi có sự cố

| Tình huống | Việc nên làm |
|---|---|
| Mã sai hoặc hết hiệu lực | Kiểm tra thẻ được phát đúng người; mod cấp lại mã nếu cần |
| Màn hình chưa có người được ghép | BTC kiểm tra đã nhập đủ người và ghép chưa |
| Không gửi được | Kiểm tra cổng/giờ mở, lượt thêm, mạng; giữ tab và bản nháp, thử lại |
| Gửi lâu hoặc mất phản hồi | Chờ xác nhận. Nút thử lại dùng cùng mã yêu cầu, tránh gửi trùng |
| Ảnh không khớp | Mod thay/chỉnh ảnh theo mã nhân viên, không ghép mơ hồ theo tên |
| Tường ngừng cập nhật | Kiểm tra mạng, nhấn Làm mới; chuyển máy chiếu sang hotspot 4G nếu Wi-Fi chặn |
| Thiệp không tải trên iPhone/Zalo | Dùng nút lưu/chia sẻ hoặc mở bằng Safari/Chrome; chạm giữ ảnh để lưu |
| Phiên mod hết hạn | Đăng nhập lại; không chia sẻ mật khẩu qua màn chiếu |
| Muốn đổi mật khẩu | Người kỹ thuật cập nhật .env, chạy npm run mod:password; mọi phiên cũ bị thu hồi |

Khi mạng bình thường, tường cập nhật theo chu kỳ khoảng 10–15 giây; thao tác ẩn không biến mất trên mọi màn hình ngay lập tức. Khi mất kết nối kéo dài, tường tạm ngừng hiển thị để tránh tiếp tục chiếu nội dung đã bị ẩn.

## Kết thúc

Đóng cổng gửi, thông báo thời hạn lưu thiệp. Sau thời hạn, nhờ người phụ trách kỹ thuật làm theo mục xoá dữ liệu trong README: gỡ deployment, tắt website, dọn Sheet/Drive, Trash, file mã, ảnh/screenshot và backup local. Đóng cổng đơn thuần vẫn cho phép đọc thư. Thiệp đã tải về thiết bị của người tham gia không thể thu hồi từ xa.

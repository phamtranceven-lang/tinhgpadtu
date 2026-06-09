# DTU GPA – gói GitHub Pages đã sửa

## Cách đăng

1. Xóa các file cũ trong repository.
2. Upload toàn bộ file trong ZIP này vào thư mục gốc của nhánh `main`.
3. Vào **Settings → Pages**.
4. Chọn **Deploy from a branch → main → /(root)** rồi bấm **Save**.
5. Mở: `https://phamtranceven-lang.github.io/tinhgpadtu/`

## Cấu trúc

- `index.html`
- `index-BPbzpTUj.js`
- `index-DLIS5DeS.css`
- `guide_curriculum.png`
- `guide_step1.png`
- `guide_step2.png`
- `guide_step3.png`
- `404.html`
- `.nojekyll`

## Lưu ý kỹ thuật

- Không còn thư mục `assets`; JS và CSS nằm cùng cấp với `index.html`.
- Dữ liệu môn học được lưu bằng `localStorage` của trình duyệt.
- Email hỗ trợ đã đổi thành `phambaobao557@gmail.com`.
- Bundle ứng dụng đầy đủ được tải từ commit gốc đã ghim trên GitHub ở lần mở đầu và được trình duyệt lưu cache. Vì vậy trang cần Internet trong lần tải đầu tiên.

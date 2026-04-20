Bước 1: Mở cmd (Run as Admin)
Bước 2: Chạy choco install mkcert
Bước 3: Chạy mkcert -install
Bước 4: Chạy mkcert localhost
=> Có đường dẫn chứng chỉ
TLS_KEY_PATH="C:\Windows\System32\localhost-key.pem"
TLS_CERT_PATH="C:\Windows\System32\localhost.pem"

Xong, vô backend cài:
HTTPS_ENABLED=true
HTTPS_PORT=3443
HTTPS_REDIRECT=true

Frontend ko cần làm gì, đã có sẵn
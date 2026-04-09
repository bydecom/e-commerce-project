# E-Commerce Mock Project — Setup Guide

## Prerequisites

Cài đặt trước khi bắt đầu:

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Git](https://git-scm.com)
- Angular CLI: `npm install -g @angular/cli`

---

## 1. Khởi tạo Repo

```bash
mkdir ecommerce-mock && cd ecommerce-mock
git init

mkdir frontend backend docs
touch docker-compose.yml .env.example .gitignore README.md
```

`.gitignore`:
```
node_modules/
.env
dist/
```

---

## 2. Setup Backend (Node + Express + Prisma)

```bash
cd backend
npm init -y
npm install express cors dotenv jsonwebtoken bcryptjs nodemailer @google/generative-ai
npm install @prisma/client
npm install -D prisma nodemon
```

### 2.1 Khởi tạo Prisma

```bash
npx prisma init
```

Lệnh này tạo ra:
```
backend/
├── prisma/
│   └── schema.prisma   ← định nghĩa DB schema ở đây
└── .env                ← Prisma tự tạo, chứa DATABASE_URL
```

### 2.2 Prisma Schema

Mở `backend/prisma/schema.prisma`, thay toàn bộ nội dung:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  phone     String?
  address   String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())

  orders    Order[]
  feedbacks Feedback[]
}

model Category {
  id       String    @id @default(uuid())
  name     String    @unique
  products Product[]
}

model Product {
  id          String   @id @default(uuid())
  name        String
  description String?
  price       Float
  stock       Int      @default(0)
  imageUrl    String?
  createdAt   DateTime @default(now())

  categoryId  String
  category    Category    @relation(fields: [categoryId], references: [id])
  orderItems  OrderItem[]
  feedbacks   Feedback[]
}

model Order {
  id        String      @id @default(uuid())
  status    OrderStatus @default(PENDING)
  total     Float
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  userId    String
  user      User        @relation(fields: [userId], references: [id])
  items     OrderItem[]
  feedback  Feedback?
}

model OrderItem {
  id        String  @id @default(uuid())
  quantity  Int
  unitPrice Float

  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
}

model Feedback {
  id        String          @id @default(uuid())
  rating    Int
  comment   String?
  sentiment SentimentLabel? 
  createdAt DateTime        @default(now())

  userId    String
  user      User    @relation(fields: [userId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  orderId   String  @unique
  order     Order   @relation(fields: [orderId], references: [id])
}

enum Role {
  USER
  ADMIN
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPING
  DONE
  CANCELLED
}

enum SentimentLabel {
  POSITIVE
  NEUTRAL
  NEGATIVE
}
```

### 2.3 Cấu hình DATABASE_URL

Mở `backend/.env` (do `prisma init` tạo ra), thêm đầy đủ:

```env
DATABASE_URL="postgresql://admin:secret123@localhost:5432/ecommerce?schema=public"

REDIS_URL=redis://:redissecret@localhost:6379
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=noreply@ecommerce.local

GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
CLIENT_URL=http://localhost:4200
```

> ⚠️ Lưu ý: khi chạy backend **trong Docker** thì đổi `localhost` → tên service (`postgres`, `redis`, `mailpit`). Khi chạy backend **ngoài Docker** (dev local) thì giữ `localhost`.

### 2.4 Package.json scripts

```json
"scripts": {
  "dev": "nodemon src/app.js",
  "start": "node src/app.js",
  "db:migrate": "prisma migrate dev",
  "db:generate": "prisma generate",
  "db:seed": "node prisma/seed.js",
  "db:studio": "prisma studio"
}
```

### 2.5 Backend folder structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.js             ← seed data
├── src/
│   ├── config/
│   │   ├── redis.js
│   │   └── swagger.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   └── error.middleware.js
│   ├── modules/
│   │   ├── auth/
│   │   ├── product/
│   │   ├── order/
│   │   ├── user/
│   │   ├── feedback/
│   │   ├── dashboard/
│   │   └── ai/
│   ├── utils/
│   │   ├── mail.js
│   │   └── response.js
│   └── app.js
├── Dockerfile
├── .env
└── package.json
```

---

## 3. Setup Frontend (Angular)

```bash
cd ../frontend
ng new . --routing --style=scss --skip-git
npm install
```

Cấu trúc folder Angular khuyến nghị:

```
frontend/src/app/
├── core/
│   ├── guards/
│   ├── interceptors/     ← JWT interceptor
│   └── services/         ← auth.service, api.service
├── features/
│   ├── auth/
│   ├── products/
│   ├── cart/
│   ├── orders/
│   ├── profile/
│   └── admin/
│       ├── products/
│       ├── orders/
│       └── dashboard/
└── shared/
    ├── components/
    └── models/           ← TypeScript interfaces
```

---

## 4. Docker Setup

### 4.1 Dockerfiles

**`backend/Dockerfile`:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**`frontend/Dockerfile`:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "500"]
```

### 4.2 docker-compose.yml

```yaml
version: '3.9'

services:
  frontend:
    build: ./frontend
    ports:
      - '4200:4200'
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - ecommerce-net

  backend:
    build: ./backend
    ports:
      - '3000:3000'
    volumes:
      - ./backend:/app
      - /app/node_modules
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
      - redis
      - mailpit
    networks:
      - ecommerce-net

  postgres:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret123
      POSTGRES_DB: ecommerce
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - ecommerce-net

  pgadmin:
    image: dpage/pgadmin4
    ports:
      - '5050:80'
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    depends_on:
      - postgres
    networks:
      - ecommerce-net

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --requirepass redissecret
    volumes:
      - redis-data:/data
    networks:
      - ecommerce-net

  redis-commander:
    image: rediscommander/redis-commander:latest
    ports:
      - '8082:8081'
    environment:
      - REDIS_HOSTS=local:redis:6379:0:redissecret
    depends_on:
      - redis
    networks:
      - ecommerce-net

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - '8025:8025'
      - '1025:1025'
    networks:
      - ecommerce-net

  portainer:
    image: portainer/portainer-ce:latest
    ports:
      - '9000:9000'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer-data:/data
    networks:
      - ecommerce-net

volumes:
  postgres-data:
  redis-data:
  portainer-data:

networks:
  ecommerce-net:
    driver: bridge
```

---

## 5. Workflow hàng ngày

### Lần đầu setup (chạy 1 lần duy nhất)

```bash
# 1. Start tất cả services
docker-compose up -d postgres redis mailpit portainer pgadmin redis-commander

# 2. Chạy migration tạo tables
cd backend
npx prisma migrate dev --name init

# 3. Seed data mẫu
npm run db:seed

# 4. Start backend và frontend (local, không Docker để hot-reload nhanh hơn)
npm run dev

# Terminal khác
cd ../frontend
ng serve
```

### Mỗi ngày làm việc

```bash
# Start infrastructure services
docker-compose up -d

# Backend (terminal 1)
cd backend && npm run dev

# Frontend (terminal 2)  
cd frontend && ng serve
```

### Khi thay đổi Prisma schema

```bash
cd backend
npx prisma migrate dev --name ten_migration
# Prisma tự update DB và regenerate client
```

### Xem DB bằng Prisma Studio (thay thế pgAdmin nếu muốn)

```bash
cd backend
npm run db:studio
# Mở http://localhost:5555
```

---

## 6. Web UIs

| URL | Công cụ | Dùng để |
|-----|---------|---------|
| `localhost:4200` | Angular App | Frontend |
| `localhost:3000` | Express API | Backend |
| `localhost:3000/api-docs` | Swagger UI | API documentation |
| `localhost:5050` | pgAdmin 4 | Xem/query PostgreSQL |
| `localhost:8082` | Redis Commander | Xem Redis cache/session |
| `localhost:8025` | Mailpit | Xem email gửi đi |
| `localhost:9000` | Portainer | Quản lý Docker containers |

**pgAdmin lần đầu — thêm server:**
1. Vào `localhost:5050`, login `admin@admin.com / admin`
2. Add New Server → Name: `local`
3. Connection: Host `postgres`, Port `5432`, DB `ecommerce`, User `admin`, Password `secret123`

---

## 7. Swagger Setup (docs/)

Swagger được serve từ backend tại `/api-docs`. Tạo file `backend/src/config/swagger.js`:

```js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'E-Commerce API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/modules/**/*.route.js']
};

const specs = swaggerJsdoc(options);
module.exports = { swaggerUi, specs };
```

Install packages:
```bash
npm install swagger-jsdoc swagger-ui-express
```

Folder `docs/` dùng để chứa file export Swagger JSON nếu cần share với PM:
```bash
# Export swagger spec ra file
curl http://localhost:3000/api-docs-json > docs/swagger.json
```

---

## 8. Checklist Day 1

- [ ] Docker Desktop đang chạy
- [ ] `docker-compose up -d` thành công, tất cả services green
- [ ] `npx prisma migrate dev --name init` tạo tables thành công
- [ ] Truy cập pgAdmin thấy tables
- [ ] Backend chạy được `GET /health` trả về 200
- [ ] Frontend `ng serve` chạy được `localhost:4200`
- [ ] Mailpit `localhost:8025` accessible
- [ ] `.env` đã có `GEMINI_API_KEY`
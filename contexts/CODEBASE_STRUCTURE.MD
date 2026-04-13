D:\WORKSPACE\PROJECT\E-COMMERCE-PROJECT\FRONTEND\SRC
│   favicon.ico
│   index.html
│   main.server.ts
│   main.ts
│   styles.scss
│
├───app
│   │   app.component.html
│   │   app.component.scss
│   │   app.component.spec.ts
│   │   app.component.ts
│   │   app.config.server.ts
│   │   app.config.ts
│   │   app.routes.ts
│   │
│   ├───core
│   │   ├───guards
│   │   │       admin.guard.ts
│   │   │       auth.guard.ts
│   │   │
│   │   ├───interceptors
│   │   │       auth.interceptor.ts
│   │   │       error.interceptor.ts
│   │   │
│   │   └───services
│   │           auth.service.ts
│   │           cart.service.ts
│   │           product-api.service.ts
│   │           store-setting.service.ts
│   │           toast.service.ts
│   │
│   ├───features
│   │   ├───admin
│   │   │   │   admin.routes.ts
│   │   │   │
│   │   │   ├───categories
│   │   │   │   └───category-list
│   │   │   │           category-list.component.ts
│   │   │   │
│   │   │   ├───dashboard
│   │   │   │       dashboard.component.ts
│   │   │   │
│   │   │   ├───shop-settings
│   │   │   │       shop-settings.component.ts
│   │   │   │
│   │   │   ├───feedbacks
│   │   │   │       feedback-list.component.ts
│   │   │   │
│   │   │   ├───layout
│   │   │   │       admin-layout.component.html
│   │   │   │       admin-layout.component.scss
│   │   │   │       admin-layout.component.ts
│   │   │   │       admin-navbar.component.ts
│   │   │   │
│   │   │   ├───orders
│   │   │   │   ├───order-detail
│   │   │   │   │       order-detail.component.ts
│   │   │   │   │
│   │   │   │   └───order-list
│   │   │   │           order-list.component.ts
│   │   │   │
│   │   │   ├───products
│   │   │   │   ├───product-form
│   │   │   │   │       product-form.component.ts
│   │   │   │   │
│   │   │   │   └───product-list
│   │   │   │           product-list.component.ts
│   │   │   │
│   │   │   └───shop-settings
│   │   │           shop-settings.component.ts
│   │   │
│   │   ├───auth
│   │   │   ├───login
│   │   │   │       login.component.ts
│   │   │   │
│   │   │   └───register
│   │   │           register.component.ts
│   │   │
│   │   ├───cart
│   │   │       cart.component.ts
│   │   │
│   │   ├───checkout
│   │   │       checkout.component.ts
│   │   │
│   │   ├───home
│   │   │       home.component.ts
│   │   │
│   │   ├───info
│   │   │   ├───about
│   │   │   │       about.component.ts
│   │   │   │
│   │   │   ├───contact
│   │   │   │       contact.component.ts
│   │   │   │
│   │   │   ├───privacy
│   │   │   │       privacy.component.ts
│   │   │   │
│   │   │   ├───shipping-policy
│   │   │   │       shipping-policy.component.ts
│   │   │   │
│   │   │   └───terms
│   │   │           terms.component.ts
│   │   │
│   │   ├───layout
│   │   │       user-layout.component.html
│   │   │       user-layout.component.ts
│   │   │
│   │   ├───orders
│   │   │   ├───order-detail
│   │   │   │       order-detail.component.ts
│   │   │   │
│   │   │   └───order-list
│   │   │           order-list.component.ts
│   │   │
│   │   ├───products
│   │   │   ├───product-detail
│   │   │   │       product-detail.component.ts
│   │   │   │
│   │   │   └───product-list
│   │   │           product-list.component.ts
│   │   │
│   │   └───profile
│   │           profile.component.ts
│   │
│   └───shared
│       ├───components
│       │   ├───confirm-dialog
│       │   │       confirm-dialog.component.html
│       │   │       confirm-dialog.component.scss
│       │   │       confirm-dialog.component.ts
│       │   │
│       │   ├───footer
│       │   │       footer.component.html
│       │   │       footer.component.scss
│       │   │       footer.component.ts
│       │   │
│       │   ├───navbar
│       │   │       navbar.component.html
│       │   │       navbar.component.scss
│       │   │       navbar.component.ts
│       │   │
│       │   ├───order-status-badge
│       │   │       order-status-badge.component.html
│       │   │       order-status-badge.component.scss
│       │   │       order-status-badge.component.ts
│       │   │
│       │   ├───pagination
│       │   │       pagination.component.html
│       │   │       pagination.component.scss
│       │   │       pagination.component.ts
│       │   │
│       │   ├───product-card
│       │   │       product-card.component.html
│       │   │       product-card.component.scss
│       │   │       product-card.component.ts
│       │   │
│       │   └───sentiment-badge
│       │           sentiment-badge.component.html
│       │           sentiment-badge.component.scss
│       │           sentiment-badge.component.ts
│       │
│       ├───constants
│       │       footer-contact.ts
│       │
│       ├───models
│       │       api-response.model.ts
│       │       feedback.model.ts
│       │       order.model.ts
│       │       product.model.ts
│       │       store-setting.model.ts
│       │       user.model.ts
│       │
│       └───pipes
│               currency-vnd.pipe.ts
│               order-status-label.pipe.ts
│
├───assets
│       .gitkeep
│
└───environments
        environment.prod.ts
        environment.ts

D:\WORKSPACE\PROJECT\E-COMMERCE-PROJECT\BACKEND\SRC
│   app.ts
│   db.ts
│
├───config
│       redis.ts
│       swagger.ts
│
├───middlewares
│       auth.middleware.ts
│       error.middleware.ts
│       role.middleware.ts
│
├───modules
│   ├───ai
│   │       ai.controller.ts
│   │       ai.route.ts
│   │       ai.service.ts
│   │
│   ├───auth
│   │       auth.controller.ts
│   │       auth.route.ts
│   │       auth.service.ts
│   │
│   ├───category
│   │       category.controller.ts
│   │       category.route.ts
│   │       category.service.ts
│   │
│   ├───dashboard
│   │       dashboard.controller.ts
│   │       dashboard.route.ts
│   │
│   ├───feedback
│   │       feedback.controller.ts
│   │       feedback.route.ts
│   │       feedback.service.ts
│   │
│   ├───order
│   │       order.controller.ts
│   │       order.route.ts
│   │       order.service.ts
│   │
│   ├───product
│   │       product.controller.ts
│   │       product.route.ts
│   │       product.service.ts
│   │
│   ├───store-setting
│   │       store-setting.controller.ts
│   │       store-setting.route.ts
│   │       store-setting.service.ts
│   │
│   └───user
│           user.controller.ts
│           user.route.ts
│           user.service.ts
│
└───utils
        http-error.ts
        mail.ts
        pagination.ts
        response.ts

---

## Backend `modules/auth` (behavior)

| File | Role |
|------|------|
| `auth.route.ts` | `POST /register`, `POST /login`, `GET /verify-email`, `POST /resend-verification`, `POST /logout` |
| `auth.controller.ts` | Parses body/query; verify-email redirects to `CLIENT_URL/login` unless `mode=json` |
| `auth.service.ts` | bcrypt, Redis pending + verification tokens, Nodemailer link (`API_BASE_URL`), Prisma user on verify, JWT on login, logout blacklist |
| `utils/jwt-blacklist.ts` | Redis `jwt:blacklist:<jti>` until `exp` |

Protected routes use `middlewares/auth.middleware.ts` (`Bearer` JWT + blacklist check). See `contexts/API_CONTRACT.MD` § Auth.
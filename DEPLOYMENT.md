# TikTok AI Creator - 部署指南 (Vercel + Supabase)

本作是一个基于 Next.js 16 (App Router) 构建的全栈 AI 短视频生成平台。包含了用户认证、计费（Stripe）、以及后端的安全 Gemini 大规模模型代理调用。

## 架构

- **前端/全栈**: Next.js 16
- **数据库/Auth**: Supabase (PostgreSQL)
- **支付处理**: Stripe
- **AI 大模型**: Google Gemini 2.0/2.5 Pro & Flash

## 环境变量准备

在部署前，您需要注册并获取以下 3 个平台的服务密钥，请妥善保管（详见项目下的 `.env.local` 模板）。

### 1. Supabase (数据库与登录)

1. 登录 [Supabase](https://supabase.com)，新建 Project。
2. 拿到 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
3. 获取服务器管理员密钥 `SUPABASE_SERVICE_ROLE_KEY`。
4. **初始化数据库**:
   进入 Supabase 控制台的 SQL Editor，执行项目中 `supabase/schema.sql` 里的所有表结构和 RLS 策略语句。
5. **配置 Auth 回调**:
   在 Authentication -> URL Configuration 中配置 Site URL 为你 Vercel 部署后的域名（开发时是 `http://localhost:3000`）。

### 2. Stripe (支付)

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)(Test Mode 开发阶段)。
2. 获取 `STRIPE_SECRET_KEY`。
3. 配置 Webhook：
   创建 Endpoint，指向 `你的域名/api/stripe/webhook`。
   选取监听事件 `checkout.session.completed`。
   获取 `STRIPE_WEBHOOK_SECRET` 并填入环境。

### 3. Gemini (AI 生成)

1. 前往 Google AI Studio 申请 API Key。
2. 填入 `GEMINI_API_KEY`。

## Vercel 部署步骤

1. 将本代码推送到你的 GitHub 仓库：
   ```bash
   git add .
   git commit -m "init tk creator next.js"
   git push origin main
   ```
2. 登录 [Vercel](https://vercel.com/)。
3. 点击 **Add New...** -> **Project**，导入刚刚你推送到 GitHub 的仓库。
4. 在 Vercel 部署配置界面的 **Environment Variables** 选项卡下，将前面的所有配置项全部一次性填写（不要遗漏）：

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_APP_URL=你的Vercel部署访问域名(https://xxx.vercel.app)
```

5. 点击 **Deploy**。Vercel 会自动检测到 Next.js 并且进行编译。

## 支付测试数据 (Stripe Test Mode)
在没有上线前，您可以使用 Stripe 提供的一系列测试卡进行充值购买测试，例如：
- 卡号：`4242 4242 4242 4242`
- 有效期：任何未来日期（如 `12/26`）
- CVC/安全码：任何三位数字（如 `123`）

## 开发模式注意事项
在本地开发时，如果你通过 `npm run dev` 启动，不要忘记填写 `.env.local`。对于 Webhook 调试，推荐通过 `stripe-cli` 转发到本地 3000 端口来即时响应本机的充值记录到数据库。

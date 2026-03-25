# [测试技术] 深入理解 JSON Web Token (JWT)

> 原文: https://blog.csdn.net/weixin_42390585/article/details/156855690

> *原创内容，未获授权禁止转载、转发、抄袭。
在现代 Web 开发中，身份认证（Authentication）是绕不开的话题。随着微服务架构的流行和前后端分离模式的普及，传统的基于 Session-Cookie 的认证方式逐渐显露出其局限性。
取而代之的，是 **JSON Web Token (JWT)** 。它轻量、无状态、跨语言，成为了目前最流行的跨域认证解决方案。
作为一名开发者，你可能已经在使用 JWT，但你真的理解它的内部原理吗？你知道如何安全地存储它吗？本文将带你从头到尾彻底解析 JWT。
* * *
### 1\. 为什么我们需要 JWT？
在讲“是什么”之前，先看“为什么”。
#### 传统的 Session 认证模式
在 Web 1.0 时代，我们通常这样做：
  1. 用户登录，服务器验证通过。
  2. 服务器在内存或数据库中创建一个 **Session** ，并记录用户信息。
  3. 服务器将 Session ID 返回给浏览器，写入 **Cookie** 。
  4. 之后浏览器的每次请求都会自动带上这个 Cookie。
  5. 服务器拿着 Cookie 里的 ID 去查 Session，确认用户身份。


**这种模式的问题在于：**
  * **扩展性差（Stateful）：** 服务器必须保存状态。如果你的应用做负载均衡（Load Balancer），用户第一次请求到了服务器 A，第二次请求到了服务器 B，服务器 B 没有这个 Session，用户就掉线了（除非做复杂的 Session 同步或使用 Redis 集中存储）。
  * **CORS（跨域）问题：** Cookie 在跨域场景下处理起来非常麻烦。
  * **CSRF 攻击：** 基于 Cookie 的自动发送特性，容易遭受跨站请求伪造攻击。


#### JWT 的无状态（Stateless）革命
JWT 的核心思想是：**服务器不再保存任何 Session 数据。**
服务器仅负责生成一个“令牌”（Token），这个令牌里包含了用户是谁、有什么权限、什么时候过期。服务器对这个令牌进行**签名** （防止篡改），然后发给客户端。客户端自己保存这个令牌，每次请求带上即可。
* * *
### 2\. JWT 是什么？长什么样？
根据 RFC 7519 标准，JWT 是一个紧凑的、URL 安全的字符串。它的样子通常是这样的：
    
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
    eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.
    SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
仔细观察，你会发现它由**三部分** 组成，中间用点（.）隔开：
  1. **Header（头部）**
  2. **Payload（负载）**
  3. **Signature（签名）**


也就是：Header.Payload.Signature
#### 第一部分：Header
Header 是一个 JSON 对象，描述了 JWT 的元数据，通常包含两部分：令牌类型（即 JWT）和使用的签名算法（如 HMAC SHA256 或 RSA）。
    
    {
      "alg": "HS256",
      "typ": "JWT"
    }
最后将此 JSON 进行 Base64Url 编码，就得到了第一部分。
#### 第二部分：Payload
Payload 也是一个 JSON 对象，用来存放实际需要传递的数据。这些数据被称为 **Claims（声明）** 。
RFC 标准定义了一些由系统保留的声明（建议使用，但不强制）：
  * iss (issuer): 签发人
  * exp (expiration time): 过期时间
  * sub (subject): 主题（通常是用户 ID）
  * iat (issued at): 签发时间


你也可以定义私有声明：
    
    {
      "sub": "1234567890",
      "name": "John Doe",
      "admin": true
    }
**注意：** Payload 也是经过 Base64Url 编码的，**它是明文的！** 任何人拿到 Token 都可以解码看到 Payload 的内容。**千万不要在 Payload 中存放密码等敏感信息。**
#### 第三部分：Signature
这是最关键的部分，用于验证消息在传递过程中没有被篡改。
生成公式如下：
    
    HMACSHA256(
      base64UrlEncode(header) + "." +
      base64UrlEncode(payload),
      your-256-bit-secret
    )
服务器拿到 Header 和 Payload，用同样的算法和**只有服务器知道的密钥（Secret）**再算一次签名。如果算出来的签名和 Token 里携带的签名一致，说明这个 Token 是合法的，且内容没有被修改过。
* * *
### 3\. JWT 的工作流程
  1. **用户登录** ：客户端向服务器发送用户名和密码。
  2. **生成 Token** ：服务器验证通过后，计算出 JWT（Header + Payload + Signature），返回给客户端。
  3. **存储 Token** ：客户端收到 JWT，将其存储在 LocalStorage 或 Cookie 中。
  4. **请求资源** ：客户端再次发起请求（如获取订单列表）时，通常会在 HTTP 请求头中携带 Token：
         Authorization: Bearer &lt;token&gt;
  5. **验证 Token** ：服务器拦截请求，提取 Token，验证签名是否正确、是否过期。
  6. **响应** ：验证通过，处理业务逻辑并返回数据；验证失败，返回 401 Unauthorized。


* * *
### 4\. JWT vs Session：优缺点深度对比
特性| Session 模式| JWT 模式  
---|---|---  
**状态存储**|  服务端（内存/Redis）| 客户端（自身存储）  
**扩展性**|  较差（需同步 Session）| **极佳** （天生支持分布式/微服务）  
**带宽消耗**|  小（仅传输 Session ID）| 大（Header+Payload 越大 Token 越长）  
**安全性**|  容易防御 XSS，需防 CSRF| **需防 XSS** ，天然免疫 CSRF  
**注销机制**|  容易（服务端删除 Session 即可）| **困难** （一旦签发，有效期内很难由服务端强制失效）  
* * *
### 5\. 必须掌握的 Security Best Practices（安全最佳实践）
很多 JWT 的安全漏洞并非技术本身的问题，而是使用姿势不对。作为专业开发者，以下几点必须牢记：
#### 1\. 永远使用 HTTPS
JWT 也就是一段字符串，如果在 HTTP 明文传输中被拦截，攻击者就可以冒充用户（中间人攻击）。全站 HTTPS 是标配。
#### 2\. 签名算法的选择
  * **HS256 (对称加密)** ：由于只有一个密钥（Secret），任何拥有该密钥的人都可以签发 Token。适用于单体应用。
  * **RS256 (非对称加密)** ：私钥签发，公钥验证。适用于微服务架构（认证中心发 Token，业务服务只验 Token）。


#### 3\. Token 存储位置：Cookie 还是 LocalStorage？
这是一个经典的争论。
  * **LocalStorage** :
    * 优点：使用方便，前端完全可控。
    * 缺点：容易受到 **XSS（跨站脚本攻击）** 。如果黑客注入一段 JS 代码，就能轻松读出 localStorage 里的 Token。
  * **HttpOnly Cookie** :
    * 优点：JS 无法读取，免疫 XSS 盗取 Token。
    * 缺点：容易受到 **CSRF** 攻击（需要配合 CSRF Token 防御），且跨域稍微麻烦一点。


**专家建议** ：如果安全性要求极高，建议存储在标记为 httpOnly 和 Secure 的 Cookie 中。
#### 4\. 解决“注销难”和“续期”问题
JWT 最大的痛点是：**一旦签发，无法撤回。** 如果用户修改了密码，或者管理员想封禁某个账号，旧的 Token 在过期前依然有效。
**解决方案：**
  * **黑名单机制** ：将已注销但未过期的 Token ID 存入 Redis（设置 TTL 与 Token 过期时间一致）。每次验证时查一下 Redis。虽然这牺牲了一点“无状态”的特性，但在安全和性能之间取得了平衡。
  * **双 Token 机制（Access Token + Refresh Token）** ：
    * Access Token：有效期短（如 15 分钟），用于请求资源。
    * Refresh Token：有效期长（如 7 天），专门用于换取新的 Access Token。
    * 当 Access Token 过期，前端用 Refresh Token 去换新的。如果用户注销，服务端只需把 Refresh Token 设为无效，用户手中的 Access Token 最多活 15 分钟。


* * *
### 6\. 总结
JWT 是现代 Web 应用架构（特别是前后端分离和微服务）中不可或缺的技术。
**何时使用 JWT？**
  * 微服务架构。
  * 移动端应用（App 无法像浏览器那样处理 Cookie）。
  * 不需要服务端保存过多状态的场景。


**何时不使用 JWT？**
  * 对安全性要求极高，需要极其严格的 Session 管理（如银行系统，通常还是用 Session）。
  * Token 数据量过大，导致 HTTP 请求头过重。


技术没有银弹，只有最适合的方案。希望这篇文章能帮你彻底搞懂 JWT，并在项目中优雅地使用它。

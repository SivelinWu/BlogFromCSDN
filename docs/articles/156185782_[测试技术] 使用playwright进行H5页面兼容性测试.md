# [测试技术] 使用playwright进行H5页面兼容性测试

> 原文: https://blog.csdn.net/weixin_42390585/article/details/156185782

> *原创内容，未获授权禁止转载、转发、抄袭。
结合 Playwright 和 Node.js 进行 H5 页面兼容性测试，可充分利用 Playwright 的设备模拟能力和 Node.js 的脚本自动化优势，实现跨设备、跨浏览器的高效测试。
### 一、核心优势与准备工作
#### 核心优势
  * 内置设备库：支持数百种预设设备（如 iPhone、华为、小米等），无需手动配置尺寸；
  * 多浏览器支持：可在 Chromium（Chrome）、WebKit（Safari）、Firefox 内核中测试；
  * 自动化操作：支持点击、输入等交互，结合截图功能可对比不同设备的渲染效果；
  * 并行测试：同时在多个设备上运行测试，大幅提升效率。


#### 环境搭建（Node.js + Playwright）
##### 1\. 初始化 Node.js 项目
    
    # 创建项目目录
    mkdir h5-compatibility-test && cd h5-compatibility-test
    
    # 初始化 Node.js 项目（生成 package.json）
    npm init -y
    
    # 安装 Playwright（包含浏览器驱动）
    npm install playwright
    
    # 安装浏览器（首次运行需执行）
    npx playwright install 
##### 2\. 验证环境
    
    # 检查 Playwright 版本（确保安装成功）
    npx playwright --version
    # 检查 node 版本（确保安装成功）
    node -v
### 二、核心测试场景与代码实现
#### 场景 1：多设备基础渲染测试
模拟主流手机、平板，验证 H5 页面在不同设备上的基础渲染效果（元素显示、布局结构）。
    
    // test/device-render.test.js
    const { test, expect } = require('@playwright/test');
    const fs = require('fs');
    const path = require('path');
    
    // 创建截图目录（Node.js 文件操作）
    const screenshotDir = path.join(__dirname, '../screenshots/device-render');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // 测试设备列表（Playwright 内置设备 + 自定义设备）
    const devices = [
      'iPhone 14',         // iOS 主流机型
      'Pixel 7',           // Android 主流机型
      'Samsung Galaxy S23',// 安卓热门机型
      'iPad (10th gen)',   // 平板设备
      { name: '小屏安卓', viewport: { width: 320, height: 568 } } // 自定义设备
    ];
    
    test.describe('H5 多设备基础渲染测试', () => {
      devices.forEach(device => {
        const deviceName = typeof device === 'string' ? device : device.name;
        
        test(`[${deviceName}] 验证首页核心元素渲染`, async ({ page }) => {
          // 1. 模拟设备（Node.js 动态处理设备配置）
          if (typeof device === 'string') {
            await page.emulate(device); // 内置设备（自动配置分辨率、UA等）
          } else {
            await page.setViewportSize(device.viewport); // 自定义设备尺寸
          }
    
          // 2. 访问 H5 页面
          await page.goto('https://你的H5页面地址');
    
          // 3. 验证核心元素加载（Playwright 断言）
          await expect(page.locator('#logo')).toBeVisible(); // 验证 Logo 显示
          await expect(page.locator('.nav-item')).toHaveCount(4); // 验证导航项数量
          await expect(page.locator('.btn-primary')).toBeEnabled(); // 验证按钮可用
    
          // 4. 截图保存（Node.js 路径处理）
          await page.screenshot({
            path: path.join(screenshotDir, `${deviceName}-homepage.png`),
            fullPage: true // 截取全页面（含滚动区域）
          });
        });
      });
    });
    
#### 场景 2：多浏览器兼容性测试
在 Chromium（Chrome）、WebKit（Safari）、Firefox 内核中测试，排查浏览器特异性问题（如 CSS 兼容、API 支持）。
    
    // test/browser-compatibility.test.js
    const { test, expect } = require('@playwright/test');
    
    // 配置多浏览器（在 playwright.config.js 中定义）
    // 执行时会自动在三个浏览器中运行测试
    
    test('表单提交在多浏览器中的兼容性', async ({ page, browserName }) => {
      // 统一使用 iPhone 14 尺寸测试
      await page.emulate('iPhone 14');
      await page.goto('https://你的H5页面地址/form');
    
      // 填充表单（Playwright 交互操作）
      await page.locator('#username').fill('test-user');
      await page.locator('#phone').fill('13800138000');
    
      // 提交表单
      await page.locator('#submit-btn').click();
    
      // 根据浏览器类型验证结果（处理浏览器差异）
      if (browserName === 'webkit') {
        // Safari 特有逻辑（如不同的成功提示）
        await expect(page.locator('.safari-success')).toBeVisible();
      } else {
        // 通用逻辑（Chrome/Firefox）
        await expect(page.locator('.common-success')).toBeVisible();
      }
    });
    
配置多浏览器（`playwright.config.js`）：
    
    // playwright.config.js
    const { defineConfig } = require('@playwright/test');
    
    module.exports = defineConfig({
      projects: [
        { name: 'chromium', use: { browserName: 'chromium' } }, // Chrome/Edge
        { name: 'webkit', use: { browserName: 'webkit' } },     // Safari
        { name: 'firefox', use: { browserName: 'firefox' } }    // Firefox
      ]
    });
    
#### 场景 3：响应式布局断点测试
验证 H5 在不同屏幕宽度下的响应式布局切换（如移动端 / 平板 / PC 端布局适配）
    
    // test/responsive-layout.test.js
    const { test, expect } = require('@playwright/test');
    
    // 响应式断点（px）
    const breakpoints = [
      { name: '移动端', width: 360 },   // <576px
      { name: '平板竖屏', width: 768 }, // 576px-992px
      { name: 'PC端', width: 1200 }     // >992px
    ];
    
    test.describe('H5 响应式布局断点测试', () => {
      breakpoints.forEach(({ name, width }) => {
        test(`[${name}] 验证布局适配`, async ({ page }) => {
          // 设置屏幕宽度（Node.js 动态传入参数）
          await page.setViewportSize({ width, height: 1000 });
          await page.goto('https://你的H5页面地址');
    
          // 验证布局差异（根据屏幕宽度判断）
          if (width < 576) {
            // 移动端：汉堡菜单显示，隐藏完整导航
            await expect(page.locator('#hamburger-menu')).toBeVisible();
            await expect(page.locator('#desktop-nav')).toBeHidden();
          } else {
            // 平板/PC端：显示完整导航
            await expect(page.locator('#desktop-nav')).toBeVisible();
          }
    
          // 验证栅格布局列数（响应式核心）
          const gridColumns = await page.locator('.grid-container').evaluate(el => {
            return getComputedStyle(el).gridTemplateColumns; // 获取 CSS 计算值
          });
          console.log(`[${name}] 栅格列数:`, gridColumns); // 输出如 "repeat(3, 1fr)"
        });
      });
    });
    
#### 场景 4：交互场景兼容性测试
验证点击、滚动、输入等交互在不同设备上的表现（如按钮状态变化、弹窗显示）
    
    // test/interaction.test.js
    const { test, expect } = require('@playwright/test');
    
    // 测试设备（覆盖不同触控尺寸）
    const devices = [
      { name: '大屏手机', device: 'iPhone 14 Plus' },
      { name: '小屏手机', device: 'Samsung Galaxy S10' }
    ];
    
    test.describe('H5 交互场景兼容性', () => {
      devices.forEach(({ name, device }) => {
        test(`[${name}] 验证商品列表交互`, async ({ page }) => {
          await page.emulate(device);
          await page.goto('https://你的H5页面地址/products');
    
          // 1. 滚动加载更多商品（模拟用户浏览）
          await page.mouse.wheel(0, 1000); // 向下滚动
          await page.waitForSelector('.product-item:nth-child(15)'); // 等待加载
    
          // 2. 点击商品卡片，验证弹窗显示
          await page.locator('.product-item').first().click();
          await expect(page.locator('#detail-modal')).toBeVisible();
    
          // 3. 点击"加入购物车"，验证按钮状态变化
          const addBtn = page.locator('#add-to-cart');
          await addBtn.click();
          await expect(addBtn).toHaveText('已加入'); // 验证按钮文字变化
        });
      });
    });
    
### 三、执行测试与结果分析
#### 1\. 运行测试（Node.js 命令）
    
    # 执行指定测试文件
    node device-compatibility-test.js
    
#### 2.结果输出
截图：保存在 `screenshots` 目录，可直观对比不同设备 / 浏览器的渲染差异；
报告：包含测试用例执行状态、耗时、失败原因（如元素未找到、断言不通过）；
控制台日志：输出响应式布局信息、交互状态等，辅助分析兼容性问题。
#### 四、Node.js 辅助工具提升效率
#### 1\. 用 Node.js 管理测试配置
将设备列表、测试地址等配置抽离为单独的 JSON 文件，通过 Node.js 动态加载：
    
    // config/test-config.json
    {
      "h5Url": "https://你的H5页面地址",
      "devices": ["iPhone 14", "Pixel 7", "iPad (10th gen)"]
    }
    
    // 在测试脚本中加载
    const config = require('../config/test-config.json');
    test.describe('动态配置测试', () => {
      config.devices.forEach(device => {
        test(`测试设备：${device}`, async ({ page }) => {
          await page.emulate(device);
          await page.goto(config.h5Url);
          // ...测试逻辑
        });
      });
    });
    
#### 2\. 用 Node.js 生成测试报告
通过 Node.js 读取 Playwright 测试结果，生成自定义报告（如 CSV/Excel）：
    
    // scripts/generate-report.js
    const fs = require('fs');
    const { parse } = require('json2csv'); // 需安装：npm install json2csv
    
    // 读取 Playwright 测试结果
    const results = require('../test-results/results.json');
    
    // 提取关键信息
    const reportData = results.tests.map(test => ({
      用例名称: test.title,
      设备/浏览器: test.project.name,
      状态: test.status,
      耗时: `${test.duration}ms`
    }));
    
    // 生成 CSV 报告
    const csv = parse(reportData);
    fs.writeFileSync('compatibility-report.csv', csv);
    console.log('报告生成完成：compatibility-report.csv');
    
node scripts/generate-report.js
![](/cdn/156185782/319f9f031ec7455db61e4b5c2fc77592.png)

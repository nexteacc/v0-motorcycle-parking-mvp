# PWA 支持说明

本项目已支持 PWA（Progressive Web App），用户可以将应用安装到设备主屏幕，获得类似原生应用的体验。

## 功能特性

### ✅ 已实现的功能

1. **应用清单（Manifest）**
   - 定义了应用名称、图标、主题色等
   - 支持添加到主屏幕
   - 支持快捷方式（入场登记、出场登记）

2. **Service Worker**
   - 离线缓存支持
   - 静态资源缓存
   - API 请求网络优先策略
   - 自动更新机制

3. **安装提示**
   - 自动检测是否可安装
   - 友好的安装提示界面
   - 支持延迟安装（24 小时内不再提示）

4. **移动端优化**
   - iOS Safari 支持
   - Android Chrome 支持
   - 全屏显示
   - 状态栏样式配置

## 文件结构

```
public/
  ├── manifest.json          # PWA 应用清单
  ├── sw.js                  # Service Worker
  └── icon-*.png            # 应用图标

components/
  ├── pwa-installer.tsx      # 安装提示组件
  └── service-worker-registration.tsx  # Service Worker 注册

app/
  └── layout.tsx            # 包含 PWA 元数据
```

## 使用方法

### 开发环境测试

1. **启动开发服务器**
   ```bash
   pnpm dev
   ```

2. **使用 HTTPS**
   - Service Worker 需要 HTTPS 环境（localhost 除外）
   - 开发环境可以使用 `localhost`
   - 生产环境必须使用 HTTPS

3. **测试安装**
   - Chrome/Edge: 地址栏会出现安装图标
   - 移动端: 浏览器菜单中会出现"添加到主屏幕"选项

### 生产环境部署

1. **确保 HTTPS**
   - PWA 功能需要 HTTPS 才能正常工作
   - 确保所有资源都通过 HTTPS 提供

2. **验证清单文件**
   - 访问 `https://your-domain.com/manifest.json` 确认可访问
   - 使用 [PWA Builder](https://www.pwabuilder.com/) 验证

3. **测试 Service Worker**
   - 打开浏览器开发者工具
   - 在 Application/应用程序标签页查看 Service Worker 状态
   - 测试离线功能

## 浏览器支持

| 浏览器 | 支持情况 | 说明 |
|--------|---------|------|
| Chrome (Android) | ✅ 完全支持 | 推荐 |
| Chrome (Desktop) | ✅ 完全支持 | 推荐 |
| Edge | ✅ 完全支持 | 推荐 |
| Safari (iOS) | ✅ 基本支持 | 支持添加到主屏幕，Service Worker 支持有限 |
| Safari (macOS) | ⚠️ 部分支持 | 不支持 Service Worker |
| Firefox | ✅ 完全支持 | 推荐 |

## 自定义配置

### 修改应用信息

编辑 `public/manifest.json`:

```json
{
  "name": "您的应用名称",
  "short_name": "简短名称",
  "theme_color": "#您的主题色",
  "background_color": "#您的背景色"
}
```

### 修改缓存策略

编辑 `public/sw.js` 中的缓存配置：

```javascript
const CACHE_NAME = 'motorcycle-parking-v1'  // 修改版本号以强制更新
const STATIC_ASSETS = [...]  // 添加需要缓存的静态资源
```

### 自定义安装提示

编辑 `components/pwa-installer.tsx` 来自定义提示样式和行为。

## 调试技巧

### 1. 检查 Service Worker 状态

```javascript
// 在浏览器控制台运行
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations)
})
```

### 2. 清除缓存

```javascript
// 清除所有缓存
caches.keys().then(names => {
  names.forEach(name => caches.delete(name))
})
```

### 3. 强制更新 Service Worker

修改 `sw.js` 中的 `CACHE_NAME` 版本号，浏览器会自动检测并更新。

### 4. 测试离线功能

1. 打开浏览器开发者工具
2. 进入 Network/网络标签页
3. 选择 "Offline/离线" 模式
4. 刷新页面测试离线访问

## 常见问题

### Q: Service Worker 没有注册？

**A:** 检查以下几点：
- 确保使用 HTTPS（localhost 除外）
- 检查 `sw.js` 文件路径是否正确
- 查看浏览器控制台是否有错误

### Q: 安装提示没有显示？

**A:** 可能的原因：
- 应用已经安装
- 浏览器不支持 PWA
- 用户之前关闭了提示（24 小时内不再显示）

### Q: 缓存没有更新？

**A:** 
- 修改 `sw.js` 中的 `CACHE_NAME` 版本号
- 在浏览器中清除 Service Worker 注册
- 硬刷新页面（Ctrl+Shift+R）

### Q: iOS Safari 不支持 Service Worker？

**A:** iOS 15+ 已支持 Service Worker，但功能有限。确保使用最新版本的 iOS。

## 性能优化建议

1. **图标优化**
   - 提供多种尺寸的图标（建议：192x192, 512x512）
   - 使用 WebP 或优化的 PNG 格式

2. **缓存策略**
   - 静态资源：缓存优先
   - API 请求：网络优先
   - 图片：根据使用频率调整缓存策略

3. **更新策略**
   - 定期更新 Service Worker 版本号
   - 实现后台更新机制
   - 提示用户刷新以获取新版本

## 参考资源

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev: PWA](https://web.dev/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/)

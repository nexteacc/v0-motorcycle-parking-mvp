# Check In 和 Check Out 功能总结

## Check In (Entry) 页面功能

### 页面路径
`/entry`

### 核心功能
车辆入场登记，创建新的停车记录

---

### 1. 照片采集功能

#### 方式一：系统相机拍照
- **功能**：直接调用系统相机 App（iOS/Android）
- **实现**：`capture="environment"` 属性
- **按钮**：Camera
- **特点**：
  - iOS 直接打开系统相机
  - Android 直接打开系统相机
  - 拍照后自动返回应用

#### 方式二：相册选择
- **功能**：从相册选择已有图片
- **按钮**：Upload
- **支持格式**：JPG / PNG

#### 方式三：手动输入
- **功能**：不拍照，直接手动输入车牌号
- **按钮**：Manual

---

### 2. OCR 识别功能

#### 自动识别
- **触发**：拍照或上传图片后自动触发
- **API**：`/api/ocr`（使用 OpenAI GPT-4o-mini）
- **识别内容**：
  - 车牌号（plate_number）
  - 识别置信度（confidence）
  - 车辆颜色（vehicle_color）

#### 识别结果
- 自动填充到车牌输入框
- 显示识别置信度百分比
- 识别失败时显示错误提示

---

### 3. 车牌号处理

#### 输入方式
- OCR 自动识别（推荐）
- 手动输入（支持多国车牌格式）

#### 重复检测
- **功能**：检查车牌号是否已存在活跃记录
- **缓存机制**：LRU 缓存，5 分钟 TTL
- **匹配方式**：
  - 精确匹配（保留原始格式）
  - 大小写不敏感匹配
- **处理**：发现重复时弹出确认对话框

#### 车牌修改标记
- 如果 OCR 识别结果与最终输入不一致，标记为已修改
- 保存原始识别结果到 `original_plate_number`

---

### 4. 照片上传

#### 上传流程
1. 图片压缩（最大宽度 1024px，质量 0.6）
2. 上传到 Supabase Storage（`parking-photos` bucket）
3. 获取 publicUrl
4. 保存到数据库 `photo_url` 字段

#### 文件命名
- 格式：`entry_{timestamp}_{plateNumber}.jpg`
- 示例：`entry_1704067200000_ABC1234.jpg`

---

### 5. 记录创建

#### 创建的数据
```typescript
{
  plate_number: string,           // 车牌号
  photo_url: string | null,       // 照片 URL
  vehicle_color: string | null,    // 车辆颜色
  status: "active" | "abnormal",  // 状态
  device_id: string,              // 设备 ID
  parking_lot_id: "default",      // 停车场 ID
  plate_modified: boolean,        // 是否修改过车牌
  original_plate_number: string | null  // 原始识别结果
}
```

#### 状态说明
- **active**：正常入场
- **abnormal**：强制创建（重复车牌但选择继续）

---

### 6. 页面状态流程

```
idle（初始状态）
  ↓
拍照/上传/手动输入
  ↓
processing（OCR 识别中）
  ↓
result（显示识别结果）
  ↓
确认创建
  ↓
success（创建成功）
```

---

### 7. 特殊功能

#### 重复车牌处理
- 检测到重复时弹出对话框
- 选项：
  - **Cancel**：取消创建
  - **Mark Abnormal & Re-enter**：标记原记录为异常，创建新记录

#### 异常记录
- 当强制创建重复车牌时，新记录状态为 `abnormal`
- 原记录也会被标记为 `abnormal`

---

## Check Out (Exit) 页面功能

### 页面路径
`/exit`

### 核心功能
车辆出场登记，更新停车记录状态

---

### 1. 选择出场方式

#### 方式一：Scan QR Code（扫码）
- **功能**：扫描车辆 QR 码
- **实现**：使用 `CameraCapture` 组件
- **支持**：
  - 系统相机（iOS/Android）
  - WebRTC 实时扫描（桌面/Android）
- **流程**：
  1. 拍照或实时扫描
  2. 识别 QR 码
  3. 解析 ticket ID
  4. 查找对应记录

#### 方式二：Upload（上传）
- **功能**：从相册选择 QR 码图片
- **实现**：文件选择 + jsQR 识别
- **说明**：仅支持相册选择，不支持直接拍照

#### 方式三：Search（搜索）
- **功能**：通过车牌号搜索
- **实现**：防抖搜索（400ms）
- **搜索范围**：仅搜索 `active` 状态的记录
- **显示**：车牌号 + 入场时间 + 停车时长

---

### 2. QR 码识别

#### QR 码格式
```json
{
  "id": 123  // ticket ID
}
```

#### 识别流程
1. 拍照/上传图片
2. 使用 jsQR 库识别
3. 解析 JSON 数据
4. 获取 ticket ID
5. 查询数据库

#### 错误处理
- QR 码格式错误
- QR 码未识别
- 记录未找到

---

### 3. 记录确认

#### 显示信息
- 车辆照片（如有）
- 车牌号（大号等宽字体）
- 入场时间
- 停车时长
- 状态提示（如已出场）

#### 操作按钮
- **Cancel**：取消，返回选择方式
- **Confirm Exit**：确认出场

---

### 4. 出场处理

#### 更新数据
```typescript
{
  status: "exited",
  exit_time: new Date().toISOString()
}
```

#### 操作日志
- 记录操作类型：`exit`
- 记录旧值和新值
- 记录设备 ID

---

### 5. 成功页面

#### 显示内容
- 成功图标
- 车牌号
- 出场时间
- 停车总时长

#### 操作选项
- **Undo Exit**：撤销出场（如果允许）
- **Continue**：继续处理下一个

---

### 6. 撤销功能（Undo）

#### 撤销条件
- 该车牌号在出场后没有新的入场记录
- 如果已有新入场记录，则不允许撤销

#### 撤销操作
- 恢复状态为 `active`
- 清空 `exit_time`
- 记录操作日志（`undo_exit`）

---

### 7. 页面状态流程

```
select（选择方式）
  ↓
qr-scan / upload-scan / search
  ↓
confirm（确认出场）
  ↓
success（出场成功）
  ↓
（可选）undo（撤销）
```

---

## 功能对比表

| 功能 | Check In | Check Out |
|------|----------|-----------|
| **照片采集** | | |
| 系统相机 | ✅ | ✅（仅扫码） |
| 相册选择 | ✅ | ✅（Upload） |
| 手动输入 | ✅ | ❌ |
| **识别功能** | | |
| OCR 识别 | ✅（车牌号） | ❌ |
| QR 码识别 | ❌ | ✅ |
| **搜索功能** | ❌ | ✅（车牌号搜索） |
| **重复检测** | ✅ | ❌ |
| **照片上传** | ✅ | ❌ |
| **状态管理** | active/abnormal | active → exited |
| **撤销功能** | ❌ | ✅（Undo Exit） |

---

## 技术实现

### Check In 页面

#### 使用的组件
- `CameraCapture`：照片采集（系统相机 + WebRTC）
- 自定义 OCR API：车牌识别

#### 使用的库
- OpenAI API（GPT-4o-mini）：OCR 识别
- Supabase Storage：照片存储
- Supabase Database：数据存储

#### 缓存机制
- 车牌重复检测：LRU 缓存，5 分钟 TTL

---

### Check Out 页面

#### 使用的组件
- `CameraCapture`：QR 码扫描（系统相机 + WebRTC）
- 文件上传：相册选择

#### 使用的库
- jsQR：QR 码识别
- Supabase Database：数据查询和更新

#### 防抖机制
- 搜索防抖：400ms 延迟

---

## 数据流程

### Check In 流程
```
用户拍照/上传
  ↓
OCR 识别（OpenAI API）
  ↓
显示识别结果
  ↓
用户确认/修改车牌号
  ↓
检查重复
  ↓
压缩图片
  ↓
上传到 Supabase Storage
  ↓
创建数据库记录
  ↓
显示成功页面
```

### Check Out 流程
```
选择方式（扫码/上传/搜索）
  ↓
识别 QR 码或搜索记录
  ↓
显示确认页面
  ↓
用户确认出场
  ↓
更新数据库（status + exit_time）
  ↓
记录操作日志
  ↓
显示成功页面
  ↓
（可选）撤销出场
```

---

## 用户体验特性

### Check In
- ✅ 支持系统相机，iOS 体验好
- ✅ OCR 自动识别，减少手动输入
- ✅ 重复检测，防止误操作
- ✅ 图片自动压缩，节省存储

### Check Out
- ✅ 多种出场方式，灵活选择
- ✅ 系统相机支持，扫码方便
- ✅ 搜索功能，快速查找
- ✅ 撤销功能，容错性强
- ✅ 防抖搜索，性能优化

---

## 总结

### Check In 核心价值
- **快速登记**：拍照 + OCR 自动识别
- **准确记录**：重复检测 + 照片存储
- **灵活输入**：支持多种车牌格式

### Check Out 核心价值
- **多种方式**：扫码/上传/搜索
- **快速出场**：QR 码一键识别
- **容错机制**：撤销功能 + 搜索备选

### 共同特点
- ✅ 支持系统相机（iOS/Android）
- ✅ 照片存储到 Supabase
- ✅ 操作日志记录
- ✅ 设备 ID 追踪
- ✅ 错误处理完善

# 🐾 PawType

轻量级 **Windows & macOS** 透明置顶桌面打字猫咪伴侣。基于 Tauri v2（Rust 全局原生钩子 + HTML5 Canvas 2D），开箱自带多款猫咪皮肤，并内置 MCP，可用 AI 定制更多猫咪。

> 本项目基于 [qianyiai/kurocat](https://github.com/qianyiai/kurocat)（MIT）衍生开发，保留原作者版权声明，详见 [LICENSE](LICENSE)。

## 📥 下载

最新版 **[v0.2.1](https://github.com/XiaobenkangDD/pawtype/releases/tag/v0.2.1)**：

- Windows 安装包：[`PawType-0.2.1-x64-setup.exe`](https://github.com/XiaobenkangDD/pawtype/releases/download/v0.2.1/PawType-0.2.1-x64-setup.exe)
- Windows 绿色版：[`PawType-v0.2.1-windows-x64.exe`](https://github.com/XiaobenkangDD/pawtype/releases/download/v0.2.1/PawType-v0.2.1-windows-x64.exe)
- macOS Universal：[`PawType-v0.2.1-macos-universal.dmg`](https://github.com/XiaobenkangDD/pawtype/releases/download/v0.2.1/PawType-v0.2.1-macos-universal.dmg)

更多文件见 [Releases](https://github.com/XiaobenkangDD/pawtype/releases)。

## 🍎 macOS 权限说明（重要）

正式版为未公证安装包。首次使用以及**每次覆盖更新后**，请确认：

1. **系统设置 → 隐私与安全性 → 输入监控**：添加并打开 `PawType`
2. **系统设置 → 隐私与安全性 → 辅助功能**：添加并打开 `PawType`
3. 若开关已开但仍无反应：在列表中选中 `PawType` 点左下角 **-** 删除，再 **+** 重新添加，然后完全退出并重启 App
4. 打不开时执行：`xattr -cr /Applications/PawType.app`
5. 菜单栏托盘可点 **「查看键盘监听与权限诊断」** 确认是否生效

## ✨ 核心特性

- **多款内置猫咪外观**，右键或托盘一键切换；支持 MCP 自定义皮肤热更新
- **65% / 108 键**键盘布局，以及「面向猫咪 / 面向观众」方向切换
- 鼠标左 / 右 / 中键独立反馈；摸头眯眼 + 可选呼噜声
- 透明区域智能点击穿透；缩放 20%–150%
- App 内检查更新（对接本仓库 Releases）
- 免费猫种扩展：银渐层、英短蓝猫
- 赞助按「皮肤包」解锁：打工包 / 学霸包 / 夜猫包 / 节日包（可分开解锁）
- 节日与考试档：春节猫（1–2 月限时免费）、高考猫（6/1–6/15 限时免费）
- macOS 更新后强制权限复检；白话诊断（输入监控 / 辅助功能 / 钩子状态）+ 一键复制修复命令

## 🤖 MCP 接入

运行 PawType 后，右键猫咪 → 勾选「开启 MCP 扩展」→「复制 MCP 配置」。

**Stdio：**

```json
{
  "mcpServers": {
    "pawtype": {
      "command": "/path/to/PawType",
      "args": ["--mcp"]
    }
  }
}
```

**本机 HTTP（桌宠运行时）：** `http://127.0.0.1:27420/mcp`

自定义猫咪配置目录：

- **Windows**：`%APPDATA%\pawtype\cats.json`
- **macOS**：`~/Library/Application Support/pawtype/cats.json`

## 🛠️ 本地构建

前置：Windows 10/11 或 macOS 11+、Node.js 18+、Rust（`cargo`）。

```bash
git clone https://github.com/XiaobenkangDD/pawtype.git
cd pawtype
npm install
npm run tauri:dev      # 调试
npm run tauri:build    # 发布包
```

## 📄 开源协议

[MIT License](LICENSE) — 包含原 KuroCat 贡献者与 PawType 贡献者版权声明。

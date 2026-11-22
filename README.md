# 🐾 PawType

轻量级 **Windows & macOS** 透明置顶桌面打字猫咪伴侣。基于 Tauri v2（Rust 全局原生钩子 + HTML5 Canvas 2D），开箱自带多款猫咪皮肤，并内置 MCP，可用 AI 定制更多猫咪。

> 本项目基于 [qianyiai/kurocat](https://github.com/qianyiai/kurocat)（MIT）衍生开发，保留原作者版权声明，详见 [LICENSE](LICENSE)。

## 📥 下载

前往 [Releases](https://github.com/XiaobenkangDD/pawtype/releases) 下载最新安装包（Windows 安装版 / 绿色版，macOS universal `.dmg`）。

## ✨ 核心特性

- **多款内置猫咪外观**，右键或托盘一键切换；支持 MCP 自定义皮肤热更新
- **65% / 108 键**键盘布局，以及「面向猫咪 / 面向观众」方向切换
- 鼠标左 / 右 / 中键独立反馈；摸头眯眼 + 可选呼噜声
- 透明区域智能点击穿透；缩放 20%–150%
- App 内检查更新（对接本仓库 Releases）

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

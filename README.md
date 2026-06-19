# Air Guitar

基于 [agneya-1402/AirGuitar](https://github.com/agneya-1402/AirGuitar) 制作的空气吉他。左手伸出的手指数选择和弦，右手快速上下移动触发扫弦，声音来自 `sounds/` 里的 MP3 文件。

这个版本保留了原始 Python 玩法，并新增了一个更容易直接运行的浏览器版。

## Browser Version

浏览器版使用 MediaPipe Tasks Vision、摄像头和 Web Audio，不需要安装 Python 的 MediaPipe 包。

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000/web/
```

点击 `Start Camera`，允许摄像头权限即可开始。

## Python Version

建议使用 Python 3.10 或 3.11，因为 MediaPipe 的 Python wheel 通常不支持最新 Python 版本。

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

按 `q` 退出 OpenCV 窗口。

## Controls

- 左手：伸出 0 到 5 根手指，对应 6 个和弦采样。
- 右手：快速竖向移动，触发当前和弦播放。
- 浏览器版右侧和弦按钮也可以直接点击试听。

## Chord Files

默认映射：

| Fingers | Chord | File |
| --- | --- | --- |
| 0 | C | `sounds/1.mp3` |
| 1 | D | `sounds/2.mp3` |
| 2 | Em | `sounds/EM.mp3` |
| 3 | G | `sounds/GM.mp3` |
| 4 | Am | `sounds/3.mp3` |
| 5 | F | `sounds/4.mp3` |

你可以替换这些 MP3 文件来换成自己的吉他音色。

## Credits

Original project: [agneya-1402/AirGuitar](https://github.com/agneya-1402/AirGuitar), MIT License.

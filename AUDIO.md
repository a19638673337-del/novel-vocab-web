# 内置发音

2026-10-31 发音兼容修复。原先仅同步读取一次浏览器语音列表，无法在未提供英语语音服务的浏览器中发音。现在改为随网页托管的普通 MP3，不在用户点击时请求生成接口。

- 5 个词：proposal、signature、executive、subordinate、preliminary。
- 10 个文件：各词 en-GB、en-US，存放于 `dist/assets/audio/`。
- 合成语音：en-GB-SoniaNeural 与 en-US-JennyNeural；生成前从服务目录验证音色可用。
- 工具：edge-tts 7.3.1；生成速率 -10%；转码为单声道 24kHz、64kbps MP3。
- subordinate 以“She is my subordinate.”的名词语境生成，通过服务返回的词边界截出目标词，避免套用动词词条发音。未使用 Wiktionary 的动词录音。
- 生成脚本：`scripts/generate-pronunciations.py`。仅构建时需要 edge-tts、imageio-ffmpeg，线上网页无这些依赖。
- 每个最终文件已实际解码检查；具体检查与限制见 QA.md。

实现参考：[edge-tts 官方项目](https://github.com/rany2/edge-tts)。这些文件是合成发音，不标为真人词典录音。

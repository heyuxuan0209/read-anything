#!/usr/bin/env python3
"""本地 ASR 转写（可选增强，依赖 faster-whisper：pip install faster-whisper）。

把音频转成带时间戳的文本，输出 JSON 到 stdout。
- 模型默认 small（~460MB，首次运行自动下载到 ~/.cache/huggingface）；
  中文质量不满意可用 WHISPER_MODEL=medium 覆盖（~1.5GB，速度约慢 2-3 倍）
- --max-seconds 截断：长音频只转前 N 秒（前段足够支撑解读，等待时间可控；
  small 模型 CPU int8 实测约 3.2 倍速实时，15 分钟音频约等 5 分钟）
- 依赖 PyAV 解码，m4a/webm/mp3 直接喂，无需 ffmpeg
- 零 API 费、音频不出本机

用法: python3 transcribe.py <audio_file> [--max-seconds 900]
"""
import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", help="音频文件路径（m4a/webm/mp3/wav）")
    parser.add_argument("--max-seconds", type=int, default=900)
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        json.dump({"error": "未安装 faster-whisper（pip install faster-whisper）"},
                  sys.stdout, ensure_ascii=False)
        sys.exit(1)

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        args.audio,
        vad_filter=True,  # 跳过静音段，片头/BGM 场景显著提速
        # 引导中文输出简体（whisper 对中文默认时常吐繁体）+ 标点；对英文音频无副作用
        initial_prompt="以下是简体中文普通话的内容，使用规范的标点符号。",
    )

    texts = []
    seg_list = []
    for seg in segments:
        if seg.start > args.max_seconds:
            break
        texts.append(seg.text.strip())
        seg_list.append({"start": round(seg.start, 1), "text": seg.text.strip()})

    json.dump(
        {
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 1),
            "truncated": info.duration > args.max_seconds,
            "text": " ".join(texts),
            "segments": seg_list,
        },
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()

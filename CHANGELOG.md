# Changelog

## [0.1.0] - 2026-04-27 - Initial release

### Added
- CLI: `notify`, `preview`, `health` 三个命令
- Mustache-lite 模板渲染引擎
- 飞书推送（通过 `openclaw message send`）
- 事件归档（推送成功后自动 mv 到 `events/processed/`）
- 默认日报模板 `templates/daily-report.tmpl`
- `scripts/setup.sh` 一键安装
- 完整测试覆盖（render 模块）

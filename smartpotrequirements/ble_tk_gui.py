#!/usr/bin/env python3

from __future__ import annotations

import asyncio
import platform
import re
import struct
import threading
import time
import tkinter as tk
from concurrent.futures import Future
from dataclasses import dataclass
from datetime import datetime
from tkinter import messagebox, ttk

try:
    from bleak import BleakClient, BleakScanner
except ImportError:  # pragma: no cover - dependency is optional at import time
    BleakClient = None
    BleakScanner = None

try:
    from history_chart import HistoryChart, HistoryPoint
except ImportError:  # pragma: no cover - optional chart module / matplotlib
    HistoryChart = None
    HistoryPoint = None  # type: ignore[misc, assignment]


SERVICE_UUID = "6f3f0000-4f52-4f54-9a4f-000000000001"
LIGHT_UUID = "6f3f0001-4f52-4f54-9a4f-000000000001"
LIGHT_SENSOR_UUID = "6f3f0002-4f52-4f54-9a4f-000000000001"
PUMP_UUID = "6f3f0003-4f52-4f54-9a4f-000000000001"
SOIL_MOISTURE_UUID = "6f3f0004-4f52-4f54-9a4f-000000000001"
SOIL_EC_UUID = "6f3f0005-4f52-4f54-9a4f-000000000001"
SOIL_TEMPERATURE_UUID = "6f3f0006-4f52-4f54-9a4f-000000000001"
LIGHT_RGB_UUID = "6f3f0007-4f52-4f54-9a4f-000000000001"
PLANT_CONFIG_UUID = "6f3f0008-4f52-4f54-9a4f-000000000001"
SENSOR_HISTORY_UUID = "6f3f0009-4f52-4f54-9a4f-000000000001"
TIME_UUID = "6f3f000a-4f52-4f54-9a4f-000000000001"

POLL_INTERVAL_MS = 2000
SCAN_TIMEOUT_SECONDS = 5.0
CONNECT_TIMEOUT_SECONDS = 20.0
DEVICE_NAME_PREFIX = "SmartPot"
CONFIG_HOLD_SECONDS = 4.0
WRITE_REFRESH_DELAY_MS = 800

COLOR_BG = "#eef3ef"
COLOR_CARD = "#ffffff"
COLOR_BORDER = "#d0dbd3"
COLOR_TEXT = "#1f2a24"
COLOR_MUTED = "#5f6f66"
COLOR_ACCENT = "#2f6f4e"
COLOR_CONNECTED = "#1b7f3a"
COLOR_DISCONNECTED = "#c0392b"
COLOR_AUTO = "#1f6feb"
COLOR_MANUAL = "#6b7280"
COLOR_DANGER = "#b42318"
COLOR_DANGER_BG = "#fde8e6"
COLOR_PANEL = "#f7faf7"


@dataclass
class DeviceEntry:
    name: str
    address: str

    @property
    def label(self) -> str:
        if self.name:
            return f"{self.name} [{self.address}]"
        return self.address


@dataclass
class PlantConfigView:
    auto_mode: int | None = None
    auto_water: int | None = None
    auto_light: int | None = None
    auto_light_lux: int | None = None
    low: float | None = None
    high: float | None = None
    duration: int | None = None
    interval: int | None = None
    light_duration: int | None = None
    light_interval: int | None = None
    lux_on: int | None = None
    lux_off: int | None = None
    auto_care_window: int | None = None
    care_start: str | None = None
    care_end: str | None = None
    raw: str = ""

    @property
    def work_mode_label(self) -> str:
        if self.auto_mode is None:
            return "-"
        return "AUTO" if self.auto_mode else "MANUAL"


def parse_hhmm_token(value: str) -> str | None:
    """Parse HH:MM into normalized HH:MM, or None if invalid."""
    text = value.strip()
    match = re.fullmatch(r"([0-9]{1,2}):([0-9]{2})", text)
    if match is None:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}"


def parse_duration_token(value: str) -> int | None:
    """Parse seconds or Nh/Nm/Ns forms used by firmware (e.g. 1h, 2h, 30m)."""
    text = value.strip().lower()
    if not text:
        return None
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)\s*([hms]?)", text)
    if match is None:
        return None
    number = float(match.group(1))
    unit = match.group(2) or "s"
    mult = {"s": 1.0, "m": 60.0, "h": 3600.0}[unit]
    seconds = int(number * mult + 0.5)
    if seconds < 0 or seconds > 65535:
        return None
    return seconds


def parse_plant_config(raw: str) -> PlantConfigView:
    """Parse firmware form including le/lon/loff lux closed-loop fields."""
    view = PlantConfigView(raw=raw.strip())
    if not view.raw or view.raw == "unavailable" or view.raw.startswith("ERR:"):
        return view

    for part in re.split(r"[,;\n]", view.raw):
        item = part.strip()
        if not item or "=" not in item:
            continue
        key, value = item.split("=", 1)
        key = key.strip().lower().replace("_", "")
        value = value.strip()
        try:
            if key in ("am", "automode"):
                view.auto_mode = 1 if value in ("1", "true", "on") else 0
            elif key in ("aw", "autowater"):
                view.auto_water = 1 if value in ("1", "true", "on") else 0
            elif key in ("al", "autolight"):
                view.auto_light = 1 if value in ("1", "true", "on") else 0
            elif key in ("le", "autolightlux"):
                view.auto_light_lux = 1 if value in ("1", "true", "on") else 0
            elif key in ("l", "low", "waterlow"):
                view.low = float(value)
            elif key in ("h", "high", "waterhigh"):
                view.high = float(value)
            elif key in ("d", "duration", "waterduration"):
                parsed = parse_duration_token(value)
                if parsed is not None:
                    view.duration = parsed
            elif key in ("i", "interval", "waterinterval"):
                parsed = parse_duration_token(value)
                if parsed is not None:
                    view.interval = parsed
            elif key in ("ld", "lightduration"):
                parsed = parse_duration_token(value)
                if parsed is not None:
                    view.light_duration = parsed
            elif key in ("li", "lightinterval"):
                parsed = parse_duration_token(value)
                if parsed is not None:
                    view.light_interval = parsed
            elif key in ("lon", "luxon", "lightluxon"):
                view.lux_on = int(float(value))
            elif key in ("loff", "luxoff", "lightluxoff"):
                view.lux_off = int(float(value))
            elif key in ("ace", "autocarewindow"):
                view.auto_care_window = 1 if value in ("1", "true", "on") else 0
            elif key in ("cs", "carestart"):
                parsed = parse_hhmm_token(value)
                if parsed is not None:
                    view.care_start = parsed
            elif key in ("ce", "careend"):
                parsed = parse_hhmm_token(value)
                if parsed is not None:
                    view.care_end = parsed
        except ValueError:
            continue
    return view


def _is_connection_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    markers = (
        "not connected",
        "disconnected",
        "connection",
        "not found",
        "timed out",
        "timeout",
        "no such device",
        "device unreachable",
        "org.bluez.error",
    )
    return any(marker in text for marker in markers)


def _parse_history_chunk_payload(raw: str) -> tuple[list[str], dict[str, int]]:
    """Parse one paged history chunk.

    Device shape:
      c=<chunk>;t=<total>;n=<count>;more=<0|1>;<timestamp>:<soil>:<temp>:<lux>;...
    or: end
    """
    meta: dict[str, int] = {}
    records: list[str] = []
    text = (raw or "").strip()
    if not text or text == "end":
        return records, meta

    for part in text.split(";"):
        item = part.strip()
        if not item:
            continue
        lower = item.lower()
        if lower.startswith("c=") and ":" not in item:
            try:
                meta["chunk"] = int(item.split("=", 1)[1])
            except ValueError:
                pass
            continue
        if lower.startswith("t=") and ":" not in item:
            try:
                meta["total"] = int(item.split("=", 1)[1])
            except ValueError:
                pass
            continue
        if lower.startswith("n=") and ":" not in item:
            try:
                meta["n"] = int(item.split("=", 1)[1])
            except ValueError:
                pass
            continue
        if lower.startswith("more=") and ":" not in item:
            try:
                meta["more"] = int(item.split("=", 1)[1])
            except ValueError:
                pass
            continue
        fields = item.split(":")
        if len(fields) == 4:
            records.append(item)
    return records, meta


@dataclass
class HistoryRecord:
    timestamp: int
    soil: float
    temperature: float
    lux: float


def format_history_time_label(timestamp: int) -> str:
    """Unix hour-start → local HH:00. timestamp==0 means time not synced."""
    if timestamp == 0:
        return "--"
    local = datetime.fromtimestamp(timestamp)
    return f"{local.hour:02d}:00"


def parse_sensor_history_records(raw: str) -> list[HistoryRecord]:
    """Parse merged history payload: n=<count>;<timestamp>:<soil>:<temp>:<lux>;..."""
    text = (raw or "").strip()
    if not text or text == "unavailable" or text.startswith("ERR:") or text == "end":
        return []

    payload = text
    if text.lower().startswith("n="):
        if ";" in text:
            _head, payload = text.split(";", 1)
        else:
            return []

    if ";" in payload:
        parts = payload.split(";")
    else:
        parts = payload.split(",")

    records: list[HistoryRecord] = []
    for part in parts:
        item = part.strip()
        if not item:
            continue
        fields = item.split(":")
        if len(fields) != 4:
            continue
        try:
            records.append(
                HistoryRecord(
                    timestamp=int(float(fields[0])),
                    soil=float(fields[1]),
                    temperature=float(fields[2]),
                    lux=float(fields[3]),
                )
            )
        except ValueError:
            continue
    return records


def format_history_table_rows(records: list[HistoryRecord]) -> list[tuple[str, str, str, str]]:
    """Rows for History table: Time / Soil / Temp / Light."""
    rows: list[tuple[str, str, str, str]] = []
    for record in records:
        rows.append(
            (
                format_history_time_label(record.timestamp),
                f"{record.soil:.0f}%",
                f"{record.temperature:.1f}C",
                f"{record.lux:.0f}Lux",
            )
        )
    return rows


def history_points_for_chart(records: list[HistoryRecord]) -> list:
    """Convert GUI records into HistoryChart points (timestamp + metrics)."""
    if HistoryPoint is None:
        return []
    return [
        HistoryPoint(
            timestamp=record.timestamp,
            soil=record.soil,
            temperature=record.temperature,
            lux=record.lux,
        )
        for record in records
    ]


class BleController:
    def __init__(self) -> None:
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        self._client: BleakClient | None = None

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def _submit(self, coro) -> Future:
        return asyncio.run_coroutine_threadsafe(coro, self._loop)

    async def _scan(self) -> list[DeviceEntry]:
        if BleakScanner is None:
            raise RuntimeError("Missing dependency: install bleak first")

        devices = await BleakScanner.discover(timeout=SCAN_TIMEOUT_SECONDS)
        unique: dict[str, DeviceEntry] = {}
        for device in devices:
            address = getattr(device, "address", "")
            name = getattr(device, "name", "") or getattr(device, "metadata", {}).get("local_name", "")
            if not address or not name.startswith(DEVICE_NAME_PREFIX):
                continue
            unique[address] = DeviceEntry(name=name, address=address)

        return sorted(unique.values(), key=lambda item: (item.name.lower(), item.address.lower()))

    def scan(self) -> Future:
        return self._submit(self._scan())

    async def _connect(self, address: str) -> None:
        if BleakClient is None or BleakScanner is None:
            raise RuntimeError("Missing dependency: install bleak first")

        if self._client is not None:
            await self._disconnect()

        # Prefer BLEDevice from scanner for BlueZ (Linux) compatibility.
        device = await BleakScanner.find_device_by_address(address, timeout=SCAN_TIMEOUT_SECONDS)
        if device is not None:
            client = BleakClient(device, timeout=CONNECT_TIMEOUT_SECONDS)
        else:
            client = BleakClient(address, timeout=CONNECT_TIMEOUT_SECONDS)

        await client.connect()
        if not client.is_connected:
            raise RuntimeError("Connect failed")
        self._client = client
        # Phone/PC wall clock → device TimeManager (4-byte LE Unix seconds).
        await self._sync_time()

    def connect(self, address: str) -> Future:
        return self._submit(self._connect(address))

    async def _disconnect(self) -> None:
        client = self._client
        self._client = None
        if client is not None:
            try:
                if client.is_connected:
                    await client.disconnect()
            except Exception:
                pass

    def disconnect(self) -> Future:
        return self._submit(self._disconnect())

    async def _ensure_connected(self) -> BleakClient:
        if self._client is None or not self._client.is_connected:
            raise RuntimeError("Not connected")
        return self._client

    async def _sync_time(self) -> int:
        """Write current Unix timestamp to TIME characteristic and verify by read."""
        client = await self._ensure_connected()
        # Ensure GATT table is resolved (important on Windows / BlueZ).
        try:
            await client.get_services()
        except Exception:
            pass

        unix_time = int(time.time())
        payload = struct.pack("<I", unix_time & 0xFFFFFFFF)
        print("[Time]")
        print(f"Sync unix={unix_time}")
        print(f"payload_hex={payload.hex()}")

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                # Prefer write-with-response; fall back to write-without-response.
                try:
                    await client.write_gatt_char(TIME_UUID, payload, response=True)
                except Exception as write_exc:
                    print(f"[Time] write response failed: {write_exc}; retry without response")
                    await client.write_gatt_char(TIME_UUID, payload, response=False)

                await asyncio.sleep(0.15)
                raw = await client.read_gatt_char(TIME_UUID)
                if len(raw) < 4:
                    raise RuntimeError(f"TIME read too short: {raw!r}")
                read_unix = struct.unpack("<I", bytes(raw[:4]))[0]
                print(f"Read unix={read_unix}")
                # Allow 1s skew between write and read.
                if abs(int(read_unix) - unix_time) > 2:
                    raise RuntimeError(f"TIME mismatch write={unix_time} read={read_unix}")
                if not client.is_connected:
                    raise RuntimeError("Disconnected after time sync")
                return unix_time
            except Exception as exc:
                last_error = exc
                print(f"[Time] sync attempt {attempt + 1} failed: {exc}")
                await asyncio.sleep(0.3)

        raise RuntimeError(f"Time sync failed: {last_error}")

    def sync_time(self) -> Future:
        return self._submit(self._sync_time())

    async def _read_text(self, uuid: str) -> str:
        client = await self._ensure_connected()
        value = await client.read_gatt_char(uuid)
        return bytes(value).decode("utf-8", errors="replace").strip()

    async def _write_text(self, uuid: str, value: str) -> None:
        client = await self._ensure_connected()
        await client.write_gatt_char(uuid, value.encode("utf-8"), response=True)
        if not client.is_connected:
            raise RuntimeError("Disconnected after write")

    async def _read_sensor_history_paged(self) -> str:
        """Write offset=N / read chunk until end; merge into n=<total>;records..."""
        record_parts: list[str] = []
        total_hint = 0
        # Firmware pages ~5 records/chunk (<200B). 24 records => up to 5 pages.
        for chunk_index in range(8):
            await self._write_text(SENSOR_HISTORY_UUID, f"offset={chunk_index}")
            raw = await self._read_text(SENSOR_HISTORY_UUID)
            text = (raw or "").strip()
            if not text or text == "end":
                print("[History RX]")
                print(f"chunk={chunk_index}")
                print("records=0")
                print(f"total={len(record_parts)}")
                print("end")
                break

            chunk_records, meta = _parse_history_chunk_payload(text)
            if meta.get("total") is not None:
                total_hint = int(meta["total"])
            record_parts.extend(chunk_records)
            more = int(meta.get("more", 0 if not chunk_records else 1))

            print("[History RX]")
            print(f"chunk={meta.get('chunk', chunk_index)}")
            print(f"records={len(chunk_records)}")
            print(f"total={total_hint or len(record_parts)}")

            if more == 0:
                break

        if total_hint and len(record_parts) != total_hint:
            print("[History RX]")
            print(
                f"WARN merged={len(record_parts)} device_total={total_hint} "
                "(possible chunk truncation or mid-read ring update)"
            )

        if not record_parts:
            return "n=0"
        return "n=" + str(len(record_parts)) + ";" + ";".join(record_parts)

    async def _read_all(self) -> dict[str, str]:
        await self._ensure_connected()

        items = (
            ("light", LIGHT_UUID),
            ("light_sensor", LIGHT_SENSOR_UUID),
            ("light_rgb", LIGHT_RGB_UUID),
            ("pump", PUMP_UUID),
            ("soil_moisture", SOIL_MOISTURE_UUID),
            ("soil_ec", SOIL_EC_UUID),
            ("soil_temperature", SOIL_TEMPERATURE_UUID),
            ("plant_config", PLANT_CONFIG_UUID),
        )

        # Sequential reads: parallel GATT reads can overflow ESP32 BTC_TASK stack
        # when the history characteristic returns a long payload.
        results: dict[str, str] = {}
        connection_errors = 0
        total_ops = len(items) + 1  # + sensor_history paged read
        for key, uuid in items:
            try:
                results[key] = await self._read_text(uuid)
            except Exception as exc:
                results[key] = f"ERR: {exc}"
                if _is_connection_error(exc):
                    connection_errors += 1

        try:
            results["sensor_history"] = await self._read_sensor_history_paged()
        except Exception as exc:
            results["sensor_history"] = f"ERR: {exc}"
            if _is_connection_error(exc):
                connection_errors += 1

        client = self._client
        if client is None or not client.is_connected:
            raise RuntimeError("Not connected")
        if connection_errors == total_ops:
            raise RuntimeError("Not connected")

        return results

    def read_all(self) -> Future:
        return self._submit(self._read_all())

    def write_light(self, value: str) -> Future:
        return self._submit(self._write_text(LIGHT_UUID, value))

    def write_pump(self, value: str) -> Future:
        return self._submit(self._write_text(PUMP_UUID, value))

    def write_light_rgb(self, value: str) -> Future:
        return self._submit(self._write_text(LIGHT_RGB_UUID, value))

    def write_plant_config(self, value: str) -> Future:
        return self._submit(self._write_text(PLANT_CONFIG_UUID, value))

    def close(self) -> None:
        try:
            self.disconnect().result(timeout=5)
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=1)


class BleTkApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Smart Pot Control Panel")
        self.root.geometry("1040x900")
        self.root.minsize(920, 760)
        self.root.configure(bg=COLOR_BG)

        self.controller = BleController()
        self.devices: list[DeviceEntry] = []
        self.refresh_in_flight = False
        self.connection_lost_popup_shown = False
        self._config_hold_until = 0.0
        self._pending_config_payload = ""
        self._device_work_mode = "MANUAL"

        self.status_var = tk.StringVar(value="Idle")
        self.connection_var = tk.StringVar(value="Disconnected")
        self.device_var = tk.StringVar()
        self.auto_refresh_var = tk.BooleanVar(value=True)
        self.pump_seconds_var = tk.StringVar(value="30")
        self.light_r_var = tk.IntVar(value=255)
        self.light_g_var = tk.IntVar(value=255)
        self.light_b_var = tk.IntVar(value=255)

        # PlantConfig fields (BLE am/aw/al/l/h/d/i/ld/li)
        self.work_mode_var = tk.StringVar(value="MANUAL")  # MANUAL | AUTO
        self.auto_water_var = tk.BooleanVar(value=True)
        self.auto_light_var = tk.BooleanVar(value=False)
        self.auto_light_lux_var = tk.BooleanVar(value=False)
        self.water_low_var = tk.StringVar(value="35")
        self.water_high_var = tk.StringVar(value="50")
        self.water_duration_var = tk.StringVar(value="30")
        self.water_interval_var = tk.StringVar(value="60")
        self.light_duration_var = tk.StringVar(value="1h")
        self.light_interval_var = tk.StringVar(value="1h")
        self.lux_on_var = tk.StringVar(value="300")
        self.lux_off_var = tk.StringVar(value="500")
        self.auto_care_window_var = tk.BooleanVar(value=False)
        self.care_start_var = tk.StringVar(value="08:00")
        self.care_end_var = tk.StringVar(value="17:00")
        self.work_mode_display_var = tk.StringVar(value="MANUAL")
        self.config_raw_var = tk.StringVar(value="-")
        self.history_raw_var = tk.StringVar(value="history: -")
        self.panel_title_var = tk.StringVar(value="Manual Control")

        self.value_vars = {
            "light": tk.StringVar(value="-"),
            "light_sensor": tk.StringVar(value="-"),
            "light_rgb": tk.StringVar(value="-"),
            "pump": tk.StringVar(value="-"),
            "soil_moisture": tk.StringVar(value="-"),
            "soil_ec": tk.StringVar(value="-"),
            "soil_temperature": tk.StringVar(value="-"),
            "plant_config": tk.StringVar(value="-"),
            "sensor_history": tk.StringVar(value="-"),
        }
        self.card_value_labels: dict[str, tk.Label] = {}

        self.device_combo: ttk.Combobox | None = None
        self.connection_badge: tk.Label | None = None
        self.mode_badge: tk.Label | None = None
        self.rgb_preview: tk.Label | None = None
        self.mode_panel_host: tk.Frame | None = None
        self.manual_panel: tk.Frame | None = None
        self.auto_panel: tk.Frame | None = None
        self.ctrl_body: tk.Frame | None = None
        self.history_chart: HistoryChart | None = None
        self.history_tree: ttk.Treeview | None = None

        self._setup_style()
        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.after(300, self._schedule_refresh)
        self._update_connection_badge()
        self._update_mode_badge()
        self._update_rgb_preview()
        self._update_mode_panels()

    def _setup_style(self) -> None:
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Card.TFrame", background=COLOR_CARD)
        style.configure("Card.TLabelframe", background=COLOR_CARD, foreground=COLOR_TEXT)
        style.configure(
            "Card.TLabelframe.Label",
            background=COLOR_CARD,
            foreground=COLOR_TEXT,
            font=("Segoe UI", 10, "bold"),
        )
        style.configure("Card.TLabel", background=COLOR_CARD, foreground=COLOR_TEXT)
        style.configure("Muted.TLabel", background=COLOR_CARD, foreground=COLOR_MUTED)
        style.configure("Primary.TButton", padding=(12, 8))
        style.configure("TCheckbutton", background=COLOR_CARD)
        style.configure("TRadiobutton", background=COLOR_CARD)
        style.configure("Panel.Horizontal.TScale", background=COLOR_CARD)

    def _card(self, parent: tk.Misc, title: str) -> tuple[tk.Frame, tk.Frame]:
        outer = tk.Frame(parent, bg=COLOR_BG, highlightthickness=0)
        box = tk.Frame(
            outer,
            bg=COLOR_CARD,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
            padx=14,
            pady=12,
        )
        box.pack(fill=tk.BOTH, expand=True)
        tk.Label(box, text=title, bg=COLOR_CARD, fg=COLOR_ACCENT, font=("Segoe UI", 12, "bold")).pack(anchor=tk.W)
        body = tk.Frame(box, bg=COLOR_CARD)
        body.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        return outer, body

    def _metric_card(self, parent: tk.Misc, title: str, key: str, row: int, column: int) -> None:
        card = tk.Frame(
            parent,
            bg=COLOR_PANEL,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
            padx=12,
            pady=10,
        )
        card.grid(row=row, column=column, sticky=tk.NSEW, padx=5, pady=5)
        tk.Label(card, text=title, bg=COLOR_PANEL, fg=COLOR_MUTED, font=("Segoe UI", 9)).pack(anchor=tk.W)
        value_label = tk.Label(
            card,
            textvariable=self.value_vars[key],
            bg=COLOR_PANEL,
            fg=COLOR_TEXT,
            font=("Segoe UI", 18, "bold"),
            wraplength=170,
            justify=tk.LEFT,
        )
        value_label.pack(anchor=tk.W, pady=(6, 0))
        self.card_value_labels[key] = value_label

    def _section_label(self, parent: tk.Misc, text: str) -> None:
        tk.Label(parent, text=text, bg=COLOR_CARD, fg=COLOR_MUTED, font=("Segoe UI", 9, "bold")).pack(
            anchor=tk.W, pady=(0, 6)
        )

    def _action_button(
        self, parent: tk.Misc, text: str, command, *, danger: bool = False, full: bool = False
    ) -> tk.Button:
        width = None if full else 12
        if danger:
            return tk.Button(
                parent,
                text=text,
                command=command,
                width=width,
                height=1,
                bg=COLOR_DANGER,
                fg="#ffffff",
                activebackground="#912018",
                activeforeground="#ffffff",
                relief=tk.FLAT,
                font=("Segoe UI", 10, "bold"),
            )
        return tk.Button(
            parent,
            text=text,
            command=command,
            width=width,
            height=1,
            bg=COLOR_ACCENT,
            fg="#ffffff",
            activebackground="#245a3e",
            activeforeground="#ffffff",
            relief=tk.FLAT,
            font=("Segoe UI", 10),
        )

    def _build_ui(self) -> None:
        container = tk.Frame(self.root, bg=COLOR_BG, padx=16, pady=12)
        container.pack(fill=tk.BOTH, expand=True)
        container.rowconfigure(2, weight=3)
        container.rowconfigure(3, weight=2)
        container.columnconfigure(0, weight=1)

        header = tk.Frame(container, bg=COLOR_BG)
        header.grid(row=0, column=0, sticky=tk.EW)
        tk.Label(header, text="Smart Pot", bg=COLOR_BG, fg=COLOR_TEXT, font=("Segoe UI", 18, "bold")).pack(
            side=tk.LEFT
        )
        self.connection_badge = tk.Label(
            header,
            textvariable=self.connection_var,
            bg=COLOR_DISCONNECTED,
            fg="#ffffff",
            font=("Segoe UI", 11, "bold"),
            padx=12,
            pady=6,
        )
        self.connection_badge.pack(side=tk.RIGHT)

        conn_outer, conn_body = self._card(container, "Device")
        conn_outer.grid(row=1, column=0, sticky=tk.EW, pady=(10, 0))

        ttk.Label(conn_body, text="Device", style="Card.TLabel").grid(row=0, column=0, sticky=tk.W)
        self.device_combo = ttk.Combobox(conn_body, textvariable=self.device_var, state="readonly", width=52)
        self.device_combo.grid(row=0, column=1, columnspan=2, sticky=tk.EW, padx=(8, 8))
        ttk.Button(conn_body, text="Scan", style="Primary.TButton", command=self.scan_devices).grid(
            row=0, column=3, padx=(0, 6)
        )
        ttk.Button(conn_body, text="Connect", style="Primary.TButton", command=self.connect_selected).grid(
            row=0, column=4, padx=(0, 6)
        )
        ttk.Button(conn_body, text="Disconnect", style="Primary.TButton", command=self.disconnect_device).grid(
            row=0, column=5
        )
        ttk.Label(conn_body, textvariable=self.status_var, style="Muted.TLabel").grid(
            row=1, column=0, columnspan=6, sticky=tk.W, pady=(8, 0)
        )
        conn_body.columnconfigure(1, weight=1)

        center = tk.Frame(container, bg=COLOR_BG)
        center.grid(row=2, column=0, sticky=tk.NSEW, pady=(12, 0))
        center.columnconfigure(0, weight=3)
        center.columnconfigure(1, weight=2)
        center.rowconfigure(0, weight=1)

        left = tk.Frame(center, bg=COLOR_BG)
        left.grid(row=0, column=0, sticky=tk.NSEW, padx=(0, 8))
        dash_outer, dash_body = self._card(left, "Plant Status")
        dash_outer.pack(fill=tk.BOTH, expand=True)

        mode_row = tk.Frame(dash_body, bg=COLOR_CARD)
        mode_row.pack(fill=tk.X, pady=(0, 8))
        tk.Label(mode_row, text="Work Mode", bg=COLOR_CARD, fg=COLOR_MUTED, font=("Segoe UI", 9)).pack(side=tk.LEFT)
        self.mode_badge = tk.Label(
            mode_row,
            textvariable=self.work_mode_display_var,
            bg=COLOR_MANUAL,
            fg="#ffffff",
            font=("Segoe UI", 14, "bold"),
            padx=14,
            pady=4,
        )
        self.mode_badge.pack(side=tk.LEFT, padx=(10, 0))

        cards = tk.Frame(dash_body, bg=COLOR_CARD)
        cards.pack(fill=tk.BOTH, expand=True)
        for index in range(2):
            cards.columnconfigure(index, weight=1)
        for index in range(3):
            cards.rowconfigure(index, weight=1)

        self._metric_card(cards, "Soil Moisture", "soil_moisture", 0, 0)
        self._metric_card(cards, "Temperature", "soil_temperature", 0, 1)
        self._metric_card(cards, "EC", "soil_ec", 1, 0)
        self._metric_card(cards, "Light / Sensor", "light", 1, 1)
        self._metric_card(cards, "Pump", "pump", 2, 0)
        self._metric_card(cards, "RGB", "light_rgb", 2, 1)

        ttk.Label(dash_body, textvariable=self.config_raw_var, style="Muted.TLabel").pack(anchor=tk.W, pady=(8, 0))
        ttk.Label(dash_body, textvariable=self.history_raw_var, style="Muted.TLabel", wraplength=420).pack(
            anchor=tk.W, pady=(2, 0)
        )

        history_table_frame = tk.Frame(dash_body, bg=COLOR_CARD)
        history_table_frame.pack(fill=tk.BOTH, expand=False, pady=(6, 0))
        tk.Label(
            history_table_frame,
            text="History (24h)",
            bg=COLOR_CARD,
            fg=COLOR_ACCENT,
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor=tk.W)
        columns = ("time", "soil", "temp", "lux")
        self.history_tree = ttk.Treeview(
            history_table_frame,
            columns=columns,
            show="headings",
            height=6,
            selectmode="browse",
        )
        self.history_tree.heading("time", text="Time")
        self.history_tree.heading("soil", text="Soil Moisture")
        self.history_tree.heading("temp", text="Temperature")
        self.history_tree.heading("lux", text="Light")
        self.history_tree.column("time", width=64, anchor=tk.CENTER)
        self.history_tree.column("soil", width=72, anchor=tk.CENTER)
        self.history_tree.column("temp", width=72, anchor=tk.CENTER)
        self.history_tree.column("lux", width=80, anchor=tk.CENTER)
        history_scroll = ttk.Scrollbar(history_table_frame, orient=tk.VERTICAL, command=self.history_tree.yview)
        self.history_tree.configure(yscrollcommand=history_scroll.set)
        self.history_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=(4, 0))
        history_scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=(4, 0))

        right = tk.Frame(center, bg=COLOR_BG)
        right.grid(row=0, column=1, sticky=tk.NSEW, padx=(8, 0))
        ctrl_outer, ctrl_body = self._card(right, "Control Panel")
        ctrl_outer.pack(fill=tk.BOTH, expand=True)
        self.ctrl_body = ctrl_body

        tools = tk.Frame(ctrl_body, bg=COLOR_CARD)
        tools.pack(fill=tk.X)
        ttk.Button(tools, text="Refresh", style="Primary.TButton", command=self.refresh_values).pack(
            side=tk.LEFT, fill=tk.X, expand=True
        )
        ttk.Checkbutton(tools, text="Auto Refresh", variable=self.auto_refresh_var).pack(side=tk.LEFT, padx=(10, 0))

        # --- Mode switch (always visible) ---
        mode_box = tk.Frame(
            ctrl_body, bg=COLOR_PANEL, highlightbackground=COLOR_BORDER, highlightthickness=1, padx=12, pady=10
        )
        mode_box.pack(fill=tk.X, pady=(12, 0))
        tk.Label(mode_box, text="Switch Mode", bg=COLOR_PANEL, fg=COLOR_ACCENT, font=("Segoe UI", 10, "bold")).pack(
            anchor=tk.W
        )
        mode_row = tk.Frame(mode_box, bg=COLOR_PANEL)
        mode_row.pack(fill=tk.X, pady=(8, 0))
        ttk.Radiobutton(mode_row, text="MANUAL", value="MANUAL", variable=self.work_mode_var).pack(side=tk.LEFT)
        ttk.Radiobutton(mode_row, text="AUTO", value="AUTO", variable=self.work_mode_var).pack(
            side=tk.LEFT, padx=(16, 0)
        )
        self._action_button(mode_box, "Apply Mode", self.apply_work_mode_only).pack(fill=tk.X, pady=(10, 0))

        tk.Label(
            ctrl_body,
            textvariable=self.panel_title_var,
            bg=COLOR_CARD,
            fg=COLOR_TEXT,
            font=("Segoe UI", 11, "bold"),
        ).pack(anchor=tk.W, pady=(14, 6))

        self.mode_panel_host = tk.Frame(ctrl_body, bg=COLOR_CARD)
        self.mode_panel_host.pack(fill=tk.BOTH, expand=True)

        self.manual_panel = self._build_manual_panel(self.mode_panel_host)
        self.auto_panel = self._build_auto_panel(self.mode_panel_host)

        chart_row = tk.Frame(container, bg=COLOR_BG)
        chart_row.grid(row=3, column=0, sticky=tk.NSEW, pady=(12, 0))
        chart_row.rowconfigure(0, weight=1)
        chart_row.columnconfigure(0, weight=1)

        if HistoryChart is not None:
            self.history_chart = HistoryChart(chart_row, height=220)
            self.history_chart.grid(row=0, column=0, sticky=tk.NSEW)
        else:
            tk.Label(
                chart_row,
                text="History chart unavailable (history_chart / matplotlib missing)",
                bg=COLOR_BG,
                fg=COLOR_DISCONNECTED,
                font=("Segoe UI", 9),
            ).grid(row=0, column=0, sticky=tk.W)

        footer = tk.Label(
            container,
            text=(
                f"Scans {DEVICE_NAME_PREFIX}-XXXXXXXX. "
                "Top: status + control. Bottom: 24h soil / temp / lux trend. "
                f"Platform: {platform.system()}"
            ),
            bg=COLOR_BG,
            fg=COLOR_MUTED,
            wraplength=980,
            justify=tk.LEFT,
            font=("Segoe UI", 8),
        )
        footer.grid(row=4, column=0, sticky=tk.EW, pady=(8, 0))

    def _build_manual_panel(self, parent: tk.Misc) -> tk.Frame:
        """Manual controls in a scrollable panel so all settings (incl. Apply RGB) are reachable."""
        panel = tk.Frame(parent, bg=COLOR_CARD)

        scroll_host = tk.Frame(panel, bg=COLOR_CARD)
        scroll_host.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(scroll_host, bg=COLOR_CARD, highlightthickness=0, bd=0)
        scrollbar = ttk.Scrollbar(scroll_host, orient=tk.VERTICAL, command=canvas.yview)
        form = tk.Frame(canvas, bg=COLOR_CARD)

        form_window = canvas.create_window((0, 0), window=form, anchor=tk.NW)
        canvas.configure(yscrollcommand=scrollbar.set)

        def _sync_scroll_region(_event: tk.Event | None = None) -> None:
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _sync_form_width(event: tk.Event) -> None:
            canvas.itemconfigure(form_window, width=max(event.width, 1))

        form.bind("<Configure>", _sync_scroll_region)
        canvas.bind("<Configure>", _sync_form_width)

        def _on_mousewheel(event: tk.Event) -> None:
            delta = getattr(event, "delta", 0)
            if delta:
                canvas.yview_scroll(int(-delta / 120), "units")
            elif getattr(event, "num", None) == 4:
                canvas.yview_scroll(-1, "units")
            elif getattr(event, "num", None) == 5:
                canvas.yview_scroll(1, "units")

        canvas.bind("<Enter>", lambda _e: canvas.bind_all("<MouseWheel>", _on_mousewheel))
        canvas.bind("<Leave>", lambda _e: canvas.unbind_all("<MouseWheel>"))
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self._section_label(form, "Light")
        light_row = tk.Frame(form, bg=COLOR_CARD)
        light_row.pack(fill=tk.X)
        self._action_button(light_row, "LED ON", lambda: self.write_light("on")).pack(side=tk.LEFT)
        self._action_button(light_row, "LED OFF", lambda: self.write_light("off")).pack(side=tk.LEFT, padx=(8, 0))

        self._section_label(form, "LED RGB")
        rgb_box = tk.Frame(form, bg=COLOR_PANEL, highlightbackground=COLOR_BORDER, highlightthickness=1, padx=10, pady=8)
        rgb_box.pack(fill=tk.X)

        self.rgb_preview = tk.Label(rgb_box, text="  ", bg="#ffffff", width=6, relief=tk.SOLID, bd=1)
        self.rgb_preview.pack(anchor=tk.W, pady=(0, 8))

        for label, var in (("R", self.light_r_var), ("G", self.light_g_var), ("B", self.light_b_var)):
            row = tk.Frame(rgb_box, bg=COLOR_PANEL)
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label, bg=COLOR_PANEL, fg=COLOR_TEXT, width=2).pack(side=tk.LEFT)
            # ttk.Scale is float-based; do not bind IntVar directly (Windows TclError).
            scale = ttk.Scale(row, from_=0, to=255, orient=tk.HORIZONTAL)
            scale.set(float(var.get()))
            scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(6, 6))

            def on_move(value: str, channel_var: tk.IntVar = var, widget: ttk.Scale = scale) -> None:
                try:
                    channel_var.set(max(0, min(255, int(round(float(value))))))
                except (TypeError, ValueError, tk.TclError):
                    channel_var.set(max(0, min(255, int(round(float(widget.get()))))))
                self._update_rgb_preview()

            scale.configure(command=on_move)
            tk.Label(row, textvariable=var, bg=COLOR_PANEL, fg=COLOR_MUTED, width=3).pack(side=tk.LEFT)

        # Directly under RGB sliders (not pinned to panel bottom).
        self._action_button(
            rgb_box, "Apply RGB", self._on_apply_rgb_clicked, full=True
        ).pack(fill=tk.X, pady=(12, 0), ipady=4)

        self._section_label(form, "Pump")
        danger = tk.Frame(form, bg=COLOR_DANGER_BG, padx=10, pady=10)
        danger.pack(fill=tk.X)
        tk.Label(
            danger,
            text="Pump ON will start watering",
            bg=COLOR_DANGER_BG,
            fg=COLOR_DANGER,
            font=("Segoe UI", 9, "bold"),
        ).pack(anchor=tk.W)
        pump_row = tk.Frame(danger, bg=COLOR_DANGER_BG)
        pump_row.pack(fill=tk.X, pady=(8, 0))
        self._action_button(pump_row, "Pump ON", lambda: self.write_pump("on"), danger=True).pack(side=tk.LEFT)
        self._action_button(pump_row, "Pump OFF", lambda: self.write_pump("off")).pack(side=tk.LEFT, padx=(8, 0))

        run_row = tk.Frame(form, bg=COLOR_CARD)
        run_row.pack(fill=tk.X, pady=(10, 0))
        tk.Label(run_row, text="Seconds", bg=COLOR_CARD, fg=COLOR_MUTED).pack(side=tk.LEFT)
        ttk.Entry(run_row, textvariable=self.pump_seconds_var, width=8).pack(side=tk.LEFT, padx=(8, 8))
        self._action_button(run_row, "Run", self.write_pump_seconds).pack(side=tk.LEFT)

        self._update_rgb_preview()
        return panel

    def _build_auto_panel(self, parent: tk.Misc) -> tk.Frame:
        """AUTO settings with scrollable form and Apply pinned at the bottom."""
        panel = tk.Frame(parent, bg=COLOR_CARD)

        # Pack Apply first so it always stays visible at the bottom.
        self._action_button(panel, "Apply Auto Settings", self.apply_auto_settings).pack(
            side=tk.BOTTOM, fill=tk.X, pady=(8, 0)
        )

        scroll_host = tk.Frame(panel, bg=COLOR_CARD)
        scroll_host.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(scroll_host, bg=COLOR_CARD, highlightthickness=0, bd=0)
        scrollbar = ttk.Scrollbar(scroll_host, orient=tk.VERTICAL, command=canvas.yview)
        form = tk.Frame(canvas, bg=COLOR_CARD)

        form_window = canvas.create_window((0, 0), window=form, anchor=tk.NW)
        canvas.configure(yscrollcommand=scrollbar.set)

        def _sync_scroll_region(_event: tk.Event | None = None) -> None:
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _sync_form_width(event: tk.Event) -> None:
            canvas.itemconfigure(form_window, width=event.width)

        form.bind("<Configure>", _sync_scroll_region)
        canvas.bind("<Configure>", _sync_form_width)

        def _on_mousewheel(event: tk.Event) -> None:
            delta = getattr(event, "delta", 0)
            if delta:
                canvas.yview_scroll(int(-delta / 120), "units")
            elif getattr(event, "num", None) == 4:
                canvas.yview_scroll(-1, "units")
            elif getattr(event, "num", None) == 5:
                canvas.yview_scroll(1, "units")

        def _bind_wheel(_event: tk.Event) -> None:
            canvas.bind_all("<MouseWheel>", _on_mousewheel)
            canvas.bind_all("<Button-4>", _on_mousewheel)
            canvas.bind_all("<Button-5>", _on_mousewheel)

        def _unbind_wheel(_event: tk.Event) -> None:
            canvas.unbind_all("<MouseWheel>")
            canvas.unbind_all("<Button-4>")
            canvas.unbind_all("<Button-5>")

        canvas.bind("<Enter>", _bind_wheel)
        canvas.bind("<Leave>", _unbind_wheel)

        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        tk.Label(
            form,
            text="AUTO: set water/light timing and lux thresholds.",
            bg=COLOR_CARD,
            fg=COLOR_MUTED,
            justify=tk.LEFT,
            font=("Segoe UI", 9),
        ).pack(anchor=tk.W, pady=(0, 6))

        flags = tk.Frame(form, bg=COLOR_CARD)
        flags.pack(fill=tk.X)
        ttk.Checkbutton(flags, text="Water (aw)", variable=self.auto_water_var).pack(side=tk.LEFT)
        ttk.Checkbutton(flags, text="Light (al)", variable=self.auto_light_var).pack(side=tk.LEFT, padx=(10, 0))
        ttk.Checkbutton(flags, text="Lux loop (le)", variable=self.auto_light_lux_var).pack(
            side=tk.LEFT, padx=(10, 0)
        )
        ttk.Checkbutton(flags, text="Care window (ace)", variable=self.auto_care_window_var).pack(
            side=tk.LEFT, padx=(10, 0)
        )

        limits = tk.Frame(
            form,
            bg=COLOR_PANEL,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
            padx=10,
            pady=8,
        )
        limits.pack(fill=tk.X, pady=(8, 0))
        tk.Label(limits, text="Watering Limits", bg=COLOR_PANEL, fg=COLOR_ACCENT, font=("Segoe UI", 10, "bold")).pack(
            anchor=tk.W
        )

        for label, variable in (
            ("Soil low % (l)", self.water_low_var),
            ("Soil high % (h)", self.water_high_var),
            ("Duration sec (d)", self.water_duration_var),
            ("Interval sec (i)", self.water_interval_var),
        ):
            row = tk.Frame(limits, bg=COLOR_PANEL)
            row.pack(fill=tk.X, pady=(6, 0))
            tk.Label(row, text=label, bg=COLOR_PANEL, fg=COLOR_TEXT, width=16, anchor=tk.W).pack(side=tk.LEFT)
            ttk.Entry(row, textvariable=variable, width=10).pack(side=tk.LEFT)

        tk.Label(
            limits,
            text="Require low < high; duration/interval > 0",
            bg=COLOR_PANEL,
            fg=COLOR_MUTED,
            font=("Segoe UI", 8),
        ).pack(anchor=tk.W, pady=(6, 0))

        light_box = tk.Frame(
            form,
            bg=COLOR_PANEL,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
            padx=10,
            pady=8,
        )
        light_box.pack(fill=tk.X, pady=(8, 0))
        tk.Label(
            light_box, text="Auto Light / Lux", bg=COLOR_PANEL, fg=COLOR_ACCENT, font=("Segoe UI", 10, "bold")
        ).pack(anchor=tk.W)

        for label, variable in (
            ("Duration (ld)", self.light_duration_var),
            ("Interval (li)", self.light_interval_var),
            ("Lux on (lon)", self.lux_on_var),
            ("Lux off (loff)", self.lux_off_var),
        ):
            row = tk.Frame(light_box, bg=COLOR_PANEL)
            row.pack(fill=tk.X, pady=(6, 0))
            tk.Label(row, text=label, bg=COLOR_PANEL, fg=COLOR_TEXT, width=16, anchor=tk.W).pack(side=tk.LEFT)
            ttk.Entry(row, textvariable=variable, width=10).pack(side=tk.LEFT)

        tk.Label(
            light_box,
            text="ld=max on; li=min gap; lon < loff; ace off = all-day (needs BLE time)",
            bg=COLOR_PANEL,
            fg=COLOR_MUTED,
            font=("Segoe UI", 8),
        ).pack(anchor=tk.W, pady=(6, 0))

        window_box = tk.Frame(
            form,
            bg=COLOR_PANEL,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
            padx=10,
            pady=8,
        )
        window_box.pack(fill=tk.X, pady=(8, 0))
        tk.Label(
            window_box,
            text="Care Window",
            bg=COLOR_PANEL,
            fg=COLOR_ACCENT,
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor=tk.W)

        for label, variable in (
            ("Start (cs)", self.care_start_var),
            ("End (ce)", self.care_end_var),
        ):
            row = tk.Frame(window_box, bg=COLOR_PANEL)
            row.pack(fill=tk.X, pady=(6, 0))
            tk.Label(row, text=label, bg=COLOR_PANEL, fg=COLOR_TEXT, width=16, anchor=tk.W).pack(
                side=tk.LEFT
            )
            ttk.Entry(row, textvariable=variable, width=10).pack(side=tk.LEFT)

        tk.Label(
            window_box,
            text="HH:MM, start < end (no overnight). Example: 08:00 ~ 17:00",
            bg=COLOR_PANEL,
            fg=COLOR_MUTED,
            font=("Segoe UI", 8),
        ).pack(anchor=tk.W, pady=(6, 0))

        return panel

    def _update_rgb_preview(self) -> None:
        if self.rgb_preview is None:
            return
        try:
            r, g, b = self._rgb_channel_values()
            color = f"#{r:02x}{g:02x}{b:02x}"
        except (tk.TclError, TypeError, ValueError):
            color = "#ffffff"
        self.rgb_preview.configure(bg=color)

    def _rgb_channel_values(self) -> tuple[int, int, int]:
        def channel(var: tk.IntVar) -> int:
            return max(0, min(255, int(round(float(var.get())))))

        return channel(self.light_r_var), channel(self.light_g_var), channel(self.light_b_var)

    def _update_connection_badge(self) -> None:
        if self.connection_badge is None:
            return
        connected = self.connection_var.get().startswith("Connected")
        self.connection_badge.configure(bg=COLOR_CONNECTED if connected else COLOR_DISCONNECTED)

    def _update_mode_badge(self) -> None:
        if self.mode_badge is None:
            return
        mode = self.work_mode_display_var.get()
        if mode == "AUTO":
            self.mode_badge.configure(bg=COLOR_AUTO)
        elif mode == "MANUAL":
            self.mode_badge.configure(bg=COLOR_MANUAL)
        else:
            self.mode_badge.configure(bg=COLOR_MUTED)

    def _is_auto_mode(self) -> bool:
        return self._device_work_mode == "AUTO"

    def _update_mode_panels(self) -> None:
        if self.mode_panel_host is None or self.manual_panel is None or self.auto_panel is None:
            return

        for child in self.mode_panel_host.winfo_children():
            child.pack_forget()

        if self._is_auto_mode():
            self.panel_title_var.set("AUTO Settings")
            self.auto_panel.pack(fill=tk.BOTH, expand=True)
        else:
            self.panel_title_var.set("Manual Control")
            self.manual_panel.pack(fill=tk.BOTH, expand=True)

    def _mark_value_error(self, key: str, value: str) -> None:
        label = self.card_value_labels.get(key)
        if label is None:
            return
        if value.startswith("ERR:"):
            label.configure(fg=COLOR_DISCONNECTED, font=("Segoe UI", 11, "bold"))
        else:
            label.configure(fg=COLOR_TEXT, font=("Segoe UI", 18, "bold"))

    def _begin_config_hold(self, payload: str) -> None:
        self._pending_config_payload = payload
        self._config_hold_until = time.monotonic() + CONFIG_HOLD_SECONDS

    def _config_hold_active(self) -> bool:
        return time.monotonic() < self._config_hold_until

    def _schedule_delayed_refresh(self, delay_ms: int = WRITE_REFRESH_DELAY_MS) -> None:
        self.root.after(delay_ms, self.refresh_values)

    def _set_device_mode(self, mode: str) -> None:
        if mode not in ("AUTO", "MANUAL"):
            return
        self._device_work_mode = mode
        self.work_mode_display_var.set(mode)
        self.work_mode_var.set(mode)
        self._update_mode_badge()
        self._update_mode_panels()

    def _watch_future(self, future: Future, on_success, action: str) -> None:
        def poll() -> None:
            if not future.done():
                self.root.after(100, poll)
                return

            try:
                result = future.result()
            except Exception as exc:
                connection_lost_by_text = _is_connection_error(exc)
                is_refresh_or_write = action == "Refresh" or action.startswith("Write ")
                connection_lost = connection_lost_by_text or (
                    is_refresh_or_write and self.connection_var.get().startswith("Connected:")
                )

                self.status_var.set(f"{action} failed: {exc}")
                if connection_lost:
                    self.connection_var.set("Disconnected")
                    self._update_connection_badge()
                    if not self.connection_lost_popup_shown:
                        self.connection_lost_popup_shown = True
                        messagebox.showerror("BLE Error", f"Connection lost\n\n{exc}")
                else:
                    messagebox.showerror("BLE Error", f"{action} failed\n\n{exc}")

                if action == "Refresh":
                    self.refresh_in_flight = False
                if action.startswith("Write "):
                    if self.connection_var.get().startswith("Connected:"):
                        self._schedule_delayed_refresh(400)
                return

            on_success(result)

        poll()

    def scan_devices(self) -> None:
        self.status_var.set("Scanning for BLE devices...")
        future = self.controller.scan()

        def on_success(devices: list[DeviceEntry]) -> None:
            self.devices = devices
            labels = [device.label for device in devices]
            assert self.device_combo is not None
            self.device_combo["values"] = labels
            if labels:
                self.device_var.set(labels[0])
                self.status_var.set(f"Found {len(labels)} device(s)")
            else:
                self.device_var.set("")
                self.status_var.set("No BLE devices found")

        self._watch_future(future, on_success, "Scan")

    def _selected_device(self) -> DeviceEntry | None:
        selected = self.device_var.get()
        for device in self.devices:
            if device.label == selected:
                return device
        return None

    def connect_selected(self) -> None:
        device = self._selected_device()
        if device is None:
            messagebox.showwarning("BLE", "Select a device first")
            return

        self.status_var.set(f"Connecting to {device.label}...")
        future = self.controller.connect(device.address)

        def on_success(_: None) -> None:
            self.connection_var.set(f"Connected: {device.label}")
            self._update_connection_badge()
            self.status_var.set("Connected (time synced)")
            self.connection_lost_popup_shown = False
            self.refresh_values()

        self._watch_future(future, on_success, "Connect")

    def disconnect_device(self) -> None:
        self.status_var.set("Disconnecting...")
        future = self.controller.disconnect()

        def on_success(_: None) -> None:
            self.connection_var.set("Disconnected")
            self._update_connection_badge()
            self.status_var.set("Disconnected")
            self.connection_lost_popup_shown = False
            self._set_device_mode("MANUAL")

        self._watch_future(future, on_success, "Disconnect")

    def _apply_config_to_form(self, raw: str, *, force: bool = False) -> None:
        view = parse_plant_config(raw)
        if view.work_mode_label in ("AUTO", "MANUAL"):
            self._device_work_mode = view.work_mode_label
            self.work_mode_display_var.set(view.work_mode_label)
        self.config_raw_var.set(f"raw: {view.raw or '-'}")
        self._update_mode_badge()
        self._update_mode_panels()

        if self._config_hold_active() and not force:
            return

        self._pending_config_payload = ""
        if view.auto_mode is not None:
            self.work_mode_var.set("AUTO" if view.auto_mode else "MANUAL")
        if view.auto_water is not None:
            self.auto_water_var.set(bool(view.auto_water))
        if view.auto_light is not None:
            self.auto_light_var.set(bool(view.auto_light))
        if view.auto_light_lux is not None:
            self.auto_light_lux_var.set(bool(view.auto_light_lux))
        if view.low is not None:
            self.water_low_var.set(str(int(view.low) if view.low == int(view.low) else view.low))
        if view.high is not None:
            self.water_high_var.set(str(int(view.high) if view.high == int(view.high) else view.high))
        if view.duration is not None:
            self.water_duration_var.set(str(view.duration))
        if view.interval is not None:
            self.water_interval_var.set(str(view.interval))
        if view.light_duration is not None:
            self.light_duration_var.set(str(view.light_duration))
        if view.light_interval is not None:
            self.light_interval_var.set(str(view.light_interval))
        if view.lux_on is not None:
            self.lux_on_var.set(str(view.lux_on))
        if view.lux_off is not None:
            self.lux_off_var.set(str(view.lux_off))
        if view.auto_care_window is not None:
            self.auto_care_window_var.set(bool(view.auto_care_window))
        if view.care_start is not None:
            self.care_start_var.set(view.care_start)
        if view.care_end is not None:
            self.care_end_var.set(view.care_end)

    def _update_history_table(self, records: list[HistoryRecord]) -> None:
        if self.history_tree is None:
            return
        for item_id in self.history_tree.get_children():
            self.history_tree.delete(item_id)
        for row in format_history_table_rows(records):
            self.history_tree.insert("", tk.END, values=row)

    def refresh_values(self) -> None:
        if self.refresh_in_flight:
            return
        if not self.connection_var.get().startswith("Connected:"):
            return

        self.refresh_in_flight = True
        self.status_var.set("Refreshing values...")
        future = self.controller.read_all()

        def on_success(values: dict[str, str]) -> None:
            self.refresh_in_flight = False
            error_count = 0
            for key, value in values.items():
                self.value_vars[key].set(value)
                self._mark_value_error(key, value)
                if value.startswith("ERR:"):
                    error_count += 1

            # Light card shows lamp + sensor
            light = values.get("light", "-")
            sensor = values.get("light_sensor", "-")
            if not str(light).startswith("ERR:") and not str(sensor).startswith("ERR:"):
                self.value_vars["light"].set(f"{light} / {sensor}")

            config_raw = values.get("plant_config", "")
            if not config_raw.startswith("ERR:"):
                self._apply_config_to_form(config_raw)
            else:
                self.config_raw_var.set(config_raw)

            history_raw = values.get("sensor_history", "-")
            # Merged paged history (n=<total>;timestamp:soil:temp:lux;...).
            print("RAW HISTORY:")
            print(history_raw)
            print(
                f"[GUI History][BLE] uuid={SENSOR_HISTORY_UUID} "
                f"len={len(str(history_raw))} chars"
            )
            if str(history_raw).startswith("ERR:"):
                self.history_raw_var.set(history_raw)
                self._update_history_table([])
                if self.history_chart is not None:
                    self.history_chart.update_from_points([])
            else:
                records = parse_sensor_history_records(str(history_raw))
                preview = str(history_raw)
                if len(preview) > 72:
                    preview = preview[:69] + "..."
                self.history_raw_var.set(f"history: {len(records)} records | {preview}")
                self._update_history_table(records)
                print("[GUI History]")
                print(f"records={len(records)}")
                if records:
                    print(
                        f"range time={format_history_time_label(records[0].timestamp)}"
                        f"..{format_history_time_label(records[-1].timestamp)} "
                        f"soil={records[0].soil}..{records[-1].soil} "
                        f"temp={records[0].temperature}..{records[-1].temperature} "
                        f"lux={records[0].lux}..{records[-1].lux}"
                    )
                if self.history_chart is not None:
                    self.history_chart.update_from_points(history_points_for_chart(records))

            if error_count:
                self.status_var.set(f"Values updated with {error_count} read error(s)")
            else:
                self.status_var.set("Values updated")

        self._watch_future(future, on_success, "Refresh")

    def _schedule_refresh(self) -> None:
        if self.auto_refresh_var.get() and self.connection_var.get().startswith("Connected:"):
            self.refresh_values()
        self.root.after(POLL_INTERVAL_MS, self._schedule_refresh)

    def _guard_manual_control(self, action_name: str) -> bool:
        if self._is_auto_mode():
            messagebox.showwarning(
                "AUTO Mode",
                f"{action_name} is only available in MANUAL mode.\nSwitch mode first.",
            )
            return False
        return True

    def write_light(self, value: str) -> None:
        if not self._guard_manual_control("Light control"):
            return
        self.status_var.set(f"Writing light={value}...")
        future = self.controller.write_light(value)

        def on_success(_: None) -> None:
            self.status_var.set(f"Light set to {value}")
            self._schedule_delayed_refresh()

        self._watch_future(future, on_success, "Write light")

    def write_pump(self, value: str) -> None:
        if not self._guard_manual_control("Pump control"):
            return
        if value == "on":
            ok = messagebox.askokcancel("Pump ON", "Start the pump now?\nThis is a watering action.")
            if not ok:
                self.status_var.set("Pump ON cancelled")
                return
        self.status_var.set(f"Writing pump={value}...")
        future = self.controller.write_pump(value)

        def on_success(_: None) -> None:
            self.status_var.set(f"Pump command sent: {value}")
            self._schedule_delayed_refresh()

        self._watch_future(future, on_success, "Write pump")

    def _is_light_on(self) -> bool:
        """Best-effort parse of dashboard light value ('1', '0', or '1 / <sensor>')."""
        text = self.value_vars["light"].get().strip()
        if not text or text.startswith("ERR:"):
            return False
        head = text.split("/", 1)[0].strip().lower()
        return head in ("1", "on", "true")

    def _on_apply_rgb_clicked(self) -> None:
        # Always log first so we can see the click even if later guards fail.
        print("[GUI][RGB WRITE] click", flush=True)
        self.status_var.set("Apply RGB clicked...")
        try:
            self.write_light_rgb()
        except Exception as exc:
            print(f"[GUI][RGB WRITE] exception: {exc}", flush=True)
            messagebox.showerror("Light RGB", f"Apply RGB failed:\n{exc}")

    def write_light_rgb(self) -> None:
        print("[GUI][RGB WRITE] enter", flush=True)
        if not self._guard_manual_control("RGB control"):
            print("[GUI][RGB WRITE] blocked: AUTO mode", flush=True)
            return
        try:
            values = list(self._rgb_channel_values())
        except (tk.TclError, TypeError, ValueError) as exc:
            print(f"[GUI][RGB WRITE] bad slider: {exc}", flush=True)
            messagebox.showwarning("Light RGB", f"Invalid RGB slider value: {exc}")
            return
        if any(value < 0 or value > 255 for value in values):
            print(f"[GUI][RGB WRITE] out of range: {values}", flush=True)
            messagebox.showwarning("Light RGB", "R, G, B must be integers from 0 to 255")
            return

        payload = f"{values[0]},{values[1]},{values[2]}"
        print("[GUI][RGB WRITE]")
        print(f"payload={payload}")
        light_on = self._is_light_on()
        self.status_var.set(f"Writing light RGB={payload}...")
        future = self.controller.write_light_rgb(payload)

        # def on_success(_: None) -> None:
        #     # Do not auto-turn light on; only report cache vs applied.
        #     if light_on:
        #         tip = "RGB applied successfully"
        #     else:
        #         tip = "RGB saved, will apply when light turns on"
        #     print(f"[GUI][RGB WRITE] ok light_on={1 if light_on else 0}", flush=True)
        #     self.status_var.set(tip)
        #     messagebox.showinfo("Light RGB", tip)
        #     self._schedule_delayed_refresh()

        # self._watch_future(future, on_success, "Write light RGB")

    def write_pump_seconds(self) -> None:
        if not self._guard_manual_control("Pump control"):
            return
        seconds = self.pump_seconds_var.get().strip()
        if not seconds.isdigit():
            messagebox.showwarning("Pump", "Seconds must be a non-negative integer")
            return
        ok = messagebox.askokcancel("Pump Run", f"Run pump for {seconds} seconds?")
        if not ok:
            self.status_var.set("Pump Run cancelled")
            return
        self.status_var.set(f"Writing pump={seconds}...")
        future = self.controller.write_pump(seconds)

        def on_success(_: None) -> None:
            self.status_var.set(f"Pump command sent: {seconds}")
            self._schedule_delayed_refresh()

        self._watch_future(future, on_success, "Write pump")

    def _parse_thresholds(self) -> tuple[float, float] | None:
        low_text = self.water_low_var.get().strip()
        high_text = self.water_high_var.get().strip()
        try:
            low = float(low_text)
            high = float(high_text)
        except ValueError:
            messagebox.showwarning("Config", "low / high must be numbers")
            return None
        if low >= high:
            messagebox.showwarning("Config", "Require low < high (firmware rejects otherwise)")
            return None
        return low, high

    def _parse_timing(self) -> tuple[int, int] | None:
        duration_text = self.water_duration_var.get().strip()
        interval_text = self.water_interval_var.get().strip()
        duration = parse_duration_token(duration_text)
        interval = parse_duration_token(interval_text)
        if duration is None or interval is None:
            messagebox.showwarning("Config", "duration / interval must be numbers (or 30s/2m/1h)")
            return None
        if duration <= 0 or interval <= 0:
            messagebox.showwarning("Config", "duration / interval must be > 0")
            return None
        return duration, interval

    def _parse_light_timing(self) -> tuple[int, int] | None:
        duration = parse_duration_token(self.light_duration_var.get())
        interval = parse_duration_token(self.light_interval_var.get())
        if duration is None or interval is None:
            messagebox.showwarning("Config", "ld / li must be numbers (or 1h/2h/30m); 0 allowed")
            return None
        return duration, interval

    def _parse_lux_thresholds(self) -> tuple[int, int] | None:
        try:
            lux_on = int(self.lux_on_var.get().strip())
            lux_off = int(self.lux_off_var.get().strip())
        except ValueError:
            messagebox.showwarning("Config", "lon / loff must be integers")
            return None
        if lux_on < 0 or lux_off < 0:
            messagebox.showwarning("Config", "lon / loff must be >= 0")
            return None
        if lux_on >= lux_off:
            messagebox.showwarning("Config", "Require lon < loff (firmware rejects otherwise)")
            return None
        return lux_on, lux_off

    def _parse_care_window(self) -> tuple[bool, str, str] | None:
        enabled = bool(self.auto_care_window_var.get())
        start = parse_hhmm_token(self.care_start_var.get())
        end = parse_hhmm_token(self.care_end_var.get())
        if start is None or end is None:
            messagebox.showwarning("Config", "cs / ce must be HH:MM (e.g. 08:00)")
            return None
        if enabled:
            start_h, start_m = (int(x) for x in start.split(":"))
            end_h, end_m = (int(x) for x in end.split(":"))
            if start_h * 60 + start_m >= end_h * 60 + end_m:
                messagebox.showwarning(
                    "Config", "Require cs < ce (no overnight window in v1)"
                )
                return None
        return enabled, start, end

    def _write_config_payload(self, payload: str, action: str) -> None:
        self.status_var.set(f"Writing config={payload}...")
        self._begin_config_hold(payload)
        future = self.controller.write_plant_config(payload)

        def on_success(_: None) -> None:
            self.status_var.set(f"Config sent: {payload}")
            compact = payload.replace(" ", "")
            if "am=1" in compact:
                self._set_device_mode("AUTO")
            elif "am=0" in compact:
                self._set_device_mode("MANUAL")
            self._schedule_delayed_refresh(WRITE_REFRESH_DELAY_MS)

        def poll() -> None:
            if not future.done():
                self.root.after(100, poll)
                return
            try:
                result = future.result()
            except Exception as exc:
                self._config_hold_until = 0.0
                self._pending_config_payload = ""
                connection_lost_by_text = _is_connection_error(exc)
                self.status_var.set(f"{action} failed: {exc}")
                if connection_lost_by_text:
                    self.connection_var.set("Disconnected")
                    self._update_connection_badge()
                    if not self.connection_lost_popup_shown:
                        self.connection_lost_popup_shown = True
                        messagebox.showerror("BLE Error", f"Connection lost\n\n{exc}")
                else:
                    messagebox.showerror("BLE Error", f"{action} failed\n\n{exc}")
                if self.connection_var.get().startswith("Connected:"):
                    self._schedule_delayed_refresh(400)
                return
            on_success(result)

        poll()

    def apply_work_mode_only(self) -> None:
        am = 1 if self.work_mode_var.get() == "AUTO" else 0
        self._write_config_payload(f"am={am}", "Write work mode")

    def apply_auto_settings(self) -> None:
        if not self._is_auto_mode():
            messagebox.showwarning("AUTO Mode", "Auto settings are only available in AUTO mode.")
            return
        thresholds = self._parse_thresholds()
        if thresholds is None:
            return
        timing = self._parse_timing()
        if timing is None:
            return
        light_timing = self._parse_light_timing()
        if light_timing is None:
            return
        lux_thresholds = self._parse_lux_thresholds()
        if lux_thresholds is None:
            return
        care_window = self._parse_care_window()
        if care_window is None:
            return
        low, high = thresholds
        duration, interval = timing
        light_duration, light_interval = light_timing
        lux_on, lux_off = lux_thresholds
        ace, care_start, care_end = care_window
        aw = 1 if self.auto_water_var.get() else 0
        al = 1 if self.auto_light_var.get() else 0
        le = 1 if self.auto_light_lux_var.get() else 0
        payload = (
            f"aw={aw},al={al},le={le},l={low:g},h={high:g},"
            f"d={duration},i={interval},ld={light_duration},li={light_interval},"
            f"lon={lux_on},loff={lux_off},"
            f"ace={1 if ace else 0},cs={care_start},ce={care_end}"
        )
        self._write_config_payload(payload, "Write auto settings")

    def apply_thresholds_only(self) -> None:
        # Kept for compatibility with previous action name.
        self.apply_auto_settings()

    def apply_plant_config(self) -> None:
        # Kept for compatibility: apply mode + current auto settings when in AUTO.
        am = 1 if self.work_mode_var.get() == "AUTO" else 0
        if am == 0:
            self.apply_work_mode_only()
            return
        thresholds = self._parse_thresholds()
        if thresholds is None:
            return
        timing = self._parse_timing()
        if timing is None:
            return
        light_timing = self._parse_light_timing()
        if light_timing is None:
            return
        lux_thresholds = self._parse_lux_thresholds()
        if lux_thresholds is None:
            return
        care_window = self._parse_care_window()
        if care_window is None:
            return
        low, high = thresholds
        duration, interval = timing
        light_duration, light_interval = light_timing
        lux_on, lux_off = lux_thresholds
        ace, care_start, care_end = care_window
        aw = 1 if self.auto_water_var.get() else 0
        al = 1 if self.auto_light_var.get() else 0
        le = 1 if self.auto_light_lux_var.get() else 0
        payload = (
            f"am={am},aw={aw},al={al},le={le},l={low:g},h={high:g},"
            f"d={duration},i={interval},ld={light_duration},li={light_interval},"
            f"lon={lux_on},loff={lux_off},"
            f"ace={1 if ace else 0},cs={care_start},ce={care_end}"
        )
        self._write_config_payload(payload, "Write plant config")

    def _on_close(self) -> None:
        self.controller.close()
        self.root.destroy()


def main() -> None:
    root = tk.Tk()
    app = BleTkApp(root)
    if BleakClient is None:
        app.status_var.set("Install bleak first: python3 -m pip install bleak")
    root.mainloop()


if __name__ == "__main__":
    main()

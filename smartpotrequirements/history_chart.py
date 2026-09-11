#!/usr/bin/env python3
"""24h sensor history chart for Smart Pot BLE GUI (matplotlib + tkinter)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import tkinter as tk
from tkinter import ttk

try:
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
    from matplotlib.figure import Figure
except ImportError:  # pragma: no cover
    FigureCanvasTkAgg = None
    Figure = None


COLOR_CARD = "#ffffff"
COLOR_BORDER = "#d0dbd3"
COLOR_ACCENT = "#2f6f4e"
COLOR_MUTED = "#5f6f66"
COLOR_PANEL = "#f7faf7"
COLOR_SOIL = "#2f6f4e"
COLOR_TEMP = "#c0392b"
COLOR_LUX = "#1f6feb"


@dataclass
class HistoryPoint:
    timestamp: int
    soil: float
    temperature: float
    lux: float

    @property
    def time_label(self) -> str:
        if self.timestamp == 0:
            return "--"
        local = datetime.fromtimestamp(self.timestamp)
        return f"{local.hour:02d}:00"


def parse_sensor_history(raw: str) -> list[HistoryPoint]:
    """Parse BLE sensor_history payload.

    Device format:
      n=<count>;<timestamp>:<avgSoil>:<avgTemp>:<avgLux>;...
    Empty: n=0
    """
    text = (raw or "").strip()
    if not text or text == "unavailable" or text.startswith("ERR:") or text == "end":
        return []

    payload = text
    if text.lower().startswith("n="):
        if ";" in text:
            head, payload = text.split(";", 1)
        else:
            return []
        head = head.strip().lower()
        try:
            count = int(head[2:].strip())
        except ValueError:
            count = -1
        if count == 0 or not payload.strip():
            return []

    if ";" in payload:
        parts = payload.split(";")
    else:
        parts = payload.split(",")

    points: list[HistoryPoint] = []
    for part in parts:
        item = part.strip()
        if not item:
            continue
        fields = item.split(":")
        if len(fields) != 4:
            continue
        try:
            points.append(
                HistoryPoint(
                    timestamp=int(float(fields[0])),
                    soil=float(fields[1]),
                    temperature=float(fields[2]),
                    lux=float(fields[3]),
                )
            )
        except ValueError:
            continue
    return points


class HistoryChart:
    """Embed an interactive 24h trend chart into a tkinter parent."""

    def __init__(self, parent: tk.Misc, *, height: int = 240) -> None:
        self.parent = parent
        self._points: list[HistoryPoint] = []
        self._raw = ""
        self._canvas: FigureCanvasTkAgg | None = None
        self._figure = None
        self._ax_left = None
        self._ax_right = None
        self._height = height
        self._hover_cid = None
        self._click_cid = None
        self._vline = None
        self._selected_index: int | None = None

        self._status = tk.StringVar(value="waiting for data")
        self._detail = tk.StringVar(value="Hover or click a point to inspect values")
        self.show_soil = tk.BooleanVar(value=True)
        self.show_temp = tk.BooleanVar(value=False)
        self.show_lux = tk.BooleanVar(value=False)

        self.frame = tk.Frame(
            parent,
            bg=COLOR_CARD,
            highlightbackground=COLOR_BORDER,
            highlightthickness=1,
        )

        header = tk.Frame(self.frame, bg=COLOR_CARD)
        header.pack(fill=tk.X, padx=12, pady=(10, 0))
        tk.Label(
            header,
            text="24h Environment Trend",
            bg=COLOR_CARD,
            fg=COLOR_ACCENT,
            font=("Segoe UI", 12, "bold"),
        ).pack(side=tk.LEFT)
        tk.Label(
            header,
            textvariable=self._status,
            bg=COLOR_CARD,
            fg=COLOR_MUTED,
            font=("Segoe UI", 8),
        ).pack(side=tk.RIGHT)

        controls = tk.Frame(self.frame, bg=COLOR_CARD)
        controls.pack(fill=tk.X, padx=12, pady=(6, 0))
        tk.Label(controls, text="Series:", bg=COLOR_CARD, fg=COLOR_MUTED, font=("Segoe UI", 9)).pack(
            side=tk.LEFT
        )
        ttk.Checkbutton(
            controls, text="Soil Moisture", variable=self.show_soil, command=self._on_series_toggle
        ).pack(side=tk.LEFT, padx=(6, 0))
        ttk.Checkbutton(
            controls, text="Temperature", variable=self.show_temp, command=self._on_series_toggle
        ).pack(side=tk.LEFT, padx=(10, 0))
        ttk.Checkbutton(
            controls, text="Light", variable=self.show_lux, command=self._on_series_toggle
        ).pack(side=tk.LEFT, padx=(10, 0))
        ttk.Button(controls, text="Show All", command=self.show_all_series).pack(side=tk.LEFT, padx=(14, 0))
        ttk.Button(controls, text="Clear Selection", command=self.clear_selection).pack(side=tk.LEFT, padx=(8, 0))

        detail = tk.Frame(self.frame, bg=COLOR_PANEL, highlightbackground=COLOR_BORDER, highlightthickness=1)
        detail.pack(fill=tk.X, padx=12, pady=(8, 0))
        tk.Label(
            detail,
            textvariable=self._detail,
            bg=COLOR_PANEL,
            fg=COLOR_MUTED,
            font=("Segoe UI", 9),
            justify=tk.LEFT,
            anchor=tk.W,
            padx=8,
            pady=6,
        ).pack(fill=tk.X)

        self._chart_host = tk.Frame(self.frame, bg=COLOR_CARD, height=height)
        self._chart_host.pack(fill=tk.BOTH, expand=True, padx=8, pady=(4, 8))
        self._chart_host.pack_propagate(False)

        if Figure is None or FigureCanvasTkAgg is None:
            self._status.set("Install matplotlib: pip install matplotlib")
            tk.Label(
                self._chart_host,
                text="matplotlib is required for history chart",
                bg=COLOR_CARD,
                fg=COLOR_TEMP,
            ).pack(expand=True)
            return

        self._figure = Figure(figsize=(8.0, 2.4), dpi=100)
        self._figure.patch.set_facecolor(COLOR_CARD)
        self._ax_left = self._figure.add_subplot(111)
        self._ax_right = self._ax_left.twinx()
        self._figure.subplots_adjust(left=0.10, right=0.90, top=0.92, bottom=0.22)

        self._canvas = FigureCanvasTkAgg(self._figure, master=self._chart_host)
        widget = self._canvas.get_tk_widget()
        widget.configure(height=height)
        widget.pack(fill=tk.BOTH, expand=True)

        self._hover_cid = self._canvas.mpl_connect("motion_notify_event", self._on_hover)
        self._click_cid = self._canvas.mpl_connect("button_press_event", self._on_click)
        self.clear()

    def pack(self, **kwargs) -> None:
        self.frame.pack(**kwargs)

    def grid(self, **kwargs) -> None:
        self.frame.grid(**kwargs)

    def show_all_series(self) -> None:
        self.show_soil.set(True)
        self.show_temp.set(True)
        self.show_lux.set(True)
        self._draw(self._points)

    def clear_selection(self) -> None:
        self._selected_index = None
        self._detail.set("Hover or click a point to inspect values")
        self._draw(self._points)

    def clear(self) -> None:
        self._points = []
        self._raw = ""
        self._selected_index = None
        self._status.set("no data")
        self._detail.set("Hover or click a point to inspect values")
        self._draw([])

    def update_from_points(self, points: list[HistoryPoint]) -> None:
        if Figure is None or FigureCanvasTkAgg is None:
            return
        self._raw = ""
        self._points = list(points)
        if self._selected_index is not None and self._selected_index >= len(self._points):
            self._selected_index = None
        if not self._points:
            self._status.set("n=0")
            self._detail.set("No history samples yet")
        else:
            self._status.set(f"{len(self._points)} / 24 hours")
            if self._selected_index is not None:
                self._set_detail(self._selected_index, pinned=True)
        self._draw(self._points)

    def update_from_raw(self, raw: str) -> None:
        if Figure is None or FigureCanvasTkAgg is None:
            return
        self._raw = raw
        if raw.startswith("ERR:"):
            self._status.set(raw)
            self._points = []
            self._selected_index = None
            self._detail.set("History read error")
            self._draw([])
            return
        self.update_from_points(parse_sensor_history(raw))

    def _on_series_toggle(self) -> None:
        # Keep at least one series visible.
        if not (self.show_soil.get() or self.show_temp.get() or self.show_lux.get()):
            self.show_soil.set(True)
        self._draw(self._points)

    def _nearest_index(self, xdata: float) -> int | None:
        if not self._points:
            return None
        index = int(round(xdata))
        if index < 0 or index >= len(self._points):
            return None
        return index

    def _format_point(self, index: int) -> str:
        point = self._points[index]
        return (
            f"#{index + 1}/{len(self._points)}  {point.time_label}  "
            f"ts={point.timestamp}  "
            f"Soil={point.soil:.1f}%  Temp={point.temperature:.1f}C  Lux={point.lux:.0f}"
        )

    def _set_detail(self, index: int, *, pinned: bool) -> None:
        prefix = "Selected: " if pinned else "Hover: "
        self._detail.set(prefix + self._format_point(index))

    def _on_hover(self, event) -> None:
        if event.inaxes not in (self._ax_left, self._ax_right) or event.xdata is None:
            return
        index = self._nearest_index(event.xdata)
        if index is None:
            return
        if self._selected_index is None:
            self._set_detail(index, pinned=False)
        self._update_marker(index, temporary=self._selected_index is None)

    def _on_click(self, event) -> None:
        if event.inaxes not in (self._ax_left, self._ax_right) or event.xdata is None:
            return
        index = self._nearest_index(event.xdata)
        if index is None:
            return
        self._selected_index = index
        self._set_detail(index, pinned=True)
        self._draw(self._points)

    def _update_marker(self, index: int, *, temporary: bool) -> None:
        if self._ax_left is None or self._canvas is None or not self._points:
            return
        if temporary and self._selected_index is not None:
            return
        if self._vline is not None:
            try:
                self._vline.remove()
            except Exception:
                pass
            self._vline = None
        self._vline = self._ax_left.axvline(index, color="#9aa5a0", linestyle="--", linewidth=1.0, alpha=0.8)
        self._canvas.draw_idle()

    def _draw(self, points: list[HistoryPoint]) -> None:
        if self._ax_left is None or self._ax_right is None or self._canvas is None:
            return

        self._ax_left.clear()
        self._ax_right.clear()
        self._vline = None
        self._ax_left.set_facecolor(COLOR_PANEL)
        self._ax_right.set_facecolor(COLOR_PANEL)

        if not points:
            self._ax_left.text(
                0.5,
                0.5,
                "No history yet",
                ha="center",
                va="center",
                color=COLOR_MUTED,
                transform=self._ax_left.transAxes,
            )
            self._ax_left.set_xticks([])
            self._ax_left.set_yticks([])
            self._ax_right.set_yticks([])
            self._canvas.draw_idle()
            return

        xs = list(range(len(points)))
        soil = [p.soil for p in points]
        temperature = [p.temperature for p in points]
        lux = [p.lux for p in points]
        labels = [p.time_label for p in points]

        left_used = False
        right_used = False
        if self.show_soil.get():
            self._ax_left.plot(
                xs, soil, color=COLOR_SOIL, marker="o", markersize=4, linewidth=1.8, label="Soil %"
            )
            left_used = True
        if self.show_temp.get():
            self._ax_left.plot(
                xs, temperature, color=COLOR_TEMP, marker="o", markersize=4, linewidth=1.8, label="Temp C"
            )
            left_used = True
        if self.show_lux.get():
            self._ax_right.plot(
                xs, lux, color=COLOR_LUX, marker="s", markersize=4, linewidth=1.6, label="Lux"
            )
            right_used = True

        if self._selected_index is not None and 0 <= self._selected_index < len(points):
            self._ax_left.axvline(
                self._selected_index, color="#6b7280", linestyle="--", linewidth=1.2, alpha=0.9
            )
            selected = points[self._selected_index]
            if self.show_soil.get():
                self._ax_left.scatter([self._selected_index], [selected.soil], color=COLOR_SOIL, s=45, zorder=5)
            if self.show_temp.get():
                self._ax_left.scatter(
                    [self._selected_index], [selected.temperature], color=COLOR_TEMP, s=45, zorder=5
                )
            if self.show_lux.get():
                self._ax_right.scatter([self._selected_index], [selected.lux], color=COLOR_LUX, s=45, zorder=5)

        tick_step = 1 if len(xs) <= 12 else 2
        tick_xs = xs[::tick_step]
        self._ax_left.set_xticks(tick_xs)
        self._ax_left.set_xticklabels([labels[i] for i in tick_xs], fontsize=8)
        self._ax_left.set_xlabel("Time (HH:00)", fontsize=8, color=COLOR_MUTED)

        if left_used:
            self._ax_left.set_ylabel("Soil % / Temp C", fontsize=8, color=COLOR_MUTED)
            self._ax_left.tick_params(axis="y", labelsize=8)
        else:
            self._ax_left.set_yticks([])
            self._ax_left.set_ylabel("")

        if right_used:
            self._ax_right.set_ylabel("Lux", fontsize=8, color=COLOR_LUX)
            self._ax_right.tick_params(axis="y", labelsize=8, labelcolor=COLOR_LUX)
        else:
            self._ax_right.set_yticks([])
            self._ax_right.set_ylabel("")

        self._ax_left.grid(True, alpha=0.25)
        self._figure.subplots_adjust(left=0.10, right=0.90, top=0.92, bottom=0.22)
        self._canvas.draw_idle()

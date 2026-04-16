import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import mysql.connector
import requests
import json
import time
import threading
import os
from datetime import datetime

# DPI Awareness for Windows
try:
    from ctypes import windll
    windll.shcore.SetProcessDpiAwareness(1)
except Exception: pass

CONFIG_FILE = "sync_agent_config.json"

class LabSyncAgent:
    def __init__(self, root):
        self.root = root
        self.root.title("EMR Laboratory Sync Agent")
        self.root.geometry("800x750")
        self.themes = {
            "Midnight": {"bg": "#020617", "card": "#0f172a", "input": "#1e293b", "primary": "#6366f1", "accent": "#8b5cf6", "success": "#10b981", "danger": "#ef4444", "warning": "#f59e0b", "text": "#f8fafc", "muted": "#94a3b8"},
            "Ocean": {"bg": "#082f49", "card": "#0c4a6e", "input": "#075985", "primary": "#0ea5e9", "accent": "#38bdf8", "success": "#38bdf8", "danger": "#f43f5e", "warning": "#fbbf24", "text": "#f0f9ff", "muted": "#7dd3fc"},
            "Forest": {"bg": "#064e3b", "card": "#065f46", "input": "#047857", "primary": "#10b981", "accent": "#34d399", "success": "#34d399", "danger": "#f87171", "warning": "#fbbf24", "text": "#ecfdf5", "muted": "#6ee7b7"},
            "Crimson": {"bg": "#450a0a", "card": "#7f1d1d", "input": "#991b1b", "primary": "#ef4444", "accent": "#f87171", "success": "#f87171", "danger": "#fca5a1", "warning": "#fbbf24", "text": "#fef2f2", "muted": "#fca5a1"}
        }

        self.config = self.load_config()
        self.COLORS = self.themes.get(self.config.get("theme", "Midnight"), self.themes["Midnight"])
        self.FONTS = ("Segoe UI", "Ubuntu", "Helvetica", "Arial")
        
        # State Management
        self.is_auto_sync = False
        self.total_synced_count = 0
        self.last_sync_time = "Never"
        self.countdown = 0
        self.log_buffer = [] 
        
        # Window Handlers
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.configure(bg=self.COLORS["bg"])
        
        self.setup_ui()
        self.log_message("System Online. High-Speed Sync Pipeline Ready.")

    def on_closing(self):
        if self.is_auto_sync:
            if messagebox.askokcancel("Quit Agent", "Sync Agent is currently active in Auto-Mode. Closing will stop all synchronization. Quit anyway?"):
                self.root.destroy()
        else:
            self.root.destroy()

    def load_config(self):
        default = {
            "db_host": "10.2.1.159", "db_port": 3306, "db_name": "bc_cbc_db", "db_user": "root",
            "db_pass": "root_123", "emr_endpoint": "http://localhost:8000/api/laboratory/requests/sync_batch/",
            "sync_key": "emr_lab_sync_bridge_secure_9HqR2S9vXz4P5mN8", "interval": 30, "theme": "Midnight"
        }
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f: return {**default, **json.load(f)}
            except: pass
        return default

    def get_int_safe(self, val, default=0):
        try:
            return int(val) if val and str(val).strip() else default
        except (ValueError, TypeError):
            return default

    def save_config(self):
        new_config = {
            "db_host": self.host_entry.get(), 
            "db_port": self.get_int_safe(self.port_entry.get(), 3306), 
            "db_name": self.db_name_entry.get(),
            "db_user": self.user_entry.get(), "db_pass": self.pass_entry.get(),
            "emr_endpoint": self.url_entry.get(), "sync_key": self.key_entry.get(),
            "interval": self.get_int_safe(self.interval_spin.get(), 60),
            "theme": self.theme_var.get()
        }
        with open(CONFIG_FILE, "w") as f: json.dump(new_config, f, indent=4)
        return new_config

    def setup_ui(self):
        # 1. NAVBAR/HEADER
        header = tk.Frame(self.root, bg=self.COLORS["card"], height=100)
        header.pack(fill="x", side="top")
        
        branding = tk.Frame(header, bg=self.COLORS["card"])
        branding.pack(pady=20)
        
        tk.Label(branding, text="EMR", bg=self.COLORS["card"], fg=self.COLORS["primary"], font=(self.FONTS[0], 20, "bold")).pack(side="left")
        tk.Label(branding, text=" LABORATORY SYNC AGENT ", bg=self.COLORS["card"], fg=self.COLORS["text"], font=(self.FONTS[0], 20, "bold")).pack(side="left")
        

        # 2. MAIN DASHBOARD
        container = tk.Frame(self.root, bg=self.COLORS["bg"], padx=30, pady=10)
        container.pack(fill="both", expand=True)

        # Dashboard Stats
        stats_frame = tk.Frame(container, bg=self.COLORS["bg"])
        stats_frame.pack(fill="x", pady=10)

        self.create_stat_card(stats_frame, "Total Synced", "0", "total_val", 0)
        self.create_stat_card(stats_frame, "Last Success", "Never", "last_val", 1)
        self.create_stat_card(stats_frame, "Next Sync", "IDLE", "next_val", 2)

        # 3. CONFIGURATION GRID (GLASSMORPHIC style)
        config_parent = tk.Frame(container, bg=self.COLORS["card"], padx=20, pady=20, highlightthickness=1, highlightbackground=self.COLORS["primary"])
        config_parent.pack(fill="x", pady=20)
        
        tk.Label(config_parent, text="HUB CONFIGURATION", bg=self.COLORS["card"], fg=self.COLORS["muted"], font=(self.FONTS[0], 8, "bold")).grid(row=0, column=0, columnspan=4, sticky="w", pady=(0, 15))

        # Row 1: DB Settings
        self.create_input(config_parent, "DB Host:", self.config["db_host"], "host_entry", 1, 0, width=20)
        self.create_input(config_parent, "Port:", self.config["db_port"], "port_entry", 1, 2, width=8)

        # Row 2: Secondary DB Info
        self.create_input(config_parent, "DB Name:", self.config["db_name"], "db_name_entry", 2, 0, width=20)
        self.create_input(config_parent, "DB User:", self.config["db_user"], "user_entry", 2, 2, width=15)
        
        # Row 3: Security & EMR
        self.create_input(config_parent, "DB Pass:", self.config["db_pass"], "pass_entry", 3, 0, width=20, show="*")
        self.create_input(config_parent, "Sync Key:", self.config["sync_key"], "key_entry", 3, 2, width=25, show="*")

        # Row 4: Endpoint
        self.create_input(config_parent, "EMR URL:", self.config["emr_endpoint"], "url_entry", 4, 0, width=60)

        # 4. ACTION BAR
        control_frame = tk.Frame(container, bg=self.COLORS["bg"])
        control_frame.pack(fill="x", pady=20)

        self.test_btn = tk.Button(control_frame, text="🔍 TEST CONNECTIVITY", command=self.test_connection, 
                                  bg="#334155", fg=self.COLORS["primary"], font=(self.FONTS[0], 9, "bold"), 
                                  padx=20, pady=10, relief="flat", cursor="hand2")
        self.test_btn.pack(side="left")

        self.sync_btn = tk.Button(control_frame, text="⚡ FORCE SYNC", command=self.manual_sync, 
                                  bg=self.COLORS["primary"], fg="white", font=(self.FONTS[0], 10, "bold"), 
                                  padx=30, pady=12, relief="flat", cursor="hand2")
        self.sync_btn.pack(side="left", padx=15)

        self.auto_btn = tk.Button(control_frame, text="▶ ENABLE AUTO-SYNC", command=self.toggle_auto_sync, 
                                  bg="#1e293b", fg=self.COLORS["primary"], font=(self.FONTS[0], 10, "bold"), 
                                  padx=30, pady=12, relief="flat", cursor="hand2")
        self.auto_btn.pack(side="left")

        tk.Label(control_frame, text="Frequency (s):", bg=self.COLORS["bg"], fg=self.COLORS["muted"], font=(self.FONTS[0], 9, "bold")).pack(side="left", padx=(20, 0))
        self.interval_spin = ttk.Spinbox(control_frame, from_=3, to=3600, width=6, font=(self.FONTS[0], 11))
        self.interval_spin.set(self.config["interval"])
        self.interval_spin.pack(side="left", padx=10)

        # Theme Selector
        tk.Label(control_frame, text="Theme:", bg=self.COLORS["bg"], fg=self.COLORS["muted"], font=(self.FONTS[0], 9, "bold")).pack(side="left", padx=(10, 0))
        self.theme_var = tk.StringVar(value=self.config.get("theme", "Midnight"))
        self.theme_cb = ttk.Combobox(control_frame, textvariable=self.theme_var, values=list(self.themes.keys()), width=10, state="readonly")
        self.theme_cb.pack(side="left", padx=10)
        self.theme_cb.bind("<<ComboboxSelected>>", lambda e: self.set_theme(self.theme_var.get()))

        # 5. LOGGING OUTPUT
        log_header_frame = tk.Frame(container, bg=self.COLORS["bg"])
        log_header_frame.pack(fill="x", pady=(10, 5))
        
        tk.Label(log_header_frame, text="TERMINAL OUTPUT", bg=self.COLORS["bg"], fg=self.COLORS["muted"], font=(self.FONTS[0], 8, "bold")).pack(side="left")
        
        self.export_btn = tk.Button(log_header_frame, text="📥 EXPORT CSV", command=self.export_logs_to_csv, 
                                    bg="#0f172a", fg=self.COLORS["success"], font=(self.FONTS[0], 7, "bold"), 
                                    padx=10, pady=2, relief="flat", cursor="hand2", highlightthickness=1, highlightbackground=self.COLORS["success"])
        self.export_btn.pack(side="right")
        
        self.log_area = scrolledtext.ScrolledText(container, height=12, bg="#020617", fg=self.COLORS["success"], 
                                                 font=("Consolas", 10), borderwidth=0, padx=15, pady=15)
        self.log_area.pack(fill="both", expand=True)

    def create_stat_card(self, parent, label, val, attr, col):
        card = tk.Frame(parent, bg=self.COLORS["card"], padx=20, pady=15, highlightthickness=1, highlightbackground="#1e293b")
        card.grid(row=0, column=col, sticky="nsew", padx=5)
        parent.grid_columnconfigure(col, weight=1)
        
        tk.Label(card, text=label.upper(), bg=self.COLORS["card"], fg=self.COLORS["muted"], font=(self.FONTS[0], 8, "bold")).pack(anchor="w")
        lbl = tk.Label(card, text=val, bg=self.COLORS["card"], fg=self.COLORS["text"], font=(self.FONTS[0], 14, "bold"), pady=5)
        lbl.pack(anchor="w")
        setattr(self, attr, lbl)

    def create_input(self, parent, label, val, attr, r, c, width=25, show=None):
        tk.Label(parent, text=label, bg=self.COLORS["card"], fg=self.COLORS["text"], font=(self.FONTS[0], 9)).grid(row=r, column=c, sticky="w", pady=8, padx=(0, 10))
        entry = tk.Entry(parent, width=width, bg=self.COLORS["input"], fg="white", insertbackground="white", borderwidth=0, show=show, font=(self.FONTS[0], 10))
        entry.insert(0, val)
        entry.grid(row=r, column=c+1, sticky="w", pady=8, padx=(0, 20))
        setattr(self, attr, entry)

    def log_message(self, msg, type="INFO"):
        colors = {"INFO": self.COLORS["success"], "ERR": self.COLORS["danger"], "WARN": self.COLORS["warning"]}
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        self.log_area.insert(tk.END, f"[{timestamp}] [{type}] {msg}\n")
        self.log_area.see(tk.END)
        # Add to buffer for export
        self.log_buffer.append({"time": timestamp, "type": type, "message": msg})

    def export_logs_to_csv(self):
        import csv
        from tkinter import filedialog
        if not self.log_buffer:
            messagebox.showwarning("Export", "No logs available to export.")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv", 
            filetypes=[("CSV files", "*.csv")],
            initialfile=f"sync_logs_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
        )
        
        if filename:
            try:
                with open(filename, 'w', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=["time", "type", "message"])
                    writer.writeheader()
                    writer.writerows(self.log_buffer)
                self.log_message(f"✔ Audit Logs exported to {os.path.basename(filename)}", "INFO")
                messagebox.showinfo("Export Success", f"Successfully exported {len(self.log_buffer)} log entries.")
            except Exception as e:
                messagebox.showerror("Export Error", f"Failed to save CSV: {str(e)}")

    def set_theme(self, theme_name):
        self.COLORS = self.themes.get(theme_name, self.themes["Midnight"])
        self.root.configure(bg=self.COLORS["bg"])
        self.log_message(f"✔ Branding updated to '{theme_name}'. Save and restart for full effect.", "INFO")
        self.config = self.save_config()
        if messagebox.askyesno("Personalization", f"Theme '{theme_name}' applied. Would you like to restart the agent now to apply changes and full color mappings?"):
            self.root.destroy()
            import sys
            os.execv(sys.executable, ['python'] + sys.argv)

    def manual_sync(self):
        self.config = self.save_config()
        self.sync_btn.config(state="disabled", text="⚡ SYNCING...")
        threading.Thread(target=self.run_sync_logic, daemon=True).start()

    def toggle_auto_sync(self):
        self.is_auto_sync = not self.is_auto_sync
        self.config = self.save_config()
        if self.is_auto_sync:
            self.auto_btn.config(text="■ STOP AGENT", bg=self.COLORS["danger"], fg="white")
            self.log_message(f"Agent Started. Auto-Sync interval: {self.config['interval']}s")
            self.countdown = self.config["interval"]
            threading.Thread(target=self.agent_loop, daemon=True).start()
        else:
            self.auto_btn.config(text="▶ ENABLE AUTO-SYNC", bg="#1e293b", fg=self.COLORS["primary"])
            self.next_val.config(text="IDLE", fg=self.COLORS["text"])
            self.log_message("Agent Paused.")

    def agent_loop(self):
        while self.is_auto_sync:
            if self.countdown <= 0:
                self.run_sync_logic()
                self.countdown = self.config["interval"]
            
            self.next_val.config(text=f"{self.countdown}s", fg=self.COLORS["warning"])
            time.sleep(1)
            self.countdown -= 1

    def run_sync_logic(self):
        try:
            self.log_message(f"Initiating High-Speed Delta Sync...", "INFO")
            
            # 1. Start from our watermark
            last_id = self.config.get("last_synced_id", 0)
            batch_limit = 5000
            total_session_synced = 0

            conn = mysql.connector.connect(
                host=self.config["db_host"], port=self.config["db_port"],
                user=self.config["db_user"], password=self.config["db_pass"], 
                database=self.config["db_name"], connect_timeout=5
            )
            
            while True:
                cursor = conn.cursor(dictionary=True)
                # QUERY: Fetch everything AFTER our last successful ID
                query = "SELECT * FROM cbc_results WHERE id > %s ORDER BY id ASC LIMIT %s"
                cursor.execute(query, (last_id, batch_limit))
                rows = cursor.fetchall()
                cursor.close()

                if not rows:
                    if total_session_synced == 0:
                        self.log_message("✔ IDLE: Cloud fully matched with Local DB.", "INFO")
                    else:
                        self.log_message(f"✔ SYNC SESSION COMPLETE: {total_session_synced} records pushed.", "INFO")
                    break

                self.log_message(f"Pumping {len(rows)} records (Last ID: {last_id})...", "INFO")

                def json_serial(obj):
                    from datetime import datetime, date
                    if isinstance(obj, (datetime, date)): return obj.isoformat()
                    return str(obj)

                headers = {
                    "X-Machine-Sync-Key": self.config["sync_key"], 
                    "Content-Type": "application/json"
                }
                
                response = requests.post(
                    self.config["emr_endpoint"], 
                    data=json.dumps({"results": rows}, default=json_serial), 
                    headers=headers, timeout=30
                )

                if response.status_code in [200, 201, 202]:
                    # Update Watermark
                    last_id = rows[-1]['id']
                    total_session_synced += len(rows)
                    self.total_synced_count += len(rows)
                    
                    self.config["last_synced_id"] = last_id
                    with open(CONFIG_FILE, "w") as f:
                        json.dump(self.config, f, indent=4)

                    # Update UI Dashboard
                    self.root.after(0, lambda: self.total_val.config(text=f"{self.total_synced_count:,}"))
                    self.root.after(0, lambda: self.last_val.config(text=f"ID {last_id}")) 
                    self.log_message(f"✔ BATCH OK: Synced to ID {last_id}", "INFO")
                    
                    if len(rows) < batch_limit: break 
                else:
                    self.log_message(f"✖ BRIDGE ERROR: HTTP {response.status_code}. Pausing.", "ERR")
                    break

            conn.close()
            
        except mysql.connector.Error as err:
            self.log_message(f"✖ DB FAILURE: {err}", "ERR")
        except requests.exceptions.RequestException as e:
            self.log_message(f"✖ NETWORK TIMEOUT: Retrying...", "WARN")
        except Exception as e:
            self.log_message(f"✖ CRITICAL FAULT: {str(e)}", "ERR")
        finally:
            self.root.after(0, lambda: self.sync_btn.config(state="normal", text="⚡ FORCE SYNC"))

    def test_connection(self):
        self.config = self.save_config()
        self.log_message("Initiating Global Connectivity Test...", "INFO")
        
        def run_test():
            # 1. Test Database
            try:
                conn = mysql.connector.connect(
                    host=self.config["db_host"], port=self.config["db_port"],
                    user=self.config["db_user"], password=self.config["db_pass"], 
                    database=self.config["db_name"], connect_timeout=3
                )
                conn.close()
                self.log_message("✔ DATABASE: Connection Successful.", "INFO")
            except Exception as e:
                self.log_message(f"✖ DATABASE: Connection Failed. ({str(e)})", "ERR")

            # 2. Test EMR Bridge
            try:
                headers = {"X-Machine-Sync-Key": self.config["sync_key"]}
                # Send a small heartbeat or just a check
                response = requests.options(self.config["emr_endpoint"], headers=headers, timeout=5)
                if response.status_code in [200, 204, 405]: # 405 is fine for OPTIONS if endpoint exists
                    self.log_message("✔ EMR BRIDGE: Endpoint Reachable.", "INFO")
                else:
                    self.log_message(f"✖ EMR BRIDGE: Response Error {response.status_code}", "WARN")
            except Exception as e:
                self.log_message(f"✖ EMR BRIDGE: Endpoint Unreachable.", "ERR")

        threading.Thread(target=run_test, daemon=True).start()

if __name__ == "__main__":
    root = tk.Tk()
    # High-End Styling
    style = ttk.Style()
    style.theme_use('clam')
    style.configure("TSpinbox", fieldbackground="#1e293b", foreground="white", borderwidth=0)
    
    app = LabSyncAgent(root)
    root.mainloop()

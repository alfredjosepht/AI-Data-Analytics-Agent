from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import os
import pandas as pd
from backend.database.duckdb_manager import duckdb_manager
from backend.database.sqlite_manager import sqlite_manager


class SchedulerAgent:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()

    def start_existing_jobs(self):
        try:
            schedules = sqlite_manager.list_schedules()
            for sch in schedules:
                self.add_report_job(
                    workspace_id=sch["workspace_id"],
                    schedule_id=sch["id"],
                    name=sch["name"],
                    query=sch["query"],
                    frequency=sch["frequency"],
                    cron_expr=sch["cron_expr"]
                )
        except Exception as e:
            print(f"Error loading existing schedules: {e}")

    def add_report_job(self, workspace_id, schedule_id, name, query, frequency, cron_expr=None):
        job_id = f"sch_{schedule_id}"
        
        trigger_args = {}
        if frequency == "weekly":
            trigger_args = {"trigger": "cron", "day_of_week": "mon", "hour": 9, "minute": 0}
        elif frequency == "monthly":
            trigger_args = {"trigger": "cron", "day": 1, "hour": 9, "minute": 0}
        elif frequency == "cron" and cron_expr:
            parts = cron_expr.split()
            if len(parts) == 5:
                trigger_args = {
                    "trigger": "cron",
                    "minute": parts[0],
                    "hour": parts[1],
                    "day": parts[2],
                    "month": parts[3],
                    "day_of_week": parts[4]
                }
            else:
                trigger_args = {"trigger": "interval", "hours": 24}
        else: # daily or custom interval
            trigger_args = {"trigger": "interval", "hours": 24}

        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

        self.scheduler.add_job(
            func=self.run_scheduled_report,
            args=[workspace_id, schedule_id, name, query],
            id=job_id,
            **trigger_args
        )

        job = self.scheduler.get_job(job_id)
        if job and job.next_run_time:
            sqlite_manager.update_schedule_next_run(schedule_id, job.next_run_time.strftime("%Y-%m-%d %H:%M:%S"))

    def remove_job(self, schedule_id):
        job_id = f"sch_{schedule_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

    def run_scheduled_report(self, workspace_id, schedule_id, name, query):
        print(f"Running scheduled report '{name}' for workspace {workspace_id}")
        try:
            df = duckdb_manager.query(query)
            
            out_dir = "exports"
            os.makedirs(out_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"report_{workspace_id}_{schedule_id}_{timestamp}.xlsx"
            file_path = os.path.join(out_dir, filename)
            
            # Use openpyxl to write beautiful excel
            df.to_excel(file_path, index=False)
            
            sqlite_manager.create_report(
                workspace_id=workspace_id,
                title=f"Scheduled Report: {name}",
                file_path=file_path,
                file_type="xlsx"
            )
            
            job_id = f"sch_{schedule_id}"
            job = self.scheduler.get_job(job_id)
            if job and job.next_run_time:
                sqlite_manager.update_schedule_next_run(schedule_id, job.next_run_time.strftime("%Y-%m-%d %H:%M:%S"))
        except Exception as e:
            print(f"Scheduled report execution failed: {e}")


scheduler_agent = SchedulerAgent()
